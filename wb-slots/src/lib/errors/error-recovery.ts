// ===== ERROR RECOVERY SYSTEM =====

import { Logger } from '../logging/logger';
import { ContextualError, ErrorContext } from './contextual-error';
import { ErrorCategory, ErrorSeverity } from './advanced-error-classification';
import { errorTracker } from './error-tracking';

// ===== TYPES =====

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicableCategories: ErrorCategory[];
  applicableSeverities: ErrorSeverity[];
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
  conditions: RecoveryCondition[];
  actions: RecoveryAction[];
  fallbackStrategy?: string;
}

export interface RecoveryCondition {
  type: 'error_code' | 'error_message' | 'context_property' | 'custom';
  value: string | RegExp;
  operator?: 'equals' | 'contains' | 'matches' | 'exists';
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'circuit_breaker' | 'graceful_degradation' | 'notification' | 'custom';
  config: Record<string, any>;
  priority: number;
}

export interface RecoveryAttempt {
  id: string;
  strategyId: string;
  errorId: string;
  attemptNumber: number;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  result?: any;
  error?: ContextualError;
  metadata: Record<string, any>;
}

export interface RecoveryResult {
  success: boolean;
  attempts: RecoveryAttempt[];
  finalResult?: any;
  finalError?: ContextualError;
  strategy: RecoveryStrategy;
  duration: number;
  metadata: Record<string, any>;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount: number;
  threshold: number;
  timeout: number;
}

// ===== MAIN CLASS =====

export class ErrorRecoverySystem {
  private static instance: ErrorRecoverySystem;
  private logger: Logger;
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private attempts: Map<string, RecoveryAttempt> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private recoveryHistory: RecoveryResult[] = [];

  private constructor() {
    this.logger = new Logger('INFO', { service: 'ErrorRecoverySystem' });
    this.initializeDefaultStrategies();
  }

  public static getInstance(): ErrorRecoverySystem {
    if (!ErrorRecoverySystem.instance) {
      ErrorRecoverySystem.instance = new ErrorRecoverySystem();
    }
    return ErrorRecoverySystem.instance;
  }

  // ===== INITIALIZATION =====

  private initializeDefaultStrategies(): void {
    // Стратегия для сетевых ошибок
    this.addStrategy({
      id: 'network-retry',
      name: 'Network Error Retry',
      description: 'Retry network errors with exponential backoff',
      applicableCategories: [ErrorCategory.NETWORK, ErrorCategory.TIMEOUT],
      applicableSeverities: [ErrorSeverity.MEDIUM, ErrorSeverity.HIGH],
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      jitter: true,
      conditions: [
        { type: 'error_code', value: 'NETWORK_CONNECTION_FAILED' },
        { type: 'error_code', value: 'OPERATION_TIMEOUT' }
      ],
      actions: [
        { type: 'retry', config: {}, priority: 1 },
        { type: 'notification', config: { level: 'warning' }, priority: 2 }
      ]
    });

    // Стратегия для ошибок базы данных
    this.addStrategy({
      id: 'database-recovery',
      name: 'Database Error Recovery',
      description: 'Recover from database connection issues',
      applicableCategories: [ErrorCategory.DATABASE],
      applicableSeverities: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL],
      maxRetries: 2,
      retryDelay: 2000,
      exponentialBackoff: true,
      jitter: false,
      conditions: [
        { type: 'error_code', value: 'DATABASE_CONNECTION_FAILED' }
      ],
      actions: [
        { type: 'circuit_breaker', config: { threshold: 5, timeout: 30000 }, priority: 1 },
        { type: 'retry', config: {}, priority: 2 },
        { type: 'notification', config: { level: 'critical' }, priority: 3 }
      ]
    });

    // Стратегия для ошибок браузерной автоматизации
    this.addStrategy({
      id: 'browser-recovery',
      name: 'Browser Automation Recovery',
      description: 'Recover from browser automation errors',
      applicableCategories: [ErrorCategory.BROWSER, ErrorCategory.SELECTOR, ErrorCategory.ANTI_BOT],
      applicableSeverities: [ErrorSeverity.MEDIUM, ErrorSeverity.HIGH],
      maxRetries: 2,
      retryDelay: 3000,
      exponentialBackoff: true,
      jitter: true,
      conditions: [
        { type: 'error_code', value: 'ELEMENT_NOT_FOUND' },
        { type: 'error_code', value: 'BOT_DETECTED' }
      ],
      actions: [
        { type: 'retry', config: {}, priority: 1 },
        { type: 'graceful_degradation', config: { fallbackMode: 'manual' }, priority: 2 }
      ]
    });

