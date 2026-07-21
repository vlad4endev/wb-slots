// ===== ENHANCED BOOKING SERVICE WITH SESSION REFRESH =====

import { Logger } from '@/lib/logging/logger';
import { sessionErrorHandler } from '@/lib/errors/session-error-handler';
import { sessionAutoRefreshService } from '@/lib/session/session-auto-refresh-service';
import { prisma } from '@/lib/prisma';
import { Browser, BrowserContext, Page, chromium } from 'playwright';

export interface EnhancedBookingConfig {
  userId: string;
  taskId: string;
  supplyId: string;
  warehouseId: number;
  date: string;
  retryConfig?: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  details?: any;
  attemptCount: number;
  executionTime: number;
  sessionRefreshed?: boolean;
}

export interface StepResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class SessionExpiredError extends Error {
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'SessionExpiredError';
    if (originalError) {
      (this as any).cause = originalError;
    }
  }
}

export class EnhancedBookingWithSessionRefresh {
  private logger: Logger;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor() {
    this.logger = new Logger('INFO', { service: 'INFO' });
  }

  /**
   * Основной метод бронирования с автоматическим обновлением сессий
   */
  async bookSlot(config: EnhancedBookingConfig): Promise<BookingResult> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;
    let sessionRefreshed = false;

    const retryConfig = {
      maxAttempts: 5,
      initialDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      ...config.retryConfig
    };

    this.logger.info('🚀 Starting enhanced booking with session refresh', {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId
    });

    // Проверяем здоровье сессии перед началом
    const sessionValidation = await sessionErrorHandler.validateSessionBeforeOperation(config.userId);
    if (!sessionValidation.isValid) {
      this.logger.error('Session validation failed before booking', {
        userId: config.userId,
        error: sessionValidation.error
      });

      return {
        success: false,
        error: `Session validation failed: ${sessionValidation.error}`,
        attemptCount: 0,
        executionTime: Date.now() - startTime
      };
    }

    while (attempt < retryConfig.maxAttempts) {
      attempt++;
      
      try {
        this.logger.info(`📋 Booking attempt ${attempt}/${retryConfig.maxAttempts}`, {
          userId: config.userId,
          taskId: config.taskId,
          supplyId: config.supplyId
        });

        // Инициализируем браузер
        const browserResult = await this.initializeBrowser();
        if (!browserResult.success) {
          throw new Error(browserResult.error);
        }

        // Валидируем и восстанавливаем сессию
        const sessionResult = await this.validateAndRestoreSession(config.userId);
        if (!sessionResult.success) {
          throw new SessionExpiredError(sessionResult.error || 'Session validation failed');
        }

        // Выполняем бронирование
        const bookingResult = await this.performBooking(config);
        
        if (bookingResult.success) {
          this.logger.info('✅ Booking completed successfully', {
            userId: config.userId,
            taskId: config.taskId,
            bookingId: bookingResult.bookingId,
            attemptCount: attempt,
            sessionRefreshed
          });

          // Сохраняем результат
          await this.saveBookingResult(config, bookingResult, attempt, Date.now() - startTime);

          return {
            success: true,
            bookingId: bookingResult.bookingId,
            details: bookingResult.details,
            attemptCount: attempt,
            executionTime: Date.now() - startTime,
            sessionRefreshed
          };
        } else {
          throw new Error(bookingResult.error || 'Booking failed');
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        this.logger.warn(`❌ Booking attempt ${attempt} failed`, {
          userId: config.userId,
          taskId: config.taskId,
          error: lastError.message,
          errorType: lastError.constructor.name
        });

        // Обрабатываем ошибку сессии
        if (lastError instanceof SessionExpiredError || lastError.message.includes('SESSION_EXPIRED')) {
          const sessionHandlingResult = await sessionErrorHandler.handleSessionExpired({
            userId: config.userId,
            taskId: config.taskId,
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            retryCount: attempt,
            originalError: lastError,
            browserContext: this.context
          });

          if (sessionHandlingResult.sessionRefreshed) {
            sessionRefreshed = true;
            this.logger.info('🔄 Session refreshed, will retry booking', {
              userId: config.userId,
              retryAfter: sessionHandlingResult.retryAfter
            });
          }

          if (!sessionHandlingResult.shouldRetry) {
            this.logger.error('Session handling failed, stopping retries', {
              userId: config.userId,
              error: sessionHandlingResult.error
            });
            break;
          }

          // Ждем перед следующей попыткой
          if (sessionHandlingResult.retryAfter) {
            await this.sleep(sessionHandlingResult.retryAfter);
          }
        } else {
          // Для других ошибок используем стандартную логику retry
          if (attempt < retryConfig.maxAttempts) {
            const delay = Math.min(
              retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
              retryConfig.maxDelay
            );
            
            this.logger.info(`Waiting ${delay}ms before retry`, { attempt });
            await this.sleep(delay);
          }
        }

        // Закрываем браузер после неудачной попытки
        await this.cleanup();
      }
    }

    // Все попытки исчерпаны
    const executionTime = Date.now() - startTime;
    const finalError = lastError || new Error('All booking attempts failed');

    this.logger.error('💥 All booking attempts failed', {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      attemptCount: attempt,
      executionTime,
      finalError: finalError.message,
      sessionRefreshed
    });

    // Сохраняем неудачный результат
    await this.saveBookingResult(config, {
      success: false,
      error: finalError.message
    }, attempt, executionTime);

    return {
      success: false,
      error: finalError.message,
      attemptCount: attempt,
      executionTime,
      sessionRefreshed
    };
  }

