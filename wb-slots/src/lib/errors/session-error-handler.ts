// ===== SESSION ERROR HANDLER =====

import { Logger } from '@/lib/logging/logger';
import { sessionAutoRefreshService } from '@/lib/session/session-auto-refresh-service';
import { prisma } from '@/lib/prisma';

export interface SessionErrorContext {
  userId: string;
  taskId?: string;
  supplyId?: string;
  warehouseId?: number;
  retryCount?: number;
  originalError?: Error;
  browserContext?: any;
}

export interface SessionErrorHandlingResult {
  shouldRetry: boolean;
  retryAfter?: number; // в миллисекундах
  sessionRefreshed: boolean;
  error: string;
  metadata?: Record<string, any>;
}

export class SessionErrorHandler {
  private logger: Logger;
  private refreshAttempts = new Map<string, number>(); // userId -> attempts

  constructor() {
    this.logger = new Logger('INFO', { service: 'INFO' });
  }

  /**
   * Обработка ошибки SESSION_EXPIRED
   */
  async handleSessionExpired(context: SessionErrorContext): Promise<SessionErrorHandlingResult> {
    const { userId, retryCount = 0, browserContext } = context;

    this.logger.warn('🔐 Handling SESSION_EXPIRED error', {
      userId,
      taskId: context.taskId,
      retryCount,
      hasBrowserContext: !!browserContext
    });

    try {
      // Проверяем, сколько раз мы уже пытались обновить сессию для этого пользователя
      const refreshAttempts = this.refreshAttempts.get(userId) || 0;
      const maxRefreshAttempts = 2; // Максимум 2 попытки обновления сессии

      if (refreshAttempts >= maxRefreshAttempts) {
        this.logger.error('Max session refresh attempts reached', {
          userId,
          attempts: refreshAttempts
        });

        // Логируем в AuditLog
        await this.logSessionFailure(context, 'MAX_REFRESH_ATTEMPTS_REACHED');

        return {
          shouldRetry: false,
          sessionRefreshed: false,
          error: 'Maximum session refresh attempts reached. Manual re-authentication required.',
          metadata: {
            refreshAttempts,
            maxAttempts: maxRefreshAttempts
          }
        };
      }

      // Пытаемся обновить сессию
      this.logger.info('Attempting session refresh', {
        userId,
        attempt: refreshAttempts + 1
      });

      const refreshResult = await sessionAutoRefreshService.handleSessionExpired(
        userId, 
        browserContext
      );

      if (refreshResult.success) {
        // Успешно обновили сессию
        this.refreshAttempts.delete(userId); // Сбрасываем счетчик
        this.logger.info('✅ Session refreshed successfully', {
          userId,
          sessionId: refreshResult.sessionId,
          newExpiresAt: refreshResult.newExpiresAt
        });

        // Логируем успешное обновление
        await this.logSessionSuccess(context, refreshResult);

        return {
          shouldRetry: true,
          retryAfter: 2000, // 2 секунды задержки перед retry
          sessionRefreshed: true,
          error: 'Session refreshed successfully',
          metadata: {
            sessionId: refreshResult.sessionId,
            newExpiresAt: refreshResult.newExpiresAt,
            refreshMethod: refreshResult.refreshMethod
          }
        };
      } else {
        // Не удалось обновить сессию
        this.refreshAttempts.set(userId, refreshAttempts + 1);
        
        this.logger.error('❌ Session refresh failed', {
          userId,
          error: refreshResult.error,
          attempts: refreshAttempts + 1
        });

        // Логируем неудачу обновления
        await this.logSessionFailure(context, 'REFRESH_FAILED', refreshResult.error);

        // Если это первая попытка обновления, пробуем еще раз
        if (refreshAttempts < maxRefreshAttempts - 1) {
          return {
            shouldRetry: true,
            retryAfter: 5000, // 5 секунд задержки
            sessionRefreshed: false,
            error: `Session refresh failed: ${refreshResult.error}. Retrying...`,
            metadata: {
              refreshAttempts: refreshAttempts + 1,
              maxAttempts: maxRefreshAttempts
            }
          };
        } else {
          // Исчерпали все попытки
          return {
            shouldRetry: false,
            sessionRefreshed: false,
            error: `Session refresh failed after ${maxRefreshAttempts} attempts: ${refreshResult.error}`,
            metadata: {
              refreshAttempts: refreshAttempts + 1,
              maxAttempts: maxRefreshAttempts
            }
          };
        }
      }

    } catch (error) {
      this.logger.error('Session error handling failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.logSessionFailure(context, 'HANDLING_ERROR', error instanceof Error ? error.message : 'Unknown error');

      return {
        shouldRetry: false,
        sessionRefreshed: false,
        error: `Session error handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          handlingError: true
        }
      };
    }
  }

  /**
   * Проверка здоровья сессии перед началом операции
   */
  async validateSessionBeforeOperation(userId: string): Promise<{
    isValid: boolean;
    needsRefresh: boolean;
    error?: string;
    expiresIn?: number;
  }> {
    try {
      const healthCheck = await sessionAutoRefreshService.checkSessionHealth(userId);

      if (!healthCheck.isHealthy) {
        this.logger.warn('Session health check failed before operation', {
          userId,
          error: healthCheck.error
        });

        return {
          isValid: false,
          needsRefresh: false,
          error: healthCheck.error
        };
      }

      if (healthCheck.needsRefresh) {
        this.logger.info('Session needs refresh before operation', {
          userId,
          expiresIn: healthCheck.expiresIn
        });

        // Пытаемся обновить сессию заранее
        const refreshResult = await sessionAutoRefreshService.handleSessionExpired(userId);
        
        if (refreshResult.success) {
          this.logger.info('Session pre-refreshed successfully', { userId });
          return {
            isValid: true,
            needsRefresh: false
          };
        } else {
          this.logger.warn('Session pre-refresh failed', {
            userId,
            error: refreshResult.error
          });
          return {
            isValid: true, // Продолжаем с текущей сессией
            needsRefresh: true,
            error: refreshResult.error
          };
        }
      }

      return {
        isValid: true,
        needsRefresh: false,
        expiresIn: healthCheck.expiresIn
      };

    } catch (error) {
      this.logger.error('Session validation before operation failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        needsRefresh: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Логирование успешного обновления сессии
   */
  private async logSessionSuccess(
    context: SessionErrorContext, 
    refreshResult: any
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: context.userId,
          action: 'SESSION_REFRESH_SUCCESS',
          target: context.taskId || 'unknown',
          meta: {
            eventType: 'session_refresh',
            taskId: context.taskId,
            supplyId: context.supplyId,
            warehouseId: context.warehouseId,
            sessionId: refreshResult.sessionId,
            newExpiresAt: refreshResult.newExpiresAt,
            refreshMethod: refreshResult.refreshMethod,
            retryCount: context.retryCount,
            metadata: {
              success: true,
              autoRefresh: true
            },
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      this.logger.warn('Failed to log session success', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Логирование неудачи обновления сессии
   */
  private async logSessionFailure(
    context: SessionErrorContext, 
    reason: string,
    error?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: context.userId,
          action: 'SESSION_REFRESH_FAILED',
          target: context.taskId || 'unknown',
          meta: {
            eventType: 'session_refresh_failure',
            taskId: context.taskId,
            supplyId: context.supplyId,
            warehouseId: context.warehouseId,
            reason,
            error,
            retryCount: context.retryCount,
            metadata: {
              success: false,
              autoRefresh: true,
              failureReason: reason
            },
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (logError) {
      this.logger.warn('Failed to log session failure', {
        error: logError instanceof Error ? logError.message : 'Unknown error'
      });
    }
  }

  /**
   * Сброс счетчика попыток обновления для пользователя
   */
  resetRefreshAttempts(userId: string): void {
    this.refreshAttempts.delete(userId);
    this.logger.info('Reset refresh attempts counter', { userId });
  }

  /**
   * Получение статистики попыток обновления
   */
  getRefreshStats(): Record<string, number> {
    return Object.fromEntries(this.refreshAttempts);
  }
}

// Экспортируем singleton instance
export const sessionErrorHandler = new SessionErrorHandler();
