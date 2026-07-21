// ===== SERVICE FACTORY =====

import { Logger } from '../../logging/logger';
import { 
  IService, 
  IServiceFactory, 
  ServiceFactoryFunction 
} from './interfaces';
import { ServiceRegistry } from './service-registry';

// ===== SERVICE FACTORY IMPLEMENTATION =====

export class ServiceFactory implements IServiceFactory {
  private static instance: ServiceFactory;
  private logger: Logger;
  private factories: Map<string, ServiceFactoryFunction> = new Map();

  private constructor() {
    this.logger = new Logger('INFO', { context: 'ServiceFactory' });
  }

  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  // ===== FACTORY METHODS =====

  async createService<T extends IService>(type: string, config?: any): Promise<T> {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory registered for service type: ${type}`);
    }

    try {
      this.logger.info(`Creating service of type: ${type}`, { config });
      const service = await factory(config);
      
      // Automatically register the created service
      const serviceRegistry = ServiceRegistry.getInstance();
      serviceRegistry.register(service);
      
      return service as T;
    } catch (error) {
      this.logger.error(`Failed to create service of type: ${type}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        config
      });
      throw error;
    }
  }

  getSupportedTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  registerFactory(type: string, factory: ServiceFactoryFunction): void {
    this.factories.set(type, factory);
    this.logger.info(`Registered factory for service type: ${type}`);
  }

  unregisterFactory(type: string): void {
    this.factories.delete(type);
    this.logger.info(`Unregistered factory for service type: ${type}`);
  }

  hasFactory(type: string): boolean {
    return this.factories.has(type);
  }

  // ===== CONVENIENCE METHODS =====

  async createAndStartService<T extends IService>(type: string, config?: any): Promise<T> {
    const service = await this.createService<T>(type, config);
    await service.initialize();
    await service.start();
    return service;
  }

  async createServiceWithRetry<T extends IService>(
    type: string, 
    config?: any, 
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.createService<T>(type, config);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Failed to create service on attempt ${attempt}/${maxRetries}`, {
          type,
          error: lastError.message
        });
        
        if (attempt < maxRetries) {
          await this._delay(1000 * attempt); // Exponential backoff
        }
      }
    }
    
    throw lastError || new Error('Failed to create service after all retries');
  }

  // ===== BULK OPERATIONS =====

  async createMultipleServices<T extends IService>(
    serviceConfigs: Array<{ type: string; config?: any }>
  ): Promise<T[]> {
    const services: T[] = [];
    
    for (const { type, config } of serviceConfigs) {
      try {
        const service = await this.createService<T>(type, config);
        services.push(service);
      } catch (error) {
        this.logger.error(`Failed to create service of type: ${type}`, { error });
        // Continue with other services
      }
    }
    
    return services;
  }

  async createAndStartMultipleServices<T extends IService>(
    serviceConfigs: Array<{ type: string; config?: any }>
  ): Promise<T[]> {
    const services: T[] = [];
    
    for (const { type, config } of serviceConfigs) {
      try {
        const service = await this.createAndStartService<T>(type, config);
        services.push(service);
      } catch (error) {
        this.logger.error(`Failed to create and start service of type: ${type}`, { error });
        // Continue with other services
      }
    }
    
    return services;
  }

  // ===== UTILITY METHODS =====

  private async _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== STATIC CONVENIENCE METHODS =====

  static async create<T extends IService>(type: string, config?: any): Promise<T> {
    return ServiceFactory.getInstance().createService<T>(type, config);
  }

  static async createAndStart<T extends IService>(type: string, config?: any): Promise<T> {
    return ServiceFactory.getInstance().createAndStartService<T>(type, config);
  }

  static register(type: string, factory: ServiceFactoryFunction): void {
    ServiceFactory.getInstance().registerFactory(type, factory);
  }

  static getSupportedTypes(): string[] {
    return ServiceFactory.getInstance().getSupportedTypes();
  }
}

// ===== SERVICE REGISTRY INTEGRATION =====

// Export singleton instance for convenience
export const serviceFactory = ServiceFactory.getInstance();

// ===== PREDEFINED SERVICE FACTORIES =====

// Auto Booking Service Factory
ServiceFactory.register('UnifiedAutoBookingService', async (config?: any) => {
  const { UnifiedAutoBookingService } = await import('../unified/auto-booking-service');
  return new UnifiedAutoBookingService();
});

// Notification Service Factory
ServiceFactory.register('UnifiedNotificationService', async (config?: any) => {
  const { UnifiedNotificationService } = await import('../unified/notification-service');
  return new UnifiedNotificationService();
});

// Slot Search Service Factory
ServiceFactory.register('UnifiedSlotSearchService', async (config?: any) => {
  const { UnifiedSlotSearchService } = await import('../unified/slot-search-service');
  return new UnifiedSlotSearchService();
});

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Create a service instance
 */
export async function createService<T extends IService>(type: string, config?: any): Promise<T> {
  return serviceFactory.createService<T>(type, config);
}

/**
 * Create and start a service instance
 */
export async function createAndStartService<T extends IService>(type: string, config?: any): Promise<T> {
  return serviceFactory.createAndStartService<T>(type, config);
}

/**
 * Register a service factory
 */
export function registerServiceFactory(type: string, factory: ServiceFactoryFunction): void {
  serviceFactory.registerFactory(type, factory);
}

/**
 * Get all supported service types
 */
export function getSupportedServiceTypes(): string[] {
  return serviceFactory.getSupportedTypes();
}