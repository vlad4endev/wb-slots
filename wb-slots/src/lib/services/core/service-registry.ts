// ===== SERVICE REGISTRY =====

import { Logger } from '../../logging/logger';
import { 
  IService, 
  IServiceRegistry, 
  IServiceFactory,
  RegistryStatus,
  ServiceFactoryFunction 
} from './interfaces';

// ===== SERVICE REGISTRY IMPLEMENTATION =====

export class ServiceRegistry implements IServiceRegistry, IServiceFactory {
  private static instance: ServiceRegistry;
  private logger: Logger;
  private services: Map<string, IService> = new Map();
  private factories: Map<string, ServiceFactoryFunction> = new Map();

  private constructor() {
    this.logger = new Logger('INFO', { context: 'ServiceRegistry' });
  }

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  // ===== IServiceRegistry IMPLEMENTATION =====

  register(service: IService): void {
    if (this.services.has(service.name)) {
      this.logger.warn(`Service ${service.name} is already registered, replacing it`);
    }

    this.services.set(service.name, service);
    this.logger.info(`Service registered: ${service.name} (${service.version})`);
  }

  unregister(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (service) {
      this.services.delete(serviceName);
      this.logger.info(`Service unregistered: ${serviceName}`);
    } else {
      this.logger.warn(`Service not found for unregistration: ${serviceName}`);
    }
  }

  get(serviceName: string): IService | undefined {
    return this.services.get(serviceName);
  }

  getAll(): IService[] {
    return Array.from(this.services.values());
  }

  getRegistryStatus(): RegistryStatus {
    const allServices = this.getAll();
    const runningServices = allServices.filter(s => s.isRunning());
    const healthyServices = allServices.filter(s => {
      try {
        const health = (s as any).getHealth?.();
        return health?.status === 'healthy';
      } catch {
        return false;
      }
    });

    return {
      totalServices: allServices.length,
      runningServices: runningServices.length,
      healthyServices: healthyServices.length,
      services: allServices.map(service => ({
        name: service.name,
        type: service.constructor.name,
        status: service.getStatus(),
        health: (service as any).getHealth?.(),
        uptime: (service as any).getMetrics?.()?.uptime || 0
      }))
    };
  }

  // ===== IServiceFactory IMPLEMENTATION =====

