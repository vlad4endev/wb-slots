/**
 * 🏗️ Единый менеджер сервисов
 * Централизованное управление всеми сервисами системы
 */

import { 
  IServiceManager, 
  ServiceRegistry, 
  ServiceHealth, 
  ServiceMetrics,
  ServiceName,
  SERVICE_NAMES
} from './unified-interfaces';
import { BaseService } from './base-service';

export class UnifiedServiceManager extends BaseService implements IServiceManager {
  private services: Partial<ServiceRegistry> = {};
  private serviceInstances: Map<ServiceName, BaseService> = new Map();

  constructor() {
    super('ServiceManager', '1.0.0');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ
  // ============================================================================

  protected async doInitialize(): Promise<void> {
    this.log('info', 'Initializing service manager...');
    
    // Здесь будет инициализация всех сервисов
    // Пока что просто логируем
    this.log('info', 'Service manager initialized');
  }

  protected async doStart(): Promise<void> {
    this.log('info', 'Starting service manager...');
    
    // Запускаем все зарегистрированные сервисы
    await this.startAllServices();
    
    this.log('info', 'Service manager started');
  }

  protected async doStop(): Promise<void> {
    this.log('info', 'Stopping service manager...');
    
    // Останавливаем все сервисы
    await this.stopAllServices();
    
    this.log('info', 'Service manager stopped');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА IServiceManager
  // ============================================================================

  getService<T extends keyof ServiceRegistry>(name: T): ServiceRegistry[T] {
    const service = this.services[name];
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }
    return service;
  }

  registerService<T extends keyof ServiceRegistry>(name: T, service: ServiceRegistry[T]): void {
    this.log('info', `Registering service: ${name}`);
    
    if (this.services[name]) {
      this.log('warn', `Service '${name}' is already registered, replacing...`);
    }
    
    this.services[name] = service;
    
    // Если сервис наследуется от BaseService, добавляем в instances
    if (service instanceof BaseService) {
      this.serviceInstances.set(name as ServiceName, service);
    }
    
    this.log('info', `Service '${name}' registered successfully`);
  }

  unregisterService(name: keyof ServiceRegistry): void {
    this.log('info', `Unregistering service: ${name}`);
    
    const service = this.services[name];
    if (service) {
      // Останавливаем сервис перед удалением
      if (service instanceof BaseService && service.status === 'running') {
        service.stop().catch(error => {
          this.log('error', `Failed to stop service '${name}' during unregistration`, error);
        });
      }
      
      delete this.services[name];
      this.serviceInstances.delete(name as ServiceName);
      
      this.log('info', `Service '${name}' unregistered successfully`);
    } else {
      this.log('warn', `Service '${name}' is not registered`);
    }
  }

  async getAllServicesHealth(): Promise<Record<keyof ServiceRegistry, ServiceHealth>> {
    const health: Record<keyof ServiceRegistry, ServiceHealth> = {} as any;
    
    for (const [name, service] of Object.entries(this.services)) {
      try {
        if (service instanceof BaseService) {
          health[name as keyof ServiceRegistry] = await service.getHealth();
        } else {
          // Для сервисов, не наследующихся от BaseService, создаем базовое состояние
          health[name as keyof ServiceRegistry] = {
            status: 'healthy',
            uptime: 0,
            lastCheck: new Date(),
            errors: [],
            metrics: {}
          };
        }
      } catch (error) {
        this.log('error', `Failed to get health for service '${name}'`, error);
        health[name as keyof ServiceRegistry] = {
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

  async getAllServicesMetrics(): Promise<Record<keyof ServiceRegistry, ServiceMetrics>> {
    const metrics: Record<keyof ServiceRegistry, ServiceMetrics> = {} as any;
    
    for (const [name, service] of Object.entries(this.services)) {
      try {
        if (service instanceof BaseService) {
          metrics[name as keyof ServiceRegistry] = await service.getMetrics();
        } else {
          // Для сервисов, не наследующихся от BaseService, создаем базовые метрики
          metrics[name as keyof ServiceRegistry] = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastActivity: new Date()
          };
        }
      } catch (error) {
        this.log('error', `Failed to get metrics for service '${name}'`, error);
        metrics[name as keyof ServiceRegistry] = {
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

  async startAllServices(): Promise<void> {
    this.log('info', 'Starting all registered services...');
    
    const startPromises = Object.entries(this.services).map(async ([name, service]) => {
      try {
        if (service instanceof BaseService) {
          await service.start();
          this.log('info', `Service '${name}' started successfully`);
        }
      } catch (error) {
        this.log('error', `Failed to start service '${name}'`, error);
        throw error;
      }
    });
    
    await Promise.all(startPromises);
    this.log('info', 'All services started successfully');
  }

  async stopAllServices(): Promise<void> {
    this.log('info', 'Stopping all registered services...');
    
    const stopPromises = Object.entries(this.services).map(async ([name, service]) => {
      try {
        if (service instanceof BaseService) {
          await service.stop();
          this.log('info', `Service '${name}' stopped successfully`);
        }
      } catch (error) {
        this.log('error', `Failed to stop service '${name}'`, error);
        // Не выбрасываем ошибку, чтобы остановить все сервисы
      }
    });
    
    await Promise.all(stopPromises);
    this.log('info', 'All services stopped');
  }

  async restartAllServices(): Promise<void> {
    this.log('info', 'Restarting all registered services...');
    await this.stopAllServices();
    await this.startAllServices();
    this.log('info', 'All services restarted successfully');
  }

  // ============================================================================
  // ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================================

  /**
   * Получить список всех зарегистрированных сервисов
   */
  getRegisteredServices(): ServiceName[] {
    return Object.keys(this.services) as ServiceName[];
  }

  /**
   * Проверить, зарегистрирован ли сервис
   */
  isServiceRegistered(name: keyof ServiceRegistry): boolean {
    return name in this.services;
  }

  /**
   * Получить статус всех сервисов
   */
  async getServicesStatus(): Promise<Record<keyof ServiceRegistry, string>> {
    const status: Record<keyof ServiceRegistry, string> = {} as any;
    
    for (const [name, service] of Object.entries(this.services)) {
      if (service instanceof BaseService) {
        status[name as keyof ServiceRegistry] = service.status;
      } else {
        status[name as keyof ServiceRegistry] = 'unknown';
      }
    }
    
    return status;
  }

  /**
   * Выполнить операцию на всех сервисах
   */
  async executeOnAllServices<T>(
    operation: (service: BaseService) => Promise<T>
  ): Promise<Record<keyof ServiceRegistry, T | Error>> {
    const results: Record<keyof ServiceRegistry, T | Error> = {} as any;
    
    for (const [name, service] of Object.entries(this.services)) {
      try {
        if (service instanceof BaseService) {
          results[name as keyof ServiceRegistry] = await operation(service);
        }
      } catch (error) {
        results[name as keyof ServiceRegistry] = error as Error;
      }
    }
    
    return results;
  }

  /**
   * Получить детальную информацию о сервисе
   */
  async getServiceInfo(name: keyof ServiceRegistry): Promise<{
    name: string;
    version: string;
    status: string;
    health: ServiceHealth;
    metrics: ServiceMetrics;
    config: any;
  } | null> {
    const service = this.services[name];
    if (!service) {
      return null;
    }
    
    try {
      const health = service instanceof BaseService ? await service.getHealth() : {
        status: 'healthy' as const,
        uptime: 0,
        lastCheck: new Date(),
        errors: [],
        metrics: {}
      };
      
      const metrics = service instanceof BaseService ? await service.getMetrics() : {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastActivity: new Date()
      };
      
      const config = service instanceof BaseService ? service.getConfig() : {};
      
      return {
        name: service.name,
        version: service.version,
        status: service instanceof BaseService ? service.status : 'unknown',
        health,
        metrics,
        config
      };
    } catch (error) {
      this.log('error', `Failed to get info for service '${name}'`, error);
      return null;
    }
  }
}

// ============================================================================
// ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР МЕНЕДЖЕРА СЕРВИСОВ
// ============================================================================

let globalServiceManager: UnifiedServiceManager | null = null;

export function getServiceManager(): UnifiedServiceManager {
  if (!globalServiceManager) {
    globalServiceManager = new UnifiedServiceManager();
  }
  return globalServiceManager;
}

export function initializeServiceManager(): Promise<UnifiedServiceManager> {
  const manager = getServiceManager();
  return manager.initialize().then(() => manager);
}

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С СЕРВИСАМИ
// ============================================================================

export async function withServiceManager<T>(
  operation: (manager: UnifiedServiceManager) => Promise<T>
): Promise<T> {
  const manager = getServiceManager();
  return operation(manager);
}

export function requireService<T extends keyof ServiceRegistry>(name: T): ServiceRegistry[T] {
  const manager = getServiceManager();
  return manager.getService(name);
}
