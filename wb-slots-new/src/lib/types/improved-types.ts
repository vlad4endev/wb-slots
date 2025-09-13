// ===== IMPROVED TYPING SYSTEM =====

// ===== BASE TYPES =====

export type ID = string;
export type Timestamp = Date;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// ===== DOMAIN TYPES =====

export interface User {
  readonly id: ID;
  readonly email: string;
  readonly name?: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export type UserRole = 'USER' | 'ADMIN' | 'DEVELOPER';

export interface Task {
  readonly id: ID;
  readonly taskNumber: number;
  readonly userId: ID;
  readonly name: string;
  readonly description?: string;
  readonly enabled: boolean;
  readonly status: TaskStatus;
  readonly scheduleCron?: string;
  readonly autoBook: boolean;
  readonly autoBookSupplyId?: string;
  readonly filters: TaskFilters;
  readonly retryPolicy: RetryPolicy;
  readonly priority: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'STOPPED' | 'BOOKING' | 'COMPLETED';

export interface TaskFilters {
  readonly warehouseIds: readonly number[];
  readonly boxTypeIds: readonly number[];
  readonly coefficientMin: number;
  readonly coefficientMax: number;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly isSortingCenter: boolean;
  readonly allowUnload: boolean;
}

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
}

export interface Run {
  readonly id: ID;
  readonly taskId: ID;
  readonly userId: ID;
  readonly status: RunStatus;
  readonly startedAt: Timestamp;
  readonly finishedAt?: Timestamp;
  readonly foundSlots: number;
  readonly summary?: RunSummary;
  readonly createdAt: Timestamp;
}

export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED' | 'COMPLETED';

export interface RunSummary {
  readonly foundSlots: number;
  readonly totalChecked: number;
  readonly searchTime: number;
  readonly errors: readonly string[];
  readonly stoppedEarly: boolean;
  readonly completedAt: Timestamp;
}

export interface FoundSlot {
  readonly id: ID;
  readonly runId: ID;
  readonly userId: ID;
  readonly warehouseId: number;
  readonly warehouseName: string;
  readonly date: string;
  readonly timeSlot: string;
  readonly coefficient: number;
  readonly available: boolean;
  readonly boxTypes: readonly number[];
  readonly supplyId?: string;
  readonly isBooked: boolean;
  readonly bookingId?: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface Warehouse {
  readonly id: number;
  readonly name: string;
  readonly isActive: boolean;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface UserToken {
  readonly id: ID;
  readonly userId: ID;
  readonly category: TokenCategory;
  readonly tokenEncrypted: string;
  readonly isActive: boolean;
  readonly lastUsedAt?: Timestamp;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export type TokenCategory = 'STATISTICS' | 'SUPPLIES' | 'MARKETPLACE' | 'CONTENT' | 'PROMOTION' | 'ANALYTICS' | 'FINANCE';

// ===== API TYPES =====

export interface APIResponse<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly message?: string;
  readonly pagination?: PaginationInfo;
}

export interface PaginationInfo {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly pages: number;
}

export interface APIError {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
  readonly context?: JSONObject;
}

// ===== REQUEST/RESPONSE TYPES =====

export interface CreateTaskRequest {
  readonly name: string;
  readonly description?: string;
  readonly enabled?: boolean;
  readonly scheduleCron?: string;
  readonly autoBook?: boolean;
  readonly autoBookSupplyId?: string;
  readonly filters: TaskFilters;
  readonly retryPolicy?: RetryPolicy;
  readonly priority?: number;
}

export interface UpdateTaskRequest {
  readonly name?: string;
  readonly description?: string;
  readonly enabled?: boolean;
  readonly scheduleCron?: string;
  readonly autoBook?: boolean;
  readonly autoBookSupplyId?: string;
  readonly filters?: Partial<TaskFilters>;
  readonly retryPolicy?: Partial<RetryPolicy>;
  readonly priority?: number;
}

export interface TaskResponse {
  readonly task: Task;
  readonly runId?: ID;
}

export interface TasksListResponse {
  readonly tasks: readonly Task[];
  readonly pagination: PaginationInfo;
}

export interface SlotSearchRequest {
  readonly taskId: ID;
  readonly userId: ID;
  readonly warehouseIds: readonly number[];
  readonly boxTypeIds: readonly number[];
  readonly coefficientMin: number;
  readonly coefficientMax: number;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly stopOnFirstFound: boolean;
  readonly isSortingCenter?: boolean;
  readonly autoBook?: boolean;
  readonly autoBookSupplyId?: string;
}

export interface SlotSearchResponse {
  readonly foundSlots: readonly FoundSlot[];
  readonly totalChecked: number;
  readonly searchTime: number;
  readonly errors: readonly string[];
  readonly stoppedEarly: boolean;
  readonly runId: ID;
}

export interface BookingRequest {
  readonly taskId: ID;
  readonly userId: ID;
  readonly runId: ID;
  readonly slotId: string;
  readonly supplyId: string;
  readonly warehouseId: number;
  readonly boxTypeId: number;
  readonly date: string;
  readonly coefficient: number;
}

export interface BookingResponse {
  readonly success: boolean;
  readonly bookingId?: string;
  readonly error?: string;
  readonly screenshot?: string;
}

// ===== WB API TYPES =====

export interface WBCoefficient {
  readonly date: string;
  readonly warehouseId: number;
  readonly coefficient: number;
  readonly allowUnload: boolean;
}

export interface WBWarehouse {
  readonly id: number;
  readonly name: string;
  readonly address?: string;
  readonly city?: string;
}

export interface WBSupply {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly warehouseId: number;
  readonly boxTypeId: number;
  readonly supplyDate?: string;
  readonly factDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WBAcceptanceOptions {
  readonly warehouseId: number;
  readonly boxTypeId: number;
  readonly date: string;
  readonly coefficient: number;
}

export interface WBAPIResponse<T = any> {
  readonly data: T;
  readonly error: boolean;
  readonly errorText?: string;
  readonly additionalErrors?: string[];
}

// ===== NOTIFICATION TYPES =====

export interface NotificationChannel {
  readonly id: ID;
  readonly userId: ID;
  readonly type: NotificationType;
  readonly config: NotificationConfig;
  readonly enabled: boolean;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export type NotificationType = 'EMAIL' | 'TELEGRAM' | 'WEBHOOK';

export type NotificationConfig = EmailNotificationConfig | TelegramNotificationConfig | WebhookNotificationConfig;

export interface EmailNotificationConfig {
  readonly email: string;
}

export interface TelegramNotificationConfig {
  readonly chatId: string;
  readonly botToken?: string;
}

export interface WebhookNotificationConfig {
  readonly url: string;
  readonly secret?: string;
}

export interface NotificationData {
  readonly type: NotificationEventType;
  readonly taskId: ID;
  readonly taskName: string;
  readonly slotsCount?: number;
  readonly slots?: readonly FoundSlot[];
  readonly error?: string;
  readonly bookingId?: string;
}

export type NotificationEventType = 'slot_found' | 'slot_booked' | 'task_failed' | 'task_completed' | 'task_started' | 'task_stopped';

// ===== QUEUE TYPES =====

export interface QueueJob<T = any> {
  readonly id: string;
  readonly name: string;
  readonly data: T;
  readonly opts: JobOptions;
  readonly progress: number;
  readonly delay: number;
  readonly timestamp: number;
  readonly attemptsMade: number;
  readonly failedReason?: string;
  readonly processedOn?: number;
  readonly finishedOn?: number;
}

export interface JobOptions {
  readonly delay?: number;
  readonly attempts?: number;
  readonly backoff?: BackoffOptions;
  readonly removeOnComplete?: number;
  readonly removeOnFail?: number;
  readonly priority?: number;
}

export interface BackoffOptions {
  readonly type: 'fixed' | 'exponential';
  readonly delay: number;
}

export interface ScanSlotsJobData {
  readonly taskId: ID;
  readonly userId: ID;
  readonly runId: ID;
}

export interface BookSlotJobData {
  readonly taskId: ID;
  readonly userId: ID;
  readonly runId: ID;
  readonly slotData: SlotBookingData;
}

export interface SlotBookingData {
  readonly warehouseId: number;
  readonly date: string;
  readonly coefficient: number;
  readonly boxTypeId?: number;
}

export interface NotifyJobData {
  readonly userId: ID;
  readonly type: NotificationEventType;
  readonly data: NotificationData;
}

export interface StopTaskJobData {
  readonly taskId: ID;
}

export interface MonitorJobData {
  readonly taskId: ID;
  readonly runId: ID;
  readonly userId: ID;
  readonly checkInterval: number;
  readonly maxAttempts: number;
}

// ===== CONFIGURATION TYPES =====

export interface AppConfig {
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly jwt: JWTConfig;
  readonly encryption: EncryptionConfig;
  readonly wb: WBConfig;
  readonly telegram: TelegramConfig;
  readonly email: EmailConfig;
  readonly logging: LoggingConfig;
}

export interface DatabaseConfig {
  readonly url: string;
  readonly maxConnections: number;
  readonly connectionTimeout: number;
}

export interface RedisConfig {
  readonly url: string;
  readonly maxRetriesPerRequest: number;
  readonly enableReadyCheck: boolean;
}

export interface JWTConfig {
  readonly secret: string;
  readonly expiresIn: string;
  readonly issuer: string;
  readonly audience: string;
}

export interface EncryptionConfig {
  readonly key: string;
  readonly algorithm: string;
  readonly ivLength: number;
}

export interface WBConfig {
  readonly baseUrl: string;
  readonly timeout: number;
  readonly rateLimit: RateLimitConfig;
}

export interface RateLimitConfig {
  readonly maxRequestsPerMinute: number;
  readonly maxRequestsPerHour: number;
  readonly retryAfter: number;
}

export interface TelegramConfig {
  readonly botToken: string;
  readonly webhookUrl?: string;
  readonly parseMode: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface EmailConfig {
  readonly smtp: SMTPConfig;
  readonly from: string;
  readonly templates: EmailTemplateConfig;
}

export interface SMTPConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly auth: SMTPAuth;
}

export interface SMTPAuth {
  readonly user: string;
  readonly pass: string;
}

export interface EmailTemplateConfig {
  readonly slotFound: string;
  readonly bookingSuccess: string;
  readonly bookingFailed: string;
  readonly taskCompleted: string;
}

export interface LoggingConfig {
  readonly level: LogLevel;
  readonly format: 'json' | 'pretty';
  readonly destination: 'console' | 'file' | 'both';
  readonly filePath?: string;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

// ===== UTILITY TYPES =====

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// ===== TYPE GUARDS =====

export function isUserRole(value: string): value is UserRole {
  return ['USER', 'ADMIN', 'DEVELOPER'].includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'STOPPED', 'BOOKING', 'COMPLETED'].includes(value);
}

export function isRunStatus(value: string): value is RunStatus {
  return ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL', 'CANCELLED', 'COMPLETED'].includes(value);
}

export function isTokenCategory(value: string): value is TokenCategory {
  return ['STATISTICS', 'SUPPLIES', 'MARKETPLACE', 'CONTENT', 'PROMOTION', 'ANALYTICS', 'FINANCE'].includes(value);
}

export function isNotificationType(value: string): value is NotificationType {
  return ['EMAIL', 'TELEGRAM', 'WEBHOOK'].includes(value);
}

export function isLogLevel(value: string): value is LogLevel {
  return ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(value);
}

// ===== TYPE ASSERTIONS =====

export function assertIsUserRole(value: string): asserts value is UserRole {
  if (!isUserRole(value)) {
    throw new Error(`Invalid user role: ${value}`);
  }
}

export function assertIsTaskStatus(value: string): asserts value is TaskStatus {
  if (!isTaskStatus(value)) {
    throw new Error(`Invalid task status: ${value}`);
  }
}

export function assertIsRunStatus(value: string): asserts value is RunStatus {
  if (!isRunStatus(value)) {
    throw new Error(`Invalid run status: ${value}`);
  }
}

export function assertIsTokenCategory(value: string): asserts value is TokenCategory {
  if (!isTokenCategory(value)) {
    throw new Error(`Invalid token category: ${value}`);
  }
}

export function assertIsNotificationType(value: string): asserts value is NotificationType {
  if (!isNotificationType(value)) {
    throw new Error(`Invalid notification type: ${value}`);
  }
}

export function assertIsLogLevel(value: string): asserts value is LogLevel {
  if (!isLogLevel(value)) {
    throw new Error(`Invalid log level: ${value}`);
  }
}

// ===== USAGE EXAMPLES =====

/*
// Type-safe API response
const response: APIResponse<Task[]> = {
  success: true,
  data: tasks,
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    pages: 5
  }
};

// Type-safe configuration
const config: AppConfig = {
  database: {
    url: process.env.DATABASE_URL!,
    maxConnections: 10,
    connectionTimeout: 30000
  },
  redis: {
    url: process.env.REDIS_URL!,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false
  },
  // ... other config
};

// Type-safe request validation
function validateCreateTaskRequest(data: unknown): CreateTaskRequest {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid request data');
  }
  
  const request = data as Record<string, unknown>;
  
  if (typeof request.name !== 'string') {
    throw new Error('Name is required');
  }
  
  // ... other validations
  
  return request as CreateTaskRequest;
}

// Type-safe error handling
function handleError(error: unknown): APIError {
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: 500
    };
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    statusCode: 500
  };
}
*/
