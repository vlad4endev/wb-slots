// ===== ENTERPRISE MONITORING SYSTEM =====

import { Logger } from '../logging/logger';
import { 
  IEnterpriseService, 
  IEnterpriseComponent, 
  ServiceCategory,
  ComponentType,
  ServiceStatus,
  ComponentStatus
} from './enterprise-architecture-core';

// ===== INTERFACES =====

export interface MonitoringConfig {
  enableRealTimeMonitoring: boolean;
  enableMetricsCollection: boolean;
  enableHealthChecks: boolean;
  enableAlerting: boolean;
  enableTracing: boolean;
  enableProfiling: boolean;
  
  collectionInterval: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  alertCheckInterval: number; // milliseconds
  
  retentionPeriod: number; // days
  maxMetricsHistory: number;
  maxAlertsHistory: number;
  
  alertThresholds: AlertThresholds;
  performanceThresholds: PerformanceThresholds;
}

export interface AlertThresholds {
  errorRate: number; // 0-1
  responseTime: number; // milliseconds
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  diskUsage: number; // percentage
  healthScore: number; // 0-100
  downtime: number; // milliseconds
}

export interface PerformanceThresholds {
  apiResponseTime: number; // milliseconds
  databaseResponseTime: number; // milliseconds
  externalServiceResponseTime: number; // milliseconds
  throughput: number; // requests per second
  concurrentUsers: number;
  memoryLeakThreshold: number; // MB per hour
}

export interface MonitoringMetrics {
  timestamp: Date;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  
  performance: PerformanceMetrics;
  health: HealthMetrics;
  resources: ResourceMetrics;
  errors: ErrorMetrics;
  business: BusinessMetrics;
}

export interface PerformanceMetrics {
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  latency: {
    network: number;
    processing: number;
    database: number;
    external: number;
  };
}

export interface HealthMetrics {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  score: number; // 0-100
  uptime: number; // milliseconds
  availability: number; // percentage
  checks: HealthCheckResult[];
}

export interface HealthCheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message?: string;
  duration: number;
  lastChecked: Date;
}

export interface ResourceMetrics {
  memory: {
    used: number; // MB
    total: number; // MB
    percentage: number;
    heap: number; // MB
    nonHeap: number; // MB
  };
  cpu: {
    usage: number; // percentage
    load: number;
    cores: number;
  };
  disk: {
    used: number; // MB
    total: number; // MB
    percentage: number;
    readRate: number; // MB/s
    writeRate: number; // MB/s
  };
  network: {
    bytesIn: number; // bytes
    bytesOut: number; // bytes
    packetsIn: number;
    packetsOut: number;
    errors: number;
  };
}

export interface ErrorMetrics {
  total: number;
  rate: number; // errors per second
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  recent: ErrorEvent[];
}

export interface ErrorEvent {
  timestamp: Date;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  stackTrace?: string;
  context?: Record<string, any>;
}

export interface BusinessMetrics {
  transactions: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // per second
  };
  users: {
    active: number;
    new: number;
    returning: number;
  };
  revenue?: {
    total: number;
    rate: number; // per hour
  };
  custom: Record<string, number>;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  
  threshold: number;
  actualValue: number;
  context: Record<string, any>;
  
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';
}

export interface Trace {
  id: string;
  serviceId: string;
  operation: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  
  spans: Span[];
  tags: Record<string, string>;
  logs: LogEntry[];
  
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  error?: string;
}

export interface Span {
  id: string;
  parentId?: string;
  operation: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  
  tags: Record<string, string>;
  logs: LogEntry[];
  
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  error?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  fields: Record<string, any>;
  stackTrace?: string;
}

export interface Profile {
  id: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  
  samples: ProfileSample[];
  functions: ProfileFunction[];
  memory: ProfileMemory;
  
  summary: ProfileSummary;
}

export interface ProfileSample {
  timestamp: Date;
  stack: string[];
  duration: number;
  memory: number;
}

export interface ProfileFunction {
  name: string;
  file: string;
  line: number;
  calls: number;
  totalTime: number;
  selfTime: number;
  memory: number;
}

export interface ProfileMemory {
  heap: {
    used: number;
    total: number;
    peak: number;
  };
  nonHeap: {
    used: number;
    total: number;
  };
  gc: {
    collections: number;
    time: number;
  };
}