    // Стратегия для ошибок WB API
    this.addStrategy({
      id: 'wb-api-recovery',
      name: 'Wildberries API Recovery',
      description: 'Recover from WB API errors',
      applicableCategories: [ErrorCategory.WB_API, ErrorCategory.WB_SESSION],
      applicableSeverities: [ErrorSeverity.MEDIUM, ErrorSeverity.HIGH],
      maxRetries: 3,
      retryDelay: 5000,
      exponentialBackoff: true,
      jitter: true,
      conditions: [
        { type: 'error_code', value: 'WB_API_ERROR' },
        { type: 'error_code', value: 'WB_SESSION_EXPIRED' }
      ],
      actions: [
        { type: 'retry', config: {}, priority: 1 },
        { type: 'fallback', config: { fallbackEndpoint: 'backup-api' }, priority: 2 }
      ]
    });

    // Стратегия для ошибок аутентификации
    this.addStrategy({
      id: 'auth-recovery',
      name: 'Authentication Recovery',
      description: 'Recover from authentication errors',
      applicableCategories: [ErrorCategory.AUTHENTICATION, ErrorCategory.AUTHORIZATION],
      applicableSeverities: [ErrorSeverity.HIGH],
      maxRetries: 1,
      retryDelay: 1000,
      exponentialBackoff: false,
      jitter: false,
      conditions: [
        { type: 'error_code', value: 'AUTHENTICATION_FAILED' },
        { type: 'error_code', value: 'AUTHORIZATION_DENIED' }
      ],
      actions: [
        { type: 'fallback', config: { action: 'refresh_token' }, priority: 1 },
        { type: 'notification', config: { level: 'error' }, priority: 2 }
      ]
    });

