// ===== ENTERPRISE ARCHITECTURE CORE =====

import { Logger } from '../logging/logger';

// ===== CORE INTERFACES =====

export interface IEnterpriseService {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: ServiceCategory;
  readonly dependencies: string[];
  
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  
  getStatus(): ServiceStatus;
  getHealth(): ServiceHealth;
  getMetrics(): ServiceMetrics;
  getConfiguration(): ServiceConfiguration;
  
  validateConfiguration(config: any): ValidationResult;
  updateConfiguration(config: Partial<any>): Promise<void>;
  
  addDependency(serviceId: string): void;
  removeDependency(serviceId: string): void;
  
  on(event: ServiceEvent, callback: ServiceEventHandler): void;
  off(event: ServiceEvent, callback: ServiceEventHandler): void;
  emit(event: ServiceEvent, data?: any): void;
}

export interface IEnterpriseComponent {
  readonly id: string;
  readonly name: string;
  readonly type: ComponentType;
  readonly version: string;
  
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  
  getStatus(): ComponentStatus;
  getHealth(): ComponentHealth;
  getMetrics(): ComponentMetrics;
}

export interface IEnterpriseModule {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly services: Map<string, IEnterpriseService>;
  readonly components: Map<string, IEnterpriseComponent>;
  
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  registerService(service: IEnterpriseService): void;
  unregisterService(serviceId: string): void;
  
  registerComponent(component: IEnterpriseComponent): void;
  unregisterComponent(componentId: string): void;
  
  getService<T extends IEnterpriseService>(serviceId: string): T | undefined;
  getComponent<T extends IEnterpriseComponent>(componentId: string): T | undefined;
}

// ===== ENUMS =====

export enum ServiceCategory {
  CORE = 'CORE',
  BUSINESS = 'BUSINESS',
  INTEGRATION = 'INTEGRATION',
  SECURITY = 'SECURITY',
  MONITORING = 'MONITORING',
  AUTOMATION = 'AUTOMATION',
  NOTIFICATION = 'NOTIFICATION',
  DATA = 'DATA',
  CACHE = 'CACHE',
  EXTERNAL = 'EXTERNAL'
}

export enum ComponentType {
  SERVICE = 'SERVICE',
  CONTROLLER = 'CONTROLLER',
  REPOSITORY = 'REPOSITORY',
  MIDDLEWARE = 'MIDDLEWARE',
  VALIDATOR = 'VALIDATOR',
  TRANSFORMER = 'TRANSFORMER',
  FACTORY = 'FACTORY',
  MANAGER = 'MANAGER',
  HANDLER = 'HANDLER',
  UTILITY = 'UTILITY'
}

export enum ServiceStatus {
  UNINITIALIZED = 'UNINITIALIZED',
  INITIALIZING = 'INITIALIZING',
  INITIALIZED = 'INITIALIZED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
  MAINTENANCE = 'MAINTENANCE'
}

export enum ComponentStatus {
  UNINITIALIZED = 'UNINITIALIZED',
  INITIALIZING = 'INITIALIZING',
  INITIALIZED = 'INITIALIZED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  DESTROYED = 'DESTROYED'
}

export enum ServiceEvent {
  INITIALIZED = 'INITIALIZED',
  STARTED = 'STARTED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
  HEALTH_CHANGED = 'HEALTH_CHANGED',
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',
  DEPENDENCY_ADDED = 'DEPENDENCY_ADDED',
  DEPENDENCY_REMOVED = 'DEPENDENCY_REMOVED'
}

// ===== TYPES =====

export type ServiceEventHandler = (data?: any) => void;

export interface ServiceHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  score: number; // 0-100
  checks: HealthCheck[];
  lastChecked: Date;
  uptime: number; // milliseconds
  errorRate: number; // 0-1
}

export interface HealthCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message?: string;
  duration: number;
  lastChecked: Date;
}

export interface ServiceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    rate: number; // errors per second
  };
  lastUpdated: Date;
}

export interface ServiceConfiguration {
  id: string;
  name: string;
  version: string;
  category: ServiceCategory;
  settings: Record<string, any>;
  environment: Record<string, any>;
  dependencies: string[];
  metadata: Record<string, any>;
  lastModified: Date;
}

export interface ComponentHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  score: number;
  checks: HealthCheck[];
  lastChecked: Date;
}

export interface ComponentMetrics {
  operations: {
    total: number;
    successful: number;
    failed: number;
    rate: number;
  };
  performance: {
    averageOperationTime: number;
    p95OperationTime: number;
    p99OperationTime: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
  };
  lastUpdated: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  value?: any;
}

// ===== BASE ENTERPRISE SERVICE =====

export abstract class BaseEnterpriseService implements IEnterpriseService {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly category: ServiceCategory;
  public readonly dependencies: string[] = [];
  
