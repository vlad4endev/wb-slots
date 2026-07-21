// ===== SOLID COMPLIANT SERVICES - MAIN EXPORT =====

// ===== CORE INTERFACES =====
export * from './interfaces/segregated-interfaces';

// ===== INDIVIDUAL SERVICES (SRP) =====
export * from './browser/browser-manager';
export * from './session/session-manager';
export * from './navigation/navigation-service';
export * from './booking/booking-service';
export * from './notification/notification-service';
export * from './analytics/analytics-service';
export * from './error/error-handler';

// ===== MAIN REFACTORED SERVICE =====
export * from './refactored-auto-booking-service';

// ===== FACTORY (DIP) =====
export * from './factory/booking-service-factory';

// ===== EXAMPLES =====
export * from './examples/usage-example';

// ===== CONVENIENCE EXPORTS =====

// Main service factory function
export { createBookingServiceFactory, getBookingServiceFactory } from './factory/booking-service-factory';

// Main service class
export { RefactoredAutoBookingService } from './refactored-auto-booking-service';

// Error classes
export {
  EnhancedBookingError,
  SessionExpiredError,
  ElementNotFoundError,
  BookingConflictError,
  NetworkError,
  TimeoutError
} from './error/error-handler';

// ===== TYPE EXPORTS =====
export type {
  // Main configs
  RefactoredAutoBookingConfig,
  RefactoredBookingResult,
  
  // Service configs
  BrowserConfig,
  NavigationConfig,
  BookingConfig,
  NotificationConfig,
  RetryConfig,
  
  // Results
  NavigationResult,
  BookingResult,
  BookingStep,
  BookingAnalytics,
  BookingStats,
  
  // Info types
  SessionInfo,
  BrowserInfo,
  
  // Error types
  ErrorContext,
  
  // Notification types
  NotificationMessage,
  
  // Factory types
  BookingServiceFactoryConfig
} from './interfaces/segregated-interfaces';
