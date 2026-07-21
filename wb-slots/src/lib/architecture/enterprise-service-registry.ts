// ===== ENTERPRISE SERVICE REGISTRY =====

import { Logger } from '../logging/logger';
import { 
  IEnterpriseService, 
  IEnterpriseComponent, 
  IEnterpriseModule,
  ServiceCategory,
  ComponentType,
  ServiceStatus,
  ComponentStatus,
  ServiceEvent
} from './enterprise-architecture-core';

// ===== INTERFACES =====

export interface ServiceRegistryConfig {
  enableAutoDiscovery: boolean;
  enableHealthMonitoring: boolean;
  enableMetricsCollection: boolean;
  healthCheckInterval: number; // milliseconds
  metricsCollectionInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  enableDependencyResolution: boolean;
  enableServiceIsolation: boolean;
}

export interface ServiceRegistration {
  service: IEnterpriseService;
  registeredAt: Date;
  lastHealthCheck: Date;
  isHealthy: boolean;
  retryCount: number;
  metadata: Record<string, any>;
}

export interface ComponentRegistration {
  component: IEnterpriseComponent;
  registeredAt: Date;
  lastHealthCheck: Date;
  isHealthy: boolean;
  metadata: Record<string, any>;
}

export interface ModuleRegistration {
  module: IEnterpriseModule;
  registeredAt: Date;
  services: Map<string, ServiceRegistration>;
  components: Map<string, ComponentRegistration>;
  isHealthy: boolean;
  metadata: Record<string, any>;
}

export interface RegistryMetrics {
  totalServices: number;
  totalComponents: number;
  totalModules: number;
  healthyServices: number;
  unhealthyServices: number;
  servicesByCategory: Record<ServiceCategory, number>;
  componentsByType: Record<ComponentType, number>;
  averageHealthScore: number;
  lastUpdated: Date;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, DependencyEdge[]>;
}

export interface DependencyNode {
  id: string;
  type: 'SERVICE' | 'COMPONENT' | 'MODULE';
  name: string;
  status: ServiceStatus | ComponentStatus;
  health: number;
  dependencies: string[];
  dependents: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'DEPENDENCY' | 'COMPOSITION' | 'AGGREGATION';
  weight: number;
}

// ===== ENTERPRISE SERVICE REGISTRY =====

export class EnterpriseServiceRegistry {
  private static instance: EnterpriseServiceRegistry;
  private logger: Logger;
  private config: ServiceRegistryConfig;
  
  // Registrations
  private services: Map<string, ServiceRegistration> = new Map();
  private components: Map<string, ComponentRegistration> = new Map();
  private modules: Map<string, ModuleRegistration> = new Map();
  
  // Monitoring
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private dependencyGraph: DependencyGraph = {
    nodes: new Map(),
    edges: new Map()
  };
  
  // Event handlers
  private eventHandlers: Map<string, Function[]> = new Map();

  private constructor() {
    this.logger = new Logger('INFO', { context: 'EnterpriseServiceRegistry' });
    
    this.config = {
      enableAutoDiscovery: true,
      enableHealthMonitoring: true,
      enableMetricsCollection: true,
      healthCheckInterval: 30000, // 30 seconds
      metricsCollectionInterval: 60000, // 1 minute
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      enableDependencyResolution: true,
      enableServiceIsolation: true
    };

    this.initializeMonitoring();
  }

  public static getInstance(): EnterpriseServiceRegistry {
    if (!EnterpriseServiceRegistry.instance) {
      EnterpriseServiceRegistry.instance = new EnterpriseServiceRegistry();
    }
    return EnterpriseServiceRegistry.instance;
  }

  // ===== SERVICE MANAGEMENT =====

  async registerService(service: IEnterpriseService, metadata: Record<string, any> = {}): Promise<void> {
    try {
      this.logger.info(`📝 Registering service: ${service.name} (${service.id})`);
      
      const registration: ServiceRegistration = {
        service,
        registeredAt: new Date(),
        lastHealthCheck: new Date(),
        isHealthy: true,
        retryCount: 0,
        metadata
      };

      this.services.set(service.id, registration);
      this.updateDependencyGraph();
      
      // Initialize service
      await service.initialize();
      
      // Set up event handlers
      this.setupServiceEventHandlers(service);
      
      this.logger.info(`✅ Service registered: ${service.name}`);
      this.emit('service:registered', { serviceId: service.id, serviceName: service.name });
    } catch (error) {
      this.logger.error(`❌ Failed to register service: ${service.name}`, { error });
      throw error;
    }
  }

