// ===== SEGREGATED INTERFACES - ISP: Interface Segregation Principle =====

// ===== CORE INTERFACES =====

export interface ILogger {
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

// ===== BROWSER INTERFACES =====

export interface IBrowserManager {
  initialize(config: BrowserConfig): Promise<{ browser: Browser; context: BrowserContext }>;
  createPage(context: BrowserContext): Promise<Page>;
  setupAntiDetection(page: Page): Promise<void>;
  cleanup(browser: Browser): Promise<void>;
}

export interface BrowserConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent: string;
  timeout: number;
}

// ===== SESSION INTERFACES =====

export interface ISessionManager {
  validateSession(userId: string): Promise<SessionInfo>;
  restoreSession(page: Page, userId: string): Promise<boolean>;
  saveSession(page: Page, userId: string): Promise<void>;
  clearSession(userId: string): Promise<void>;
}

export interface SessionInfo {
  isValid: boolean;
  cookies: number;
  localStorage: number;
  sessionStorage: number;
  userAgent: string;
  lastActivity: Date;
}

// ===== NAVIGATION INTERFACES =====

export interface INavigationService {
  navigateToSupplies(page: Page, config: NavigationConfig): Promise<NavigationResult>;
  navigateToSupply(page: Page, supplyId: string, config: NavigationConfig): Promise<NavigationResult>;
  waitForPageLoad(page: Page, timeout: number): Promise<boolean>;
  scrollToElement(page: Page, selector: string): Promise<boolean>;
}

export interface NavigationConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface NavigationResult {
  success: boolean;
  url: string;
  error?: string;
  duration: number;
}

// ===== BOOKING INTERFACES =====

export interface IBookingService {
  performBooking(page: Page, config: BookingConfig): Promise<BookingResult>;
  findAndClickPlanButton(page: Page, config: BookingConfig): Promise<BookingStep>;
  selectDate(page: Page, config: BookingConfig): Promise<BookingStep>;
  selectBoxType(page: Page, config: BookingConfig): Promise<BookingStep>;
  confirmBooking(page: Page, config: BookingConfig): Promise<BookingStep>;
  verifyBookingSuccess(page: Page, config: BookingConfig): Promise<BookingStep>;
}

export interface BookingConfig {
  supplyId: string;
  warehouseId: number;
  date: string;
  boxTypeId: number;
  timeout: number;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  duration: number;
  steps: BookingStep[];
}

export interface BookingStep {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  bookingId?: string;
}

// ===== NOTIFICATION INTERFACES =====

export interface INotificationService {
  sendSuccess(message: NotificationMessage): Promise<void>;
  sendError(message: NotificationMessage): Promise<void>;
  sendInfo(message: NotificationMessage): Promise<void>;
  sendWarning(message: NotificationMessage): Promise<void>;
}

export interface NotificationConfig {
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  email?: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    to: string[];
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
}

export interface NotificationMessage {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  data?: Record<string, any>;
}

// ===== ANALYTICS INTERFACES =====

export interface IAnalyticsService {
  saveBookingResult(analytics: BookingAnalytics): Promise<void>;
  getBookingHistory(userId: string, limit?: number): Promise<BookingAnalytics[]>;
  getBookingStats(userId: string): Promise<BookingStats>;
  getSuccessRate(userId: string, days?: number): Promise<number>;
}

export interface BookingAnalytics {
  userId: string;
  taskId: string;
  supplyId: string;
  warehouseId: number;
  date: string;
  success: boolean;
  bookingId?: string;
  error?: string;
  executionTime: number;
  steps: BookingStep[];
  screenshots: string[];
  sessionInfo?: SessionInfo;
  browserInfo?: BrowserInfo;
}

export interface BookingStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  averageExecutionTime: number;
  mostCommonErrors: Array<{ error: string; count: number }>;
  recentBookings: BookingAnalytics[];
}

export interface BrowserInfo {
  version: string;
  platform: string;
  viewport: { width: number; height: number };
}

// ===== ERROR HANDLING INTERFACES =====

export interface IErrorHandler {
  isRetryableError(error: Error): boolean;
  shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean;
  calculateDelay(attempt: number, config: RetryConfig): number;
  enhanceError(error: Error, context: ErrorContext): EnhancedBookingError;
  handleError(error: Error, context: ErrorContext): Promise<void>;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface ErrorContext {
  step: string;
  userId: string;
  supplyId: string;
  attempt: number;
  maxAttempts: number;
  originalError: Error;
}

export class EnhancedBookingError extends Error {
  constructor(
    message: string,
    public code: string,
    public isRetryable: boolean = false,
    public originalError?: Error,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'EnhancedBookingError';
  }
}

// ===== MAIN AUTO BOOKING INTERFACE =====

export interface IAutoBookingService {
  performBooking(config: RefactoredAutoBookingConfig): Promise<RefactoredBookingResult>;
  getBookingHistory(userId: string, limit?: number): Promise<BookingAnalytics[]>;
  getBookingStats(userId: string): Promise<BookingStats>;
  getSuccessRate(userId: string, days?: number): Promise<number>;
  isBookingInProgress(): boolean;
}

export interface RefactoredAutoBookingConfig {
  userId: string;
  taskId: string;
  supplyId: string;
  warehouseId: number;
  date: string;
  boxTypeId: number;
  baseUrl: string;
  retryConfig?: RetryConfig;
  browserConfig?: BrowserConfig;
  navigationConfig?: NavigationConfig;
  notificationConfig?: NotificationConfig;
}

export interface RefactoredBookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  executionTime: number;
  steps: BookingStep[];
  screenshots: string[];
  sessionInfo?: SessionInfo;
  browserInfo?: BrowserInfo;
}

// ===== FACTORY INTERFACE =====

export interface IBookingServiceFactory {
  createAutoBookingService(): IAutoBookingService;
  createBrowserManager(): IBrowserManager;
  createSessionManager(): ISessionManager;
  createNavigationService(): INavigationService;
  createBookingService(): IBookingService;
  createNotificationService(): INotificationService;
  createAnalyticsService(): IAnalyticsService;
  createErrorHandler(): IErrorHandler;
}

// Import types from playwright
import { Browser, BrowserContext, Page } from 'playwright';
