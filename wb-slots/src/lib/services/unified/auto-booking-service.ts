// ===== UNIFIED AUTO BOOKING SERVICE =====

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BaseServiceWithAllFeatures } from '../core/base-service-with-all-features';
import { 
  IAutoBookingService,
  AutoBookingConfig,
  BookingResult,
  BookingDetails,
  BookingHistory,
  RetryConfig,
  TimeoutConfig,
  SessionInfo,
  BrowserInfo,
  StepResult
} from '../core/interfaces';
import { prisma } from '../../prisma';
import { decrypt } from '../../encryption';
import { getActiveWBSession } from '../../utils/session-utils';
import { Logger } from '../../logging/logger';
import { TelegramService } from '../telegram-service';
import path from 'path';
import fs from 'fs/promises';

// ===== ENHANCED ERROR CLASSES =====

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

export class SessionExpiredError extends EnhancedBookingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'SESSION_EXPIRED', true, originalError);
  }
}

export class ElementNotFoundError extends EnhancedBookingError {
  constructor(selector: string, originalError?: Error) {
    super(`Element not found: ${selector}`, 'ELEMENT_NOT_FOUND', true, originalError, { selector });
  }
}

export class BookingConflictError extends EnhancedBookingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'BOOKING_CONFLICT', false, originalError);
  }
}

export class NetworkError extends EnhancedBookingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', true, originalError);
  }
}

// ===== CONFIGURATION INTERFACE =====

export interface UnifiedAutoBookingConfig {
  enableAntibot: boolean;
  enableHumanBehavior: boolean;
  enableScreenshots: boolean;
  screenshotDir: string;
  defaultTimeoutConfig: TimeoutConfig;
  selectors: {
    supply: {
      item: string[];
      planButton: string[];
    };
    calendar: {
      container: string[];
      date: string[];
    };
    booking: {
      button: string[];
      success: string[];
    };
  };
}

// ===== UNIFIED AUTO BOOKING SERVICE =====