export interface ProfileSummary {
  totalSamples: number;
  totalTime: number;
  totalMemory: number;
  topFunctions: ProfileFunction[];
  memoryLeaks: string[];
  performanceBottlenecks: string[];
}

// ===== ENUMS =====

export enum AlertType {
  ERROR_RATE = 'ERROR_RATE',
  RESPONSE_TIME = 'RESPONSE_TIME',
  MEMORY_USAGE = 'MEMORY_USAGE',
  CPU_USAGE = 'CPU_USAGE',
  DISK_USAGE = 'DISK_USAGE',
  HEALTH_SCORE = 'HEALTH_SCORE',
  DOWNTIME = 'DOWNTIME',
  THROUGHPUT = 'THROUGHPUT',
  AVAILABILITY = 'AVAILABILITY',
  CUSTOM = 'CUSTOM'
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ===== ENTERPRISE MONITORING SYSTEM =====

export class EnterpriseMonitoringSystem {
  private static instance: EnterpriseMonitoringSystem;
  private logger: Logger;
  private config: MonitoringConfig;
  
  // Data storage
  private metrics: Map<string, MonitoringMetrics[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private traces: Map<string, Trace> = new Map();
  private profiles: Map<string, Profile> = new Map();
  
  // Monitoring timers
  private metricsTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private alertCheckTimer?: NodeJS.Timeout;
  
  // Event handlers
  private eventHandlers: Map<string, Function[]> = new Map();
  
  // Services and components being monitored
  private monitoredServices: Map<string, IEnterpriseService> = new Map();
  private monitoredComponents: Map<string, IEnterpriseComponent> = new Map();

  private constructor() {
    this.logger = new Logger('INFO', { context: 'EnterpriseMonitoringSystem' });
    
    this.config = {
      enableRealTimeMonitoring: true,
      enableMetricsCollection: true,
      enableHealthChecks: true,
      enableAlerting: true,
      enableTracing: true,
      enableProfiling: false,
      
      collectionInterval: 30000, // 30 seconds
      healthCheckInterval: 60000, // 1 minute
      alertCheckInterval: 30000, // 30 seconds
      
      retentionPeriod: 30, // 30 days
      maxMetricsHistory: 10000,
      maxAlertsHistory: 1000,
      
      alertThresholds: {
        errorRate: 0.05, // 5%
        responseTime: 1000, // 1 second
        memoryUsage: 1024, // 1 GB
        cpuUsage: 80, // 80%
        diskUsage: 90, // 90%
        healthScore: 70, // 70%
        downtime: 300000 // 5 minutes
      },
      
      performanceThresholds: {
        apiResponseTime: 200, // 200ms
        databaseResponseTime: 100, // 100ms
        externalServiceResponseTime: 500, // 500ms
        throughput: 1000, // 1000 RPS
        concurrentUsers: 10000,
        memoryLeakThreshold: 100 // 100 MB per hour
      }
    };

    this.initializeMonitoring();
  }

  public static getInstance(): EnterpriseMonitoringSystem {
    if (!EnterpriseMonitoringSystem.instance) {
      EnterpriseMonitoringSystem.instance = new EnterpriseMonitoringSystem();
    }
    return EnterpriseMonitoringSystem.instance;
  }

  // ===== SERVICE REGISTRATION =====

  registerService(service: IEnterpriseService): void {
    this.monitoredServices.set(service.id, service);
    this.logger.info(`📊 Registered service for monitoring: ${service.name}`);
    this.emit('service:registered', { serviceId: service.id, serviceName: service.name });
  }

  unregisterService(serviceId: string): void {
    const service = this.monitoredServices.get(serviceId);
    if (service) {
      this.monitoredServices.delete(serviceId);
      this.logger.info(`📊 Unregistered service from monitoring: ${service.name}`);
      this.emit('service:unregistered', { serviceId, serviceName: service.name });
    }
  }

  registerComponent(component: IEnterpriseComponent): void {
    this.monitoredComponents.set(component.id, component);
    this.logger.info(`📊 Registered component for monitoring: ${component.name}`);
    this.emit('component:registered', { componentId: component.id, componentName: component.name });
  }

  unregisterComponent(componentId: string): void {
    const component = this.monitoredComponents.get(componentId);
    if (component) {
      this.monitoredComponents.delete(componentId);
      this.logger.info(`📊 Unregistered component from monitoring: ${component.name}`);
      this.emit('component:unregistered', { componentId, componentName: component.name });
    }
  }

  // ===== METRICS COLLECTION =====

  private async collectMetrics(): Promise<void> {
    if (!this.config.enableMetricsCollection) return;

    const now = new Date();
    
    // Collect service metrics
    for (const [serviceId, service] of Array.from(this.monitoredServices.entries())) {
      try {
        const metrics = await this.collectServiceMetrics(service);
        this.storeMetrics(serviceId, metrics);
      } catch (error) {
        this.logger.error(`❌ Failed to collect metrics for service: ${service.name}`, { error });
      }
    }
    
    // Collect component metrics
    for (const [componentId, component] of Array.from(this.monitoredComponents.entries())) {
      try {
        const metrics = await this.collectComponentMetrics(component);
        this.storeMetrics(componentId, metrics);
      } catch (error) {
        this.logger.error(`❌ Failed to collect metrics for component: ${component.name}`, { error });
      }
    }
    
    this.cleanupOldMetrics();
  }

  private async collectServiceMetrics(service: IEnterpriseService): Promise<MonitoringMetrics> {
    const serviceMetrics = service.getMetrics();
    const health = service.getHealth();
    
    return {
      timestamp: new Date(),
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      
      performance: {
        responseTime: {
          average: serviceMetrics.performance.averageResponseTime,
          p50: serviceMetrics.performance.averageResponseTime,
          p95: serviceMetrics.performance.p95ResponseTime,
          p99: serviceMetrics.performance.p99ResponseTime,
          max: serviceMetrics.performance.p99ResponseTime
        },
        throughput: {
          requestsPerSecond: serviceMetrics.performance.throughput,
          requestsPerMinute: serviceMetrics.performance.throughput * 60,
          requestsPerHour: serviceMetrics.performance.throughput * 3600
        },
        latency: {
          network: 0, // Would be collected from network monitoring
          processing: serviceMetrics.performance.averageResponseTime,
          database: 0, // Would be collected from database monitoring
          external: 0 // Would be collected from external service monitoring
        }
      },
      
      health: {
        status: health.status,
        score: health.score,
        uptime: health.uptime,
        availability: health.status === 'HEALTHY' ? 100 : health.status === 'DEGRADED' ? 80 : 0,
        checks: health.checks.map(check => ({
          name: check.name,
          status: check.status,
          message: check.message,
          duration: check.duration,
          lastChecked: check.lastChecked
        }))
      },
      
      resources: {
        memory: {
          used: serviceMetrics.resources.memoryUsage / (1024 * 1024), // Convert to MB
          total: process.memoryUsage().heapTotal / (1024 * 1024),
          percentage: (serviceMetrics.resources.memoryUsage / process.memoryUsage().heapTotal) * 100,
          heap: serviceMetrics.resources.memoryUsage / (1024 * 1024),
          nonHeap: 0
        },
        cpu: {
          usage: serviceMetrics.resources.cpuUsage,
          load: 0, // Would be collected from system monitoring
          cores: require('os').cpus().length
        },
        disk: {
          used: 0, // Would be collected from system monitoring
          total: 0,
          percentage: 0,
          readRate: 0,
          writeRate: 0
        },
        network: {
          bytesIn: 0,
          bytesOut: 0,
          packetsIn: 0,
          packetsOut: 0,
          errors: 0
        }
      },
      
      errors: {
        total: serviceMetrics.errors.total,
        rate: serviceMetrics.errors.rate,
        byType: serviceMetrics.errors.byType,
        bySeverity: {},
        recent: []
      },
      
      business: {
        transactions: {
          total: serviceMetrics.requests.total,
          successful: serviceMetrics.requests.successful,
          failed: serviceMetrics.requests.failed,
          rate: serviceMetrics.requests.rate
        },
        users: {
          active: 0, // Would be collected from business logic
          new: 0,
          returning: 0
        },
        custom: {}
      }
    };
  }

  private async collectComponentMetrics(component: IEnterpriseComponent): Promise<MonitoringMetrics> {
    const componentMetrics = component.getMetrics();
    const health = component.getHealth();
    
    return {
      timestamp: new Date(),
      serviceId: component.id,
      serviceName: component.name,
      category: ServiceCategory.CORE, // Components are typically core
      
      performance: {
        responseTime: {
          average: componentMetrics.performance.averageOperationTime,
          p50: componentMetrics.performance.averageOperationTime,
          p95: componentMetrics.performance.p95OperationTime,
          p99: componentMetrics.performance.p99OperationTime,
          max: componentMetrics.performance.p99OperationTime
        },
        throughput: {
          requestsPerSecond: componentMetrics.operations.rate,
          requestsPerMinute: componentMetrics.operations.rate * 60,
          requestsPerHour: componentMetrics.operations.rate * 3600
        },
        latency: {
          network: 0,
          processing: componentMetrics.performance.averageOperationTime,
          database: 0,
          external: 0
        }
      },
      
      health: {
        status: health.status,
        score: health.score,
        uptime: 0,
        availability: health.status === 'HEALTHY' ? 100 : health.status === 'DEGRADED' ? 80 : 0,
        checks: health.checks.map(check => ({
          name: check.name,
          status: check.status,
          message: check.message,
          duration: check.duration,
          lastChecked: check.lastChecked
        }))
      },
      
      resources: {
        memory: {
          used: componentMetrics.resources.memoryUsage / (1024 * 1024),
          total: process.memoryUsage().heapTotal / (1024 * 1024),
          percentage: (componentMetrics.resources.memoryUsage / process.memoryUsage().heapTotal) * 100,
          heap: componentMetrics.resources.memoryUsage / (1024 * 1024),
          nonHeap: 0
        },
        cpu: {
          usage: componentMetrics.resources.cpuUsage,
          load: 0,
          cores: require('os').cpus().length
        },
        disk: {
          used: 0,
          total: 0,
          percentage: 0,
          readRate: 0,
          writeRate: 0
        },
        network: {
          bytesIn: 0,
          bytesOut: 0,
          packetsIn: 0,
          packetsOut: 0,
          errors: 0
        }
      },
      
      errors: {
        total: componentMetrics.operations.failed,
        rate: 0,
        byType: {},
        bySeverity: {},
        recent: []
      },
      
      business: {
        transactions: {
          total: componentMetrics.operations.total,
          successful: componentMetrics.operations.successful,
          failed: componentMetrics.operations.failed,
          rate: componentMetrics.operations.rate
        },
        users: {
          active: 0,
          new: 0,
          returning: 0
        },
        custom: {}
      }
    };
  }

  // ===== ALERTING =====

  private async checkAlerts(): Promise<void> {
    if (!this.config.enableAlerting) return;

    const now = new Date();
    
    for (const [serviceId, serviceMetrics] of Array.from(this.metrics.entries())) {
      const latestMetrics = serviceMetrics[serviceMetrics.length - 1];
      if (!latestMetrics) continue;

      await this.checkServiceAlerts(serviceId, latestMetrics);
    }
  }

  private async checkServiceAlerts(serviceId: string, metrics: MonitoringMetrics): Promise<void> {
    const alerts: Alert[] = [];

    // Check error rate
    if (metrics.errors.rate > this.config.alertThresholds.errorRate) {
      alerts.push({
        id: `error_rate_${serviceId}_${Date.now()}`,
        type: AlertType.ERROR_RATE,
        severity: AlertSeverity.HIGH,
        title: 'High Error Rate',
        description: `Service ${metrics.serviceName} has high error rate: ${(metrics.errors.rate * 100).toFixed(2)}%`,
        serviceId,
        serviceName: metrics.serviceName,
        category: metrics.category,
        triggeredAt: new Date(),
        threshold: this.config.alertThresholds.errorRate,
        actualValue: metrics.errors.rate,
        context: { metrics },
        status: 'ACTIVE'
      });
    }

    // Check response time
    if (metrics.performance.responseTime.average > this.config.alertThresholds.responseTime) {
      alerts.push({
        id: `response_time_${serviceId}_${Date.now()}`,
        type: AlertType.RESPONSE_TIME,
        severity: AlertSeverity.MEDIUM,
        title: 'High Response Time',
        description: `Service ${metrics.serviceName} has high response time: ${metrics.performance.responseTime.average}ms`,
        serviceId,
        serviceName: metrics.serviceName,
        category: metrics.category,
        triggeredAt: new Date(),
        threshold: this.config.alertThresholds.responseTime,
        actualValue: metrics.performance.responseTime.average,
        context: { metrics },
        status: 'ACTIVE'
      });
    }

    // Check memory usage
    if (metrics.resources.memory.used > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        id: `memory_usage_${serviceId}_${Date.now()}`,
        type: AlertType.MEMORY_USAGE,
        severity: AlertSeverity.HIGH,
        title: 'High Memory Usage',
        description: `Service ${metrics.serviceName} has high memory usage: ${metrics.resources.memory.used}MB`,
        serviceId,
        serviceName: metrics.serviceName,
        category: metrics.category,
        triggeredAt: new Date(),
        threshold: this.config.alertThresholds.memoryUsage,
        actualValue: metrics.resources.memory.used,
        context: { metrics },
        status: 'ACTIVE'
      });
    }

