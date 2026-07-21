/**
 * 🏗️ Единый сервис автобронирования
 * Заменяет все дублирующиеся реализации автобронирования
 */

import { 
  BaseService, 
  ServiceError 
} from '../architecture';
import { 
  IAutoBookingService,
  AutoBookingConfig,
  BookingResult,
  BookingState,
  BookingStatus,
  BookingMethod,
  BookingAttempt,
  SlotInfo,
  SupplyInfo,
  BookingCredentials,
  BookingStrategy,
  BookingError,
  SlotUnavailableError,
  AuthenticationError,
  SessionExpiredError,
  BookingConflictError,
  TimeoutError,
  DEFAULT_BOOKING_CONFIG
} from '../architecture/autobooking-interfaces';
import { prisma } from '../prisma';
import puppeteer, { Browser, Page } from 'puppeteer';
import { UnifiedWBAPIClient } from './unified-wb-api-client';

export class UnifiedAutoBookingService extends BaseService implements IAutoBookingService {
  private activeBookings: Map<string, BookingState> = new Map();
  private bookingHistory: BookingResult[] = [];
  private sessions: Map<string, any> = new Map();
  private browser?: Browser;
  private wbClient?: UnifiedWBAPIClient;

  constructor() {
    super('UnifiedAutoBookingService', '1.0.0');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ
  // ============================================================================

  protected async doInitialize(): Promise<void> {
    this.log('info', 'Initializing unified auto booking service...');
    
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
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    this.log('info', 'Unified auto booking service initialized');
  }

  protected async doStart(): Promise<void> {
    this.log('info', 'Starting unified auto booking service...');
    this.log('info', 'Unified auto booking service started');
  }

  protected async doStop(): Promise<void> {
    this.log('info', 'Stopping unified auto booking service...');
    
    // Останавливаем все активные бронирования
    for (const [bookingId] of this.activeBookings) {
      await this.cancelAutoBooking(bookingId);
    }
    
    // Закрываем браузер
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
    
    // Очищаем сессии
    this.sessions.clear();
    
    this.log('info', 'Unified auto booking service stopped');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА IAutoBookingService
  // ============================================================================

  async bookSlot(config: AutoBookingConfig): Promise<BookingResult> {
    return this.executeWithMetrics('bookSlot', async () => {
      await this.validateBookingConfig(config);
      
      const startTime = Date.now();
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Создаем состояние бронирования
      const state: BookingState = {
        status: BookingStatus.IN_PROGRESS,
        currentAttempt: 0,
        maxAttempts: config.strategy.maxRetries,
        method: this.determineBookingMethod(config.strategy),
        startTime: new Date(),
        lastUpdate: new Date(),
        progress: 0
      };
      
      this.activeBookings.set(bookingId, state);
      
      try {
        // Выполняем бронирование в зависимости от стратегии
        let result: BookingResult;
        
        switch (config.strategy.type) {
          case 'API_FIRST':
            result = await this.bookViaAPI(config);
            break;
          case 'BROWSER_FIRST':
            result = await this.bookViaBrowser(config);
            break;
          case 'HYBRID':
            result = await this.bookViaHybrid(config);
            break;
          default:
            throw new BookingError(`Unknown booking strategy: ${config.strategy.type}`);
        }
        
        // Обновляем состояние
        state.status = result.success ? BookingStatus.SUCCESS : BookingStatus.FAILED;
        state.progress = 100;
        state.lastUpdate = new Date();
        
        // Сохраняем результат
        this.bookingHistory.unshift(result);
        if (this.bookingHistory.length > 1000) {
          this.bookingHistory = this.bookingHistory.slice(0, 1000);
        }
        
        // Сохраняем в базу данных
        await this.saveBookingResult(bookingId, config, result);
        
        this.log('info', `Booking ${bookingId} completed: ${result.success ? 'success' : 'failed'}`);
        return result;
        
      } catch (error) {
        state.status = BookingStatus.FAILED;
        state.error = error instanceof Error ? error.message : String(error);
        state.lastUpdate = new Date();
        
        const result: BookingResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: this.isRetryableError(error),
          details: {
            slotId: config.slot.id,
            supplyId: config.supply.id,
            warehouseId: config.slot.warehouseId,
            date: config.slot.date,
            coefficient: config.slot.coefficient,
            bookedAt: new Date(),
            method: state.method,
            attempts: state.currentAttempt,
            executionTime: Date.now() - startTime
          }
        };
        
        this.bookingHistory.unshift(result);
        throw error;
      } finally {
        // Удаляем из активных бронирований
        this.activeBookings.delete(bookingId);
      }
    });
  }

  async startAutoBooking(config: AutoBookingConfig): Promise<string> {
    return this.executeWithMetrics('startAutoBooking', async () => {
      await this.validateBookingConfig(config);
      
      const bookingId = `auto_booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Создаем состояние для автоматического бронирования
      const state: BookingState = {
        status: BookingStatus.PENDING,
        currentAttempt: 0,
        maxAttempts: config.strategy.maxRetries,
        method: this.determineBookingMethod(config.strategy),
        startTime: new Date(),
        lastUpdate: new Date(),
        progress: 0
      };
      
      this.activeBookings.set(bookingId, state);
      
      // Запускаем автоматическое бронирование в фоне
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
      const state = this.activeBookings.get(bookingId);
      if (!state) {
        throw new BookingError(`Booking ${bookingId} not found`);
      }
      
      state.status = BookingStatus.CANCELLED;
      state.lastUpdate = new Date();
      
      this.activeBookings.delete(bookingId);
      this.log('info', `Stopped auto booking: ${bookingId}`);
    });
  }

  async cancelAutoBooking(bookingId: string): Promise<void> {
    return this.executeWithMetrics('cancelAutoBooking', async () => {
      const state = this.activeBookings.get(bookingId);
      if (!state) {
        throw new BookingError(`Booking ${bookingId} not found`);
      }
      
      state.status = BookingStatus.CANCELLED;
      state.lastUpdate = new Date();
      
      this.activeBookings.delete(bookingId);
      this.log('info', `Cancelled auto booking: ${bookingId}`);
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

  async getBookingState(bookingId: string): Promise<BookingState | null> {
    return this.activeBookings.get(bookingId) || null;
  }

  getBookingHistory(limit?: number): BookingResult[] {
    if (limit) {
      return this.bookingHistory.slice(0, limit);
    }
    return [...this.bookingHistory];
  }

  // ============================================================================
  // МЕТОДЫ БРОНИРОВАНИЯ
  // ============================================================================

  async bookViaAPI(config: AutoBookingConfig): Promise<BookingResult> {
    return this.executeWithRetry('bookViaAPI', async () => {
      this.log('info', 'Attempting booking via API...');
      
      const client = await this.getWBClient(config.userId);
      
      try {
        const response = await client.bookSlot({
          supplyId: config.supply.id,
          slotId: config.slot.id,
          warehouseId: config.slot.warehouseId,
          boxTypeId: config.slot.boxTypeId,
          date: config.slot.date
        });
        
        if (response.success && response.data) {
          return {
            success: true,
            bookingId: response.data.bookingId || `api_${Date.now()}`,
            retryable: false,
            details: {
              slotId: config.slot.id,
              supplyId: config.supply.id,
              warehouseId: config.slot.warehouseId,
              date: config.slot.date,
              coefficient: config.slot.coefficient,
              bookedAt: new Date(),
              method: 'API',
              attempts: 1,
              executionTime: 0
            }
          };
        } else {
          throw new BookingError(response.error || 'API booking failed', 'API_BOOKING_FAILED');
        }
      } catch (error) {
        if (error instanceof BookingError) {
          throw error;
        }
        throw new BookingError(`API booking failed: ${error}`, 'API_BOOKING_ERROR');
      }
    }, config.strategy.maxRetries);
  }

  async bookViaBrowser(config: AutoBookingConfig): Promise<BookingResult> {
    return this.executeWithRetry('bookViaBrowser', async () => {
      this.log('info', 'Attempting booking via browser...');
      
      if (!this.browser) {
        throw new BookingError('Browser not initialized', 'BROWSER_NOT_INITIALIZED');
      }
      
      let page: Page | undefined;
      
      try {
        page = await this.browser.newPage();
        
        // Настраиваем страницу
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Авторизуемся
        await this.authenticateInBrowser(page, config.credentials);
        
        // Переходим на страницу бронирования
        await page.goto('https://seller.wildberries.ru/supplier/supplies', {
          waitUntil: 'networkidle2',
          timeout: config.strategy.timeout
        });
        
        // Выполняем бронирование
        const result = await this.performBrowserBooking(page, config);
        
        return {
          success: true,
          bookingId: `browser_${Date.now()}`,
          retryable: false,
          details: {
            slotId: config.slot.id,
            supplyId: config.supply.id,
            warehouseId: config.slot.warehouseId,
            date: config.slot.date,
            coefficient: config.slot.coefficient,
            bookedAt: new Date(),
            method: 'BROWSER',
            attempts: 1,
            executionTime: 0
          }
        };
        
      } catch (error) {
        throw new BookingError(`Browser booking failed: ${error}`, 'BROWSER_BOOKING_ERROR');
      } finally {
        if (page) {
          await page.close();
        }
      }
    }, config.strategy.maxRetries);
  }

  async bookViaHybrid(config: AutoBookingConfig): Promise<BookingResult> {
    this.log('info', 'Attempting hybrid booking (API first, then browser)...');
    
    try {
      // Сначала пробуем API
      const apiResult = await this.bookViaAPI(config);
      if (apiResult.success) {
        return apiResult;
      }
      
      this.log('info', 'API booking failed, trying browser...');
      
      // Если API не сработал, пробуем браузер
      const browserResult = await this.bookViaBrowser(config);
      return browserResult;
      
    } catch (error) {
      throw new BookingError(`Hybrid booking failed: ${error}`, 'HYBRID_BOOKING_ERROR');
    }
  }

  // ============================================================================
  // ВАЛИДАЦИЯ И ПРОВЕРКИ
  // ============================================================================

  async validateBookingConfig(config: AutoBookingConfig): Promise<boolean> {
    const requiredFields = ['taskId', 'userId', 'runId', 'slot', 'supply', 'credentials', 'strategy'];
    
    for (const field of requiredFields) {
      if (!config[field as keyof AutoBookingConfig]) {
        throw new BookingError(`Required field '${field}' is missing`, 'VALIDATION_ERROR');
      }
    }
    
    // Проверяем доступность слота
    const isAvailable = await this.checkSlotAvailability(config.slot);
    if (!isAvailable) {
      throw new SlotUnavailableError(config.slot.id);
    }
    
    // Проверяем учетные данные
    const isValidCredentials = await this.validateCredentials(config.credentials);
    if (!isValidCredentials) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    return true;
  }

  async validateCredentials(credentials: BookingCredentials): Promise<boolean> {
    // Базовая валидация
    if (!credentials.email || !credentials.password) {
      return false;
    }
    
    // Проверяем формат email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      return false;
    }
    
    // Проверяем длину пароля
    if (credentials.password.length < 6) {
      return false;
    }
    
    return true;
  }

  async checkSlotAvailability(slot: SlotInfo): Promise<boolean> {
    // Здесь должна быть логика проверки доступности слота
    // Пока что возвращаем true
    return slot.available;
  }

  // ============================================================================
  // МЕТРИКИ И АНАЛИТИКА
  // ============================================================================

  async getBookingMetrics(): Promise<{
    totalBookings: number;
    successfulBookings: number;
    failedBookings: number;
    averageBookingTime: number;
    successRate: number;
    methodStats: Record<BookingMethod, number>;
    errorStats: Record<string, number>;
  }> {
    const totalBookings = this.bookingHistory.length;
    const successfulBookings = this.bookingHistory.filter(b => b.success).length;
    const failedBookings = totalBookings - successfulBookings;
    const successRate = totalBookings > 0 ? (successfulBookings / totalBookings) * 100 : 0;
    
    // Подсчитываем статистику по методам
    const methodStats: Record<BookingMethod, number> = {
      [BookingMethod.API]: 0,
      [BookingMethod.BROWSER]: 0,
      [BookingMethod.HYBRID]: 0
    };
    
    for (const booking of this.bookingHistory) {
      if (booking.details?.method) {
        methodStats[booking.details.method as BookingMethod]++;
      }
    }
    
    // Подсчитываем статистику ошибок
    const errorStats: Record<string, number> = {};
    for (const booking of this.bookingHistory) {
      if (!booking.success && booking.errorCode) {
        errorStats[booking.errorCode] = (errorStats[booking.errorCode] || 0) + 1;
      }
    }
    
    // Для среднего времени бронирования используем метрики сервиса
    const metrics = await this.getMetrics();
    
    return {
      totalBookings,
      successfulBookings,
      failedBookings,
      averageBookingTime: metrics.averageResponseTime,
      successRate,
      methodStats,
      errorStats
    };
  }

  // ============================================================================
  // УПРАВЛЕНИЕ СЕССИЯМИ
  // ============================================================================

  async createSession(credentials: BookingCredentials): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Здесь должна быть логика создания сессии
    this.sessions.set(sessionId, {
      credentials,
      createdAt: new Date(),
      lastUsed: new Date()
    });
    
    return sessionId;
  }

  async refreshSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Обновляем время последнего использования
    session.lastUsed = new Date();
    return true;
  }

  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
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
        throw new AuthenticationError('No active WB token found for user');
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
      this.log('warn', `Auto booking ${bookingId} failed, stopping`);
      this.activeBookings.delete(bookingId);
      
    } catch (error) {
      this.log('error', `Auto booking ${bookingId} failed with error`, error);
      this.activeBookings.delete(bookingId);
    }
  }

  private async authenticateInBrowser(page: Page, credentials: BookingCredentials): Promise<void> {
    // Здесь должна быть логика авторизации в браузере
    // Пока что просто логируем
    this.log('info', 'Authenticating in browser...');
  }

  private async performBrowserBooking(page: Page, config: AutoBookingConfig): Promise<any> {
    // Здесь должна быть логика бронирования через браузер
    // Пока что просто логируем
    this.log('info', 'Performing browser booking...');
    return { success: true };
  }

  private async saveBookingResult(bookingId: string, config: AutoBookingConfig, result: BookingResult): Promise<void> {
    try {
      await prisma.runLog.create({
        data: {
          runId: config.runId,
          taskId: config.taskId,
          userId: config.userId,
          level: result.success ? 'info' : 'error',
          message: result.success ? 'Slot booked successfully' : `Booking failed: ${result.error}`,
          data: {
            bookingId,
            config,
            result
          }
        }
      });
    } catch (error) {
      this.log('error', 'Failed to save booking result to database', error);
    }
  }

  private determineBookingMethod(strategy: BookingStrategy): BookingMethod {
    switch (strategy.type) {
      case 'API_FIRST':
        return BookingMethod.API;
      case 'BROWSER_FIRST':
        return BookingMethod.BROWSER;
      case 'HYBRID':
        return BookingMethod.HYBRID;
      default:
        return BookingMethod.HYBRID;
    }
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof BookingError) {
      return error.retryable;
    }
    
    // Проверяем типы ошибок, которые можно повторить
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'SESSION_EXPIRED',
      'AUTHENTICATION_ERROR'
    ];
    
    return retryableErrors.some(errorType => 
      error.message?.includes(errorType) || error.code === errorType
    );
  }
}
