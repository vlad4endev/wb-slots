// ===== ERROR TRACKING AND LOGGING SYSTEM =====

import { Logger } from '../logging/logger';
import { ContextualError, ErrorContext } from './contextual-error';
import { ErrorCategory, ErrorSeverity } from './advanced-error-classification';

// ===== TYPES =====

export interface ErrorEvent {
  id: string;
  error: ContextualError;
  timestamp: Date;
  source: string;
  environment: string;
  version: string;
  metadata: Record<string, any>;
}

export interface ErrorAggregation {
  category: ErrorCategory;
  severity: ErrorSeverity;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  uniqueUsers: Set<string>;
  uniqueServices: Set<string>;
  sampleErrors: ContextualError[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ErrorReport {
  period: {
    start: Date;
    end: Date;
  };
  totalErrors: number;
  uniqueErrors: number;
  criticalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  topErrors: Array<{
    error: ContextualError;
    count: number;
    percentage: number;
  }>;
  trends: Array<{
    category: ErrorCategory;
    trend: 'increasing' | 'decreasing' | 'stable';
    change: number;
  }>;
  recommendations: string[];
}

export interface ErrorAlert {
  id: string;
  type: 'threshold' | 'trend' | 'critical' | 'custom';
  condition: string;
  threshold?: number;
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  recipients: string[];
  message: string;
}

// ===== MAIN CLASS =====

export class ErrorTracker {
  private static instance: ErrorTracker;
  private logger: Logger;
  private errorEvents: Map<string, ErrorEvent> = new Map();
  private errorAggregations: Map<string, ErrorAggregation> = new Map();
  private alerts: Map<string, ErrorAlert> = new Map();
  private maxEvents: number = 10000;
  private maxAggregations: number = 1000;

  private constructor() {
    this.logger = new Logger('INFO', { service: 'ErrorTracker' });
    this.initializeDefaultAlerts();
  }

  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  // ===== ERROR TRACKING =====

  /**
   * Отслеживание ошибки
   */
  trackError(
    error: ContextualError,
    source: string = 'unknown',
    additionalMetadata: Record<string, any> = {}
  ): void {
    try {
      const event: ErrorEvent = {
        id: error.id,
        error,
        timestamp: new Date(),
        source,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || 'unknown',
        metadata: {
          ...additionalMetadata,
          ...error.metadata
        }
      };

      // Сохраняем событие
      this.errorEvents.set(error.id, event);

      // Обновляем агрегацию
      this.updateAggregation(error);

      // Проверяем алерты
      this.checkAlerts(error);

      // Логируем ошибку
      this.logError(error, source);

      // Очищаем старые события если нужно
      this.cleanupOldEvents();

    } catch (trackingError) {
      this.logger.error('Failed to track error', {
        originalError: error.getLogInfo(),
        trackingError: trackingError instanceof Error ? trackingError.message : 'Unknown error'
      });
    }
  }

  /**
   * Отслеживание ошибки из обычной ошибки
   */
  trackErrorFromException(
    error: Error,
    context: ErrorContext = {},
    source: string = 'unknown',
    additionalMetadata: Record<string, any> = {}
  ): void {
    const contextualError = ContextualError.fromError(error, context, additionalMetadata);
    this.trackError(contextualError, source, additionalMetadata);
  }

  /**
   * Отслеживание ошибки из сообщения
   */
  trackErrorFromMessage(
    message: string,
    context: ErrorContext = {},
    source: string = 'unknown',
    additionalMetadata: Record<string, any> = {}
  ): void {
    const contextualError = ContextualError.fromMessage(message, context, additionalMetadata);
    this.trackError(contextualError, source, additionalMetadata);
  }

  // ===== AGGREGATION =====

  private updateAggregation(error: ContextualError): void {
    const key = `${error.classification.category}_${error.classification.severity}_${error.classification.code}`;
    
    let aggregation = this.errorAggregations.get(key);
    
    if (!aggregation) {
      aggregation = {
        category: error.classification.category,
        severity: error.classification.severity,
        count: 0,
        firstOccurrence: error.timestamp,
        lastOccurrence: error.timestamp,
        uniqueUsers: new Set(),
        uniqueServices: new Set(),
        sampleErrors: [],
        trend: 'stable'
      };
    }

    // Обновляем агрегацию
    aggregation.count++;
    aggregation.lastOccurrence = error.timestamp;
    
    if (error.context.userId) {
      aggregation.uniqueUsers.add(error.context.userId);
    }
    
    if (error.context.service) {
      aggregation.uniqueServices.add(error.context.service);
    }

    // Сохраняем примеры ошибок (максимум 5)
    if (aggregation.sampleErrors.length < 5) {
      aggregation.sampleErrors.push(error);
    }

    // Определяем тренд
    aggregation.trend = this.calculateTrend(aggregation);

    this.errorAggregations.set(key, aggregation);
  }

  private calculateTrend(aggregation: ErrorAggregation): 'increasing' | 'decreasing' | 'stable' {
    // Простая логика определения тренда
    // В реальном приложении можно использовать более сложные алгоритмы
    const now = new Date();
    const timeDiff = now.getTime() - aggregation.firstOccurrence.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff < 1) {
      return 'stable';
    }

    const errorsPerHour = aggregation.count / hoursDiff;
    
    if (errorsPerHour > 10) {
      return 'increasing';
    } else if (errorsPerHour < 1) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  // ===== LOGGING =====

  private logError(error: ContextualError, source: string): void {
    const logInfo = error.getLogInfo();
    
    // Логируем в зависимости от серьезности
    switch (error.classification.severity) {
      case ErrorSeverity.EMERGENCY:
      case ErrorSeverity.CRITICAL:
        this.logger.error('Critical Error', {
          ...logInfo,
          source,
          requiresImmediateAction: true
        });
        break;
        
      case ErrorSeverity.HIGH:
        this.logger.error('High Severity Error', {
          ...logInfo,
          source
        });
        break;
        
      case ErrorSeverity.MEDIUM:
        this.logger.warn('Medium Severity Error', {
          ...logInfo,
          source
        });
        break;
        
      case ErrorSeverity.LOW:
        this.logger.info('Low Severity Error', {
          ...logInfo,
          source
        });
        break;
    }

    // Дополнительное логирование для критических ошибок
    if (error.isCritical()) {
      this.logger.error('CRITICAL ERROR DETECTED', {
        errorId: error.id,
        message: error.message,
        category: error.classification.category,
        severity: error.classification.severity,
        context: error.context,
        suggestedActions: error.classification.suggestedActions,
        source
      });
    }
  }

  // ===== ALERTS =====

  private initializeDefaultAlerts(): void {
    // Алерт на критические ошибки
    this.addAlert({
      id: 'critical-errors',
      type: 'critical',
      condition: 'critical_error_threshold',
      isActive: true,
      triggerCount: 0,
      recipients: ['admin@example.com'],
      message: 'Critical error detected in the system'
    });

    // Алерт на превышение порога ошибок
    this.addAlert({
      id: 'error-threshold',
      type: 'threshold',
      condition: 'error_count_threshold',
      threshold: 100,
      isActive: true,
      triggerCount: 0,
      recipients: ['dev-team@example.com'],
      message: 'Error count threshold exceeded'
    });

    // Алерт на тренд увеличения ошибок
    this.addAlert({
      id: 'error-trend',
      type: 'trend',
      condition: 'increasing_error_trend',
      isActive: true,
      triggerCount: 0,
      recipients: ['monitoring@example.com'],
      message: 'Increasing error trend detected'
    });
  }

  private checkAlerts(error: ContextualError): void {
    for (const alert of this.alerts.values()) {
      if (!alert.isActive) continue;

      let shouldTrigger = false;

      switch (alert.type) {
        case 'critical':
          shouldTrigger = error.isCritical();
          break;
          
        case 'threshold':
          shouldTrigger = this.errorEvents.size >= (alert.threshold || 0);
          break;
          
        case 'trend':
          shouldTrigger = this.hasIncreasingTrend();
          break;
      }

      if (shouldTrigger) {
        this.triggerAlert(alert, error);
      }
    }
  }

  private hasIncreasingTrend(): boolean {
    const increasingAggregations = Array.from(this.errorAggregations.values())
      .filter(agg => agg.trend === 'increasing');
    
    return increasingAggregations.length > 0;
  }

  private triggerAlert(alert: ErrorAlert, error: ContextualError): void {
    alert.triggerCount++;
    alert.lastTriggered = new Date();

    this.logger.error('Alert Triggered', {
      alertId: alert.id,
      alertType: alert.type,
      alertMessage: alert.message,
      triggerCount: alert.triggerCount,
      errorId: error.id,
      errorMessage: error.message,
      recipients: alert.recipients
    });

    // В реальном приложении здесь была бы отправка уведомлений
    // await this.sendAlertNotification(alert, error);
  }

  // ===== REPORTS =====

  /**
   * Генерация отчета об ошибках
   */
  generateReport(startDate: Date, endDate: Date): ErrorReport {
    const eventsInPeriod = Array.from(this.errorEvents.values())
      .filter(event => event.timestamp >= startDate && event.timestamp <= endDate);

    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;
    const errorCounts = new Map<string, { error: ContextualError; count: number }>();

    // Инициализируем счетчики
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Подсчитываем ошибки
    for (const event of eventsInPeriod) {
      const error = event.error;
      
      errorsByCategory[error.classification.category]++;
      errorsBySeverity[error.classification.severity]++;
      
      const key = `${error.classification.category}_${error.classification.code}`;
      const existing = errorCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        errorCounts.set(key, { error, count: 1 });
      }
    }

    // Топ ошибок
    const topErrors = Array.from(errorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({
        error: item.error,
        count: item.count,
        percentage: (item.count / eventsInPeriod.length) * 100
      }));

    // Тренды
    const trends = Array.from(this.errorAggregations.values())
      .map(agg => ({
        category: agg.category,
        trend: agg.trend,
        change: agg.count
      }));

    // Рекомендации
    const recommendations = this.generateRecommendations(errorsByCategory, errorsBySeverity, topErrors);

    return {
      period: { start: startDate, end: endDate },
      totalErrors: eventsInPeriod.length,
      uniqueErrors: errorCounts.size,
      criticalErrors: errorsBySeverity[ErrorSeverity.CRITICAL] + errorsBySeverity[ErrorSeverity.EMERGENCY],
      errorsByCategory,
      errorsBySeverity,
      topErrors,
      trends,
      recommendations
    };
  }

  private generateRecommendations(
    errorsByCategory: Record<ErrorCategory, number>,
    errorsBySeverity: Record<ErrorSeverity, number>,
    topErrors: Array<{ error: ContextualError; count: number; percentage: number }>
  ): string[] {
    const recommendations: string[] = [];

    // Рекомендации по категориям
    if (errorsByCategory[ErrorCategory.NETWORK] > 50) {
      recommendations.push('High network error count detected. Check network connectivity and external service status.');
    }

    if (errorsByCategory[ErrorCategory.DATABASE] > 20) {
      recommendations.push('Database errors detected. Check database connection pool and query performance.');
    }

    if (errorsByCategory[ErrorCategory.BROWSER] > 30) {
      recommendations.push('Browser automation errors detected. Update selectors and improve anti-detection measures.');
    }

    if (errorsByCategory[ErrorCategory.WB_API] > 40) {
      recommendations.push('Wildberries API errors detected. Check API status and authentication.');
    }

    // Рекомендации по серьезности
    if (errorsBySeverity[ErrorSeverity.CRITICAL] > 5) {
      recommendations.push('Critical errors detected. Immediate investigation required.');
    }

    if (errorsBySeverity[ErrorSeverity.EMERGENCY] > 0) {
      recommendations.push('Emergency errors detected. System may be unstable.');
    }

    // Рекомендации по топ ошибкам
    const highFrequencyErrors = topErrors.filter(item => item.percentage > 20);
    if (highFrequencyErrors.length > 0) {
      recommendations.push(`High frequency errors detected: ${highFrequencyErrors.map(item => item.error.classification.code).join(', ')}`);
    }

    return recommendations;
  }

  // ===== ALERT MANAGEMENT =====

  addAlert(alert: ErrorAlert): void {
    this.alerts.set(alert.id, alert);
    this.logger.info(`Alert added: ${alert.id}`);
  }

  removeAlert(alertId: string): void {
    this.alerts.delete(alertId);
    this.logger.info(`Alert removed: ${alertId}`);
  }

  updateAlert(alertId: string, updates: Partial<ErrorAlert>): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      Object.assign(alert, updates);
      this.logger.info(`Alert updated: ${alertId}`);
    }
  }

  getAlerts(): ErrorAlert[] {
    return Array.from(this.alerts.values());
  }

  // ===== UTILITY METHODS =====

  private cleanupOldEvents(): void {
    if (this.errorEvents.size > this.maxEvents) {
      const events = Array.from(this.errorEvents.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      const toKeep = events.slice(0, this.maxEvents);
      this.errorEvents.clear();
      
      for (const event of toKeep) {
        this.errorEvents.set(event.id, event);
      }
    }
  }

  getErrorCount(): number {
    return this.errorEvents.size;
  }

  getAggregationCount(): number {
    return this.errorAggregations.size;
  }

  getErrorById(id: string): ErrorEvent | undefined {
    return this.errorEvents.get(id);
  }

  getErrorsByCategory(category: ErrorCategory): ErrorEvent[] {
    return Array.from(this.errorEvents.values())
      .filter(event => event.error.classification.category === category);
  }

  getErrorsBySeverity(severity: ErrorSeverity): ErrorEvent[] {
    return Array.from(this.errorEvents.values())
      .filter(event => event.error.classification.severity === severity);
  }

  getErrorsByUser(userId: string): ErrorEvent[] {
    return Array.from(this.errorEvents.values())
      .filter(event => event.error.context.userId === userId);
  }

  getErrorsByService(service: string): ErrorEvent[] {
    return Array.from(this.errorEvents.values())
      .filter(event => event.error.context.service === service);
  }

  clearOldErrors(olderThan: Date): void {
    const toDelete: string[] = [];
    
    for (const [id, event] of this.errorEvents) {
      if (event.timestamp < olderThan) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      this.errorEvents.delete(id);
    }
    
    this.logger.info(`Cleared ${toDelete.length} old error events`);
  }

  exportData(): string {
    const data = {
      events: Array.from(this.errorEvents.values()),
      aggregations: Array.from(this.errorAggregations.values()),
      alerts: Array.from(this.alerts.values()),
      exportDate: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }
}

// ===== SINGLETON INSTANCE =====

// Используем globalThis для сохранения instance между hot-reloads в Next.js
declare global {
  var __errorTracker: ErrorTracker | undefined;
}

if (!global.__errorTracker) {
  global.__errorTracker = ErrorTracker.getInstance();
}

export const errorTracker = global.__errorTracker;

