/**
 * 🏗️ Расширенные интерфейсы для автобронирования
 * Единые интерфейсы для всех операций автобронирования
 */

import { 
  IBaseService, 
  ServiceHealth, 
  ServiceMetrics, 
  ServiceError 
} from './unified-interfaces';

// ============================================================================
// ОСНОВНЫЕ ТИПЫ ДАННЫХ
// ============================================================================

export interface SlotInfo {
  id: string;
  warehouseId: number;
  warehouseName: string;
  boxTypeId: number;
  boxTypeName: string;
  date: string;
  coefficient: number;
  isSortingCenter: boolean;
  available: boolean;
  foundAt: Date;
}

export interface SupplyInfo {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  warehouseId: number;
  boxTypeId: number;
  createdAt: Date;
}

export interface BookingCredentials {
  email: string;
  password: string;
  sessionData?: any;
  cookies?: any[];
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
}

export interface BookingStrategy {
  type: 'API_FIRST' | 'BROWSER_FIRST' | 'HYBRID';
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  fallbackEnabled: boolean;
}

// ============================================================================
// КОНФИГУРАЦИЯ АВТОБРОНИРОВАНИЯ
// ============================================================================

export interface AutoBookingConfig {
  // Основные параметры
  taskId: string;
  userId: string;
  runId: string;
  
  // Информация о слоте
  slot: SlotInfo;
  
  // Информация о поставке
  supply: SupplyInfo;
  
  // Учетные данные
  credentials: BookingCredentials;
  
  // Стратегия бронирования
  strategy: BookingStrategy;
  
  // Дополнительные параметры
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  maxExecutionTime: number;
  enableNotifications: boolean;
  enableScreenshots: boolean;
  enableLogging: boolean;
  
  // Контекст
  context?: {
    searchConfig?: any;
    userPreferences?: any;
    systemSettings?: any;
  };
}

// ============================================================================
// РЕЗУЛЬТАТЫ БРОНИРОВАНИЯ
// ============================================================================

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  errorCode?: string;
  retryable: boolean;
  
  // Детали бронирования
  details?: {
    slotId: string;
    supplyId: string;
    warehouseId: number;
    date: string;
    coefficient: number;
    bookedAt: Date;
    method: 'API' | 'BROWSER' | 'HYBRID';
    attempts: number;
    executionTime: number;
  };
  
  // Метаданные
  metadata?: {
    screenshots?: string[];
    logs?: string[];
    sessionInfo?: any;
    performanceMetrics?: any;
  };
}

export interface BookingAttempt {
  attemptNumber: number;
  method: 'API' | 'BROWSER' | 'HYBRID';
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: string;
  executionTime?: number;
  details?: any;
}

// ============================================================================
// СТАТУСЫ И СОСТОЯНИЯ
// ============================================================================

export enum BookingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
  TIMEOUT = 'timeout'
}

export enum BookingMethod {
  API = 'api',
  BROWSER = 'browser',
  HYBRID = 'hybrid'
}

export interface BookingState {
  status: BookingStatus;
  currentAttempt: number;
  maxAttempts: number;
  method: BookingMethod;
  startTime: Date;
  lastUpdate: Date;
  error?: string;
  progress: number; // 0-100
}

// ============================================================================
// ИНТЕРФЕЙС СЕРВИСА АВТОБРОНИРОВАНИЯ
// ============================================================================

export interface IAutoBookingService extends IBaseService {
  // Основные операции
  bookSlot(config: AutoBookingConfig): Promise<BookingResult>;
  startAutoBooking(config: AutoBookingConfig): Promise<string>;
  stopAutoBooking(bookingId: string): Promise<void>;
  cancelAutoBooking(bookingId: string): Promise<void>;
  
  // Управление бронированием
  isBookingInProgress(bookingId?: string): boolean;
  getActiveBookings(): string[];
  getBookingState(bookingId: string): Promise<BookingState | null>;
  getBookingHistory(limit?: number): BookingResult[];
  