  async unregisterService(serviceId: string): Promise<void> {
    const registration = this.services.get(serviceId);
    if (!registration) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    try {
      this.logger.info(`🗑️ Unregistering service: ${registration.service.name}`);
      
      // Stop service if running
      if (registration.service.getStatus() === ServiceStatus.RUNNING) {
        await registration.service.stop();
      }
      
      this.services.delete(serviceId);
      this.updateDependencyGraph();
      
      this.logger.info(`✅ Service unregistered: ${registration.service.name}`);
      this.emit('service:unregistered', { serviceId, serviceName: registration.service.name });
    } catch (error) {
      this.logger.error(`❌ Failed to unregister service: ${serviceId}`, { error });
      throw error;
    }
  }

  getService<T extends IEnterpriseService>(serviceId: string): T | undefined {
    const registration = this.services.get(serviceId);
    return registration ? (registration.service as T) : undefined;
  }

  getServicesByCategory(category: ServiceCategory): IEnterpriseService[] {
    return Array.from(this.services.values())
      .filter(registration => registration.service.category === category)
      .map(registration => registration.service);
  }

  getAllServices(): IEnterpriseService[] {
    return Array.from(this.services.values()).map(registration => registration.service);
  }

  // ===== COMPONENT MANAGEMENT =====

  async registerComponent(component: IEnterpriseComponent, metadata: Record<string, any> = {}): Promise<void> {
    try {
      this.logger.info(`📝 Registering component: ${component.name} (${component.id})`);
      
      const registration: ComponentRegistration = {
        component,
        registeredAt: new Date(),
        lastHealthCheck: new Date(),
        isHealthy: true,
        metadata
      };

      this.components.set(component.id, registration);
      this.updateDependencyGraph();
      
      // Initialize component
      await component.initialize();
      
      this.logger.info(`✅ Component registered: ${component.name}`);
      this.emit('component:registered', { componentId: component.id, componentName: component.name });
    } catch (error) {
      this.logger.error(`❌ Failed to register component: ${component.name}`, { error });
      throw error;
    }
  }

  async unregisterComponent(componentId: string): Promise<void> {
    const registration = this.components.get(componentId);
    if (!registration) {
      throw new Error(`Component not found: ${componentId}`);
    }

    try {
      this.logger.info(`🗑️ Unregistering component: ${registration.component.name}`);
      
      // Destroy component
      await registration.component.destroy();
      
      this.components.delete(componentId);
      this.updateDependencyGraph();
      
      this.logger.info(`✅ Component unregistered: ${registration.component.name}`);
      this.emit('component:unregistered', { componentId, componentName: registration.component.name });
    } catch (error) {
      this.logger.error(`❌ Failed to unregister component: ${componentId}`, { error });
      throw error;
    }
  }

  getComponent<T extends IEnterpriseComponent>(componentId: string): T | undefined {
    const registration = this.components.get(componentId);
    return registration ? (registration.component as T) : undefined;
  }

  getComponentsByType(type: ComponentType): IEnterpriseComponent[] {
    return Array.from(this.components.values())
      .filter(registration => registration.component.type === type)
      .map(registration => registration.component);
  }

  getAllComponents(): IEnterpriseComponent[] {
    return Array.from(this.components.values()).map(registration => registration.component);
  }

  // ===== MODULE MANAGEMENT =====

  async registerModule(module: IEnterpriseModule, metadata: Record<string, any> = {}): Promise<void> {
    try {
      this.logger.info(`📝 Registering module: ${module.name} (${module.id})`);
      
      const registration: ModuleRegistration = {
        module,
        registeredAt: new Date(),
        services: new Map(),
        components: new Map(),
        isHealthy: true,
        metadata
      };

      this.modules.set(module.id, registration);
      
      // Register all services and components from the module
      for (const [serviceId, service] of module.services) {
        await this.registerService(service, { moduleId: module.id });
        registration.services.set(serviceId, this.services.get(serviceId)!);
      }
      
      for (const [componentId, component] of module.components) {
        await this.registerComponent(component, { moduleId: module.id });
        registration.components.set(componentId, this.components.get(componentId)!);
      }
      
      this.logger.info(`✅ Module registered: ${module.name}`);
      this.emit('module:registered', { moduleId: module.id, moduleName: module.name });
    } catch (error) {
      this.logger.error(`❌ Failed to register module: ${module.name}`, { error });
      throw error;
    }
  }

