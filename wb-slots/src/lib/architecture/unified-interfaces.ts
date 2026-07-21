/**
 * 🏗️ Единые интерфейсы для всех сервисов
 * Унифицированная архитектура для устранения дублирования
 */

// ============================================================================
// БАЗОВЫЕ ИНТЕРФЕЙСЫ
// ============================================================================

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: Date;
  errors: string[];
  metrics: Record<string, number>;
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastActivity: Date;
}

export interface ServiceConfig {
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  maxConcurrency: number;
}

// ============================================================================
// ИНТЕРФЕЙС БАЗОВОГО СЕРВИСА
// ============================================================================

export interface IBaseService {
  readonly name: string;
  readonly version: string;
  
  // Управление жизненным циклом
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  
  // Мониторинг и диагностика
  getHealth(): Promise<ServiceHealth>;
  getMetrics(): Promise<ServiceMetrics>;
  getConfig(): ServiceConfig;
  updateConfig(config: Partial<ServiceConfig>): Promise<void>;
  
  // Логирование
  log(level: 'info' | 'warn' | 'error', message: string, data?: any): void;
}

// ============================================================================
// ИНТЕРФЕЙС СЕРВИСА ПОИСКА СЛОТОВ
// ============================================================================

export interface SlotSearchConfig {
  taskId: string;
  userId: string;
  runId?: string;
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  stopOnFirstFound: boolean;
  isSortingCenter: boolean;
  maxSearchCycles?: number;
  searchDelay?: number;
  maxExecutionTime?: number;
}

export interface SlotSearchResult {
  success: boolean;
  foundSlots: FoundSlot[];
  totalSearched: number;
  executionTime: number;
  errors: string[];
  summary: {
    warehouses: number;
    dateRange: string;
    coefficients: string;
  };
}

export interface FoundSlot {
  id: string;
  warehouseId: number;
  warehouseName: string;
  boxTypeId: number;
  boxTypeName: string;
  date: string;
  coefficient: number;
  isSortingCenter: boolean;
  foundAt: Date;
}

export interface ISlotSearchService extends IBaseService {
  // Основные операции
  searchSlots(config: SlotSearchConfig): Promise<SlotSearchResult>;
  startContinuousSearch(config: SlotSearchConfig): Promise<string>;
  stopContinuousSearch(searchId: string): Promise<void>;
  
  // Управление поиском
  isSearchInProgress(searchId?: string): boolean;
  getActiveSearches(): string[];
  getSearchHistory(limit?: number): SlotSearchResult[];
  
  // Специфичные метрики
  getSearchMetrics(): Promise<{
    totalSearches: number;
    successfulSearches: number;
    averageSlotsFound: number;
    averageSearchTime: number;
  }>;
}

// ============================================================================
// ИНТЕРФЕЙС СЕРВИСА АВТОБРОНИРОВАНИЯ
// ============================================================================

export interface AutoBookingConfig {
  taskId: string;
  userId: string;
  runId: string;
  slotId: string;
  supplyId: string;
  warehouseId: number;
  boxTypeId: number;
  date: string;
  coefficient: number;
  sessionData?: any;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  details?: {
    slotId: string;
    supplyId: string;
    warehouseId: number;
    date: string;
    coefficient: number;
    bookedAt: Date;
  };
}

export interface IAutoBookingService extends IBaseService {
  // Основные операции
  bookSlot(config: AutoBookingConfig): Promise<BookingResult>;
  startAutoBooking(config: AutoBookingConfig): Promise<string>;
  stopAutoBooking(bookingId: string): Promise<void>;
  
  // Управление бронированием
  isBookingInProgress(bookingId?: string): boolean;
  getActiveBookings(): string[];
  getBookingHistory(limit?: number): BookingResult[];
  
  // Специфичные метрики
  getBookingMetrics(): Promise<{
    totalBookings: number;
    successfulBookings: number;
    failedBookings: number;
    averageBookingTime: number;
    successRate: number;
  }>;
}

// ============================================================================
// ИНТЕРФЕЙС СЕРВИСА УВЕДОМЛЕНИЙ
// ============================================================================

export interface NotificationConfig {
  userId: string;
  type: 'telegram' | 'email' | 'webhook';
  enabled: boolean;
  settings: {
    telegram?: {
      botToken: string;
      chatId: string;
    };
    email?: {
      smtp: any;
      to: string;
    };
    webhook?: {
      url: string;
      headers: Record<string, string>;
    };
  };
}

export interface NotificationMessage {
  id: string;
  type: 'slot_found' | 'booking_success' | 'booking_failed' | 'system_alert';
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt: Date;
  channel: string;
}

