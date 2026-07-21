/**
 * 🏗️ Базовый класс для всех сервисов
 * Реализует общую функциональность для всех сервисов
 */

import { 
  IBaseService, 
  ServiceHealth, 
  ServiceMetrics, 
  ServiceConfig, 
  ServiceStatus,
  DEFAULT_SERVICE_CONFIG,
  ServiceError 
} from './unified-interfaces';

export abstract class BaseService implements IBaseService {
  public readonly name: string;
  public readonly version: string;
  
  protected _status: ServiceStatus = ServiceStatus.STOPPED;
  protected _config: ServiceConfig;
  protected _startTime?: Date;
  protected _metrics: ServiceMetrics;
  protected _errors: string[] = [];
  protected _middleware: any[] = [];

  constructor(name: string, version: string, config: Partial<ServiceConfig> = {}) {
    this.name = name;
    this.version = version;
    this._config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this._metrics = this.initializeMetrics();
  }

  // ============================================================================
  // АБСТРАКТНЫЕ МЕТОДЫ (должны быть реализованы в наследниках)
  // ============================================================================

  protected abstract doInitialize(): Promise<void>;
  protected abstract doStart(): Promise<void>;
  protected abstract doStop(): Promise<void>;

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА IBaseService
  // ============================================================================

  async initialize(): Promise<void> {
    try {
      this.log('info', `Initializing ${this.name} service...`);
      this._status = ServiceStatus.STARTING;
      
      await this.doInitialize();
      
      this.log('info', `${this.name} service initialized successfully`);
    } catch (error) {
      this._status = ServiceStatus.ERROR;
      this.log('error', `Failed to initialize ${this.name} service`, error);
      throw new ServiceError(this.name, 'initialize', 'Initialization failed', undefined, error);
    }
  }

  async start(): Promise<void> {
    try {
      if (this._status === ServiceStatus.RUNNING) {
        this.log('warn', `${this.name} service is already running`);
        return;
      }

      this.log('info', `Starting ${this.name} service...`);
      this._status = ServiceStatus.STARTING;
      
      await this.doStart();
      
      this._status = ServiceStatus.RUNNING;
      this._startTime = new Date();
      this._errors = [];
      
      this.log('info', `${this.name} service started successfully`);
    } catch (error) {
      this._status = ServiceStatus.ERROR;
      this.log('error', `Failed to start ${this.name} service`, error);
      throw new ServiceError(this.name, 'start', 'Start failed', undefined, error);
    }
  }

  async stop(): Promise<void> {
    try {
      if (this._status === ServiceStatus.STOPPED) {
        this.log('warn', `${this.name} service is already stopped`);
        return;
      }

      this.log('info', `Stopping ${this.name} service...`);
      this._status = ServiceStatus.STOPPING;
      
      await this.doStop();
      
      this._status = ServiceStatus.STOPPED;
      this._startTime = undefined;
      
      this.log('info', `${this.name} service stopped successfully`);
    } catch (error) {
      this._status = ServiceStatus.ERROR;
      this.log('error', `Failed to stop ${this.name} service`, error);
      throw new ServiceError(this.name, 'stop', 'Stop failed', undefined, error);
    }
  }

  async restart(): Promise<void> {
    this.log('info', `Restarting ${this.name} service...`);
    await this.stop();
    await this.start();
  }

  async getHealth(): Promise<ServiceHealth> {
    const uptime = this._startTime ? Date.now() - this._startTime.getTime() : 0;
    
    return {
      status: this.getHealthStatus(),
      uptime,
      lastCheck: new Date(),
      errors: [...this._errors],
      metrics: {
        totalRequests: this._metrics.totalRequests,
        successfulRequests: this._metrics.successfulRequests,
        failedRequests: this._metrics.failedRequests,
        averageResponseTime: this._metrics.averageResponseTime
      }
    };
  }

  async getMetrics(): Promise<ServiceMetrics> {
    return { ...this._metrics };
  }

  getConfig(): ServiceConfig {
    return { ...this._config };
  }

  async updateConfig(config: Partial<ServiceConfig>): Promise<void> {
    this._config = { ...this._config, ...config };
    this.log('info', `Configuration updated for ${this.name} service`, config);
  }