  // Методы бронирования
  bookViaAPI(config: AutoBookingConfig): Promise<BookingResult>;
  bookViaBrowser(config: AutoBookingConfig): Promise<BookingResult>;
  bookViaHybrid(config: AutoBookingConfig): Promise<BookingResult>;
  
  // Валидация и проверки
  validateBookingConfig(config: AutoBookingConfig): Promise<boolean>;
  validateCredentials(credentials: BookingCredentials): Promise<boolean>;
  checkSlotAvailability(slot: SlotInfo): Promise<boolean>;
  
  // Метрики и аналитика
  getBookingMetrics(): Promise<{
    totalBookings: number;
    successfulBookings: number;
    failedBookings: number;
    averageBookingTime: number;
    successRate: number;
    methodStats: Record<BookingMethod, number>;
    errorStats: Record<string, number>;
  }>;
  
  // Управление сессиями
  createSession(credentials: BookingCredentials): Promise<string>;
  refreshSession(sessionId: string): Promise<boolean>;
  destroySession(sessionId: string): Promise<void>;
  getActiveSessions(): string[];
}

// ============================================================================
// ИНТЕРФЕЙС МЕНЕДЖЕРА БРОНИРОВАНИЯ
// ============================================================================

export interface IBookingManager extends IBaseService {
  // Управление очередью
  addToQueue(config: AutoBookingConfig, priority?: number): Promise<string>;
  removeFromQueue(bookingId: string): Promise<void>;
  getQueueStatus(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }>;
  
  // Управление ресурсами
  getAvailableResources(): Promise<{
    maxConcurrentBookings: number;
    currentBookings: number;
    availableSlots: number;
  }>;
  
  // Планирование
  scheduleBooking(config: AutoBookingConfig, delay?: number): Promise<string>;
  rescheduleBooking(bookingId: string, newTime: Date): Promise<void>;
  
  // Мониторинг
  getSystemHealth(): Promise<ServiceHealth>;
  getPerformanceMetrics(): Promise<ServiceMetrics>;
}

// ============================================================================
// ИНТЕРФЕЙС ОБРАБОТЧИКА ОШИБОК
// ============================================================================

export interface IBookingErrorHandler {
  // Классификация ошибок
  classifyError(error: Error): {
    type: 'RETRYABLE' | 'NON_RETRYABLE' | 'CRITICAL';
    code: string;
    message: string;
    retryDelay?: number;
  };
  
  // Обработка ошибок
  handleError(error: Error, context: any): Promise<{
    shouldRetry: boolean;
    retryDelay: number;
    fallbackMethod?: BookingMethod;
  }>;
  
  // Восстановление
  recoverFromError(error: Error, context: any): Promise<boolean>;
}

// ============================================================================
// ИНТЕРФЕЙС МОНИТОРИНГА
// ============================================================================

export interface IBookingMonitor {
  // Отслеживание прогресса
  trackProgress(bookingId: string, progress: number, message?: string): void;
  trackAttempt(bookingId: string, attempt: BookingAttempt): void;
  trackCompletion(bookingId: string, result: BookingResult): void;
  
  // Сбор метрик
  collectMetrics(): Promise<{
    performance: any;
    errors: any;
    usage: any;
  }>;
  
  // Уведомления
  sendAlert(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): void;
}

// ============================================================================
// ИНТЕРФЕЙС ИНТЕГРАЦИИ
// ============================================================================

export interface IBookingIntegration {
  // Интеграция с поиском слотов
  onSlotFound(slot: SlotInfo, searchConfig: any): Promise<void>;
  onSlotLost(slot: SlotInfo, reason: string): Promise<void>;
  
