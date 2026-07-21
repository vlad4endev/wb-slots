// ===== BASE SERVICE WITH ALL FEATURES =====

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

// ===== BASE SERVICE WITH ALL FEATURES =====

export abstract class BaseServiceWithAllFeatures<T = any> 
  implements IService, IConfigurableService<T>, IMonitorableService, IRetryableService {
  
  public readonly name: string;
  public readonly version: string;
  public readonly logger: Logger;
  
  protected _isRunning: boolean = false;
  protected _startTime?: Date;
  protected _lastActivity?: Date;
  protected _errorCount: number = 0;
  protected _successCount: number = 0;
  protected _totalRequests: number = 0;
  protected _responseTimes: number[] = [];
  protected _config: Record<string, any> = {};
  protected _typedConfig: T;
  protected _retryConfig: RetryConfig;
  protected _healthChecks: HealthCheck[] = [];

  constructor(
    name: string, 
    defaultConfig: T, 
    defaultRetryConfig: RetryConfig,
    version: string = '1.0.0'
  ) {
    this.name = name;
    this.version = version;
    this.logger = new Logger('INFO', { context: name });
    this._typedConfig = { ...defaultConfig };
    this._retryConfig = { ...defaultRetryConfig };
    this._config = this._typedConfig as any;
  }

  // ===== ABSTRACT METHODS =====

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract validateConfig(config: Partial<T>): boolean;

  // ===== IService IMPLEMENTATION =====

  isRunning(): boolean {
    return this._isRunning;
  }

  getStatus(): ServiceStatus {
    if (!this._startTime) return 'STOPPED';
    if (this._isRunning) return 'RUNNING';
    return 'ERROR';
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
    
    this.logger.info('Configuration updated', { config });
  }

  // ===== IMonitorableService IMPLEMENTATION =====

  getMetrics(): ServiceMetrics {
    const uptime = this._startTime ? Date.now() - this._startTime.getTime() : 0;
    const averageResponseTime = this._responseTimes.length > 0 
      ? this._responseTimes.reduce((a, b) => a + b, 0) / this._responseTimes.length 
      : 0;
    const errorRate = this._totalRequests > 0 ? (this._errorCount / this._totalRequests) * 100 : 0;

    return {
      totalRequests: this._totalRequests,
      successfulRequests: this._successCount,
      failedRequests: this._errorCount,
      averageResponseTime,
      errorRate,
      lastRequestTime: this._lastActivity,
      uptime
    };
  }

  getHealth(): ServiceHealth {
    const uptime = this._startTime ? Date.now() - this._startTime.getTime() : 0;
    const failedChecks = this._healthChecks.filter(check => check.status === 'fail').length;
    const warningChecks = this._healthChecks.filter(check => check.status === 'warn').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks > 0) {
      status = 'unhealthy';
    } else if (warningChecks > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      checks: [...this._healthChecks],
      lastCheck: new Date(),
      uptime
    };
  }

  resetMetrics(): void {
    this._errorCount = 0;
    this._successCount = 0;
    this._totalRequests = 0;
    this._responseTimes = [];
    this._lastActivity = undefined;
    this.logger.info('Metrics reset');
  }

  // ===== IRetryableService IMPLEMENTATION =====

  async retry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this._retryConfig.maxAttempts; attempt++) {
      try {
        this.logger.debug(`Attempt ${attempt}/${this._retryConfig.maxAttempts} for ${context}`);
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded on attempt ${attempt} for ${context}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const isRetryable = this._isRetryableError(error as Error);
        
        if (!isRetryable || attempt === this._retryConfig.maxAttempts) {
          this.logger.error(`Operation failed after ${attempt} attempts for ${context}`, {
            error: lastError.message,
            isRetryable,
            context
          });
          throw lastError;
        }
        
        const delay = Math.min(
          this._retryConfig.initialDelay * Math.pow(this._retryConfig.backoffMultiplier, attempt - 1),
          this._retryConfig.maxDelay
        );
        
        this.logger.warn(`Operation failed on attempt ${attempt}, retrying in ${delay}ms`, {
          error: lastError.message,
          context
        });
        
        await this._delay(delay);
      }
    }
    
    throw lastError || new Error('Operation failed');
  }

  getRetryConfig(): RetryConfig {
    return { ...this._retryConfig };
  }

  updateRetryConfig(config: Partial<RetryConfig>): void {
    this._retryConfig = { ...this._retryConfig, ...config };
    this.logger.info('Retry configuration updated', { config: this._retryConfig });
  }

  // ===== PROTECTED METHODS =====

  protected _recordRequest(success: boolean, responseTime: number): void {
    this._totalRequests++;
    this._responseTimes.push(responseTime);
    this._lastActivity = new Date();
    
    if (success) {
      this._successCount++;
    } else {
      this._errorCount++;
    }
    
    // Keep only last 100 response times for average calculation
    if (this._responseTimes.length > 100) {
      this._responseTimes = this._responseTimes.slice(-100);
    }
  }

  protected _addHealthCheck(name: string, status: 'pass' | 'fail' | 'warn', message?: string, duration?: number): void {
    const check: HealthCheck = {
      name,
      status,
      message,
      duration,
      timestamp: new Date()
    };
    
    // Remove old check with same name
    this._healthChecks = this._healthChecks.filter(c => c.name !== name);
    this._healthChecks.push(check);
    
    // Keep only last 50 health checks
    if (this._healthChecks.length > 50) {
      this._healthChecks = this._healthChecks.slice(-50);
    }
  }

  protected _isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return this._retryConfig.retryableErrors && Array.isArray(this._retryConfig.retryableErrors) 
      ? this._retryConfig.retryableErrors.some(retryableError => 
          errorMessage.includes(retryableError.toLowerCase())
        )
      : false;
  }

  protected async _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected _startService(): void {
    this._startTime = new Date();
    this._isRunning = true;
    this.logger.info('Service started', { 
      name: this.name, 
      version: this.version,
      startTime: this._startTime 
    });
  }

  protected _stopService(): void {
    this._isRunning = false;
    const uptime = this._startTime ? Date.now() - this._startTime.getTime() : 0;
    this.logger.info('Service stopped', { 
      name: this.name, 
      uptime: uptime,
      metrics: this.getMetrics()
    });
  }

  // ===== UTILITY METHODS =====

  protected _validateRequiredConfig(config: Partial<T>, requiredFields: (keyof T)[]): boolean {
    for (const field of requiredFields) {
      if (config[field] === undefined || config[field] === null) {
        this.logger.error(`Required configuration field missing: ${String(field)}`);
        return false;
      }
    }
    return true;
  }

  protected _validateConfigType(config: Partial<T>, fieldValidators: Record<keyof T, (value: any) => boolean>): boolean {
    for (const [field, validator] of Object.entries(fieldValidators)) {
      if (config[field as keyof T] !== undefined && !(validator as (value: any) => boolean)(config[field as keyof T])) {
        this.logger.error(`Invalid configuration for field: ${field}`);
        return false;
      }
    }
    return true;
  }

  protected _logOperation(operation: string, success: boolean, duration: number, details?: any): void {
    this._recordRequest(success, duration);
    
    if (success) {
      this.logger.info(`Operation completed: ${operation}`, { 
        duration, 
        details 
      });
    } else {
      this.logger.error(`Operation failed: ${operation}`, { 
        duration, 
        details 
      });
    }
  }
}
