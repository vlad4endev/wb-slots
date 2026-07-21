import { Page } from 'playwright';
import { Logger } from '../logging/logger';
import { prisma } from '../prisma';

// ===== VERIFICATION TYPES =====
export interface BookingVerificationResult {
  isConfirmed: boolean;
  bookingId?: string;
  confirmationDetails?: BookingConfirmationDetails;
  fallbackRequired: boolean;
  verificationMethod: VerificationMethod;
  error?: string;
  screenshots?: string[];
}

export interface BookingConfirmationDetails {
  bookingNumber: string;
  warehouseId: number;
  warehouseName: string;
  bookingDate: string;
  timeSlot: string;
  status: 'confirmed' | 'pending' | 'failed' | 'cancelled';
  confirmationTime: Date;
  additionalInfo?: Record<string, any>;
}

export type VerificationMethod = 
  | 'success_message'
  | 'booking_list_check'
  | 'api_confirmation'
  | 'email_confirmation'
  | 'manual_fallback';

export interface FallbackStrategy {
  name: string;
  priority: number;
  maxAttempts: number;
  delayMs: number;
  execute: (page: Page, bookingData: any) => Promise<BookingVerificationResult>;
}

// ===== BOOKING VERIFICATION SERVICE =====
export class BookingVerificationService {
  private logger: Logger;
  private fallbackStrategies: FallbackStrategy[] = [];

  constructor() {
    this.logger = new Logger('INFO', { context: 'BookingVerificationService' });
    this.initializeFallbackStrategies();
  }