export interface INotificationService extends IBaseService {
  // Основные операции
  sendNotification(userId: string, message: NotificationMessage): Promise<NotificationResult>;
  sendBulkNotifications(messages: Array<{ userId: string; message: NotificationMessage }>): Promise<NotificationResult[]>;
  
  // Управление настройками
  updateNotificationConfig(userId: string, config: NotificationConfig): Promise<void>;
  getNotificationConfig(userId: string): Promise<NotificationConfig>;
  
  // Специфичные метрики
  getNotificationMetrics(): Promise<{
    totalSent: number;
    successfulSent: number;
    failedSent: number;
    averageDeliveryTime: number;
    channelStats: Record<string, number>;
  }>;
}

// ============================================================================
// ИНТЕРФЕЙС WB API КЛИЕНТА
// ============================================================================

export interface WBAPIConfig {
  token: string;
  category: 'SUPPLIES' | 'MARKETPLACE' | 'STATISTICS';
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  rateLimit: {
    requests: number;
    window: number;
  };
}

export interface WBAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  headers: Record<string, string>;
  requestTime: number;
}

export interface IWBAPIClient extends IBaseService {
  // Основные операции
  get<T>(endpoint: string, params?: Record<string, any>): Promise<WBAPIResponse<T>>;
  post<T>(endpoint: string, data?: any): Promise<WBAPIResponse<T>>;
  put<T>(endpoint: string, data?: any): Promise<WBAPIResponse<T>>;
  delete<T>(endpoint: string): Promise<WBAPIResponse<T>>;
  
  // Управление токенами
  updateToken(token: string): Promise<void>;
  validateToken(): Promise<boolean>;
  
  // Специфичные метрики
  getAPIMetrics(): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    rateLimitUsage: number;
    lastRequest: Date;
  }>;
}

// ============================================================================
// ИНТЕРФЕЙС МЕНЕДЖЕРА СЕРВИСОВ
// ============================================================================

export interface ServiceRegistry {
  slotSearch: ISlotSearchService;
  autoBooking: IAutoBookingService;
  notifications: INotificationService;
  wbAPI: IWBAPIClient;
}

export interface IServiceManager extends IBaseService {
  // Управление сервисами
  getService<T extends keyof ServiceRegistry>(name: T): ServiceRegistry[T];
  registerService<T extends keyof ServiceRegistry>(name: T, service: ServiceRegistry[T]): void;
  unregisterService(name: keyof ServiceRegistry): void;
  
  // Мониторинг всех сервисов
  getAllServicesHealth(): Promise<Record<keyof ServiceRegistry, ServiceHealth>>;
  getAllServicesMetrics(): Promise<Record<keyof ServiceRegistry, ServiceMetrics>>;
  
  // Управление жизненным циклом
  startAllServices(): Promise<void>;
  stopAllServices(): Promise<void>;
  restartAllServices(): Promise<void>;
}

// ============================================================================
// ТИПЫ ДЛЯ ОБРАБОТКИ ОШИБОК
// ============================================================================

export class ServiceError extends Error {
  constructor(
    public service: string,
    public operation: string,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(`[${service}:${operation}] ${message}`);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(service: string, operation: string, message: string, details?: any) {
    super(service, operation, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends ServiceError {
  constructor(service: string, operation: string, message: string, details?: any) {
    super(service, operation, message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class NetworkError extends ServiceError {
  constructor(service: string, operation: string, message: string, details?: any) {
    super(service, operation, message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С СЕРВИСАМИ
// ============================================================================

export interface ServiceFactory<T extends IBaseService> {
  create(config: any): Promise<T>;
  destroy(service: T): Promise<void>;
}

export interface ServiceMiddleware {
  beforeRequest?(service: string, operation: string, params: any): Promise<any>;
  afterRequest?(service: string, operation: string, result: any, error?: Error): Promise<any>;
  onError?(service: string, operation: string, error: Error): Promise<void>;
}

// ============================================================================
// КОНСТАНТЫ И ENUMS
// ============================================================================

export enum ServiceStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error'
}

export enum ServicePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  enabled: true,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  maxConcurrency: 10
};

export const SERVICE_NAMES = {
  SLOT_SEARCH: 'slotSearch',
  AUTO_BOOKING: 'autoBooking',
  NOTIFICATIONS: 'notifications',
  WB_API: 'wbAPI'
} as const;

export type ServiceName = typeof SERVICE_NAMES[keyof typeof SERVICE_NAMES];