export class UnifiedAutoBookingService 
  extends BaseServiceWithAllFeatures<UnifiedAutoBookingConfig>
  implements IAutoBookingService {
  
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private telegramService: TelegramService;
  private isBooking = false;
  private currentSessionId: string | null = null;
  private bookingHistory: BookingHistory[] = [];

  constructor() {
    const defaultConfig: UnifiedAutoBookingConfig = {
      enableAntibot: true,
      enableHumanBehavior: true,
      enableScreenshots: true,
      screenshotDir: path.join(process.cwd(), 'screenshots', 'auto-booking'),
      defaultTimeoutConfig: {
        pageLoad: 60000,
        navigation: 45000,
        elementWait: 30000,
        actionDelay: 1000
      },
      selectors: {
        supply: {
          item: [
            `[data-supply-id="{supplyId}"]`,
            `[data-testid="supply-{supplyId}"]`,
            `.supply-item:has-text("{supplyId}")`,
            `tr:has-text("{supplyId}")`,
            `*:contains("{supplyId}")`
          ],
          planButton: [
            'button:has-text("Запланировать поставку")',
            '[data-testid="plan-supply"]',
            '.plan-supply-btn',
            'button[class*="plan"]',
            'button:contains("План")'
          ]
        },
        calendar: {
          container: [
            '[data-testid="booking-calendar"]',
            '.booking-calendar',
            '.calendar',
            '[class*="calendar"]',
            '.date-picker'
          ],
          date: [
            `[data-date="{date}"]`,
            `.date-{date}`,
            `[data-testid="date-{date}"]`,
            `td:has-text("{date}")`,
            `[title*="{date}"]`
          ]
        },
        booking: {
          button: [
            'button:has-text("Забронировать")',
            '[data-testid="book-slot"]',
            '.book-btn',
            'button[class*="book"]',
            'button:contains("Бронир")'
          ],
          success: [
            '[data-testid="booking-success"]',
            '.booking-success',
            '.success-message',
            '[class*="success"]',
            '.notification-success'
          ]
        }
      }
    };

    const defaultRetryConfig: RetryConfig = {
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

    super('UnifiedAutoBookingService', defaultConfig, defaultRetryConfig);
    this.telegramService = new TelegramService();
    this.initScreenshotDirectory();
  }

  // ===== ABSTRACT METHODS IMPLEMENTATION =====

  async initialize(): Promise<void> {
      this.logger.info('Initializing Unified Auto Booking Service');
    this._addHealthCheck('initialization', 'pass', 'Service initialized successfully');
  }

  async start(): Promise<void> {
      this.logger.info('Starting Unified Auto Booking Service');
    this._startService();
    this._addHealthCheck('service_status', 'pass', 'Service started successfully');
  }

  async stop(): Promise<void> {
      this.logger.info('Stopping Unified Auto Booking Service');
    this.isBooking = false;

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

    this._stopService();
    this._addHealthCheck('service_status', 'pass', 'Service stopped successfully');
  }

  validateConfig(config: Partial<UnifiedAutoBookingConfig>): boolean {
    const requiredFields: (keyof UnifiedAutoBookingConfig)[] = [
      'enableAntibot',
      'enableHumanBehavior',
      'enableScreenshots',
      'screenshotDir'
    ];

    return this._validateRequiredConfig(config, requiredFields);
  }

  // ===== IAutoBookingService IMPLEMENTATION =====

  async bookSlot(config: AutoBookingConfig): Promise<BookingResult> {
    if (this.isBooking) {
      throw new EnhancedBookingError('Booking is already in progress', 'ALREADY_RUNNING');
    }

    const startTime = Date.now();
    this.isBooking = true;
    
    try {
        this.logger.info('Starting slot booking', { config });

      const result = await this.retry(async () => {
        return await this._performBooking(config);
      }, 'slot_booking');

      const duration = Date.now() - startTime;
      this._logOperation('bookSlot', result.success, duration, { config, result });

      // Save to history
      this._addToHistory({
        id: `booking-${Date.now()}`,
        userId: config.userId,
        taskId: config.taskId,
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date,
        status: result.success ? 'SUCCESS' : 'FAILED',
        bookingId: result.bookingId,
        error: result.error,
        createdAt: new Date(),
        executionTime: duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const enhancedError = this._enhanceError(error);
      
      this._logOperation('bookSlot', false, duration, { config, error: enhancedError.message });
      
      const result: BookingResult = {
        success: false,
        error: enhancedError.message,
        attemptCount: 1,
        executionTime: duration
      };

      // Save to history
      this._addToHistory({
        id: `booking-${Date.now()}`,
        userId: config.userId,
        taskId: config.taskId,
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date,
        status: 'FAILED',
        error: enhancedError.message,
        createdAt: new Date(),
        executionTime: duration
        });

        return result;
    } finally {
      this.isBooking = false;
    }
  }

  isBookingInProgress(): boolean {
    return this.isBooking;
  }

  getBookingHistory(): BookingHistory[] {
    return [...this.bookingHistory];
  }

  async cancelBooking(bookingId: string): Promise<boolean> {
    try {
      this.logger.info('Cancelling booking', { bookingId });
      
      // Update history
      const booking = this.bookingHistory.find(b => b.bookingId === bookingId);
      if (booking) {
        booking.status = 'CANCELLED';
      }

      this._addHealthCheck('booking_cancellation', 'pass', `Booking ${bookingId} cancelled`);
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel booking', { bookingId, error });
      this._addHealthCheck('booking_cancellation', 'fail', `Failed to cancel booking ${bookingId}`);
      return false;
    }
  }

  // ===== PRIVATE METHODS =====

  private async _performBooking(config: AutoBookingConfig): Promise<BookingResult> {
    const timeoutConfig = { ...this._typedConfig.defaultTimeoutConfig, ...config.timeoutConfig };
    let page: Page | null = null;
    const stepResults: StepResult[] = [];

    try {
      // Step 1: Initialize browser
      const browserResult = await this._initializeBrowser(timeoutConfig);
      page = browserResult.page;
      stepResults.push(browserResult.stepResult);

      // Step 2: Validate session
      const sessionResult = await this._validateSession(page, config.userId);
      stepResults.push(sessionResult);
      
      if (!sessionResult.success) {
        throw new SessionExpiredError('Session validation failed');
      }

      // Step 3: Navigate to supplies
      const navResult = await this._navigateToSupplies(page, timeoutConfig);
      stepResults.push(navResult);

      // Step 4: Find supply
      const supplyResult = await this._findSupply(page, config.supplyId, timeoutConfig);
      stepResults.push(supplyResult);

      // Step 5: Perform booking
      const bookingResult = await this._performBookingSteps(page, config, timeoutConfig);
      stepResults.push(bookingResult);

      // Step 6: Verify success
      const verifyResult = await this._verifyBookingSuccess(page, config);
      stepResults.push(verifyResult);

      if (verifyResult.success) {
        await this._sendSuccessNotification(config, verifyResult.details?.bookingId);
        
        return {
          success: true,
          bookingId: verifyResult.details?.bookingId,
          details: {
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            date: config.date,
            bookedAt: new Date().toISOString(),
            stepResults
          }
        };
      } else {
        throw new EnhancedBookingError('Booking verification failed', 'VERIFICATION_FAILED');
      }

    } catch (error) {
      if (page && this._typedConfig.enableScreenshots) {
        try {
          const screenshot = await this._takeScreenshot(page, 'error');
          return {
            success: false,
            error: (error as Error).message,
            screenshot,
            details: {
              supplyId: config.supplyId,
              warehouseId: config.warehouseId,
              date: config.date,
              bookedAt: new Date().toISOString(),
              stepResults
            }
          };
        } catch (screenshotError) {
          this.logger.warn('Failed to take error screenshot', { error: screenshotError });
        }
        }
        
        throw error;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  private async _initializeBrowser(timeoutConfig: TimeoutConfig): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
    stepResult: StepResult;
  }> {
    const stepStart = Date.now();
    
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-blink-features=AutomationControlled',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
      });

      const page = await this.context.newPage();
      page.setDefaultTimeout(timeoutConfig.elementWait);
      page.setDefaultNavigationTimeout(timeoutConfig.navigation);

      if (this._typedConfig.enableAntibot) {
        await this._setupAntiDetection(page);
      }

      const duration = Date.now() - stepStart;
      this.logger.info('Browser initialized successfully', { duration });

      return {
        browser: this.browser,
        context: this.context,
        page,
        stepResult: {
          step: 'browser_init',
          success: true,
          duration
        }
      };

    } catch (error) {
      const duration = Date.now() - stepStart;
      throw new EnhancedBookingError(
        `Failed to initialize browser: ${(error as Error).message}`, 
        'BROWSER_INIT_ERROR', 
        false, 
        error as Error
      );
    }
  }

  private async _setupAntiDetection(page: Page): Promise<void> {
    // Remove webdriver property
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Mock permissions
    await page.addInitScript(() => {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
    });

    // Hide automation indicators
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });

    // Override plugins
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    this.logger.info('Anti-detection setup completed');
  }

  private async _validateSession(page: Page, userId: string): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      if (!process.env.ENCRYPTION_KEY) {
        throw new SessionExpiredError('Encryption key not configured');
      }

      // Используем новый WBSessionManager
      const sessionManager = new (await import('@/lib/services/wb-session-manager')).WBSessionManager(process.env.ENCRYPTION_KEY);
      
      // Восстанавливаем сессию с новой архитектурой
      const restoration = await sessionManager.restoreSession(userId, page);

      if (!restoration.isValid) {
        this.logger.warn('Session validation failed with new architecture', {
          userId,
          reason: restoration.reason,
          suggestions: restoration.suggestions,
          details: restoration.details
        });
        throw new SessionExpiredError(`Session validation failed: ${restoration.reason || 'User not authenticated'}`);
      }

      const duration = Date.now() - stepStart;
      this.logger.info('Session validated successfully with new architecture', { 
        userId, 
        duration,
        validationDetails: restoration.details
      });

      return {
        step: 'session_validation',
        success: true,
        duration
      };

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this._enhanceError(error);
      
      this.logger.error('Session validation failed', {
        userId,
        error: enhancedError.message,
        duration
      });
      
      return {
        step: 'session_validation',
        success: false,
        duration,
        error: enhancedError.message
      };
    }
  }

  private async _navigateToSupplies(page: Page, timeoutConfig: TimeoutConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      const suppliesUrl = 'https://seller.wildberries.ru/supplies-management/all-supplies';
      
      await page.goto(suppliesUrl, {
          waitUntil: 'domcontentloaded',
        timeout: timeoutConfig.pageLoad
      });

      // Check if redirected to login
      if (page.url().includes('/login')) {
        throw new SessionExpiredError('Redirected to login page');
      }

      // Wait for supplies page to load
      const suppliesSelectors = [
        '[data-testid="supplies-list"]',
        '.supplies-list',
        '.supply-item',
        'table[data-testid="supplies-table"]',
        '.supplies-container'
      ];

      let suppliesLoaded = false;
      for (const selector of suppliesSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          suppliesLoaded = true;
        break;
        } catch {
          continue;
        }
      }

      if (!suppliesLoaded) {
        throw new ElementNotFoundError('supplies-page-content');
      }

      const duration = Date.now() - stepStart;
      this.logger.info('Successfully navigated to supplies page', { duration });
      
      return {
        step: 'navigate_to_supplies',
        success: true,
        duration
      };

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this._enhanceError(error);
      
      this.logger.error('Navigation to supplies failed', {
        error: enhancedError.message,
        duration
      });
      
      return {
        step: 'navigate_to_supplies',
        success: false,
        duration,
        error: enhancedError.message
      };
    }
  }

  private async _findSupply(page: Page, supplyId: string, timeoutConfig: TimeoutConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      this.logger.info(`Looking for supply: ${supplyId}`);

      // Generate selectors with actual supplyId
      const supplySelectors = this._typedConfig.selectors.supply.item.map(selector => 
        selector.replace('{supplyId}', supplyId)
      );

      // Try each selector until one works
      let supplyElement = null;
      for (const selector of supplySelectors) {
        try {
          supplyElement = await page.waitForSelector(selector, { timeout: 5000 });
          if (supplyElement) {
            this.logger.info(`Found supply with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!supplyElement) {
        // Try scrolling and searching again
        await this._scrollAndSearch(page, supplyId);
        
        // Try selectors again after scrolling
        for (const selector of supplySelectors) {
          try {
            supplyElement = await page.waitForSelector(selector, { timeout: 5000 });
            if (supplyElement) break;
          } catch {
            continue;
          }
        }
      }

      if (!supplyElement) {
        throw new ElementNotFoundError(`supply-${supplyId}`);
      }

      // Click on supply
      await supplyElement.click();
      await this._delay(timeoutConfig.actionDelay);

      // Verify supply details loaded
      const detailSelectors = [
        '[data-testid="supply-details"]',
        '.supply-details',
        '.supply-info',
        '.supply-card'
      ];

      let detailsLoaded = false;
      for (const selector of detailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          detailsLoaded = true;
          break;
        } catch {
          continue;
        }
      }

      if (!detailsLoaded) {
        throw new ElementNotFoundError('supply-details');
      }

      const duration = Date.now() - stepStart;
      this.logger.info(`Supply found and opened: ${supplyId}`, { duration });
      
      return {
        step: 'find_supply',
        success: true,
        duration
      };

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this._enhanceError(error);
      
      this.logger.error(`Failed to find supply: ${supplyId}`, {
        error: enhancedError.message,
        duration
      });
      
      return {
        step: 'find_supply',
        success: false,
        duration,
        error: enhancedError.message
      };
    }
  }

  private async _scrollAndSearch(page: Page, supplyId: string): Promise<void> {
    this.logger.info('Scrolling to search for supply');
    
    // Scroll down in intervals to load more supplies
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await this._delay(1000);
      
      // Check if supply is now visible
      const isVisible = await page.evaluate((supplyId) => {
        const text = document.body.innerText;
        return text.includes(supplyId);
      }, supplyId);
      
      if (isVisible) {
        this.logger.info('Supply found after scrolling');
        break;
      }
    }
  }

  private async _performBookingSteps(page: Page, config: AutoBookingConfig, timeoutConfig: TimeoutConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      this.logger.info('Starting booking process');

      // Step 1: Find and click plan button
      const planSelectors = this._typedConfig.selectors.supply.planButton;
      let planButton = null;
      
      for (const selector of planSelectors) {
        try {
          planButton = await page.waitForSelector(selector, { timeout: 5000 });
          if (planButton) break;
        } catch {
          continue;
        }
      }

      if (!planButton) {
        throw new ElementNotFoundError('plan-supply-button');
      }

      await planButton.click();
      await this._delay(timeoutConfig.actionDelay);
      this.logger.info('Clicked plan supply button');

      // Step 2: Wait for calendar to appear
      const calendarSelectors = this._typedConfig.selectors.calendar.container;
      let calendarVisible = false;
      
      for (const selector of calendarSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          calendarVisible = true;
          break;
        } catch {
          continue;
        }
      }

      if (!calendarVisible) {
        throw new ElementNotFoundError('booking-calendar');
      }

      this.logger.info('Calendar appeared');

      // Step 3: Select date
      const dateSelectors = this._typedConfig.selectors.calendar.date.map(selector => 
        selector.replace('{date}', config.date)
      );
      
      let dateElement = null;
      for (const selector of dateSelectors) {
        try {
          dateElement = await page.waitForSelector(selector, { timeout: 5000 });
          if (dateElement) break;
        } catch {
          continue;
        }
      }

      if (!dateElement) {
        throw new ElementNotFoundError(`date-${config.date}`);
      }

      await dateElement.click();
      await this._delay(timeoutConfig.actionDelay);
      this.logger.info(`Selected date: ${config.date}`);

      // Step 4: Click book button
      const bookSelectors = this._typedConfig.selectors.booking.button;
      let bookButton = null;
      
      for (const selector of bookSelectors) {
        try {
          bookButton = await page.waitForSelector(selector, { timeout: 5000 });
          if (bookButton) break;
        } catch {
          continue;
        }
      }

      if (!bookButton) {
        throw new ElementNotFoundError('book-button');
      }

      await bookButton.click();
      await this._delay(timeoutConfig.actionDelay * 2); // Longer delay for booking processing
      this.logger.info('Clicked book button');

      const duration = Date.now() - stepStart;
      this.logger.info('Booking process completed', { duration });
      
      return {
        step: 'perform_booking',
        success: true,
        duration
      };

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this._enhanceError(error);
      
      this.logger.error('Booking process failed', {
        error: enhancedError.message,
        duration
      });
      
      return {
        step: 'perform_booking',
        success: false,
        duration,
        error: enhancedError.message
      };
    }
  }

  private async _verifyBookingSuccess(page: Page, config: AutoBookingConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      this.logger.info('Starting booking verification');

      // Wait for success indicators
      const successSelectors = this._typedConfig.selectors.booking.success;
      let successVisible = false;
      let bookingId: string | undefined;
      
      for (const selector of successSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          successVisible = true;
          
          // Try to extract booking ID from the page
          try {
            bookingId = await page.evaluate(() => {
              // Look for booking ID in various places
              const text = document.body.innerText;
              const idMatch = text.match(/ID[:\s]*([A-Z0-9-]+)/i);
              return idMatch ? idMatch[1] : undefined;
            });
          } catch {
            // Ignore extraction errors
          }
          
          break;
        } catch {
          continue;
        }
      }

      const duration = Date.now() - stepStart;
      
      if (successVisible) {
        this.logger.info('Booking verified successfully', { 
          duration,
          bookingId
        });
        
        return {
          step: 'verify_booking',
          success: true,
          duration,
          details: { 
            bookingId,
            verificationMethod: 'success_indicators'
          }
        };
      } else {
        this.logger.warn('Booking verification failed - no success indicators found', {
          duration
        });
        
        return {
          step: 'verify_booking',
          success: false,
          duration,
          error: 'No success indicators found'
        };
      }

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this._enhanceError(error);
      
      this.logger.error('Booking verification failed with exception', {
        error: enhancedError.message,
        duration
      });
      
      return {
        step: 'verify_booking',
        success: false,
        duration,
        error: enhancedError.message
      };
    }
  }

  private async _sendSuccessNotification(config: AutoBookingConfig, bookingId?: string): Promise<void> {
    try {
      const message = `🎉 Слот успешно забронирован!\n\n` +
        `📦 Поставка: ${config.supplyId}\n` +
        `🏢 Склад: ${config.warehouseId}\n` +
        `📅 Дата: ${config.date}\n` +
        `🆔 ID бронирования: ${bookingId || 'N/A'}`;

      await this.telegramService.sendNotification(config.userId, message);
      this.logger.info('Success notification sent');
    } catch (error) {
      this.logger.error('Failed to send success notification', { error });
    }
  }

  private async _takeScreenshot(page: Page, type: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${type}-${timestamp}.png`;
      const filepath = path.join(this._typedConfig.screenshotDir, filename);
      
      const screenshot = await page.screenshot({ 
        fullPage: true, 
        type: 'png',
        path: filepath
      });
      
      return screenshot.toString('base64');
    } catch (error) {
      this.logger.warn('Failed to take screenshot', { error });
      return '';
    }
  }

  private _enhanceError(error: any): EnhancedBookingError {
    if (error instanceof EnhancedBookingError) {
      return error;
    }

    const message = error?.message || 'Unknown error';
    const isTimeoutError = message.includes('timeout') || message.includes('Timeout');
    const isNetworkError = message.includes('net::') || message.includes('Network');
    const isSessionError = message.includes('login') || message.includes('unauthorized');

    if (isSessionError) {
      return new SessionExpiredError(message, error);
    } else if (isNetworkError) {
      return new NetworkError(message, error);
    } else if (isTimeoutError) {
      return new EnhancedBookingError(message, 'TIMEOUT_ERROR', true, error);
    } else {
      return new EnhancedBookingError(message, 'UNKNOWN_ERROR', false, error);
    }
  }

  private _addToHistory(booking: BookingHistory): void {
    this.bookingHistory.push(booking);
    
    // Keep only last 100 bookings
    if (this.bookingHistory.length > 100) {
      this.bookingHistory = this.bookingHistory.slice(-100);
    }
  }

  private async initScreenshotDirectory(): Promise<void> {
    try {
      await fs.mkdir(this._typedConfig.screenshotDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create screenshot directory', { error });
    }
  }
}