  // Интеграция с уведомлениями
  onBookingStarted(bookingId: string, config: AutoBookingConfig): Promise<void>;
  onBookingCompleted(bookingId: string, result: BookingResult): Promise<void>;
  onBookingFailed(bookingId: string, error: Error): Promise<void>;
  
  // Интеграция с задачами
  updateTaskStatus(taskId: string, status: string, details?: any): Promise<void>;
  updateRunStatus(runId: string, status: string, details?: any): Promise<void>;
}

// ============================================================================
// КОНФИГУРАЦИЯ СИСТЕМЫ
// ============================================================================

export interface BookingSystemConfig {
  // Общие настройки
  maxConcurrentBookings: number;
  defaultTimeout: number;
  defaultRetryAttempts: number;
  defaultRetryDelay: number;
  
  // Настройки методов
  apiConfig: {
    enabled: boolean;
    timeout: number;
    retryAttempts: number;
  };
  
  browserConfig: {
    enabled: boolean;
    headless: boolean;
    timeout: number;
    retryAttempts: number;
    userAgent?: string;
  };
  
  // Настройки мониторинга
  monitoringConfig: {
    enableScreenshots: boolean;
    enableDetailedLogs: boolean;
    enablePerformanceTracking: boolean;
  };
  
  // Настройки уведомлений
  notificationConfig: {
    enableRealTimeUpdates: boolean;
    enableErrorAlerts: boolean;
    enableSuccessNotifications: boolean;
  };
}

// ============================================================================
// ОШИБКИ АВТОБРОНИРОВАНИЯ
// ============================================================================

export class BookingError extends ServiceError {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public details?: any
  ) {
    super('AutoBookingService', 'booking', message, code, details);
    this.name = 'BookingError';
  }
}

export class SlotUnavailableError extends BookingError {
  constructor(slotId: string, details?: any) {
    super(`Slot ${slotId} is no longer available`, 'SLOT_UNAVAILABLE', false, details);
    this.name = 'SlotUnavailableError';
  }
}

export class AuthenticationError extends BookingError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(message, 'AUTHENTICATION_ERROR', true, details);
    this.name = 'AuthenticationError';
  }
}

export class SessionExpiredError extends BookingError {
  constructor(details?: any) {
    super('Session expired', 'SESSION_EXPIRED', true, details);
    this.name = 'SessionExpiredError';
  }
}

export class BookingConflictError extends BookingError {
  constructor(message: string = 'Booking conflict detected', details?: any) {
    super(message, 'BOOKING_CONFLICT', false, details);
    this.name = 'BookingConflictError';
  }
}

export class TimeoutError extends BookingError {
  constructor(operation: string, timeout: number, details?: any) {
    super(`Operation ${operation} timed out after ${timeout}ms`, 'TIMEOUT_ERROR', true, details);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

export const DEFAULT_BOOKING_CONFIG: Partial<AutoBookingConfig> = {
  strategy: {
    type: 'HYBRID',
    maxRetries: 3,
    retryDelay: 2000,
    timeout: 30000,
    fallbackEnabled: true
  },
  priority: 'NORMAL',
  maxExecutionTime: 300000, // 5 минут
  enableNotifications: true,
  enableScreenshots: true,
  enableLogging: true
};

export const DEFAULT_SYSTEM_CONFIG: BookingSystemConfig = {
  maxConcurrentBookings: 5,
  defaultTimeout: 30000,
  defaultRetryAttempts: 3,
  defaultRetryDelay: 2000,
  
  apiConfig: {
    enabled: true,
    timeout: 15000,
    retryAttempts: 2
  },
  
  browserConfig: {
    enabled: true,
    headless: true,
    timeout: 30000,
    retryAttempts: 3
  },
  
  monitoringConfig: {
    enableScreenshots: true,
    enableDetailedLogs: true,
    enablePerformanceTracking: true
  },
  
  notificationConfig: {
    enableRealTimeUpdates: true,
    enableErrorAlerts: true,
    enableSuccessNotifications: true
  }
};