    // Check health score
    if (metrics.health.score < this.config.alertThresholds.healthScore) {
      alerts.push({
        id: `health_score_${serviceId}_${Date.now()}`,
        type: AlertType.HEALTH_SCORE,
        severity: AlertSeverity.CRITICAL,
        title: 'Low Health Score',
        description: `Service ${metrics.serviceName} has low health score: ${metrics.health.score}`,
        serviceId,
        serviceName: metrics.serviceName,
        category: metrics.category,
        triggeredAt: new Date(),
        threshold: this.config.alertThresholds.healthScore,
        actualValue: metrics.health.score,
        context: { metrics },
        status: 'ACTIVE'
      });
    }

    // Store and emit alerts
    for (const alert of alerts) {
      this.alerts.set(alert.id, alert);
      this.emit('alert:triggered', alert);
      this.logger.warn(`🚨 Alert triggered: ${alert.title} for ${alert.serviceName}`, {
        alertId: alert.id,
        severity: alert.severity,
        threshold: alert.threshold,
        actualValue: alert.actualValue
      });
    }
  }

  // ===== DATA STORAGE =====

  private storeMetrics(serviceId: string, metrics: MonitoringMetrics): void {
    if (!this.metrics.has(serviceId)) {
      this.metrics.set(serviceId, []);
    }
    
    const serviceMetrics = this.metrics.get(serviceId)!;
    serviceMetrics.push(metrics);
    
    // Keep only recent metrics
    if (serviceMetrics.length > this.config.maxMetricsHistory) {
      serviceMetrics.splice(0, serviceMetrics.length - this.config.maxMetricsHistory);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000);
    
    for (const [serviceId, serviceMetrics] of Array.from(this.metrics.entries())) {
      const filteredMetrics = serviceMetrics.filter((metrics: MonitoringMetrics) => metrics.timestamp > cutoffTime);
      this.metrics.set(serviceId, filteredMetrics);
    }
  }