    this.logger.info(`Initialized ${this.strategies.size} default recovery strategies`);
  }

  // ===== STRATEGY MANAGEMENT =====

  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.id, strategy);
    this.logger.info(`Recovery strategy added: ${strategy.id}`);
  }

  removeStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
    this.logger.info(`Recovery strategy removed: ${strategyId}`);
  }

  getStrategy(strategyId: string): RecoveryStrategy | undefined {
    return this.strategies.get(strategyId);
  }

  getAllStrategies(): RecoveryStrategy[] {
    return Array.from(this.strategies.values());
  }

  // ===== RECOVERY EXECUTION =====

  /**
   * Попытка восстановления после ошибки
   */
  async attemptRecovery(
    error: ContextualError,
    operation: () => Promise<any>,
    context: ErrorContext = {}
  ): Promise<RecoveryResult> {
    const startTime = new Date();
    
    // Находим подходящую стратегию
    const strategy = this.findApplicableStrategy(error);
    if (!strategy) {
      this.logger.warn('No recovery strategy found for error', {
        errorId: error.id,
        errorCategory: error.classification.category,
        errorCode: error.classification.code
      });

      return {
        success: false,
        attempts: [],
        finalError: error,
        strategy: {
          id: 'none',
          name: 'No Strategy',
          description: 'No recovery strategy available',
          applicableCategories: [],
          applicableSeverities: [],
          maxRetries: 0,
          retryDelay: 0,
          exponentialBackoff: false,
          jitter: false,
          conditions: [],
          actions: []
        },
        duration: Date.now() - startTime.getTime(),
        metadata: { reason: 'no_strategy_found' }
      };
    }

    this.logger.info('Starting error recovery', {
      errorId: error.id,
      strategyId: strategy.id,
      strategyName: strategy.name
    });

    const attempts: RecoveryAttempt[] = [];
    let finalResult: any;
    let finalError: ContextualError = error;

    // Выполняем попытки восстановления
    for (let attemptNumber = 1; attemptNumber <= strategy.maxRetries; attemptNumber++) {
      const attempt = this.createRecoveryAttempt(strategy.id, error.id, attemptNumber);
      attempts.push(attempt);

      try {
        // Проверяем circuit breaker
        if (this.isCircuitBreakerOpen(strategy.id)) {
          attempt.status = 'skipped';
          attempt.endTime = new Date();
          this.logger.warn('Recovery attempt skipped due to circuit breaker', {
            strategyId: strategy.id,
            attemptNumber
          });
          continue;
        }

        // Выполняем действие восстановления
        const result = await this.executeRecoveryAction(strategy, attempt, operation, context);
        
        if (result.success) {
          attempt.status = 'success';
          attempt.result = result.data;
          attempt.endTime = new Date();
          finalResult = result.data;
          
          this.logger.info('Recovery successful', {
            strategyId: strategy.id,
            attemptNumber,
            duration: attempt.endTime.getTime() - attempt.startTime.getTime()
          });

          // Обновляем circuit breaker
          this.updateCircuitBreaker(strategy.id, true);
          break;
        } else {
          attempt.status = 'failed';
          attempt.error = result.error;
          attempt.endTime = new Date();
          finalError = result.error || error;
          
          this.logger.warn('Recovery attempt failed', {
            strategyId: strategy.id,
            attemptNumber,
            error: result.error?.message
          });

          // Обновляем circuit breaker
          this.updateCircuitBreaker(strategy.id, false);

          // Ждем перед следующей попыткой
          if (attemptNumber < strategy.maxRetries) {
            const delay = this.calculateRetryDelay(strategy, attemptNumber);
            await this.delay(delay);
          }
        }
      } catch (recoveryError) {
        attempt.status = 'failed';
        attempt.error = ContextualError.fromError(recoveryError as Error, context);
        attempt.endTime = new Date();
        finalError = attempt.error;
        
        this.logger.error('Recovery attempt threw error', {
          strategyId: strategy.id,
          attemptNumber,
          error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
        });

        // Обновляем circuit breaker
        this.updateCircuitBreaker(strategy.id, false);
      }
    }

    const result: RecoveryResult = {
      success: finalResult !== undefined,
      attempts,
      finalResult,
      finalError: finalResult ? undefined : finalError,
      strategy,
      duration: Date.now() - startTime.getTime(),
      metadata: {
        totalAttempts: attempts.length,
        successfulAttempts: attempts.filter(a => a.status === 'success').length,
        failedAttempts: attempts.filter(a => a.status === 'failed').length
      }
    };

    // Сохраняем результат в историю
    this.recoveryHistory.push(result);

    // Отслеживаем ошибку
    errorTracker.trackError(finalError, 'recovery-system', {
      strategyId: strategy.id,
      recoveryResult: result
    });

    this.logger.info('Recovery completed', {
      success: result.success,
      strategyId: strategy.id,
      totalAttempts: attempts.length,
      duration: result.duration
    });

    return result;
  }

  // ===== STRATEGY MATCHING =====

  private findApplicableStrategy(error: ContextualError): RecoveryStrategy | undefined {
    for (const strategy of this.strategies.values()) {
      if (this.isStrategyApplicable(strategy, error)) {
        return strategy;
      }
    }
    return undefined;
  }

  private isStrategyApplicable(strategy: RecoveryStrategy, error: ContextualError): boolean {
    // Проверяем категорию
    if (!strategy.applicableCategories.includes(error.classification.category)) {
      return false;
    }

    // Проверяем серьезность
    if (!strategy.applicableSeverities.includes(error.classification.severity)) {
      return false;
    }

    // Проверяем условия
    for (const condition of strategy.conditions) {
      if (!this.evaluateCondition(condition, error)) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(condition: RecoveryCondition, error: ContextualError): boolean {
    switch (condition.type) {
      case 'error_code':
        return this.compareValues(error.classification.code, condition.value, condition.operator);
      
      case 'error_message':
        return this.compareValues(error.message, condition.value, condition.operator);
      
      case 'context_property':
        const contextValue = error.context[condition.value as string];
        return this.compareValues(contextValue, condition.value, condition.operator);
      
      case 'custom':
        // Кастомная логика может быть реализована здесь
        return true;
      
      default:
        return false;
    }
  }

  private compareValues(actual: any, expected: any, operator: string = 'equals'): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      
      case 'contains':
        return typeof actual === 'string' && actual.includes(expected);
      
      case 'matches':
        if (expected instanceof RegExp) {
          return expected.test(actual);
        }
        return false;
      
      case 'exists':
        return actual !== undefined && actual !== null;
      
      default:
        return false;
    }
  }

  // ===== RECOVERY ACTIONS =====

  private async executeRecoveryAction(
    strategy: RecoveryStrategy,
    attempt: RecoveryAttempt,
    operation: () => Promise<any>,
    context: ErrorContext
  ): Promise<{ success: boolean; data?: any; error?: ContextualError }> {
    // Сортируем действия по приоритету
    const sortedActions = strategy.actions.sort((a, b) => a.priority - b.priority);

    for (const action of sortedActions) {
      try {
        switch (action.type) {
          case 'retry':
            return await this.executeRetryAction(operation, context);
          
          case 'fallback':
            return await this.executeFallbackAction(action.config, context);
          
          case 'circuit_breaker':
            return await this.executeCircuitBreakerAction(strategy.id, operation, context);
          
          case 'graceful_degradation':
            return await this.executeGracefulDegradationAction(action.config, context);
          
          case 'notification':
            await this.executeNotificationAction(action.config, attempt, context);
            break;
          
          case 'custom':
            return await this.executeCustomAction(action.config, operation, context);
        }
      } catch (actionError) {
        this.logger.error('Recovery action failed', {
          actionType: action.type,
          error: actionError instanceof Error ? actionError.message : 'Unknown error'
        });
      }
    }

    return { success: false, error: attempt.error };
  }

  private async executeRetryAction(
    operation: () => Promise<any>,
    context: ErrorContext
  ): Promise<{ success: boolean; data?: any; error?: ContextualError }> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      const contextualError = ContextualError.fromError(error as Error, context);
      return { success: false, error: contextualError };
    }
  }

  private async executeFallbackAction(
    config: Record<string, any>,
    context: ErrorContext
  ): Promise<{ success: boolean; data?: any; error?: ContextualError }> {
    // Реализация fallback логики
    this.logger.info('Executing fallback action', { config });
    
    // Здесь может быть логика переключения на резервный сервис
    // или использование кэшированных данных
    
    return { success: false, error: ContextualError.fromMessage('Fallback not implemented', context) };
  }

  private async executeCircuitBreakerAction(
    strategyId: string,
    operation: () => Promise<any>,
    context: ErrorContext
  ): Promise<{ success: boolean; data?: any; error?: ContextualError }> {
    if (this.isCircuitBreakerOpen(strategyId)) {
      return { 
        success: false, 
        error: ContextualError.fromMessage('Circuit breaker is open', context) 
      };
    }

    return await this.executeRetryAction(operation, context);
  }

  private async executeGracefulDegradationAction(
    config: Record<string, any>,
    context: ErrorContext
  ): Promise<{ success: boolean; data?: any; error?: ContextualError }> {
    // Реализация graceful degradation
    this.logger.info('Executing graceful degradation', { config });
    
    // Здесь может быть логика переключения в упрощенный режим работы
    
    return { success: false, error: ContextualError.fromMessage('Graceful degradation not implemented', context) };
  }

  private async executeNotificationAction(
    config: Record<string, any>,
    attempt: RecoveryAttempt,
    context: ErrorContext
  ): Promise<void> {
    this.logger.info('Sending recovery notification', {
      level: config.level,
      attemptNumber: attempt.attemptNumber,
      strategyId: attempt.strategyId
    });

    // Здесь может быть логика отправки уведомлений
  }

  private async executeCustomAction(
    config: Record<string, any>,
    operation: () => Promise<any>,
    context: ErrorContext
  ): Promise<{ success: boolean; data?: any; error?: ContextualError }> {
    // Кастомная логика восстановления
    this.logger.info('Executing custom recovery action', { config });
    
    return await this.executeRetryAction(operation, context);
  }

  // ===== CIRCUIT BREAKER =====

  private isCircuitBreakerOpen(strategyId: string): boolean {
    const breaker = this.circuitBreakers.get(strategyId);
    if (!breaker) {
      return false;
    }

    if (breaker.isOpen) {
      const now = new Date();
      if (breaker.nextAttemptTime && now >= breaker.nextAttemptTime) {
        breaker.isOpen = false;
        breaker.failureCount = 0;
        this.logger.info('Circuit breaker closed', { strategyId });
        return false;
      }
      return true;
    }

    return false;
  }

  private updateCircuitBreaker(strategyId: string, success: boolean): void {
    let breaker = this.circuitBreakers.get(strategyId);
    if (!breaker) {
      breaker = {
        isOpen: false,
        failureCount: 0,
        successCount: 0,
        threshold: 5,
        timeout: 60000
      };
      this.circuitBreakers.set(strategyId, breaker);
    }

    if (success) {
      breaker.successCount++;
      breaker.failureCount = 0;
      if (breaker.isOpen) {
        breaker.isOpen = false;
        this.logger.info('Circuit breaker closed after success', { strategyId });
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = new Date();
      
      if (breaker.failureCount >= breaker.threshold) {
        breaker.isOpen = true;
        breaker.nextAttemptTime = new Date(Date.now() + breaker.timeout);
        this.logger.warn('Circuit breaker opened', {
          strategyId,
          failureCount: breaker.failureCount,
          nextAttemptTime: breaker.nextAttemptTime
        });
      }
    }
  }

  // ===== UTILITY METHODS =====

  private createRecoveryAttempt(
    strategyId: string,
    errorId: string,
    attemptNumber: number
  ): RecoveryAttempt {
    const attempt: RecoveryAttempt = {
      id: this.generateAttemptId(),
      strategyId,
      errorId,
      attemptNumber,
      startTime: new Date(),
      status: 'pending',
      metadata: {}
    };

    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  private calculateRetryDelay(strategy: RecoveryStrategy, attemptNumber: number): number {
    let delay = strategy.retryDelay;

    if (strategy.exponentialBackoff) {
      delay = delay * Math.pow(2, attemptNumber - 1);
    }

    if (strategy.jitter) {
      delay = delay + Math.random() * delay * 0.1;
    }

    return Math.round(delay);
  }

  private generateAttemptId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `attempt_${timestamp}_${random}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== PUBLIC API =====

  getRecoveryHistory(): RecoveryResult[] {
    return [...this.recoveryHistory];
  }

  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  getRecoveryStats(): {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    strategiesUsed: Record<string, number>;
  } {
    const totalRecoveries = this.recoveryHistory.length;
    const successfulRecoveries = this.recoveryHistory.filter(r => r.success).length;
    const failedRecoveries = totalRecoveries - successfulRecoveries;
    
    const averageRecoveryTime = totalRecoveries > 0
      ? this.recoveryHistory.reduce((sum, r) => sum + r.duration, 0) / totalRecoveries
      : 0;

    const strategiesUsed: Record<string, number> = {};
    for (const result of this.recoveryHistory) {
      strategiesUsed[result.strategy.id] = (strategiesUsed[result.strategy.id] || 0) + 1;
    }

    return {
      totalRecoveries,
      successfulRecoveries,
      failedRecoveries,
      averageRecoveryTime,
      strategiesUsed
    };
  }

  clearHistory(): void {
    this.recoveryHistory = [];
    this.attempts.clear();
    this.logger.info('Recovery history cleared');
  }
}

// ===== SINGLETON INSTANCE =====

// Используем globalThis для сохранения instance между hot-reloads в Next.js
declare global {
  var __errorRecoverySystem: ErrorRecoverySystem | undefined;
}

if (!global.__errorRecoverySystem) {
  global.__errorRecoverySystem = ErrorRecoverySystem.getInstance();
}

export const errorRecoverySystem = global.__errorRecoverySystem;

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Попытка восстановления с автоматическим управлением
 */
export async function withRecovery<T>(
  operation: () => Promise<T>,
  error: ContextualError,
  context: ErrorContext = {}
): Promise<T> {
  const result = await errorRecoverySystem.attemptRecovery(error, operation, context);
  
  if (result.success) {
    return result.finalResult;
  } else {
    throw result.finalError || error;
  }
}

