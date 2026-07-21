// ===== CORE SERVICE INTERFACES =====

import { Logger } from '../../logging/logger';

// ===== BASE INTERFACES =====

/**
 * Базовый интерфейс для всех сервисов
 */
export interface IService {
  readonly name: string;
  readonly version: string;
  readonly logger: Logger;
  
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStatus(): ServiceStatus;
  getConfig(): any;
  updateConfig(config: Partial<any>): Promise<void>;
}

/**
 * Интерфейс для сервисов с конфигурацией
 */
export interface IConfigurableService<T = any> extends Omit<IService, 'getConfig'> {
  getConfig(): T;
  updateConfig(config: Partial<T>): Promise<void>;
  validateConfig(config: Partial<T>): boolean;
}

/**
 * Интерфейс для сервисов с мониторингом
 */
export interface IMonitorableService extends IService {
  getMetrics(): ServiceMetrics;
  getHealth(): ServiceHealth;
  resetMetrics(): void;
}

/**
 * Интерфейс для сервисов с retry логикой
 */
export interface IRetryableService extends IService {
  retry<T>(operation: () => Promise<T>, context: string): Promise<T>;
  getRetryConfig(): RetryConfig;
  updateRetryConfig(config: Partial<RetryConfig>): void;
}

// ===== TYPES =====

export type ServiceStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR';

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  lastRequestTime?: Date;
  uptime: number;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  lastCheck: Date;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  timestamp: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// ===== SERVICE REGISTRY INTERFACES =====

export interface IServiceRegistry {
  register(service: IService): void;
  unregister(serviceName: string): void;
  get(serviceName: string): IService | undefined;
  getAll(): IService[];
  getRegistryStatus(): RegistryStatus;
}

export interface IServiceFactory {
  createService<T extends IService>(type: string, config?: any): Promise<T>;
  registerFactory(type: string, factory: ServiceFactoryFunction): void;
  getSupportedTypes(): string[];
}

export interface RegistryStatus {
  totalServices: number;
  runningServices: number;
  healthyServices: number;
  services: ServiceInfo[];
}

export interface ServiceInfo {
  name: string;
  type: string;
  status: ServiceStatus;
  health: ServiceHealth;
  uptime: number;
}

export type ServiceFactoryFunction = (config?: any) => Promise<IService>;

// ===== SPECIFIC SERVICE INTERFACES =====

/**
 * Интерфейс для сервисов автобронирования
 */
export interface IAutoBookingService extends IMonitorableService, IRetryableService {
  bookSlot(config: AutoBookingConfig): Promise<BookingResult>;
  isBookingInProgress(): boolean;
  getBookingHistory(): BookingHistory[];
  cancelBooking(bookingId: string): Promise<boolean>;
}

/**
 * Интерфейс для сервисов поиска слотов
 */
export interface ISlotSearchService extends IMonitorableService, IRetryableService {
  searchSlots(config: SlotSearchConfig): Promise<SlotSearchResult>;
  isSearchInProgress(): boolean;
  stopSearch(): Promise<void>;
  getSearchHistory(): SearchHistory[];
}

/**
 * Интерфейс для сервисов уведомлений
 */
export interface INotificationService extends IMonitorableService {
  sendNotification(userId: string, message: string): Promise<boolean>;
  sendTemplatedNotification(userId: string, templateType: string, variables?: Record<string, any>): Promise<boolean>;
  isNotificationConfigured(userId: string): Promise<boolean>;
  getNotificationHistory(userId: string): NotificationHistory[];
}

// ===== CONFIGURATION TYPES =====

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
  retryConfig?: RetryConfig;
  timeoutConfig?: TimeoutConfig;
}

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

export interface TimeoutConfig {
  pageLoad: number;
  navigation: number;
  elementWait: number;
  actionDelay: number;
}

// ===== RESULT TYPES =====

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  screenshot?: string;
  details?: BookingDetails;
  attemptCount?: number;
  executionTime?: number;
}

export interface BookingDetails {
  supplyId: string;
  warehouseId: number;
  date: string;
  bookedAt: string;
  sessionInfo?: SessionInfo;
  browserInfo?: BrowserInfo;
  stepResults?: StepResult[];
}

export interface SessionInfo {
  isValid: boolean;
  cookies: number;
  localStorage: number;
  sessionStorage: number;
  userAgent: string;
}

export interface BrowserInfo {
  version: string;
  platform: string;
  viewport: { width: number; height: number };
}

export interface StepResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
  details?: Record<string, any>;
}

export interface SlotSearchResult {
  foundSlots: FoundSlot[];
  totalChecked: number;
  searchTime: number;
  errors: string[];
  stoppedEarly: boolean;
  runId: string;
}

export interface FoundSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  isAvailable: boolean;
  boxTypes: number[];
  foundAt: Date;
}

export interface BookingHistory {
  id: string;
  userId: string;
  taskId: string;
  supplyId: string;
  warehouseId: number;
  date: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  bookingId?: string;
  error?: string;
  createdAt: Date;
  executionTime: number;
}

export interface SearchHistory {
  id: string;
  userId: string;
  taskId: string;
  foundSlots: number;
  totalChecked: number;
  searchTime: number;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  error?: string;
  createdAt: Date;
}

export interface NotificationHistory {
  id: string;
  userId: string;
  type: string;
  message: string;
  status: 'SENT' | 'FAILED';
  error?: string;
  sentAt: Date;
}