  // ===== QUERY METHODS =====

  getMetrics(serviceId: string, timeRange?: { start: Date; end: Date }): MonitoringMetrics[] {
    const serviceMetrics = this.metrics.get(serviceId) || [];
    
    if (timeRange) {
      return serviceMetrics.filter(metrics => 
        metrics.timestamp >= timeRange.start && metrics.timestamp <= timeRange.end
      );
    }
    
    return serviceMetrics;
  }

  getAlerts(status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED'): Alert[] {
    const allAlerts = Array.from(this.alerts.values());
    
    if (status) {
      return allAlerts.filter(alert => alert.status === status);
    }
    
    return allAlerts;
  }

  getTraces(serviceId: string, timeRange?: { start: Date; end: Date }): Trace[] {
    const allTraces = Array.from(this.traces.values());
    let filteredTraces = allTraces.filter(trace => trace.serviceId === serviceId);
    
    if (timeRange) {
      filteredTraces = filteredTraces.filter(trace => 
        trace.startTime >= timeRange.start && trace.endTime <= timeRange.end
      );
    }
    
    return filteredTraces;
  }

  getProfiles(serviceId: string, timeRange?: { start: Date; end: Date }): Profile[] {
    const allProfiles = Array.from(this.profiles.values());
    let filteredProfiles = allProfiles.filter(profile => profile.serviceId === serviceId);
    
    if (timeRange) {
      filteredProfiles = filteredProfiles.filter(profile => 
        profile.startTime >= timeRange.start && profile.endTime <= timeRange.end
      );
    }
    
    return filteredProfiles;
  }