  async unregisterModule(moduleId: string): Promise<void> {
    const registration = this.modules.get(moduleId);
    if (!registration) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    try {
      this.logger.info(`🗑️ Unregistering module: ${registration.module.name}`);
      
      // Unregister all services and components
      for (const serviceId of registration.services.keys()) {
        await this.unregisterService(serviceId);
      }
      
      for (const componentId of registration.components.keys()) {
        await this.unregisterComponent(componentId);
      }
      
      this.modules.delete(moduleId);
      
      this.logger.info(`✅ Module unregistered: ${registration.module.name}`);
      this.emit('module:unregistered', { moduleId, moduleName: registration.module.name });
    } catch (error) {
      this.logger.error(`❌ Failed to unregister module: ${moduleId}`, { error });
      throw error;
    }
  }

  getModule<T extends IEnterpriseModule>(moduleId: string): T | undefined {
    const registration = this.modules.get(moduleId);
    return registration ? (registration.module as T) : undefined;
  }

  getAllModules(): IEnterpriseModule[] {
    return Array.from(this.modules.values()).map(registration => registration.module);
  }

  // ===== DEPENDENCY MANAGEMENT =====

  async resolveDependencies(): Promise<void> {
    this.logger.info('🔍 Resolving service dependencies');
    
    const services = Array.from(this.services.values());
    const dependencyOrder: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (serviceId: string) => {
      if (visiting.has(serviceId)) {
        throw new Error(`Circular dependency detected involving service: ${serviceId}`);
      }
      
      if (visited.has(serviceId)) {
        return;
      }

      visiting.add(serviceId);
      const registration = this.services.get(serviceId);
      
      if (registration) {
        for (const dependencyId of registration.service.dependencies) {
          if (!this.services.has(dependencyId)) {
            throw new Error(`Missing dependency: ${dependencyId} for service: ${serviceId}`);
          }
          visit(dependencyId);
        }
      }
      
      visiting.delete(serviceId);
      visited.add(serviceId);
      dependencyOrder.push(serviceId);
    };

    for (const serviceId of this.services.keys()) {
      visit(serviceId);
    }

    this.logger.info(`✅ Dependencies resolved. Order: ${dependencyOrder.join(' → ')}`);
  }

  async startServicesInOrder(): Promise<void> {
    await this.resolveDependencies();
    
    const services = Array.from(this.services.values());
    this.logger.info(`🚀 Starting ${services.length} services`);
    
    for (const registration of services) {
      try {
        if (registration.service.getStatus() !== ServiceStatus.RUNNING) {
          await registration.service.start();
          this.logger.info(`✅ Service started: ${registration.service.name}`);
        }
      } catch (error) {
        this.logger.error(`❌ Failed to start service: ${registration.service.name}`, { error });
        throw error;
      }
    }
  }

  async stopServicesInReverseOrder(): Promise<void> {
    const services = Array.from(this.services.values()).reverse();
    this.logger.info(`🛑 Stopping ${services.length} services`);
    
    for (const registration of services) {
      try {
        if (registration.service.getStatus() === ServiceStatus.RUNNING) {
          await registration.service.stop();
          this.logger.info(`✅ Service stopped: ${registration.service.name}`);
        }
      } catch (error) {
        this.logger.error(`❌ Failed to stop service: ${registration.service.name}`, { error });
      }
    }
  }

  // ===== HEALTH MONITORING =====

  private async performHealthChecks(): Promise<void> {
    const now = new Date();
    
    // Check services
    for (const [serviceId, registration] of this.services) {
      try {
        const health = registration.service.getHealth();
        registration.isHealthy = health.status === 'HEALTHY';
        registration.lastHealthCheck = now;
        
        if (!registration.isHealthy) {
          this.logger.warn(`⚠️ Service unhealthy: ${registration.service.name}`, { 
            healthScore: health.score,
            status: health.status 
          });
          
          this.emit('service:unhealthy', { 
            serviceId, 
            serviceName: registration.service.name,
            health 
          });
        }
      } catch (error) {
        this.logger.error(`❌ Health check failed for service: ${registration.service.name}`, { error });
        registration.isHealthy = false;
        registration.lastHealthCheck = now;
      }
    }
    
    // Check components
    for (const [componentId, registration] of this.components) {
      try {
        const health = registration.component.getHealth();
        registration.isHealthy = health.status === 'HEALTHY';
        registration.lastHealthCheck = now;
        
        if (!registration.isHealthy) {
          this.logger.warn(`⚠️ Component unhealthy: ${registration.component.name}`, { 
            healthScore: health.score,
            status: health.status 
          });
          
          this.emit('component:unhealthy', { 
            componentId, 
            componentName: registration.component.name,
            health 
          });
        }
      } catch (error) {
        this.logger.error(`❌ Health check failed for component: ${registration.component.name}`, { error });
        registration.isHealthy = false;
        registration.lastHealthCheck = now;
      }
    }
  }