  log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
        break;
      case 'warn':
        console.warn(logMessage, data ? JSON.stringify(data, null, 2) : '');
        break;
      case 'error':
        console.error(logMessage, data ? JSON.stringify(data, null, 2) : '');
        this._errors.push(`${timestamp}: ${message}`);
        // Ограничиваем количество ошибок в памяти
        if (this._errors.length > 100) {
          this._errors = this._errors.slice(-50);
        }
        break;
    }
  }

  // ============================================================================
  // ЗАЩИЩЕННЫЕ МЕТОДЫ ДЛЯ НАСЛЕДНИКОВ
  // ============================================================================

  protected get status(): ServiceStatus {
    return this._status;
  }

  protected get config(): ServiceConfig {
    return this._config;
  }

  protected updateMetrics(operation: 'request' | 'success' | 'failure', responseTime?: number): void {
    this._metrics.totalRequests++;
    
    if (operation === 'success') {
      this._metrics.successfulRequests++;
    } else if (operation === 'failure') {
      this._metrics.failedRequests++;
    }
    
    if (responseTime !== undefined) {
      // Простое скользящее среднее для времени ответа
      const alpha = 0.1; // Коэффициент сглаживания
      this._metrics.averageResponseTime = 
        this._metrics.averageResponseTime * (1 - alpha) + responseTime * alpha;
    }
    
    this._metrics.lastActivity = new Date();
  }

  protected async executeWithMetrics<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const responseTime = Date.now() - startTime;
      this.updateMetrics('success', responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics('failure', responseTime);
      this.log('error', `Operation ${operation} failed`, error);
      throw error;
    }
  }

  protected async executeWithRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts || this._config.retryAttempts;
    let lastError: Error;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.executeWithMetrics(operation, fn);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < attempts) {
          const delay = this._config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.log('warn', `Operation ${operation} failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms`, error);
          await this.sleep(delay);
        }
      }
    }
    
    throw new ServiceError(this.name, operation, `Operation failed after ${attempts} attempts`, undefined, lastError);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected validateConfig(config: any, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (config[field] === undefined || config[field] === null) {
        throw new ServiceError(
          this.name, 
          'validateConfig', 
          `Required field '${field}' is missing`, 
          'VALIDATION_ERROR'
        );
      }
    }
  }

  // ============================================================================
  // ПРИВАТНЫЕ МЕТОДЫ
  // ============================================================================

  private initializeMetrics(): ServiceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastActivity: new Date()
    };
  }

  private getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    if (this._status === ServiceStatus.ERROR) {
      return 'unhealthy';
    }
    
    if (this._status === ServiceStatus.RUNNING) {
      const errorRate = this._metrics.totalRequests > 0 
        ? this._metrics.failedRequests / this._metrics.totalRequests 
        : 0;
      
      if (errorRate > 0.5) {
        return 'unhealthy';
      } else if (errorRate > 0.1) {
        return 'degraded';
      } else {
        return 'healthy';
      }
    }
    
    return 'unhealthy';
  }
}

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С СЕРВИСАМИ
// ============================================================================

export class ServiceManager {
  private services: Map<string, IBaseService> = new Map();
  private middleware: any[] = [];

  registerService(service: IBaseService): void {
    this.services.set(service.name, service);
  }

  unregisterService(name: string): void {
    this.services.delete(name);
  }

  getService<T extends IBaseService>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  async startAllServices(): Promise<void> {
    const promises = Array.from(this.services.values()).map(service => 
      service.start().catch(error => {
        console.error(`Failed to start service ${service.name}:`, error);
        return null;
      })
    );
    
    await Promise.all(promises);
  }

  async stopAllServices(): Promise<void> {
    const promises = Array.from(this.services.values()).map(service => 
      service.stop().catch(error => {
        console.error(`Failed to stop service ${service.name}:`, error);
        return null;
      })
    );
    
    await Promise.all(promises);
  }

  async getAllServicesHealth(): Promise<Record<string, ServiceHealth>> {
    const health: Record<string, ServiceHealth> = {};
    
    for (const [name, service] of this.services) {
      try {
        health[name] = await service.getHealth();
      } catch (error) {
        health[name] = {
          status: 'unhealthy',
          uptime: 0,
          lastCheck: new Date(),
          errors: [`Health check failed: ${error}`],
          metrics: {}
        };
      }
    }
    
    return health;
  }

  async getAllServicesMetrics(): Promise<Record<string, ServiceMetrics>> {
    const metrics: Record<string, ServiceMetrics> = {};
    
    for (const [name, service] of this.services) {
      try {
        metrics[name] = await service.getMetrics();
      } catch (error) {
        metrics[name] = {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          lastActivity: new Date()
        };
      }
    }
    
    return metrics;
  }
}
