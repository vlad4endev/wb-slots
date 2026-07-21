// ===== BASE SERVICE IMPLEMENTATION =====

import { Logger } from '../../logging/logger';
import { 
  IService, 
  IConfigurableService, 
  IMonitorableService, 
  IRetryableService,
  ServiceStatus, 
  ServiceMetrics, 
  ServiceHealth, 
  HealthCheck,
  RetryConfig 
} from './interfaces';

// ===== ABSTRACT BASE SERVICE =====

export abstract class BaseService implements IService {
  public readonly name: string;
  public readonly version: string;
  public readonly logger: Logger;
  
  protected _isRunning: boolean = false;
  protected _startTime?: Date;
  protected _lastActivity?: Date;
  protected _errorCount: number = 0;
  protected _successCount: number = 0;
  protected _config: Record<string, any> = {};

  constructor(name: string, version: string = '1.0.0') {
    this.name = name;
    this.version = version;
    this.logger = new Logger(name);
  }

  // ===== ABSTRACT METHODS =====

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  // ===== IMPLEMENTED METHODS =====

  isRunning(): boolean {
    return this._isRunning;
  }

  getStatus(): ServiceStatus {
    return {
      isRunning: this._isRunning,
      isHealthy: this.isHealthy(),
      startTime: this._startTime,
      lastActivity: this._lastActivity,
      errorCount: this._errorCount,
      successCount: this._successCount,
      uptime: this._startTime ? Date.now() - this._startTime.getTime() : 0
    };
  }

  getConfig(): Record<string, any> {
    return { ...this._config };
  }

  async updateConfig(config: Partial<Record<string, any>>): Promise<void> {
    this._config = { ...this._config, ...config };
    this.logger.info('Configuration updated', { config });
  }

  // ===== PROTECTED METHODS =====

  protected setRunning(running: boolean): void {
    this._isRunning = running;
    if (running && !this._startTime) {
      this._startTime = new Date();
    }
    this._lastActivity = new Date();
  }

  protected incrementErrorCount(): void {
    this._errorCount++;
    this._lastActivity = new Date();
  }

  protected incrementSuccessCount(): void {
    this._successCount++;
    this._lastActivity = new Date();
  }

  protected isHealthy(): boolean {
    // Базовая проверка здоровья - можно переопределить в наследниках
    return this._isRunning && this._errorCount < 10;
  }

  protected async safeExecute<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      this.logger.debug(`Starting ${operationName}`, context);
      const result = await operation();
      this.incrementSuccessCount();
      this.logger.debug(`Completed ${operationName}`, context);
      return result;
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed ${operationName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
      throw error;
    }
  }
}

// ===== CONFIGURABLE SERVICE =====

export abstract class BaseConfigurableService<T = any> extends BaseService implements IConfigurableService<T> {
  protected _typedConfig: T;

  constructor(name: string, defaultConfig: T, version: string = '1.0.0') {
    super(name, version);
    this._typedConfig = { ...defaultConfig };
  }

  getConfig(): T {
    return { ...this._typedConfig };
  }

  async updateConfig(config: Partial<T>): Promise<void> {
    const newConfig = { ...this._typedConfig, ...config };
    
    if (!this.validateConfig(newConfig)) {
      throw new Error('Invalid configuration provided');
    }

    this._typedConfig = newConfig;
    this._config = newConfig as any;
    
    this.logger.info('Typed configuration updated', { config });
  }

  abstract validateConfig(config: Partial<T>): boolean;
}

// ===== MONITORABLE SERVICE =====

