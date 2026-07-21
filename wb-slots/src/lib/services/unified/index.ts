// ===== UNIFIED SERVICES EXPORT =====

// Auto Booking Service
export * from './auto-booking-service';

// Notification Service
export * from './notification-service';

// Slot Search Service
export * from './slot-search-service';

// WB Slot Search Adapter
export * from './wb-slot-search-adapter';

// Re-export core interfaces for convenience
export type {
  IAutoBookingService,
  ISlotSearchService,
  INotificationService,
  AutoBookingConfig,
  SlotSearchConfig,
  BookingResult,
  SlotSearchResult,
  BookingHistory,
  SearchHistory,
  NotificationHistory
} from '../core/interfaces';