// ===== SESSION AWARE BOOKING INTEGRATION =====

import { Logger } from '@/lib/logging/logger';
import { sessionErrorHandler } from '@/lib/errors/session-error-handler';
import { sessionAutoRefreshService } from '@/lib/session/session-auto-refresh-service';
import { enhancedRunLogger } from '@/lib/logging/enhanced-run-logger';
import { prisma } from '@/lib/prisma';

export interface SessionAwareBookingConfig {
  userId: string;
  taskId: string;
  supplyId: string;
  warehouseId: number;
  date: string;
  runId?: string;
  retryConfig?: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}

export interface SessionAwareBookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  details?: any;
  attemptCount: number;
  executionTime: number;
  sessionRefreshed: boolean;
  runId: string;
}

export class SessionAwareBookingIntegration {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('INFO', { service: 'INFO' });
  }

  /**
   * Интеграция с существующими сервисами бронирования
   */
  async executeBookingWithSessionAwareness(
    config: SessionAwareBookingConfig,
    bookingService: any // Существующий сервис бронирования
  ): Promise<SessionAwareBookingResult> {
    const startTime = Date.now();
    let runId = config.runId;

    // Создаем Run если не передан
    if (!runId) {
      runId = await this.createRun(config);
    }

    // Начинаем логирование
    await enhancedRunLogger.startRun(runId, config.userId, config.taskId);

    try {
      this.logger.info('🚀 Starting session-aware booking', {
        userId: config.userId,
        taskId: config.taskId,
        supplyId: config.supplyId,
        runId
      });

      // Проверяем здоровье сессии перед началом
      const sessionValidation = await sessionErrorHandler.validateSessionBeforeOperation(config.userId);
      
      if (!sessionValidation.isValid) {
        await enhancedRunLogger.logError(
          runId,
          config.userId,
          new Error(`Session validation failed: ${sessionValidation.error}`),
          {
            stepName: 'session_validation',
            actionType: 'validate_session',
            isRetryable: false
          }
        );

        await enhancedRunLogger.finishRun(runId, config.userId, 'FAILED', sessionValidation.error);

        return {
          success: false,
          error: `Session validation failed: ${sessionValidation.error}`,
          attemptCount: 0,
          executionTime: Date.now() - startTime,
          sessionRefreshed: false,
          runId
        };
      }

      // Выполняем бронирование с обработкой ошибок сессии
      const result = await this.executeBookingWithRetry(
        config,
        bookingService,
        runId,
        startTime
      );

      // Завершаем логирование
      const status = result.success ? 'SUCCESS' : 'FAILED';
      await enhancedRunLogger.finishRun(runId, config.userId, status, result.error);

      return result;

    } catch (error) {
      this.logger.error('Session-aware booking failed', {
        userId: config.userId,
        runId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await enhancedRunLogger.logError(
        runId,
        config.userId,
        error instanceof Error ? error : new Error('Unknown error'),
        {
          stepName: 'booking_execution',
          actionType: 'execute_booking',
          isRetryable: false
        }
      );

      await enhancedRunLogger.finishRun(runId, config.userId, 'FAILED', error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        attemptCount: 0,
        executionTime: Date.now() - startTime,
        sessionRefreshed: false,
        runId
      };
    }
  }

  /**
   * Выполнение бронирования с retry и обработкой ошибок сессии
   */
  private async executeBookingWithRetry(
    config: SessionAwareBookingConfig,
    bookingService: any,
    runId: string,
    startTime: number
  ): Promise<SessionAwareBookingResult> {
    const retryConfig = {
      maxAttempts: 5,
      initialDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      ...config.retryConfig
    };

    let attempt = 0;
    let lastError: Error | null = null;
    let sessionRefreshed = false;

    while (attempt < retryConfig.maxAttempts) {
      attempt++;

      try {
        this.logger.info(`📋 Booking attempt ${attempt}/${retryConfig.maxAttempts}`, {
          userId: config.userId,
          runId,
          attempt
        });

        await enhancedRunLogger.logMessage({
          runId,
          userId: config.userId,
          level: 'INFO',
          message: `Starting booking attempt ${attempt}`,
          stepName: 'booking_attempt',
          actionType: 'start_attempt',
          retryCount: attempt - 1,
          bookingContext: {
            taskId: config.taskId,
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            date: config.date
          }
        });

        // Выполняем бронирование через существующий сервис
        const bookingResult = await bookingService.bookSlot({
          userId: config.userId,
          taskId: config.taskId,
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          date: config.date
        });

        if (bookingResult.success) {
          this.logger.info('✅ Booking completed successfully', {
            userId: config.userId,
            runId,
            bookingId: bookingResult.bookingId,
            attemptCount: attempt
          });

          await enhancedRunLogger.logBookingSuccess(runId, config.userId, {
            bookingId: bookingResult.bookingId!,
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            date: config.date,
            taskId: config.taskId,
            executionTime: Date.now() - startTime,
            attemptCount: attempt,
            sessionRefreshed
          });

          return {
            success: true,
            bookingId: bookingResult.bookingId,
            details: bookingResult.details,
            attemptCount: attempt,
            executionTime: Date.now() - startTime,
            sessionRefreshed,
            runId
          };
        } else {
          throw new Error(bookingResult.error || 'Booking failed');
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        this.logger.warn(`❌ Booking attempt ${attempt} failed`, {
          userId: config.userId,
          runId,
          error: lastError.message,
          errorType: lastError.constructor.name
        });

        await enhancedRunLogger.logError(
          runId,
          config.userId,
          lastError,
          {
            stepName: 'booking_attempt',
            actionType: 'book_slot',
            retryCount: attempt - 1,
            bookingContext: {
              taskId: config.taskId,
              supplyId: config.supplyId,
              warehouseId: config.warehouseId,
              date: config.date
            }
          }
        );

        // Обрабатываем ошибки сессии
        if (this.isSessionError(lastError)) {
          const sessionHandlingResult = await sessionErrorHandler.handleSessionExpired({
            userId: config.userId,
            taskId: config.taskId,
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            retryCount: attempt,
            originalError: lastError
          });

          if (sessionHandlingResult.sessionRefreshed) {
            sessionRefreshed = true;
            
            await enhancedRunLogger.logSessionRefresh(runId, config.userId, {
              sessionId: sessionHandlingResult.metadata?.sessionId || 'unknown',
              newExpiresAt: sessionHandlingResult.metadata?.newExpiresAt || new Date(),
              refreshMethod: 'automatic',
              success: true
            });

            this.logger.info('🔄 Session refreshed, will retry booking', {
              userId: config.userId,
              runId,
              retryAfter: sessionHandlingResult.retryAfter
            });
          }

          if (!sessionHandlingResult.shouldRetry) {
            this.logger.error('Session handling failed, stopping retries', {
              userId: config.userId,
              runId,
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
            
            this.logger.info(`Waiting ${delay}ms before retry`, { attempt, runId });
            await this.sleep(delay);
          }
        }
      }
    }

    // Все попытки исчерпаны
    const executionTime = Date.now() - startTime;
    const finalError = lastError || new Error('All booking attempts failed');

    this.logger.error('💥 All booking attempts failed', {
      userId: config.userId,
      runId,
      attemptCount: attempt,
      executionTime,
      finalError: finalError.message,
      sessionRefreshed
    });

    return {
      success: false,
      error: finalError.message,
      attemptCount: attempt,
      executionTime,
      sessionRefreshed,
      runId
    };
  }

  /**
   * Создание Run записи
   */
  private async createRun(config: SessionAwareBookingConfig): Promise<string> {
    const run = await prisma.run.create({
      data: {
        taskId: config.taskId,
        userId: config.userId,
        status: 'RUNNING' as any,
        startedAt: new Date(),
        foundSlots: 0
      }
    });

    this.logger.info('📝 Created Run record', {
      runId: run.id,
      userId: config.userId,
      taskId: config.taskId
    });

    return run.id;
  }

  /**
   * Проверка, является ли ошибка связанной с сессией
   */
  private isSessionError(error: Error): boolean {
    const sessionErrorPatterns = [
      'SESSION_EXPIRED',
      'Session expired',
      'Session validation failed',
      'Redirected to login',
      'Authentication failed',
      'Unauthorized'
    ];

    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    return sessionErrorPatterns.some(pattern => 
      errorMessage.includes(pattern.toLowerCase()) || 
      errorName.includes(pattern.toLowerCase())
    );
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Экспортируем singleton instance
export const sessionAwareBookingIntegration = new SessionAwareBookingIntegration();