  // ===== METRICS COLLECTION =====

  getRegistryMetrics(): RegistryMetrics {
    const services = Array.from(this.services.values());
    const components = Array.from(this.components.values());
    const modules = Array.from(this.modules.values());
    
    const healthyServices = services.filter(s => s.isHealthy).length;
    const unhealthyServices = services.length - healthyServices;
    
    const servicesByCategory: Record<ServiceCategory, number> = {} as any;
    const componentsByType: Record<ComponentType, number> = {} as any;
    
    // Count services by category
    for (const registration of services) {
      const category = registration.service.category;
      servicesByCategory[category] = (servicesByCategory[category] || 0) + 1;
    }
    
    // Count components by type
    for (const registration of components) {
      const type = registration.component.type;
      componentsByType[type] = (componentsByType[type] || 0) + 1;
    }
    
    // Calculate average health score
    const totalHealthScore = services.reduce((sum, s) => {
      const health = s.service.getHealth();
      return sum + health.score;
    }, 0);
    const averageHealthScore = services.length > 0 ? totalHealthScore / services.length : 100;

    return {
      totalServices: services.length,
      totalComponents: components.length,
      totalModules: modules.length,
      healthyServices,
      unhealthyServices,
      servicesByCategory,
      componentsByType,
      averageHealthScore,
      lastUpdated: new Date()
    };
  }

  // ===== DEPENDENCY GRAPH =====

  private updateDependencyGraph(): void {
    this.dependencyGraph.nodes.clear();
    this.dependencyGraph.edges.clear();
    
    // Add service nodes
    for (const [serviceId, registration] of this.services) {
      const health = registration.service.getHealth();
      this.dependencyGraph.nodes.set(serviceId, {
        id: serviceId,
        type: 'SERVICE',
        name: registration.service.name,
        status: registration.service.getStatus(),
        health: health.score,
        dependencies: [...registration.service.dependencies],
        dependents: []
      });
    }
    
    // Add component nodes
    for (const [componentId, registration] of this.components) {
      const health = registration.component.getHealth();
      this.dependencyGraph.nodes.set(componentId, {
        id: componentId,
        type: 'COMPONENT',
        name: registration.component.name,
        status: registration.component.getStatus(),
        health: health.score,
        dependencies: [],
        dependents: []
      });
    }
    
    // Add edges
    for (const [serviceId, registration] of this.services) {
      const edges: DependencyEdge[] = [];
      
      for (const dependencyId of registration.service.dependencies) {
        edges.push({
          from: serviceId,
          to: dependencyId,
          type: 'DEPENDENCY',
          weight: 1
        });
        
        // Update dependents
        const dependencyNode = this.dependencyGraph.nodes.get(dependencyId);
        if (dependencyNode) {
          dependencyNode.dependents.push(serviceId);
        }
      }
      
      this.dependencyGraph.edges.set(serviceId, edges);
    }
  }

  getDependencyGraph(): DependencyGraph {
    return {
      nodes: new Map(this.dependencyGraph.nodes),
      edges: new Map(this.dependencyGraph.edges)
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

  // ===== PRIVATE METHODS =====

  private setupServiceEventHandlers(service: IEnterpriseService): void {
    service.on(ServiceEvent.ERROR, (error) => {
      this.logger.error(`❌ Service error: ${service.name}`, { error });
      this.emit('service:error', { serviceId: service.id, serviceName: service.name, error });
    });
    
    service.on(ServiceEvent.HEALTH_CHANGED, (health) => {
      const registration = this.services.get(service.id);
      if (registration) {
        registration.isHealthy = health.status === 'HEALTHY';
        registration.lastHealthCheck = new Date();
      }
      this.emit('service:health_changed', { serviceId: service.id, serviceName: service.name, health });
    });
  }

  private initializeMonitoring(): void {
    if (this.config.enableHealthMonitoring) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthChecks();
      }, this.config.healthCheckInterval);
    }
    
    if (this.config.enableMetricsCollection) {
      this.metricsTimer = setInterval(() => {
        const metrics = this.getRegistryMetrics();
        this.emit('metrics:collected', metrics);
      }, this.config.metricsCollectionInterval);
    }
  }

  // ===== CLEANUP =====

  async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down Enterprise Service Registry');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    await this.stopServicesInReverseOrder();
    
    this.services.clear();
    this.components.clear();
    this.modules.clear();
    this.dependencyGraph.nodes.clear();
    this.dependencyGraph.edges.clear();
    this.eventHandlers.clear();
    
    this.logger.info('✅ Enterprise Service Registry shutdown complete');
  }
}
