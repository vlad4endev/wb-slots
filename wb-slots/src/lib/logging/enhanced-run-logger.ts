// ===== ENHANCED RUN LOGGER =====

import { Logger } from './logger';
import { prisma } from '@/lib/prisma';

export interface EnhancedRunLogData {
  runId: string;
  userId: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  message: string;
  stepName?: string;
  actionType?: string;
  retryCount?: number;
  sessionInfo?: {
    sessionId?: string;
    isActive?: boolean;
    expiresAt?: Date;
    lastUsedAt?: Date;
  };
  performanceMetrics?: {
    duration?: number;
    memoryUsage?: number;
    apiCalls?: number;
    foundSlots?: number;
    totalChecked?: number;
    errors?: number;
  };
  errorDetails?: {
    errorCode?: string;
    errorType?: string;
    stackTrace?: string;
    isRetryable?: boolean;
    recoveryAction?: string;
  };
  bookingContext?: {
    taskId?: string;
    supplyId?: string;
    warehouseId?: number;
    date?: string;
    bookingId?: string;
  };
  meta?: Record<string, any>;
}

export interface RunSummary {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  sessionRefreshCount: number;
  errorBreakdown: Record<string, number>;
  performanceMetrics: {
    averageMemoryUsage: number;
    totalApiCalls: number;
    totalSlotsFound: number;
    totalSlotsChecked: number;
  };
}

export class EnhancedRunLogger {
  private logger: Logger;
  private runMetrics = new Map<string, {
    startTime: number;
    attempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    sessionRefreshes: number;
    errors: Record<string, number>;
    performanceData: any[];
  }>();

  constructor() {
    this.logger = new Logger('INFO', { service: 'INFO' });
  }

  /**
   * Начало выполнения Run
   */
  async startRun(runId: string, userId: string, taskId: string): Promise<void> {
    const startTime = Date.now();
    
    this.runMetrics.set(runId, {
      startTime,
      attempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      sessionRefreshes: 0,
      errors: {},
      performanceData: []
    });

    await this.logMessage({
      runId,
      userId,
      level: 'INFO',
      message: 'Run started',
      stepName: 'initialization',
      actionType: 'start_run',
      bookingContext: { taskId },
      meta: {
        startTime: new Date(startTime).toISOString(),
        runId,
        taskId
      }
    });
  }

  /**
   * Логирование сообщения с расширенными данными
   */
  async logMessage(data: EnhancedRunLogData): Promise<void> {
    try {
      // Обновляем метрики
      this.updateRunMetrics(data);

      // Логируем в консоль
      const logMethod = data.level.toLowerCase() as keyof Logger;
      if (typeof this.logger[logMethod] === 'function') {
        (this.logger[logMethod] as any)(
          data.message,
          {
            runId: data.runId,
            userId: data.userId,
            stepName: data.stepName,
            actionType: data.actionType,
            retryCount: data.retryCount,
            ...data.meta
          }
        );
      }

      // Логируем в базу данных
      await prisma.runLog.create({
        data: {
          runId: data.runId,
          level: data.level as any,
          message: data.message,
          meta: {
            stepName: data.stepName,
            actionType: data.actionType,
            retryCount: data.retryCount,
            sessionInfo: data.sessionInfo,
            performanceMetrics: data.performanceMetrics,
            errorDetails: data.errorDetails,
            bookingContext: data.bookingContext,
            timestamp: new Date().toISOString(),
            ...data.meta
          }
        }
      });

    } catch (error) {
      console.error('Failed to log enhanced run message:', error);
    }
  }

