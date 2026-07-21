/**
 * ЦЕНТРАЛИЗОВАННЫЙ ERROR HANDLER ДЛЯ АВТОБРОНИРОВАНИЯ
 * 
 * Единая точка обработки всех ошибок при автобронировании:
 * - Классификация ошибок
 * - Логирование с контекстом
 * - Автоматические screenshots
 * - Telegram уведомления
 * - Деактивация сессий при критических ошибках
 */

import { Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/logging/logger';
import { TelegramService } from './telegram-service';
import path from 'path';
import fs from 'fs/promises';

// Import error types
import {
  EnhancedBookingError,
  SessionExpiredError,
  ElementNotFoundError,
  BookingConflictError,
  NetworkError
} from './auto-booking-service';

export interface ErrorContext {
  step: string;
  userId: string;
  taskId: string;
  supplyId?: string;
  warehouseId?: number;
  page?: Page;
  attempt?: number;
  metadata?: Record<string, any>;
}

export interface ErrorHandlingResult {
  error: EnhancedBookingError;
  screenshot?: string;
  logged: boolean;
  notified: boolean;
  sessionDeactivated: boolean;
}

export class CentralizedBookingErrorHandler {
  private static instance: CentralizedBookingErrorHandler;
  private logger: Logger;
  private telegramService: TelegramService;
  private screenshotDir: string;

  private constructor() {
    this.logger = new Logger('INFO', { context: 'CentralizedBookingErrorHandler' });
    this.telegramService = new TelegramService();
    this.screenshotDir = path.join(process.cwd(), 'screenshots', 'booking-errors');
    this.initScreenshotDir();
  }

  public static getInstance(): CentralizedBookingErrorHandler {
    if (!CentralizedBookingErrorHandler.instance) {
      CentralizedBookingErrorHandler.instance = new CentralizedBookingErrorHandler();
    }
    return CentralizedBookingErrorHandler.instance;
  }

  private async initScreenshotDir(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create screenshot directory', { error });
    }
  }

  /**
   * Главный метод обработки ошибок
   */
  async handleError(error: any, context: ErrorContext): Promise<ErrorHandlingResult> {
    const startTime = Date.now();
    
    // 1. Классификация ошибки
    const enhancedError = this.classifyError(error, context);
    
    // 2. Логирование с полным контекстом
    const logged = await this.logError(enhancedError, context);
    
    // 3. Screenshot (если page доступна)
    let screenshot: string | undefined;
    if (context.page && !context.page.isClosed()) {
      screenshot = await this.takeErrorScreenshot(context.page, enhancedError, context);
    }
    
    // 4. Деактивация сессии при критических ошибках
    const sessionDeactivated = await this.handleSessionDeactivation(enhancedError, context);
    
    // 5. Telegram уведомление
    const notified = await this.sendErrorNotification(enhancedError, context);
    
    const duration = Date.now() - startTime;
    this.logger.info('Error handling completed', {
      duration,
      errorCode: enhancedError.code,
      screenshot: !!screenshot,
      notified,
      sessionDeactivated
    });
    
    return {
      error: enhancedError,
      screenshot,
      logged,
      notified,
      sessionDeactivated
    };
  }

  /**
   * Классификация ошибки с определением типа и retryable статуса
   */
  private classifyError(error: any, context: ErrorContext): EnhancedBookingError {
    // Если уже EnhancedBookingError - возвращаем как есть
    if (error instanceof EnhancedBookingError) {
      return error;
    }

    const message = error?.message || String(error);
    const stackTrace = error?.stack || '';

    // Классификация по паттернам сообщений
    const patterns = {
      session: [
        /session.*expired/i,
        /unauthorized/i,
        /forbidden/i,
        /login.*required/i,
        /redirected.*to.*login/i,
        /authentication.*failed/i
      ],
      element: [
        /element.*not.*found/i,
        /selector.*not.*found/i,
        /timeout.*waiting.*for.*selector/i,
        /element.*is.*not.*attached/i
      ],
      network: [
        /net::/i,
        /network.*error/i,
        /connection.*refused/i,
        /ECONNREFUSED/i,
        /fetch.*failed/i
      ],
      timeout: [
        /timeout/i,
        /timed.*out/i,
        /exceeded.*time/i
      ],
      booking: [
        /slot.*already.*booked/i,
        /booking.*conflict/i,
        /slot.*not.*available/i,
        /no.*slots.*found/i
      ],
      browser: [
        /page.*closed/i,
        /browser.*closed/i,
        /target.*closed/i,
        /page\.isClosed/i,
        /context.*was.*destroyed/i
      ]
    };

    // Проверяем паттерны
    if (patterns.session.some(p => p.test(message) || p.test(stackTrace))) {
      return new SessionExpiredError(message, error);
    }

    if (patterns.element.some(p => p.test(message) || p.test(stackTrace))) {
      const selector = this.extractSelector(message);
      return new ElementNotFoundError(selector, error);
    }

    if (patterns.network.some(p => p.test(message) || p.test(stackTrace))) {
      return new NetworkError(message, error);
    }

    if (patterns.timeout.some(p => p.test(message) || p.test(stackTrace))) {
      return new EnhancedBookingError(message, 'TIMEOUT_ERROR', true, error, context.metadata);
    }

    if (patterns.booking.some(p => p.test(message) || p.test(stackTrace))) {
      return new BookingConflictError(message, error);
    }

    if (patterns.browser.some(p => p.test(message) || p.test(stackTrace))) {
      return new EnhancedBookingError(message, 'BROWSER_CLOSED', false, error, context.metadata);
    }

    // По умолчанию - unknown error
    return new EnhancedBookingError(message, 'UNKNOWN_ERROR', false, error, context.metadata);
  }

  /**
   * Извлечение селектора из сообщения об ошибке
   */
  private extractSelector(message: string): string {
    const match = message.match(/selector[:\s]+["']?([^"'\s]+)["']?/i);
    return match ? match[1] : 'unknown-selector';
  }

  /**
   * Логирование ошибки с полным контекстом
   */
  private async logError(error: EnhancedBookingError, context: ErrorContext): Promise<boolean> {
    try {
      this.logger.error(`❌ Booking error in step: ${context.step}`, {
        errorCode: error.code,
        errorMessage: error.message,
        isRetryable: error.isRetryable,
        userId: context.userId,
        taskId: context.taskId,
        supplyId: context.supplyId,
        warehouseId: context.warehouseId,
        attempt: context.attempt,
        stack: error.stack,
        originalError: error.originalError?.message,
        context: error.context,
        metadata: context.metadata
      });

      // Сохраняем в БД RunLog если есть taskId
      if (context.taskId) {
        await prisma.runLog.create({
          data: {
            runId: context.taskId,
            level: 'ERROR',
            message: `Error in ${context.step}: ${error.message}`,
            meta: {
              errorCode: error.code,
              isRetryable: error.isRetryable,
              step: context.step,
              attempt: context.attempt,
              originalError: error.originalError?.message,
              stack: error.stack?.split('\n').slice(0, 5).join('\n'), // Первые 5 строк stack trace
            }
          }
        }).catch(dbError => {
          this.logger.warn('Failed to save error to RunLog', { error: dbError });
        });
      }

      return true;
    } catch (logError) {
      console.error('Failed to log error', logError);
      return false;
    }
  }

  /**
   * Создание error screenshot
   */
  private async takeErrorScreenshot(
    page: Page, 
    error: EnhancedBookingError, 
    context: ErrorContext
  ): Promise<string | undefined> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error-${context.step}-${error.code}-${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      
      const screenshot = await page.screenshot({ 
        fullPage: true, 
        type: 'png',
        path: filepath,
        timeout: 5000 // Timeout на screenshot
      });
      
      this.logger.info('✅ Error screenshot saved', { 
        filepath,
        step: context.step,
        errorCode: error.code 
      });
      
      return screenshot.toString('base64');
    } catch (screenshotError) {
      this.logger.warn('Failed to take error screenshot', { 
        error: screenshotError,
        step: context.step 
      });
      return undefined;
    }
  }

  /**
   * Деактивация сессии при критических ошибках
   */
  private async handleSessionDeactivation(
    error: EnhancedBookingError,
    context: ErrorContext
  ): Promise<boolean> {
    // Деактивируем сессию только при критических ошибках авторизации
    const shouldDeactivate = [
      'SESSION_EXPIRED',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'AUTHENTICATION_REQUIRED'
    ].includes(error.code);

    if (!shouldDeactivate) {
      return false;
    }

    try {
      this.logger.warn('🔒 Deactivating session due to critical auth error', {
        userId: context.userId,
        errorCode: error.code
      });

      await prisma.wBSession.update({
        where: { userId: context.userId },
        data: {
          isActive: false,
          deactivationReason: `${error.code}: ${error.message}`,
          deactivatedAt: new Date()
        }
      });

      this.logger.info('✅ Session deactivated in database', { userId: context.userId });
      return true;
    } catch (dbError) {
      this.logger.error('Failed to deactivate session', {
        userId: context.userId,
        error: dbError
      });
      return false;
    }
  }

  /**
   * Отправка уведомления об ошибке в Telegram
   */
  private async sendErrorNotification(
    error: EnhancedBookingError,
    context: ErrorContext
  ): Promise<boolean> {
    try {
      const emoji = this.getErrorEmoji(error.code);
      const actionText = this.getActionText(error.code);

      const message = `${emoji} ОШИБКА АВТОБРОНИРОВАНИЯ\n\n` +
        `📝 Шаг: ${context.step}\n` +
        `🚫 Код: ${error.code}\n` +
        `📋 Описание: ${error.message}\n` +
        `🔄 Попытка: ${context.attempt || 1}\n` +
        `♻️ Можно повторить: ${error.isRetryable ? 'Да' : 'Нет'}\n` +
        (context.supplyId ? `\n📦 Поставка: ${context.supplyId}` : '') +
        (context.warehouseId ? `\n🏢 Склад: ${context.warehouseId}` : '') +
        (actionText ? `\n\n${actionText}` : '');

      await this.telegramService.sendNotification(context.userId, message);
      
      this.logger.info('✅ Error notification sent', {
        userId: context.userId,
        errorCode: error.code
      });
      
      return true;
    } catch (notifError) {
      this.logger.warn('Failed to send error notification', { error: notifError });
      return false;
    }
  }

  /**
   * Получение emoji для типа ошибки
   */
  private getErrorEmoji(errorCode: string): string {
    const emojiMap: Record<string, string> = {
      SESSION_EXPIRED: '🔒',
      UNAUTHORIZED: '🚫',
      ELEMENT_NOT_FOUND: '🔍',
      TIMEOUT_ERROR: '⏰',
      NETWORK_ERROR: '🌐',
      BROWSER_CLOSED: '💥',
      BOOKING_CONFLICT: '⚠️',
      PAGE_CLOSED: '📄',
    };
    
    return emojiMap[errorCode] || '❌';
  }

  /**
   * Получение текста с рекомендациями по ошибке
   */
  private getActionText(errorCode: string): string {
    const actionMap: Record<string, string> = {
      SESSION_EXPIRED: '⚠️ Требуется повторная аутентификация через /wb-auth',
      UNAUTHORIZED: '⚠️ Проверьте права доступа к Wildberries API',
      ELEMENT_NOT_FOUND: '💡 Селекторы могли измениться. Обновите конфигурацию.',
      TIMEOUT_ERROR: '💡 Попробуйте увеличить таймауты или проверьте интернет',
      NETWORK_ERROR: '💡 Проверьте подключение к интернету',
      BROWSER_CLOSED: '💡 Браузер был закрыт. Перезапустите задачу.',
      BOOKING_CONFLICT: '💡 Слот уже забронирован. Попробуйте другой слот.',
      PAGE_CLOSED: '💡 Страница была закрыта. Перезапустите бронирование.',
    };
    
    return actionMap[errorCode] || '';
  }

  /**
   * Быстрый хелпер для обработки ошибки в catch блоке
   */
  static async handle(error: any, context: ErrorContext): Promise<EnhancedBookingError> {
    const handler = CentralizedBookingErrorHandler.getInstance();
    const result = await handler.handleError(error, context);
    return result.error;
  }

  /**
   * Проверка, является ли ошибка критической (не retryable)
   */
  static isCriticalError(error: EnhancedBookingError): boolean {
    const criticalErrors = [
      'SESSION_EXPIRED',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'BOOKING_CONFLICT',
      'SLOT_ALREADY_BOOKED',
      'BROWSER_CRASHED',
      'PAGE_CLOSED',
    ];
    
    return criticalErrors.includes(error.code);
  }
}

// Export singleton instance
export const centralizedErrorHandler = CentralizedBookingErrorHandler.getInstance();

