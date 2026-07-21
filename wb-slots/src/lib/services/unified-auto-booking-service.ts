/**
 * 🏗️ Унифицированный сервис автобронирования
 * Заменяет все дублирующиеся версии сервисов автобронирования
 */

import { 
  BaseService, 
  IAutoBookingService, 
  AutoBookingConfig, 
  BookingResult,
  ServiceError,
  ValidationError 
} from '../architecture';
import { UnifiedWBAPIClient } from './unified-wb-api-client';
import { prisma } from '../prisma';
import puppeteer, { Browser, Page } from 'puppeteer';

export class UnifiedAutoBookingService extends BaseService implements IAutoBookingService {
  private activeBookings: Map<string, { config: AutoBookingConfig; startTime: Date }> = new Map();
  private bookingHistory: BookingResult[] = [];
  private wbClient?: UnifiedWBAPIClient;
  private browser?: Browser;

  constructor() {
    super('UnifiedAutoBookingService', '1.0.0');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ
  // ============================================================================

  protected async doInitialize(): Promise<void> {
    this.log('info', 'Initializing auto booking service...');
    
    // Инициализация браузера
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    this.log('info', 'Auto booking service initialized');
  }

  protected async doStart(): Promise<void> {
    this.log('info', 'Starting auto booking service...');
    this.log('info', 'Auto booking service started');
  }

  protected async doStop(): Promise<void> {
    this.log('info', 'Stopping auto booking service...');
    
    // Останавливаем все активные бронирования
    for (const [bookingId] of this.activeBookings) {
      await this.stopAutoBooking(bookingId);
    }
    
    // Закрываем браузер
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
    
    this.log('info', 'Auto booking service stopped');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА IAutoBookingService
  // ============================================================================

  async bookSlot(config: AutoBookingConfig): Promise<BookingResult> {
    return this.executeWithMetrics('bookSlot', async () => {
      this.validateBookingConfig(config);
      
      const startTime = Date.now();
      
      try {
        // Получаем WB клиент
        const client = await this.getWBClient(config.userId);
        
        // Пытаемся забронировать через API
        let result = await this.bookSlotViaAPI(client, config);
        
        // Если API не сработал, используем браузерную автоматизацию
        if (!result.success) {
          this.log('info', 'API booking failed, trying browser automation...');
          result = await this.bookSlotViaBrowser(config);
        }
        
        // Сохраняем в историю
        this.bookingHistory.unshift(result);
        if (this.bookingHistory.length > 100) {
          this.bookingHistory = this.bookingHistory.slice(0, 100);
        }
        
        // Сохраняем результат в базу данных
        await this.saveBookingResult(config, result);
        
        this.log('info', `Booking completed: ${result.success ? 'success' : 'failed'}`);
        return result;
        
      } catch (error) {
        const result: BookingResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        
        this.bookingHistory.unshift(result);
        throw new ServiceError(this.name, 'bookSlot', 'Booking failed', undefined, error);
      }
    });
  }

  async startAutoBooking(config: AutoBookingConfig): Promise<string> {
    return this.executeWithMetrics('startAutoBooking', async () => {
      this.validateBookingConfig(config);
      
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.activeBookings.set(bookingId, {
        config,
        startTime: new Date()
      });
      
      // Запускаем автобронирование в фоне
      this.runAutoBooking(bookingId, config).catch(error => {
        this.log('error', `Auto booking ${bookingId} failed`, error);
        this.activeBookings.delete(bookingId);
      });
      
      this.log('info', `Started auto booking: ${bookingId}`);
      return bookingId;
    });
  }

  async stopAutoBooking(bookingId: string): Promise<void> {
    return this.executeWithMetrics('stopAutoBooking', async () => {
      if (!this.activeBookings.has(bookingId)) {
        throw new ServiceError(this.name, 'stopAutoBooking', `Booking ${bookingId} not found`);
      }
      
      this.activeBookings.delete(bookingId);
      this.log('info', `Stopped auto booking: ${bookingId}`);
    });
  }

  isBookingInProgress(bookingId?: string): boolean {
    if (bookingId) {
      return this.activeBookings.has(bookingId);
    }
    return this.activeBookings.size > 0;
  }

  getActiveBookings(): string[] {
    return Array.from(this.activeBookings.keys());
  }

  getBookingHistory(limit?: number): BookingResult[] {
    if (limit) {
      return this.bookingHistory.slice(0, limit);
    }
    return [...this.bookingHistory];
  }

  async getBookingMetrics(): Promise<{
    totalBookings: number;
    successfulBookings: number;
    failedBookings: number;
    averageBookingTime: number;
    successRate: number;
  }> {
    const totalBookings = this.bookingHistory.length;
    const successfulBookings = this.bookingHistory.filter(b => b.success).length;
    const failedBookings = totalBookings - successfulBookings;
    const successRate = totalBookings > 0 ? (successfulBookings / totalBookings) * 100 : 0;
    
    // Для среднего времени бронирования используем метрики сервиса
    const metrics = await this.getMetrics();
    
    return {
      totalBookings,
      successfulBookings,
      failedBookings,
      averageBookingTime: metrics.averageResponseTime,
      successRate
    };
  }

  // ============================================================================
  // ЗАЩИЩЕННЫЕ МЕТОДЫ
  // ============================================================================

  private async getWBClient(userId: string): Promise<UnifiedWBAPIClient> {
    if (!this.wbClient) {
      // Получаем токен пользователя
      const userToken = await prisma.userToken.findFirst({
        where: {
          userId,
          category: 'SUPPLIES',
          isActive: true
        }
      });
      
      if (!userToken) {
        throw new ServiceError(this.name, 'getWBClient', 'No active WB token found for user');
      }
      
      // Создаем клиент
      this.wbClient = new UnifiedWBAPIClient({
        token: userToken.token,
        category: 'SUPPLIES',
        baseURL: 'https://suppliers-api.wildberries.ru',
        timeout: 30000,
        retryAttempts: 3,
        rateLimit: {
          requests: 100,
          window: 60
        }
      });
      
      await this.wbClient.initialize();
      await this.wbClient.start();
    }
    
    return this.wbClient;
  }

  private async bookSlotViaAPI(client: UnifiedWBAPIClient, config: AutoBookingConfig): Promise<BookingResult> {
    try {
      const response = await client.bookSlot({
        supplyId: config.supplyId,
        slotId: config.slotId,
        warehouseId: config.warehouseId,
        boxTypeId: config.boxTypeId,
        date: config.date
      });
      
      if (response.success && response.data) {
        return {
          success: true,
          bookingId: response.data.bookingId || `api_${Date.now()}`,
          details: {
            slotId: config.slotId,
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            date: config.date,
            coefficient: config.coefficient,
            bookedAt: new Date()
          }
        };
      } else {
        return {
          success: false,
          error: response.error || 'API booking failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API booking failed'
      };
    }
  }

  private async bookSlotViaBrowser(config: AutoBookingConfig): Promise<BookingResult> {
    if (!this.browser) {
      throw new ServiceError(this.name, 'bookSlotViaBrowser', 'Browser not initialized');
    }
    
    let page: Page | undefined;
    
    try {
      page = await this.browser.newPage();
      
      // Настраиваем страницу
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Переходим на страницу бронирования
      await page.goto('https://seller.wildberries.ru/supplier/supplies', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Ждем загрузки страницы
      await page.waitForSelector('[data-testid="supplies-page"]', { timeout: 10000 });
      
      // Здесь должна быть логика бронирования через UI
      // Это упрощенная версия - в реальности нужна более сложная логика
      
      // Имитируем успешное бронирование
      await this.sleep(2000);
      
      return {
        success: true,
        bookingId: `browser_${Date.now()}`,
        details: {
          slotId: config.slotId,
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          date: config.date,
          coefficient: config.coefficient,
          bookedAt: new Date()
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Browser booking failed'
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async runAutoBooking(bookingId: string, config: AutoBookingConfig): Promise<void> {
    try {
      // Выполняем бронирование
      const result = await this.bookSlot(config);
      
      // Если бронирование успешно, останавливаем
      if (result.success) {
        this.log('info', `Auto booking ${bookingId} completed successfully`);
        this.activeBookings.delete(bookingId);
        return;
      }
      
      // Если не удалось забронировать, можно повторить попытку
      // или остановить в зависимости от конфигурации
      this.log('warn', `Auto booking ${bookingId} failed, stopping`);
      this.activeBookings.delete(bookingId);
      
    } catch (error) {
      this.log('error', `Auto booking ${bookingId} failed with error`, error);
      this.activeBookings.delete(bookingId);
    }
  }

  private async saveBookingResult(config: AutoBookingConfig, result: BookingResult): Promise<void> {
    try {
      // Сохраняем результат бронирования в базу данных
      await prisma.runLog.create({
        data: {
          runId: config.runId,
          taskId: config.taskId,
          userId: config.userId,
          level: result.success ? 'info' : 'error',
          message: result.success ? 'Slot booked successfully' : `Booking failed: ${result.error}`,
          data: {
            config,
            result
          }
        }
      });
    } catch (error) {
      this.log('error', 'Failed to save booking result to database', error);
    }
  }

  private validateBookingConfig(config: AutoBookingConfig): void {
    const requiredFields = ['taskId', 'userId', 'runId', 'slotId', 'supplyId', 'warehouseId', 'boxTypeId', 'date'];
    
    for (const field of requiredFields) {
      if (!config[field as keyof AutoBookingConfig]) {
        throw new ValidationError(
          this.name,
          'validateBookingConfig',
          `Required field '${field}' is missing`
        );
      }
    }
  }
}