  protected readonly logger: Logger;
  protected _status: ServiceStatus = ServiceStatus.UNINITIALIZED;
  protected _startTime?: Date;
  protected _lastActivity?: Date;
  protected _errorCount: number = 0;
  protected _successCount: number = 0;
  protected _totalRequests: number = 0;
  protected _responseTimes: number[] = [];
  protected _configuration: ServiceConfiguration;
  protected _eventHandlers: Map<ServiceEvent, ServiceEventHandler[]> = new Map();
  protected _healthChecks: HealthCheck[] = [];
  protected _metrics: ServiceMetrics;

  constructor(
    id: string,
    name: string,
    version: string,
    category: ServiceCategory,
    initialConfig: Partial<ServiceConfiguration> = {}
  ) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.category = category;
    this.logger = new Logger('INFO', { context: `${category}:${name}` });
    
    this._configuration = {
      id,
      name,
      version,
      category,
      settings: {},
      environment: {},
      dependencies: [],
      metadata: {},
      lastModified: new Date(),
      ...initialConfig
    };

    this._metrics = {
      requests: { total: 0, successful: 0, failed: 0, rate: 0 },
      performance: { averageResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0, throughput: 0 },
      resources: { memoryUsage: 0, cpuUsage: 0, diskUsage: 0 },
      errors: { total: 0, byType: {}, rate: 0 },
      lastUpdated: new Date()
    };

    this.initializeEventHandlers();
  }

  // ===== ABSTRACT METHODS =====

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  // ===== IMPLEMENTATION =====

  async restart(): Promise<void> {
    this.logger.info('🔄 Restarting service');
    await this.stop();
    await this.start();
  }

  getStatus(): ServiceStatus {
    return this._status;
  }

  getHealth(): ServiceHealth {
    const now = new Date();
    const uptime = this._startTime ? now.getTime() - this._startTime.getTime() : 0;
    const errorRate = this._totalRequests > 0 ? this._errorCount / this._totalRequests : 0;
    
    // Calculate health score based on various factors
    let score = 100;
    if (errorRate > 0.1) score -= 30; // High error rate
    if (errorRate > 0.05) score -= 15; // Medium error rate
    if (this._status !== ServiceStatus.RUNNING) score -= 50; // Not running
    
    // Check individual health checks
    const failedChecks = this._healthChecks.filter(check => check.status === 'FAIL').length;
    const warningChecks = this._healthChecks.filter(check => check.status === 'WARN').length;
    
    score -= failedChecks * 20;
    score -= warningChecks * 5;
    
    score = Math.max(0, Math.min(100, score));
    
    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    if (score >= 90) status = 'HEALTHY';
    else if (score >= 70) status = 'DEGRADED';
    else status = 'UNHEALTHY';

    return {
      status,
      score,
      checks: [...this._healthChecks],
      lastChecked: now,
      uptime,
      errorRate
    };
  }

  getMetrics(): ServiceMetrics {
    // Calculate performance metrics
    const avgResponseTime = this._responseTimes.length > 0 
      ? this._responseTimes.reduce((a, b) => a + b, 0) / this._responseTimes.length 
      : 0;
    
    const sortedTimes = [...this._responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    const p99ResponseTime = sortedTimes[p99Index] || 0;
    
    const uptime = this._startTime ? Date.now() - this._startTime.getTime() : 0;
    const throughput = uptime > 0 ? (this._totalRequests / uptime) * 1000 : 0;
    const requestRate = uptime > 0 ? (this._totalRequests / uptime) * 1000 : 0;
    const errorRate = uptime > 0 ? (this._errorCount / uptime) * 1000 : 0;

    return {
      requests: {
        total: this._totalRequests,
        successful: this._successCount,
        failed: this._errorCount,
        rate: requestRate
      },
      performance: {
        averageResponseTime: avgResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        throughput
      },
      resources: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: 0, // Would need additional monitoring
        diskUsage: 0 // Would need additional monitoring
      },
      errors: {
        total: this._errorCount,
        byType: {}, // Would be populated by error tracking
        rate: errorRate
      },
      lastUpdated: new Date()
    };
  }

  getConfiguration(): ServiceConfiguration {
    return { ...this._configuration };
  }

  validateConfiguration(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic validation
    if (!config || typeof config !== 'object') {
      errors.push({
        field: 'config',
        code: 'INVALID_TYPE',
        message: 'Configuration must be an object'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async updateConfiguration(config: Partial<any>): Promise<void> {
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this._configuration = {
      ...this._configuration,
      ...config,
      lastModified: new Date()
    };

    this.emit(ServiceEvent.CONFIGURATION_CHANGED, config);
    this.logger.info('⚙️ Configuration updated');
  }

  addDependency(serviceId: string): void {
    if (!this.dependencies.includes(serviceId)) {
      this.dependencies.push(serviceId);
      this.emit(ServiceEvent.DEPENDENCY_ADDED, { serviceId });
      this.logger.info(`🔗 Dependency added: ${serviceId}`);
    }
  }

  removeDependency(serviceId: string): void {
    const index = this.dependencies.indexOf(serviceId);
    if (index > -1) {
      this.dependencies.splice(index, 1);
      this.emit(ServiceEvent.DEPENDENCY_REMOVED, { serviceId });
      this.logger.info(`🔗 Dependency removed: ${serviceId}`);
    }
  }

  on(event: ServiceEvent, callback: ServiceEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)!.push(callback);
  }

  off(event: ServiceEvent, callback: ServiceEventHandler): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: ServiceEvent, data?: any): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.logger.error(`❌ Event handler error for ${event}`, { error });
        }
      });
    }
  }

  // ===== PROTECTED METHODS =====

  protected setStatus(status: ServiceStatus): void {
    const oldStatus = this._status;
    this._status = status;
    
    if (status === ServiceStatus.RUNNING && !this._startTime) {
      this._startTime = new Date();
    }
    
    this.logger.info(`📊 Status changed: ${oldStatus} → ${status}`);
  }

  protected recordRequest(success: boolean, responseTime: number): void {
    this._totalRequests++;
    this._lastActivity = new Date();
    
    if (success) {
      this._successCount++;
    } else {
      this._errorCount++;
    }
    
    this._responseTimes.push(responseTime);
    
    // Keep only last 1000 response times for performance
    if (this._responseTimes.length > 1000) {
      this._responseTimes = this._responseTimes.slice(-1000);
    }
  }

  protected addHealthCheck(check: HealthCheck): void {
    this._healthChecks.push(check);
  }

  protected updateHealthCheck(name: string, status: 'PASS' | 'FAIL' | 'WARN', message?: string): void {
    const check = this._healthChecks.find(c => c.name === name);
    if (check) {
      check.status = status;
      check.message = message;
      check.lastChecked = new Date();
    } else {
      this._healthChecks.push({
        name,
        status,
        message,
        duration: 0,
        lastChecked: new Date()
      });
    }
  }

  // ===== PRIVATE METHODS =====

  private initializeEventHandlers(): void {
    // Initialize event handler maps
    Object.values(ServiceEvent).forEach(event => {
      this._eventHandlers.set(event, []);
    });
  }
}

