// ===== REFACTORED AUTO BOOKING SERVICE - SOLID COMPLIANT =====

import { Browser, BrowserContext, Page } from 'playwright';
import { ILogger } from '../core/interfaces';
import { BrowserManager, IBrowserManager, BrowserConfig } from './browser/browser-manager';
import { SessionManager, ISessionManager } from './session/session-manager';
import { NavigationService, INavigationService, NavigationConfig } from './navigation/navigation-service';
import { BookingService, IBookingService, BookingConfig } from './booking/booking-service';
import { NotificationService, INotificationService, NotificationConfig, NotificationMessage } from './notification/notification-service';
import { AnalyticsService, IAnalyticsService, BookingAnalytics } from './analytics/analytics-service';
import { ErrorHandler, IErrorHandler, RetryConfig, ErrorContext, EnhancedBookingError } from './error/error-handler';

// ===== MAIN CONFIGURATION INTERFACES =====

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

export interface BookingStep {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
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

// ===== MAIN REFACTORED AUTO BOOKING SERVICE =====

export class RefactoredAutoBookingService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isBooking = false;
  private screenshots: string[] = [];

  // Default configurations
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'SESSION_EXPIRED',
      'ELEMENT_NOT_FOUND',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR'
    ]
  };

  private readonly defaultBrowserConfig: BrowserConfig = {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: 60000
  };

  private readonly defaultNavigationConfig: NavigationConfig = {
    baseUrl: 'https://seller.wildberries.ru',
    timeout: 60000,
    retryAttempts: 3
  };

  constructor(
    private logger: ILogger,
    private browserManager: IBrowserManager,
    private sessionManager: ISessionManager,
    private navigationService: INavigationService,
    private bookingService: IBookingService,
    private notificationService: INotificationService,
    private analyticsService: IAnalyticsService,
    private errorHandler: IErrorHandler
  ) {}

  async performBooking(config: RefactoredAutoBookingConfig): Promise<RefactoredBookingResult> {
    if (this.isBooking) {
      throw new EnhancedBookingError('Booking is already in progress', 'ALREADY_RUNNING');
    }

    const startTime = Date.now();
    this.isBooking = true;
    this.screenshots = [];

    try {
      this.logger.info('Starting refactored booking process', { config });

      // Step 1: Initialize browser
      await this.initializeBrowser(config);

      // Step 2: Validate and restore session
      await this.validateAndRestoreSession(config);

      // Step 3: Navigate to supply
      await this.navigateToSupply(config);

      // Step 4: Perform booking
      const bookingResult = await this.performBookingSteps(config);

      // Step 5: Save analytics
      await this.saveAnalytics(config, bookingResult, startTime);

      // Step 6: Send notifications
      await this.sendNotifications(config, bookingResult);

      const executionTime = Date.now() - startTime;
      this.logger.info(`Booking process completed in ${executionTime}ms`);

      return {
        success: bookingResult.success,
        bookingId: bookingResult.bookingId,
        error: bookingResult.error,
        executionTime,
        steps: bookingResult.steps,
        screenshots: this.screenshots,
        sessionInfo: await this.getSessionInfo(config.userId),
        browserInfo: await this.getBrowserInfo()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const enhancedError = this.errorHandler.enhanceError(error as Error, {
        step: 'performBooking',
        userId: config.userId,
        supplyId: config.supplyId,
        attempt: 1,
        maxAttempts: 1,
        originalError: error as Error
      });

      await this.errorHandler.handleError(enhancedError, {
        step: 'performBooking',
        userId: config.userId,
        supplyId: config.supplyId,
        attempt: 1,
        maxAttempts: 1,
        originalError: error as Error
      });

      return {
        success: false,
        error: enhancedError.message,
        executionTime,
        steps: [],
        screenshots: this.screenshots
      };
    } finally {
      await this.cleanup();
      this.isBooking = false;
    }
  }

  private async initializeBrowser(config: RefactoredAutoBookingConfig): Promise<void> {
    this.logger.info('Initializing browser...');
    
    const browserConfig = { ...this.defaultBrowserConfig, ...config.browserConfig };
    const { browser, context } = await this.browserManager.initialize(browserConfig);
    
    this.browser = browser;
    this.context = context;
    this.page = await this.browserManager.createPage(context);
    
    this.logger.info('Browser initialized successfully');
  }

  private async validateAndRestoreSession(config: RefactoredAutoBookingConfig): Promise<void> {
    this.logger.info('Validating and restoring session...');
    
    const sessionInfo = await this.sessionManager.validateSession(config.userId);
    
    if (!sessionInfo.isValid) {
      this.logger.warn('Session is invalid, will need to login');
      // Here you would implement login logic
      return;
    }

    const restored = await this.sessionManager.restoreSession(this.page!, config.userId);
    if (!restored) {
      throw new EnhancedBookingError('Failed to restore session', 'SESSION_RESTORE_FAILED');
    }

    this.logger.info('Session validated and restored successfully');
  }

  private async navigateToSupply(config: RefactoredAutoBookingConfig): Promise<void> {
    this.logger.info('Navigating to supply...');
    
    const navigationConfig = { ...this.defaultNavigationConfig, ...config.navigationConfig };
    const result = await this.navigationService.navigateToSupply(this.page!, config.supplyId, navigationConfig);
    
    if (!result.success) {
      throw new EnhancedBookingError(`Navigation failed: ${result.error}`, 'NAVIGATION_FAILED');
    }

    this.logger.info('Successfully navigated to supply');
  }

  private async performBookingSteps(config: RefactoredAutoBookingConfig): Promise<RefactoredBookingResult> {
    this.logger.info('Performing booking steps...');
    
    const bookingConfig: BookingConfig = {
      supplyId: config.supplyId,
      warehouseId: config.warehouseId,
      date: config.date,
      boxTypeId: config.boxTypeId,
      timeout: config.navigationConfig?.timeout || 60000
    };

    const result = await this.bookingService.performBooking(this.page!, bookingConfig);
    
    return {
      success: result.success,
      bookingId: result.bookingId,
      error: result.error,
      executionTime: result.duration,
      steps: result.steps,
      screenshots: this.screenshots
    };
  }

  private async saveAnalytics(
    config: RefactoredAutoBookingConfig, 
    result: RefactoredBookingResult, 
    startTime: number
  ): Promise<void> {
    this.logger.info('Saving analytics...');
    
    const analytics: BookingAnalytics = {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId,
      date: config.date,
      success: result.success,
      bookingId: result.bookingId,
      error: result.error,
      executionTime: result.executionTime,
      steps: result.steps,
      screenshots: result.screenshots,
      sessionInfo: result.sessionInfo,
      browserInfo: result.browserInfo
    };

    await this.analyticsService.saveBookingResult(analytics);
    this.logger.info('Analytics saved successfully');
  }

  private async sendNotifications(
    config: RefactoredAutoBookingConfig, 
    result: RefactoredBookingResult
  ): Promise<void> {
    this.logger.info('Sending notifications...');
    
    const message: NotificationMessage = {
      title: result.success ? 'Бронирование успешно' : 'Ошибка бронирования',
      message: result.success 
        ? `Слот успешно забронирован для поставки ${config.supplyId}`
        : `Ошибка бронирования: ${result.error}`,
      type: result.success ? 'success' : 'error',
      data: {
        userId: config.userId,
        supplyId: config.supplyId,
        bookingId: result.bookingId,
        executionTime: result.executionTime
      }
    };

    if (result.success) {
      await this.notificationService.sendSuccess(message);
    } else {
      await this.notificationService.sendError(message);
    }

    this.logger.info('Notifications sent successfully');
  }

  private async getSessionInfo(userId: string): Promise<SessionInfo | undefined> {
    try {
      return await this.sessionManager.validateSession(userId);
    } catch (error) {
      this.logger.warn('Failed to get session info:', error);
      return undefined;
    }
  }

  private async getBrowserInfo(): Promise<BrowserInfo | undefined> {
    if (!this.page) return undefined;

    try {
      const version = await this.page.evaluate(() => navigator.userAgent);
      const platform = await this.page.evaluate(() => navigator.platform);
      const viewport = await this.page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
      }));

      return { version, platform, viewport };
    } catch (error) {
      this.logger.warn('Failed to get browser info:', error);
      return undefined;
    }
  }

  private async cleanup(): Promise<void> {
    this.logger.info('Cleaning up resources...');
    
    try {
      if (this.browser) {
        await this.browserManager.cleanup(this.browser);
        this.browser = null;
        this.context = null;
        this.page = null;
      }
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }

    this.logger.info('Cleanup completed');
  }

  // Public utility methods
  async getBookingHistory(userId: string, limit?: number): Promise<BookingAnalytics[]> {
    return this.analyticsService.getBookingHistory(userId, limit);
  }

  async getBookingStats(userId: string): Promise<any> {
    return this.analyticsService.getBookingStats(userId);
  }

  async getSuccessRate(userId: string, days?: number): Promise<number> {
    return this.analyticsService.getSuccessRate(userId, days);
  }

  isBookingInProgress(): boolean {
    return this.isBooking;
  }
}