  // ===== DASHBOARD DATA =====

  getDashboardData(): DashboardData {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const allMetrics = Array.from(this.metrics.values()).flat();
    const recentMetrics = allMetrics.filter(m => m.timestamp >= last24Hours);
    
    const allAlerts = Array.from(this.alerts.values());
    const activeAlerts = allAlerts.filter(a => a.status === 'ACTIVE');
    
    return {
      overview: {
        totalServices: this.monitoredServices.size,
        totalComponents: this.monitoredComponents.size,
        healthyServices: recentMetrics.filter(m => m.health.status === 'HEALTHY').length,
        unhealthyServices: recentMetrics.filter(m => m.health.status === 'UNHEALTHY').length,
        activeAlerts: activeAlerts.length,
        averageResponseTime: this.calculateAverage(recentMetrics.map(m => m.performance.responseTime.average)),
        averageErrorRate: this.calculateAverage(recentMetrics.map(m => m.errors.rate))
      },
      services: Array.from(this.monitoredServices.values()).map(service => ({
        id: service.id,
        name: service.name,
        category: service.category,
        status: service.getStatus(),
        health: service.getHealth(),
        metrics: this.getLatestMetrics(service.id)
      })),
      alerts: activeAlerts.slice(0, 10), // Last 10 active alerts
      trends: this.calculateTrends(recentMetrics)
    };
  }

