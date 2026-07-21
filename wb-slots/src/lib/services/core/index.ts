// ===== CORE SERVICES EXPORT =====

// Interfaces
export * from './interfaces';

// Base Services
export { BaseService } from './base-service';
export { BaseServiceWithAllFeatures } from './base-service-with-all-features';

// Service Factory
export * from './service-factory';

// Service Registry
export * from './service-registry';

// Unified Services
export * from '../unified/auto-booking-service';
export * from '../unified/notification-service';
export * from '../unified/slot-search-service';

// Convenience exports
export { 
  createService, 
  createAndStartService, 
  registerServiceFactory, 
  getSupportedServiceTypes 
} from './service-factory';

export { serviceRegistry } from './service-registry';
export { serviceFactory } from './service-factory';