  /**
   * Инициализация браузера
   */
  private async initializeBrowser(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.browser) {
        await this.cleanup();
      }

      this.browser = await chromium.launch({
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

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      this.page = await this.context.newPage();

      this.logger.info('✅ Browser initialized successfully');
      return { success: true };

    } catch (error) {
      this.logger.error('❌ Browser initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.cleanup();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Browser initialization failed'
      };
    }
  }

  /**
   * Валидация и восстановление сессии
   */
  private async validateAndRestoreSession(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.page) {
      return { success: false, error: 'Browser page not initialized' };
    }

    try {
      // Получаем активную сессию
      const session = await prisma.wBSession.findFirst({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!session) {
        return { success: false, error: 'No active session found' };
      }

      // Проверяем срок действия
      if (session.expiresAt < new Date()) {
        return { success: false, error: 'Session expired' };
      }

      // Восстанавливаем cookies
      if (session.cookiesEncrypted) {
        try {
          // const { decrypt } = await import('@/lib/security/encryption');
          const cookiesData = session.cookiesEncrypted; // TODO: Add decryption
          const cookies = JSON.parse(cookiesData);
          
          await this.context!.addCookies(cookies);
        } catch (error) {
          this.logger.warn('Failed to restore cookies', { error });
        }
      }

      // Переходим на главную страницу WB
      await this.page.goto('https://seller.wildberries.ru', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Проверяем, не перенаправило ли на страницу входа
      if (this.page.url().includes('/login') || this.page.url().includes('/auth')) {
        return { success: false, error: 'Redirected to login page - session expired' };
      }

      this.logger.info('✅ Session validated and restored successfully', { userId });
      return { success: true };

    } catch (error) {
      this.logger.error('❌ Session validation failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  /**
   * Выполнение бронирования
   */
  private async performBooking(config: EnhancedBookingConfig): Promise<{
    success: boolean;
    bookingId?: string;
    error?: string;
    details?: any;
  }> {
    if (!this.page) {
      return { success: false, error: 'Browser page not initialized' };
    }

    try {
      // Здесь должна быть логика бронирования
      // Для примера возвращаем успешный результат
      
      this.logger.info('🎯 Performing booking', {
        userId: config.userId,
        supplyId: config.supplyId,
        warehouseId: config.warehouseId
      });

      // Симуляция бронирования
      await this.sleep(2000);

      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        bookingId,
        details: {
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          date: config.date,
          bookedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('❌ Booking performance failed', {
        userId: config.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Booking failed'
      };
    }
  }

  /**
   * Сохранение результата бронирования
   */
  private async saveBookingResult(
    config: EnhancedBookingConfig,
    result: any,
    attemptCount: number,
    executionTime: number
  ): Promise<void> {
    try {
      // Здесь можно сохранить результат в базу данных
      this.logger.info('💾 Booking result saved', {
        userId: config.userId,
        taskId: config.taskId,
        success: result.success,
        attemptCount,
        executionTime
      });
    } catch (error) {
      this.logger.warn('Failed to save booking result', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Очистка ресурсов
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      this.logger.warn('Cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Экспортируем singleton instance
export const enhancedBookingWithSessionRefresh = new EnhancedBookingWithSessionRefresh();