  /**
   * Логирование ошибки с детальной информацией
   */
  async logError(
    runId: string,
    userId: string,
    error: Error,
    context: {
      stepName?: string;
      actionType?: string;
      retryCount?: number;
      sessionInfo?: any;
      bookingContext?: any;
      isRetryable?: boolean;
      recoveryAction?: string;
    } = {}
  ): Promise<void> {
    const errorDetails = {
      errorCode: this.extractErrorCode(error),
      errorType: error.constructor.name,
      stackTrace: error.stack,
      isRetryable: context.isRetryable ?? this.isRetryableError(error),
      recoveryAction: context.recoveryAction
    };

    await this.logMessage({
      runId,
      userId,
      level: 'ERROR',
      message: `Error: ${error.message}`,
      stepName: context.stepName,
      actionType: context.actionType,
      retryCount: context.retryCount,
      sessionInfo: context.sessionInfo,
      bookingContext: context.bookingContext,
      errorDetails,
      meta: {
        errorName: error.name,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Логирование успешного бронирования
   */
  async logBookingSuccess(
    runId: string,
    userId: string,
    bookingDetails: {
      bookingId: string;
      supplyId: string;
      warehouseId: number;
      date: string;
      taskId: string;
      executionTime: number;
      attemptCount: number;
      sessionRefreshed?: boolean;
    }
  ): Promise<void> {
    const metrics = this.runMetrics.get(runId);
    if (metrics) {
      metrics.successfulAttempts++;
    }

    await this.logMessage({
      runId,
      userId,
      level: 'INFO',
      message: 'Booking completed successfully',
      stepName: 'booking_completion',
      actionType: 'book_slot',
      sessionInfo: {
        sessionId: bookingDetails.bookingId, // Use bookingId as sessionId placeholder
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      },
      bookingContext: {
        taskId: bookingDetails.taskId,
        supplyId: bookingDetails.supplyId,
        warehouseId: bookingDetails.warehouseId,
        date: bookingDetails.date,
        bookingId: bookingDetails.bookingId
      },
      performanceMetrics: {
        duration: bookingDetails.executionTime
      },
      meta: {
        attemptCount: bookingDetails.attemptCount,
        sessionRefreshed: bookingDetails.sessionRefreshed,
        success: true
      }
    });
  }

  /**
   * Логирование обновления сессии
   */
  async logSessionRefresh(
    runId: string,
    userId: string,
    refreshDetails: {
      sessionId: string;
      newExpiresAt: Date;
      refreshMethod: 'automatic' | 'manual' | 'scheduled';
      success: boolean;
      error?: string;
      retryCount?: number;
    }
  ): Promise<void> {
    const metrics = this.runMetrics.get(runId);
    if (metrics) {
      metrics.sessionRefreshes++;
    }

    await this.logMessage({
      runId,
      userId,
      level: refreshDetails.success ? 'INFO' : 'ERROR',
      message: refreshDetails.success 
        ? 'Session refreshed successfully' 
        : `Session refresh failed: ${refreshDetails.error}`,
      stepName: 'session_management',
      actionType: 'refresh_session',
      retryCount: refreshDetails.retryCount,
      sessionInfo: {
        sessionId: refreshDetails.sessionId,
        expiresAt: refreshDetails.newExpiresAt
      },
      errorDetails: refreshDetails.success ? undefined : {
        errorCode: 'SESSION_REFRESH_FAILED',
        isRetryable: true,
        recoveryAction: 'retry_with_new_session'
      },
      meta: {
        refreshMethod: refreshDetails.refreshMethod,
        success: refreshDetails.success,
        newExpiresAt: refreshDetails.newExpiresAt.toISOString()
      }
    });
  }

  /**
   * Логирование производительности
   */
  async logPerformance(
    runId: string,
    userId: string,
    metrics: {
      duration: number;
      memoryUsage: number;
      apiCalls: number;
      foundSlots: number;
      totalChecked: number;
      errors: number;
      stepName?: string;
    }
  ): Promise<void> {
    const runMetrics = this.runMetrics.get(runId);
    if (runMetrics) {
      runMetrics.performanceData.push(metrics);
    }

    await this.logMessage({
      runId,
      userId,
      level: 'INFO',
      message: 'Performance metrics recorded',
      stepName: metrics.stepName || 'performance_check',
      actionType: 'performance_metrics',
      performanceMetrics: metrics,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Завершение Run с итоговой статистикой
   */
  async finishRun(
    runId: string,
    userId: string,
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED',
    finalError?: string
  ): Promise<RunSummary> {
    const metrics = this.runMetrics.get(runId);
    if (!metrics) {
      throw new Error(`No metrics found for run ${runId}`);
    }

    const totalExecutionTime = Date.now() - metrics.startTime;
    const averageExecutionTime = metrics.attempts > 0 ? totalExecutionTime / metrics.attempts : 0;

    const summary: RunSummary = {
      totalAttempts: metrics.attempts,
      successfulAttempts: metrics.successfulAttempts,
      failedAttempts: metrics.failedAttempts,
      averageExecutionTime,
      totalExecutionTime,
      sessionRefreshCount: metrics.sessionRefreshes,
      errorBreakdown: { ...metrics.errors },
      performanceMetrics: {
        averageMemoryUsage: this.calculateAverageMemoryUsage(metrics.performanceData),
        totalApiCalls: this.calculateTotalApiCalls(metrics.performanceData),
        totalSlotsFound: this.calculateTotalSlotsFound(metrics.performanceData),
        totalSlotsChecked: this.calculateTotalSlotsChecked(metrics.performanceData)
      }
    };

    await this.logMessage({
      runId,
      userId,
      level: status === 'SUCCESS' ? 'INFO' : 'ERROR',
      message: `Run finished with status: ${status}`,
      stepName: 'completion',
      actionType: 'finish_run',
      performanceMetrics: {
        duration: totalExecutionTime
      },
      errorDetails: finalError ? {
        errorCode: 'RUN_FAILED',
        errorType: 'RunCompletionError',
        isRetryable: false
      } : undefined,
      meta: {
        status,
        finalError,
        summary,
        timestamp: new Date().toISOString()
      }
    });

    // Обновляем Run в базе данных
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: status as any,
        finishedAt: new Date(),
        summary: summary as any
      }
    });

    // Очищаем метрики
    this.runMetrics.delete(runId);

    return summary;
  }

  /**
   * Обновление метрик Run
   */
  private updateRunMetrics(data: EnhancedRunLogData): void {
    const metrics = this.runMetrics.get(data.runId);
    if (!metrics) return;

    if (data.actionType === 'start_attempt') {
      metrics.attempts++;
    }

    if (data.errorDetails) {
      const errorCode = data.errorDetails.errorCode || 'UNKNOWN_ERROR';
      metrics.errors[errorCode] = (metrics.errors[errorCode] || 0) + 1;
    }
  }

  /**
   * Извлечение кода ошибки
   */
  private extractErrorCode(error: Error): string {
    if (error.name === 'SessionExpiredError') return 'SESSION_EXPIRED';
    if (error.name === 'NetworkError') return 'NETWORK_ERROR';
    if (error.name === 'TimeoutError') return 'TIMEOUT_ERROR';
    if (error.message.includes('Element not found')) return 'ELEMENT_NOT_FOUND';
    if (error.message.includes('Rate limit')) return 'RATE_LIMIT_EXCEEDED';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Проверка, является ли ошибка retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'SESSION_EXPIRED',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'TEMPORARY_ERROR'
    ];

    const errorCode = this.extractErrorCode(error);
    return retryableErrors.includes(errorCode);
  }

  /**
   * Расчет среднего использования памяти
   */
  private calculateAverageMemoryUsage(performanceData: any[]): number {
    if (performanceData.length === 0) return 0;
    const total = performanceData.reduce((sum, data) => sum + (data.memoryUsage || 0), 0);
    return total / performanceData.length;
  }

  /**
   * Расчет общего количества API вызовов
   */
  private calculateTotalApiCalls(performanceData: any[]): number {
    return performanceData.reduce((sum, data) => sum + (data.apiCalls || 0), 0);
  }

  /**
   * Расчет общего количества найденных слотов
   */
  private calculateTotalSlotsFound(performanceData: any[]): number {
    return performanceData.reduce((sum, data) => sum + (data.foundSlots || 0), 0);
  }

  /**
   * Расчет общего количества проверенных слотов
   */
  private calculateTotalSlotsChecked(performanceData: any[]): number {
    return performanceData.reduce((sum, data) => sum + (data.totalChecked || 0), 0);
  }
}

// Экспортируем singleton instance
export const enhancedRunLogger = new EnhancedRunLogger();