  /**
   * Основной метод проверки успешности бронирования
   */
  async verifyBookingSuccess(
    page: Page, 
    bookingData: {
      supplyId: string;
      warehouseId: number;
      date: string;
      userId: string;
      taskId: string;
    }
  ): Promise<BookingVerificationResult> {
    this.logger.info('🔍 Starting booking verification', { bookingData });

    // 1. Попытка проверки через сообщение об успехе
    const successMessageResult = await this.verifyViaSuccessMessage(page);
    if (successMessageResult.isConfirmed) {
      return successMessageResult;
    }

    // 2. Попытка проверки через список бронирований
    const bookingListResult = await this.verifyViaBookingList(page, bookingData);
    if (bookingListResult.isConfirmed) {
      return bookingListResult;
    }

    // 3. Попытка проверки через API
    const apiResult = await this.verifyViaAPI(bookingData);
    if (apiResult.isConfirmed) {
      return apiResult;
    }

    // 4. Если все основные методы неудачны - используем fallback стратегии
    this.logger.warn('⚠️ Primary verification methods failed, trying fallback strategies');
    
    for (const strategy of this.fallbackStrategies) {
      try {
        this.logger.info(`🔄 Attempting fallback strategy: ${strategy.name}`);
        
        const fallbackResult = await strategy.execute(page, bookingData);
        if (fallbackResult.isConfirmed) {
          this.logger.info(`✅ Fallback strategy succeeded: ${strategy.name}`);
          return fallbackResult;
        }
        
        // Задержка между попытками
        await this.delay(strategy.delayMs);
        
      } catch (error) {
        this.logger.error(`❌ Fallback strategy failed: ${strategy.name}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 5. Если все методы неудачны - возвращаем результат с требованием ручной проверки
    return {
      isConfirmed: false,
      fallbackRequired: true,
      verificationMethod: 'manual_fallback',
      error: 'All verification methods failed - manual confirmation required'
    };
  }

  /**
   * Проверка через сообщение об успешном бронировании
   */
  private async verifyViaSuccessMessage(page: Page): Promise<BookingVerificationResult> {
    try {
      this.logger.info('🔍 Verifying via success message');

      const successSelectors = [
        '[data-testid="booking-success"]',
        '.booking-success',
        '.success-message',
        '[class*="success"]',
        '.notification-success',
        '.alert-success',
        '[role="alert"]:has-text("успешно")',
        '.toast-success'
      ];

      let successElement = null;
      let foundSelector = '';

      // Пробуем найти элемент успеха
      for (const selector of successSelectors) {
        try {
          successElement = await page.waitForSelector(selector, { timeout: 3000 });
          if (successElement) {
            foundSelector = selector;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!successElement) {
        return {
          isConfirmed: false,
          fallbackRequired: true,
          verificationMethod: 'success_message',
          error: 'Success message not found'
        };
      }

      // Извлекаем детали бронирования из сообщения
      const successText = await successElement.textContent() || '';
      const bookingId = this.extractBookingId(successText);

      this.logger.info('✅ Success message found', { 
        foundSelector, 
        successText: successText.substring(0, 100),
        bookingId 
      });

      return {
        isConfirmed: true,
        bookingId,
        fallbackRequired: false,
        verificationMethod: 'success_message',
        confirmationDetails: {
          bookingNumber: bookingId || `AUTO-${Date.now()}`,
          warehouseId: 0, // Будет заполнено из bookingData
          warehouseName: 'Unknown',
          bookingDate: new Date().toISOString().split('T')[0],
          timeSlot: '09:00-18:00',
          status: 'confirmed',
          confirmationTime: new Date(),
          additionalInfo: {
            successMessage: successText,
            foundSelector
          }
        }
      };

    } catch (error) {
      this.logger.error('❌ Success message verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'success_message',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Проверка через список бронирований
   */
  private async verifyViaBookingList(page: Page, bookingData: any): Promise<BookingVerificationResult> {
    try {
      this.logger.info('🔍 Verifying via booking list');

      // Переходим на страницу бронирований
      const bookingsUrl = 'https://seller.wildberries.ru/supplies-management/booking-list';
      await page.goto(bookingsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Ждём загрузки списка
      const listSelectors = [
        '[data-testid="booking-list"]',
        '.booking-list',
        '.bookings-table',
        'table[data-testid="bookings"]',
        '.reservations-list'
      ];

      let listLoaded = false;
      for (const selector of listSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          listLoaded = true;
          break;
        } catch {
          continue;
        }
      }

      if (!listLoaded) {
        return {
          isConfirmed: false,
          fallbackRequired: true,
          verificationMethod: 'booking_list_check',
          error: 'Booking list not loaded'
        };
      }

      // Ищем бронирование в списке
      const bookingFound = await page.evaluate((searchData) => {
        const searchTexts = [
          searchData.supplyId,
          searchData.date,
          searchData.warehouseId.toString()
        ];

        const rows = Array.from(document.querySelectorAll('tr, .booking-item, .reservation-item'));
        
        for (const row of rows) {
          const rowText = row.textContent || '';
          const matchedTexts = searchTexts.filter(text => rowText.includes(text));
          
          if (matchedTexts.length >= 2) { // Минимум 2 совпадения
            return {
              found: true,
              rowText: rowText.trim().substring(0, 200),
              matchedTexts
            };
          }
        }
        
        return { found: false };
      }, bookingData);

      if (bookingFound.found) {
        this.logger.info('✅ Booking found in list', bookingFound);

        return {
          isConfirmed: true,
          bookingId: `LIST-${Date.now()}`,
          fallbackRequired: false,
          verificationMethod: 'booking_list_check',
          confirmationDetails: {
            bookingNumber: `LIST-${Date.now()}`,
            warehouseId: bookingData.warehouseId,
            warehouseName: `Склад ${bookingData.warehouseId}`,
            bookingDate: bookingData.date,
            timeSlot: '09:00-18:00',
            status: 'confirmed',
            confirmationTime: new Date(),
            additionalInfo: bookingFound
          }
        };
      }

      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'booking_list_check',
        error: 'Booking not found in list'
      };

    } catch (error) {
      this.logger.error('❌ Booking list verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'booking_list_check',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Проверка через API (если доступно)
   */
  private async verifyViaAPI(bookingData: any): Promise<BookingVerificationResult> {
    try {
      this.logger.info('🔍 Verifying via API');

      // Здесь можно добавить API вызовы к WB, если станут доступны
      // Пока возвращаем неподтверждённый результат
      
      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'api_confirmation',
        error: 'API verification not available'
      };

    } catch (error) {
      this.logger.error('❌ API verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'api_confirmation',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Сохранение результата верификации в базу данных
   */
  async saveVerificationResult(
    bookingData: any, 
    result: BookingVerificationResult
  ): Promise<void> {
    try {
      await prisma.bookingResult.create({
        data: {
          userId: bookingData.userId,
          supplyId: bookingData.supplyId,
          warehouseId: bookingData.warehouseId,
          warehouseName: result.confirmationDetails?.warehouseName || `Склад ${bookingData.warehouseId}`,
          bookingDate: bookingData.date,
          timeSlot: result.confirmationDetails?.timeSlot || '09:00-18:00',
          boxTypes: ['Standard'],
          coefficient: 0,
          bookingId: result.bookingId,
          status: result.isConfirmed ? 'SUCCESS' : 'FAILED',
          errorMessage: result.error,
          details: {
            verificationMethod: result.verificationMethod,
            confirmationDetails: result.confirmationDetails as any,
            fallbackRequired: result.fallbackRequired,
            verifiedAt: new Date().toISOString()
          } as any
        }
      });

      this.logger.info('💾 Verification result saved', {
        bookingId: result.bookingId,
        isConfirmed: result.isConfirmed,
        method: result.verificationMethod
      });

    } catch (error) {
      this.logger.error('❌ Failed to save verification result', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== PRIVATE METHODS =====

  /**
   * Инициализация fallback стратегий
   */
  private initializeFallbackStrategies(): void {
    this.fallbackStrategies = [
      {
        name: 'screenshot_analysis',
        priority: 1,
        maxAttempts: 2,
        delayMs: 2000,
        execute: this.executeScreenshotAnalysis.bind(this)
      },
      {
        name: 'page_refresh_check',
        priority: 2,
        maxAttempts: 3,
        delayMs: 5000,
        execute: this.executePageRefreshCheck.bind(this)
      },
      {
        name: 'network_requests_check',
        priority: 3,
        maxAttempts: 1,
        delayMs: 1000,
        execute: this.executeNetworkCheck.bind(this)
      }
    ];
  }

  /**
   * Fallback: анализ скриншота для поиска подтверждения
   */
  private async executeScreenshotAnalysis(page: Page, bookingData: any): Promise<BookingVerificationResult> {
    this.logger.info('📸 Executing screenshot analysis fallback');

    try {
      // Делаем скриншот текущей страницы
      const screenshot = await page.screenshot({ fullPage: true });
      
      // Здесь можно добавить OCR или другой анализ изображения
      // Пока просто проверяем наличие определённых элементов
      
      const hasSuccessIndicators = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const successKeywords = [
          'успешно забронирован',
          'бронирование подтверждено',
          'слот забронирован',
          'резерв создан',
          'заявка принята'
        ];
        
        return successKeywords.some(keyword => text.includes(keyword));
      });

      if (hasSuccessIndicators) {
        return {
          isConfirmed: true,
          bookingId: `SCREENSHOT-${Date.now()}`,
          fallbackRequired: false,
          verificationMethod: 'manual_fallback'
        };
      }

      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'manual_fallback',
        error: 'No success indicators found in screenshot analysis'
      };

    } catch (error) {
      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'manual_fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fallback: обновление страницы и повторная проверка
   */
  private async executePageRefreshCheck(page: Page, bookingData: any): Promise<BookingVerificationResult> {
    this.logger.info('🔄 Executing page refresh check fallback');

    try {
      // Обновляем страницу
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Повторяем основные проверки
      const successResult = await this.verifyViaSuccessMessage(page);
      if (successResult.isConfirmed) {
        return successResult;
      }

      // Проверяем через список бронирований
      const listResult = await this.verifyViaBookingList(page, bookingData);
      if (listResult.isConfirmed) {
        return listResult;
      }

      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'manual_fallback',
        error: 'Page refresh check failed'
      };

    } catch (error) {
      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'manual_fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fallback: анализ сетевых запросов
   */
  private async executeNetworkCheck(page: Page, bookingData: any): Promise<BookingVerificationResult> {
    this.logger.info('🌐 Executing network requests check fallback');

    try {
      // Анализируем сетевые запросы (если логируются)
      // Ищем запросы, связанные с бронированием
      
      const networkLogs = await page.evaluate(() => {
        // Получаем информацию о недавних запросах (если доступно)
        return {
          currentUrl: window.location.href,
          timestamp: new Date().toISOString()
        };
      });

      // Пока просто возвращаем неуспешный результат
      // В будущем можно добавить более сложную логику
      
      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'manual_fallback',
        error: 'Network check analysis incomplete'
      };

    } catch (error) {
      return {
        isConfirmed: false,
        fallbackRequired: true,
        verificationMethod: 'manual_fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Извлечение ID бронирования из текста
   */
  private extractBookingId(text: string): string | undefined {
    const patterns = [
      /№\s*(\d+)/,           // № 123456
      /ID[:\s]*(\d+)/i,      // ID: 123456 или ID 123456
      /#(\d+)/,              // #123456
      /(\d{6,})/             // Любое число из 6+ цифр
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Задержка
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BookingVerificationService;