  private getLatestMetrics(serviceId: string): MonitoringMetrics | undefined {
    const serviceMetrics = this.metrics.get(serviceId);
    return serviceMetrics ? serviceMetrics[serviceMetrics.length - 1] : undefined;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculateTrends(metrics: MonitoringMetrics[]): TrendData {
    // Simplified trend calculation
    return {
      responseTime: { direction: 'stable', change: 0 },
      errorRate: { direction: 'stable', change: 0 },
      throughput: { direction: 'stable', change: 0 },
      memoryUsage: { direction: 'stable', change: 0 }
    };
  }

  // ===== EVENT SYSTEM =====

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
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

  // ===== INITIALIZATION =====

  private initializeMonitoring(): void {
    if (this.config.enableMetricsCollection) {
      this.metricsTimer = setInterval(() => {
        this.collectMetrics();
      }, this.config.collectionInterval);
    }
    
    if (this.config.enableHealthChecks) {
      this.healthCheckTimer = setInterval(() => {
        this.collectMetrics(); // Health checks are part of metrics collection
      }, this.config.healthCheckInterval);
    }
    
    if (this.config.enableAlerting) {
      this.alertCheckTimer = setInterval(() => {
        this.checkAlerts();
      }, this.config.alertCheckInterval);
    }
  }

  // ===== CLEANUP =====

  async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down Enterprise Monitoring System');
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
    }
    
    this.metrics.clear();
    this.alerts.clear();
    this.traces.clear();
    this.profiles.clear();
    this.monitoredServices.clear();
    this.monitoredComponents.clear();
    this.eventHandlers.clear();
    
    this.logger.info('✅ Enterprise Monitoring System shutdown complete');
  }
}

// ===== TYPES =====

export interface DashboardData {
  overview: {
    totalServices: number;
    totalComponents: number;
    healthyServices: number;
    unhealthyServices: number;
    activeAlerts: number;
    averageResponseTime: number;
    averageErrorRate: number;
  };
  services: Array<{
    id: string;
    name: string;
    category: ServiceCategory;
    status: ServiceStatus;
    health: any;
    metrics?: MonitoringMetrics;
  }>;
  alerts: Alert[];
  trends: TrendData;
}

export interface TrendData {
  responseTime: { direction: 'up' | 'down' | 'stable'; change: number };
  errorRate: { direction: 'up' | 'down' | 'stable'; change: number };
  throughput: { direction: 'up' | 'down' | 'stable'; change: number };
  memoryUsage: { direction: 'up' | 'down' | 'stable'; change: number };
}