export abstract class BaseMonitorableService extends BaseService implements IMonitorableService {
  protected _metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errorRate: 0
  };

  protected _responseTimes: number[] = [];
  protected _maxResponseTimeHistory: number = 100;

  getMetrics(): ServiceMetrics {
    return { ...this._metrics };
  }

  getHealth(): ServiceHealth {
    const checks = this.performHealthChecks();
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warningChecks = checks.filter(check => check.status === 'warn');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks.length > 0) {
      status = 'unhealthy';
    } else if (warningChecks.length > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      checks,
      lastCheck: new Date(),
      uptime: this._startTime ? Date.now() - this._startTime.getTime() : 0
    };
  }

  resetMetrics(): void {
    this._metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0
    };
    this._responseTimes = [];
    this.logger.info('Metrics reset');
  }

  protected recordRequest(success: boolean, responseTime: number): void {
    this._metrics.totalRequests++;
    
    if (success) {
      this._metrics.successfulRequests++;
    } else {
      this._metrics.failedRequests++;
    }

    // Обновляем историю времени ответа
    this._responseTimes.push(responseTime);
    if (this._responseTimes.length > this._maxResponseTimeHistory) {
      this._responseTimes.shift();
    }

    // Пересчитываем среднее время ответа
    this._metrics.averageResponseTime = 
      this._responseTimes.reduce((sum, time) => sum + time, 0) / this._responseTimes.length;

    // Пересчитываем процент ошибок
    this._metrics.errorRate = this._metrics.failedRequests / this._metrics.totalRequests;

    this._metrics.lastRequestTime = new Date();
  }

  protected performHealthChecks(): HealthCheck[] {
    const checks: HealthCheck[] = [];

    // Проверка базового состояния
    checks.push({
      name: 'service_running',
      status: this._isRunning ? 'pass' : 'fail',
      message: this._isRunning ? 'Service is running' : 'Service is not running',
      timestamp: new Date()
    });

    // Проверка ошибок
    checks.push({
      name: 'error_rate',
      status: this._metrics.errorRate < 0.1 ? 'pass' : this._metrics.errorRate < 0.3 ? 'warn' : 'fail',
      message: `Error rate: ${(this._metrics.errorRate * 100).toFixed(2)}%`,
      timestamp: new Date()
    });

    // Проверка времени ответа
    checks.push({
      name: 'response_time',
      status: this._metrics.averageResponseTime < 5000 ? 'pass' : this._metrics.averageResponseTime < 10000 ? 'warn' : 'fail',
      message: `Average response time: ${this._metrics.averageResponseTime.toFixed(2)}ms`,
      timestamp: new Date()
    });

    return checks;
  }
}

// ===== RETRYABLE SERVICE =====