// ===== BASE ENTERPRISE COMPONENT =====

export abstract class BaseEnterpriseComponent implements IEnterpriseComponent {
  public readonly id: string;
  public readonly name: string;
  public readonly type: ComponentType;
  public readonly version: string;
  
  protected readonly logger: Logger;
  protected _status: ComponentStatus = ComponentStatus.UNINITIALIZED;
  protected _healthChecks: HealthCheck[] = [];
  protected _metrics: ComponentMetrics;

  constructor(
    id: string,
    name: string,
    type: ComponentType,
    version: string
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.version = version;
    this.logger = new Logger('INFO', { context: `${type}:${name}` });
    
    this._metrics = {
      operations: { total: 0, successful: 0, failed: 0, rate: 0 },
      performance: { averageOperationTime: 0, p95OperationTime: 0, p99OperationTime: 0 },
      resources: { memoryUsage: 0, cpuUsage: 0 },
      lastUpdated: new Date()
    };
  }

  // ===== ABSTRACT METHODS =====

  abstract initialize(): Promise<void>;
  abstract destroy(): Promise<void>;

  // ===== IMPLEMENTATION =====

  getStatus(): ComponentStatus {
    return this._status;
  }

  getHealth(): ComponentHealth {
    const now = new Date();
    const failedChecks = this._healthChecks.filter(check => check.status === 'FAIL').length;
    const warningChecks = this._healthChecks.filter(check => check.status === 'WARN').length;
    
    let score = 100;
    score -= failedChecks * 20;
    score -= warningChecks * 5;
    
    if (this._status !== ComponentStatus.ACTIVE) score -= 50;
    
    score = Math.max(0, Math.min(100, score));
    
    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    if (score >= 90) status = 'HEALTHY';
    else if (score >= 70) status = 'DEGRADED';
    else status = 'UNHEALTHY';

    return {
      status,
      score,
      checks: [...this._healthChecks],
      lastChecked: now
    };
  }

  getMetrics(): ComponentMetrics {
    return { ...this._metrics };
  }

  // ===== PROTECTED METHODS =====

  protected setStatus(status: ComponentStatus): void {
    const oldStatus = this._status;
    this._status = status;
    this.logger.info(`📊 Status changed: ${oldStatus} → ${status}`);
  }

  protected recordOperation(success: boolean, duration: number): void {
    this._metrics.operations.total++;
    this._metrics.lastUpdated = new Date();
    
    if (success) {
      this._metrics.operations.successful++;
    } else {
      this._metrics.operations.failed++;
    }
    
    // Update performance metrics (simplified)
    const totalOps = this._metrics.operations.total;
    this._metrics.performance.averageOperationTime = 
      (this._metrics.performance.averageOperationTime * (totalOps - 1) + duration) / totalOps;
  }

  protected addHealthCheck(check: HealthCheck): void {
    this._healthChecks.push(check);
  }
}