  async createService<T extends IService>(type: string, config?: any): Promise<T> {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory registered for service type: ${type}`);
    }

    try {
      this.logger.info(`Creating service of type: ${type}`, { config });
      const service = await factory(config);
      
      // Automatically register the created service
      this.register(service);
      
      return service as T;
    } catch (error) {
      this.logger.error(`Failed to create service of type: ${type}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        config
      });
      throw error;
    }
  }

  registerFactory(type: string, factory: ServiceFactoryFunction): void {
    this.factories.set(type, factory);
    this.logger.info(`Factory registered for service type: ${type}`);
  }

  getSupportedTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  // ===== SERVICE MANAGEMENT METHODS =====

  async startAllServices(): Promise<void> {
    this.logger.info('Starting all registered services');
    
    const services = this.getAll();
    const startPromises = services.map(async (service) => {
      try {
        if (!service.isRunning()) {
          await service.initialize();
          await service.start();
          this.logger.info(`Service started: ${service.name}`);
        }
      } catch (error) {
        this.logger.error(`Failed to start service: ${service.name}`, { error });
      }
    });

    await Promise.allSettled(startPromises);
  }

  async stopAllServices(): Promise<void> {
    this.logger.info('Stopping all registered services');
    
    const services = this.getAll();
    const stopPromises = services.map(async (service) => {
      try {
        if (service.isRunning()) {
          await service.stop();
          this.logger.info(`Service stopped: ${service.name}`);
        }
      } catch (error) {
        this.logger.error(`Failed to stop service: ${service.name}`, { error });
      }
    });

    await Promise.allSettled(stopPromises);
  }

  async restartService(serviceName: string): Promise<boolean> {
    const service = this.get(serviceName);
    if (!service) {
      this.logger.error(`Service not found for restart: ${serviceName}`);
      return false;
    }

    try {
      this.logger.info(`Restarting service: ${serviceName}`);
      
      if (service.isRunning()) {
        await service.stop();
      }
      
      await service.initialize();
      await service.start();
      
      this.logger.info(`Service restarted successfully: ${serviceName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to restart service: ${serviceName}`, { error });
      return false;
    }
  }

  async restartAllServices(): Promise<void> {
    this.logger.info('Restarting all registered services');
    
    const services = this.getAll();
    const restartPromises = services.map(async (service) => {
      try {
        await this.restartService(service.name);
      } catch (error) {
        this.logger.error(`Failed to restart service: ${service.name}`, { error });
      }
    });

    await Promise.allSettled(restartPromises);
  }

  // ===== HEALTH MONITORING =====

  async performHealthCheck(): Promise<RegistryStatus> {
    this.logger.info('Performing health check on all services');
    
    const services = this.getAll();
    const healthPromises = services.map(async (service) => {
      try {
        if ((service as any).getHealth) {
          const health = (service as any).getHealth();
          this.logger.debug(`Health check for ${service.name}: ${health.status}`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for service: ${service.name}`, { error });
      }
    });

    await Promise.allSettled(healthPromises);
    
    return this.getRegistryStatus();
  }

  getUnhealthyServices(): IService[] {
    return this.getAll().filter(service => {
      try {
        const health = (service as any).getHealth?.();
        return health?.status !== 'healthy';
      } catch {
        return true; // Consider services without health check as unhealthy
      }
    });
  }

  getServicesByStatus(status: string): IService[] {
    return this.getAll().filter(service => (service as any).getStatus?.() === status);
  }

  // ===== METRICS AND MONITORING =====

  getTotalMetrics() {
    const services = this.getAll();
    const metrics = services.map(service => {
      try {
        return (service as any).getMetrics?.();
      } catch {
        return null;
      }
    }).filter(Boolean);

    return {
      totalServices: services.length,
      totalRequests: metrics.reduce((sum, m) => sum + (m?.totalRequests || 0), 0),
      successfulRequests: metrics.reduce((sum, m) => sum + (m?.successfulRequests || 0), 0),
      failedRequests: metrics.reduce((sum, m) => sum + (m?.failedRequests || 0), 0),
      averageResponseTime: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + (m?.averageResponseTime || 0), 0) / metrics.length 
        : 0,
      totalUptime: metrics.reduce((sum, m) => sum + (m?.uptime || 0), 0)
    };
  }

  // ===== UTILITY METHODS =====

  clear(): void {
    this.logger.info('Clearing all services and factories');
    this.services.clear();
    this.factories.clear();
  }

  hasService(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  hasFactory(type: string): boolean {
    return this.factories.has(type);
  }

  getServiceCount(): number {
    return this.services.size;
  }

  getFactoryCount(): number {
    return this.factories.size;
  }

  // ===== DEBUGGING AND INSPECTION =====

  getServiceInfo(serviceName: string): any {
    const service = this.get(serviceName);
    if (!service) {
      return null;
    }

    return {
      name: service.name,
      version: service.version,
      status: (service as any).getStatus?.(),
      isRunning: (service as any).isRunning?.(),
      health: (service as any).getHealth?.(),
      metrics: (service as any).getMetrics?.(),
      config: (service as any).getConfig?.()
    };
  }

  getAllServiceInfo(): any[] {
    return this.getAll().map(service => this.getServiceInfo(service.name));
  }

  // ===== STATIC CONVENIENCE METHODS =====


  static async createAndRegister<T extends IService>(
    type: string, 
    config?: any
  ): Promise<T> {
    const registry = ServiceRegistry.getInstance();
    return registry.createService<T>(type, config);
  }

  static registerFactory(type: string, factory: ServiceFactoryFunction): void {
    const registry = ServiceRegistry.getInstance();
    registry.registerFactory(type, factory);
  }
}

// ===== EXPORT SINGLETON INSTANCE =====

export const serviceRegistry = ServiceRegistry.getInstance();