export abstract class BaseRetryableService extends BaseService implements IRetryableService {
  protected _retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBackoff: true,
    jitter: true,
    retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'TEMPORARY_ERROR']
  };

  getRetryConfig(): RetryConfig {
    return { ...this._retryConfig };
  }

  updateRetryConfig(config: Partial<RetryConfig>): void {
    this._retryConfig = { ...this._retryConfig, ...config };
    this.logger.info('Retry configuration updated', { config });
  }

  async retry<T>(
    operation: () => Promise<T>, 
    context?: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this._retryConfig.maxRetries; attempt++) {
      try {
        this.logger.debug(`Retry attempt ${attempt}/${this._retryConfig.maxRetries}`, { context });
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded on attempt ${attempt}`, { context });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Проверяем, стоит ли повторять
        if (!this.shouldRetry(lastError, attempt)) {
          this.logger.warn(`Operation failed and will not be retried`, { 
            context, 
            attempt, 
            error: lastError.message 
          });
          break;
        }

        // Если это не последняя попытка, ждем
        if (attempt < this._retryConfig.maxRetries) {
          const delay = this.calculateDelay(attempt);
          this.logger.debug(`Waiting ${delay}ms before retry`, { context, attempt });
          await this.delay(delay);
        }
      }
    }

    this.logger.error(`Operation failed after ${this._retryConfig.maxRetries} attempts`, { 
      context, 
      error: lastError?.message 
    });
    throw lastError;
  }

  protected shouldRetry(error: Error, attempt: number): boolean {
    // Проверяем, не превышено ли количество попыток
    if (attempt >= this._retryConfig.maxRetries) {
      return false;
    }

    // Проверяем, является ли ошибка повторяемой
    const errorMessage = error.message.toUpperCase();
    return this._retryConfig.retryableErrors && Array.isArray(this._retryConfig.retryableErrors)
      ? this._retryConfig.retryableErrors.some(retryableError => 
          errorMessage.includes(retryableError)
        )
      : false;
  }

  protected calculateDelay(attempt: number): number {
    let delay = this._retryConfig.baseDelay;

    if (this._retryConfig.exponentialBackoff) {
      delay = delay * Math.pow(2, attempt - 1);
    }

    // Ограничиваем максимальной задержкой
    delay = Math.min(delay, this._retryConfig.maxDelay);

    // Добавляем jitter для избежания thundering herd
    if (this._retryConfig.jitter) {
      delay = delay + Math.random() * delay * 0.1;
    }

    return Math.round(delay);
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== COMBINED BASE SERVICE =====

export abstract class BaseServiceWithAllFeatures<T = any> 
  extends BaseConfigurableService<T> 
  implements IMonitorableService, IRetryableService {
  
  protected _metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errorRate: 0
  };

  protected _responseTimes: number[] = [];
  protected _maxResponseTimeHistory: number = 100;

  protected _retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBackoff: true,
    jitter: true,
    retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'TEMPORARY_ERROR']
  };

  // Реализация методов из BaseMonitorableService
  getMetrics(): ServiceMetrics {
    return { ...this._metrics };
  }

  getHealth(): ServiceHealth {
    const checks = this.performHealthChecks();
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warningChecks = checks.filter(check => check.status === 'warn');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks.length > 0) {
      status = 'unhealthy';
    } else if (warningChecks.length > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      checks,
      lastCheck: new Date(),
      uptime: this._startTime ? Date.now() - this._startTime.getTime() : 0
    };
  }

  resetMetrics(): void {
    this._metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0
    };
    this._responseTimes = [];
    this.logger.info('Metrics reset');
  }

  // Реализация методов из BaseRetryableService
  getRetryConfig(): RetryConfig {
    return { ...this._retryConfig };
  }

  updateRetryConfig(config: Partial<RetryConfig>): void {
    this._retryConfig = { ...this._retryConfig, ...config };
    this.logger.info('Retry configuration updated', { config });
  }

  async retry<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this._retryConfig.maxRetries; attempt++) {
      try {
        this.logger.debug(`Retry attempt ${attempt}/${this._retryConfig.maxRetries}`, { context });
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded on attempt ${attempt}`, { context });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (!this.shouldRetry(lastError, attempt)) {
          this.logger.warn(`Operation failed and will not be retried`, { 
            context, 
            attempt, 
            error: lastError.message 
          });
          break;
        }

        if (attempt < this._retryConfig.maxRetries) {
          const delay = this.calculateDelay(attempt);
          this.logger.debug(`Waiting ${delay}ms before retry`, { context, attempt });
          await this.delay(delay);
        }
      }
    }

    this.logger.error(`Operation failed after ${this._retryConfig.maxRetries} attempts`, { 
      context, 
      error: lastError?.message 
    });
    throw lastError;
  }

  // Защищенные методы
  protected recordRequest(success: boolean, responseTime: number): void {
    this._metrics.totalRequests++;
    
    if (success) {
      this._metrics.successfulRequests++;
    } else {
      this._metrics.failedRequests++;
    }

    this._responseTimes.push(responseTime);
    if (this._responseTimes.length > this._maxResponseTimeHistory) {
      this._responseTimes.shift();
    }

    this._metrics.averageResponseTime = 
      this._responseTimes.reduce((sum, time) => sum + time, 0) / this._responseTimes.length;

    this._metrics.errorRate = this._metrics.failedRequests / this._metrics.totalRequests;
    this._metrics.lastRequestTime = new Date();
  }

  protected performHealthChecks(): HealthCheck[] {
    const checks: HealthCheck[] = [];

    checks.push({
      name: 'service_running',
      status: this._isRunning ? 'pass' : 'fail',
      message: this._isRunning ? 'Service is running' : 'Service is not running',
      timestamp: new Date()
    });

    checks.push({
      name: 'error_rate',
      status: this._metrics.errorRate < 0.1 ? 'pass' : this._metrics.errorRate < 0.3 ? 'warn' : 'fail',
      message: `Error rate: ${(this._metrics.errorRate * 100).toFixed(2)}%`,
      timestamp: new Date()
    });

    checks.push({
      name: 'response_time',
      status: this._metrics.averageResponseTime < 5000 ? 'pass' : this._metrics.averageResponseTime < 10000 ? 'warn' : 'fail',
      message: `Average response time: ${this._metrics.averageResponseTime.toFixed(2)}ms`,
      timestamp: new Date()
    });

    return checks;
  }

  protected shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this._retryConfig.maxRetries) {
      return false;
    }

    const errorMessage = error.message.toUpperCase();
    return this._retryConfig.retryableErrors && Array.isArray(this._retryConfig.retryableErrors)
      ? this._retryConfig.retryableErrors.some(retryableError => 
          errorMessage.includes(retryableError)
        )
      : false;
  }

  protected calculateDelay(attempt: number): number {
    let delay = this._retryConfig.baseDelay;

    if (this._retryConfig.exponentialBackoff) {
      delay = delay * Math.pow(2, attempt - 1);
    }

    delay = Math.min(delay, this._retryConfig.maxDelay);

    if (this._retryConfig.jitter) {
      delay = delay + Math.random() * delay * 0.1;
    }

    return Math.round(delay);
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
