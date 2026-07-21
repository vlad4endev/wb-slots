import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { prisma } from '../prisma';
import { decrypt } from '../encryption';
import { Logger } from '../logging/logger';
import { TelegramService } from './telegram-service';
import EnhancedBookingMonitor from './enhanced-booking-monitor';
import EnhancedSessionManager from './enhanced-session-manager';
import BookingVerificationService from './booking-verification-service';
import BookingAnalyticsService from './booking-analytics-service';
import { getUnifiedSessionManager } from '../session';
import path from 'path';
import fs from 'fs/promises';

// ===== ENHANCED TYPES =====
export interface EnhancedBookingConfig {
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

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface TimeoutConfig {
  pageLoad: number;
  navigation: number;
  elementWait: number;
  actionDelay: number;
}

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

// ===== ENHANCED AUTO BOOKING SERVICE =====
export class AutoBookingService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private logger: Logger;
  private telegramService: TelegramService;
  private monitor: EnhancedBookingMonitor;
  private sessionManager: EnhancedSessionManager;
  private verificationService: BookingVerificationService;
  private analyticsService: BookingAnalyticsService;
  private isBooking = false;
  private screenshotDir: string;
  private currentSessionId: string | null = null;

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

  private readonly defaultTimeoutConfig: TimeoutConfig = {
    pageLoad: 60000,
    navigation: 45000,
    elementWait: 30000,
    actionDelay: 1000
  };

  // Enhanced selectors with fallbacks
  private readonly selectors = {
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
  };

  constructor() {
    this.logger = new Logger('INFO', { context: 'EnhancedAutoBookingService' });
    this.telegramService = new TelegramService();
    this.sessionManager = getUnifiedSessionManager();
    this.verificationService = new BookingVerificationService();
    this.analyticsService = new BookingAnalyticsService();
    this.monitor = new EnhancedBookingMonitor({
      screenshotOnError: true,
      screenshotOnSuccess: true,
      detailedLogging: true,
      performanceTracking: true,
      memoryMonitoring: true
    });
    this.screenshotDir = path.join(process.cwd(), 'screenshots', 'auto-booking');
    this.initScreenshotDirectory();
  }

  /**
   * Enhanced booking with comprehensive error handling and retry logic
   */
  async startBooking(config: EnhancedBookingConfig): Promise<BookingResult> {
    if (this.isBooking) {
      throw new EnhancedBookingError('Booking is already in progress', 'ALREADY_RUNNING');
    }

    this.isBooking = true;
    const startTime = Date.now();
    const retryConfig = { ...this.defaultRetryConfig, ...config.retryConfig };
    const timeoutConfig = { ...this.defaultTimeoutConfig, ...config.timeoutConfig };
    
    // Начинаем сессию мониторинга
    this.currentSessionId = this.monitor.startSession(config.taskId, config.userId);
    
    let attempt = 0;
    let lastError: EnhancedBookingError | null = null;
    const stepResults: StepResult[] = [];

    this.logger.info('🚀 Starting enhanced auto-booking process', { 
      config, 
      retryConfig, 
      timeoutConfig 
    });

    // Отслеживаем начало попытки бронирования
    await this.analyticsService.trackBookingEvent('attempt', {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId,
      metadata: { retryConfig, timeoutConfig }
    });

    while (attempt < retryConfig.maxAttempts) {
      attempt++;
      let page: Page | null = null;
      
      try {
        this.logger.info(`📝 Booking attempt ${attempt}/${retryConfig.maxAttempts}`, { config });
        this.monitor.startStep(`attempt-${attempt}`, `Booking Attempt ${attempt}`, { config, retryConfig, timeoutConfig });

        // Step 1: Initialize browser and page
        this.monitor.startStep('browser-init', 'Initialize Browser and Page');
        const { browser, context, page: newPage } = await this.initializeBrowser(timeoutConfig);
        page = newPage;
        this.monitor.endStep(true, undefined, { browserInitialized: true });
        stepResults.push(await this.recordStep('browser_init', true, 0));

        // Начинаем периодические скриншоты
        const stopPeriodicScreenshots = await this.monitor.startPeriodicScreenshots(page, 15000); // каждые 15 секунд

        // Step 2: Validate and restore session
        this.monitor.startStep('session-validation', 'Validate and Restore Session');
        const sessionResult = await this.validateAndRestoreSession(page, config.userId);
        this.monitor.endStep(sessionResult.success, sessionResult.error);
        stepResults.push(sessionResult);
        
        if (!sessionResult.success) {
          await this.monitor.captureScreenshot(page, 'session-validation-failed', 'error');
          throw new SessionExpiredError('Session validation failed');
        }

        // Step 3: Navigate to supplies page
        this.monitor.startStep('navigation', 'Navigate to Supplies Page');
        const navResult = await this.enhancedNavigateToSupplies(page, timeoutConfig);
        this.monitor.endStep(navResult.success, navResult.error);
        stepResults.push(navResult);

        // Step 4: Find and select supply
        this.monitor.startStep('find-supply', 'Find and Select Supply', { supplyId: config.supplyId });
        const supplyResult = await this.enhancedFindSupply(page, config.supplyId, timeoutConfig);
        this.monitor.endStep(supplyResult.success, supplyResult.error);
        stepResults.push(supplyResult);

        // Step 5: Perform booking
        this.monitor.startStep('perform-booking', 'Perform Slot Booking');
        const bookingResult = await this.enhancedPerformBooking(page, config, timeoutConfig);
        this.monitor.endStep(bookingResult.success, bookingResult.error);
        stepResults.push(bookingResult);

        // Step 6: Verify booking success
        this.monitor.startStep('verify-booking', 'Verify Booking Success');
        const verificationResult = await this.verifyBookingSuccess(page, config);
        this.monitor.endStep(verificationResult.success, verificationResult.error, verificationResult.details);
        stepResults.push(verificationResult);

        // Success - захватываем скриншот успеха
        await this.monitor.captureScreenshot(page, 'booking-success', 'success');
        
        // Останавливаем периодические скриншоты
        stopPeriodicScreenshots();
        
        // Завершаем текущую попытку
        this.monitor.endStep(true);
        
        // Save results and notify
        await this.saveBookingResult(config, {
          success: true,
          bookingId: verificationResult.details?.bookingId,
          details: {
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            date: config.date,
            bookedAt: new Date().toISOString(),
            stepResults
          }
        });

        await this.sendSuccessNotification(config, verificationResult.details?.bookingId);

        const executionTime = Date.now() - startTime;
        this.logger.info(`🎉 Booking completed successfully in ${executionTime}ms`, {
          bookingId: verificationResult.details?.bookingId,
          attemptCount: attempt
        });

        // Отслеживаем успешное бронирование
        await this.analyticsService.trackBookingEvent('success', {
          userId: config.userId,
          taskId: config.taskId,
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          executionTime,
          metadata: {
            bookingId: verificationResult.details?.bookingId,
            verificationMethod: verificationResult.details?.verificationMethod,
            attemptCount: attempt
          }
        });

        // Завершаем сессию мониторинга
        const session = this.monitor.endSession('success');
        if (session) {
          await this.monitor.saveSessionReport(session);
        }

        return {
          success: true,
          bookingId: verificationResult.details?.bookingId,
          details: {
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            date: config.date,
            bookedAt: new Date().toISOString(),
            stepResults
          },
          attemptCount: attempt,
          executionTime
        };

      } catch (error) {
        const enhancedError = this.enhanceError(error);
        lastError = enhancedError;
        
        // Отслеживаем ошибку бронирования
        if (attempt < retryConfig.maxAttempts && enhancedError.isRetryable) {
          await this.analyticsService.trackBookingEvent('retry', {
            userId: config.userId,
            taskId: config.taskId,
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            errorReason: enhancedError.message,
            retryCount: attempt,
            metadata: {
              errorCode: enhancedError.code,
              isRetryable: enhancedError.isRetryable
            }
          });
        }

        this.logger.error(`❌ Booking attempt ${attempt} failed`, {
          error: enhancedError.message,
          code: enhancedError.code,
          isRetryable: enhancedError.isRetryable,
          context: enhancedError.context
        });

        // Take screenshot on error
        if (page) {
          try {
            const screenshot = await this.takeErrorScreenshot(page, attempt, enhancedError.code);
            stepResults.push(await this.recordStep('error_screenshot', true, 0, undefined, screenshot));
          } catch (screenshotError) {
            this.logger.warn('Failed to take error screenshot', { error: screenshotError });
          }
        }

        // Check if error is retryable and we have attempts left
        if (!enhancedError.isRetryable || attempt >= retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        this.logger.info(`⏳ Retrying in ${delay}ms`, { attempt, maxAttempts: retryConfig.maxAttempts });
        await this.delay(delay);

      } finally {
        if (page) {
          await page.close().catch((error) => {
            this.logger.warn({ 
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to close page after booking attempt');
          });
        }
      }
    }

    // All attempts failed
    const executionTime = Date.now() - startTime;
    const finalError = lastError || new EnhancedBookingError('Unknown booking error', 'UNKNOWN_ERROR');

    // Отслеживаем окончательную неудачу
    await this.analyticsService.trackBookingEvent('failure', {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId,
      executionTime,
      errorReason: finalError.message,
      retryCount: attempt,
      metadata: {
        errorCode: finalError.code,
        totalAttempts: attempt
      }
    });

    await this.saveBookingResult(config, {
      success: false,
      error: finalError.message,
      details: {
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date,
        bookedAt: new Date().toISOString(),
        stepResults
      }
    });

    await this.sendFailureNotification(config, finalError, attempt);

    this.logger.error(`💥 Booking failed after ${attempt} attempts in ${executionTime}ms`, {
      error: finalError.message,
      code: finalError.code
    });

    return {
      success: false,
      error: finalError.message,
      details: {
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date,
        bookedAt: new Date().toISOString(),
        stepResults
      },
      attemptCount: attempt,
      executionTime
    };
  }

  /**
   * Initialize browser with enhanced configuration
   */
  private async initializeBrowser(timeoutConfig: TimeoutConfig): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
  }> {
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
      
      // Set enhanced timeouts
      page.setDefaultTimeout(timeoutConfig.elementWait);
      page.setDefaultNavigationTimeout(timeoutConfig.navigation);

      // Enhanced anti-detection setup
      await this.setupEnhancedAntiDetection(page);

      this.logger.info('✅ Browser initialized successfully');
      return { browser: this.browser, context: this.context, page };

    } catch (error: any) {
      throw new EnhancedBookingError(
        `Failed to initialize browser: ${error?.message || 'Unknown error'}`, 
        'BROWSER_INIT_ERROR', 
        false, 
        error
      );
    }
  }

  /**
   * Enhanced anti-detection setup
   */
  private async setupEnhancedAntiDetection(page: Page): Promise<void> {
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

    this.logger.info('✅ Enhanced anti-detection setup completed');
  }

  /**
   * Validate and restore session with enhanced verification
   */
  private async validateAndRestoreSession(page: Page, userId: string): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      // Используем улучшенный менеджер сессий
      const sessionResult = await this.sessionManager.restoreSession(userId, page.context());
      
      if (!sessionResult.isValid) {
        this.logger.warn('⚠️ Session invalid, needs refresh', { userId, error: sessionResult.error });
        throw new SessionExpiredError(sessionResult.error || 'Session invalid');
      }
      
      // Проверяем статус авторизации на странице
      await page.goto('https://seller.wildberries.ru', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      const authStatus = await this.sessionManager.checkAuthenticationStatus(page);
      
      if (!authStatus.isAuthenticated) {
        this.logger.warn('⚠️ User not authenticated on page', { userId, authStatus });
        throw new SessionExpiredError('User not authenticated on page');
      }
      
      // Обновляем сессию, если нужно
      if (sessionResult.needsRefresh) {
        this.logger.info('🔄 Refreshing session', { userId });
        await this.sessionManager.refreshSession(userId, page, sessionResult.metadata?.sessionId);
      }

      const duration = Date.now() - stepStart;
      this.logger.info('✅ Session validated and restored successfully', { 
        userId,
        duration,
        sessionMetadata: sessionResult.metadata,
        authStatus
      });
      
      return await this.recordStep('session_validation', true, duration, undefined, undefined, {
        sessionValid: sessionResult.isValid,
        needsRefresh: sessionResult.needsRefresh,
        authenticated: authStatus.isAuthenticated,
        userInfo: authStatus.userInfo
      });

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this.enhanceError(error);
      
      this.logger.error('❌ Session validation failed', {
        userId,
        error: enhancedError.message,
        duration
      });
      
      return await this.recordStep('session_validation', false, duration, enhancedError.message);
    }
  }

  /**
   * Enhanced navigation to supplies page
   */
  private async enhancedNavigateToSupplies(page: Page, timeoutConfig: TimeoutConfig): Promise<StepResult> {
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

      // Wait for supplies page to load with multiple selectors
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
      this.logger.info('✅ Successfully navigated to supplies page', { duration });
      
      return await this.recordStep('navigate_to_supplies', true, duration);

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this.enhanceError(error);
      
      this.logger.error('❌ Navigation to supplies failed', {
        error: enhancedError.message,
        duration
      });
      
      return await this.recordStep('navigate_to_supplies', false, duration, enhancedError.message);
    }
  }

  /**
   * Enhanced supply finding with multiple selectors
   */
  private async enhancedFindSupply(page: Page, supplyId: string, timeoutConfig: TimeoutConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      this.logger.info(`🔍 Looking for supply: ${supplyId}`);

      // Generate selectors with actual supplyId
      const supplySelectors = this.selectors.supply.item.map(selector => 
        selector.replace('{supplyId}', supplyId)
      );

      // Try each selector until one works
      let supplyElement = null;
      for (const selector of supplySelectors) {
        try {
          supplyElement = await page.waitForSelector(selector, { timeout: 5000 });
          if (supplyElement) {
            this.logger.info(`✅ Found supply with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!supplyElement) {
        // Try scrolling and searching again
        await this.scrollAndSearch(page, supplyId);
        
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
      await this.delay(timeoutConfig.actionDelay);

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
      this.logger.info(`✅ Supply found and opened: ${supplyId}`, { duration });
      
      return await this.recordStep('find_supply', true, duration);

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this.enhanceError(error);
      
      this.logger.error(`❌ Failed to find supply: ${supplyId}`, {
        error: enhancedError.message,
        duration
      });
      
      return await this.recordStep('find_supply', false, duration, enhancedError.message);
    }
  }

  /**
   * Scroll and search for supply if not immediately visible
   */
  private async scrollAndSearch(page: Page, supplyId: string): Promise<void> {
    this.logger.info('📜 Scrolling to search for supply');
    
    // Scroll down in intervals to load more supplies
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await this.delay(1000);
      
      // Check if supply is now visible
      const isVisible = await page.evaluate((supplyId) => {
        const text = document.body.innerText;
        return text.includes(supplyId);
      }, supplyId);
      
      if (isVisible) {
        this.logger.info('✅ Supply found after scrolling');
        break;
      }
    }
  }

  /**
   * Enhanced booking performance with multiple strategies
   */
  private async enhancedPerformBooking(page: Page, config: EnhancedBookingConfig, timeoutConfig: TimeoutConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      this.logger.info('📅 Starting enhanced booking process');

      // Step 1: Find and click plan button
      const planSelectors = this.selectors.supply.planButton;
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
      await this.delay(timeoutConfig.actionDelay);
      this.logger.info('✅ Clicked plan supply button');

      // Step 2: Wait for calendar to appear
      const calendarSelectors = this.selectors.calendar.container;
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

      this.logger.info('✅ Calendar appeared');

      // Step 3: Select date
      const dateSelectors = this.selectors.calendar.date.map(selector => 
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
      await this.delay(timeoutConfig.actionDelay);
      this.logger.info(`✅ Selected date: ${config.date}`);

      // Step 4: Click book button
      const bookSelectors = this.selectors.booking.button;
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
      await this.delay(timeoutConfig.actionDelay * 2); // Longer delay for booking processing
      this.logger.info('✅ Clicked book button');

      const duration = Date.now() - stepStart;
      this.logger.info('✅ Booking process completed', { duration });
      
      return await this.recordStep('perform_booking', true, duration);

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this.enhanceError(error);
      
      this.logger.error('❌ Booking process failed', {
        error: enhancedError.message,
        duration
      });
      
      return await this.recordStep('perform_booking', false, duration, enhancedError.message);
    }
  }

  /**
   * Verify booking success with multiple confirmation strategies and fallback mechanisms
   */
  private async verifyBookingSuccess(page: Page, config: EnhancedBookingConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      this.logger.info('🔍 Starting comprehensive booking verification');

      // Используем специальный сервис верификации
      const verificationResult = await this.verificationService.verifyBookingSuccess(page, {
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date,
        userId: config.userId,
        taskId: config.taskId
      });

      // Сохраняем результат верификации
      await this.verificationService.saveVerificationResult({
        userId: config.userId,
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date
      }, verificationResult);

      const duration = Date.now() - stepStart;
      
      if (verificationResult.isConfirmed) {
        this.logger.info(`🎉 Booking verified successfully via ${verificationResult.verificationMethod}`, { 
          duration,
          bookingId: verificationResult.bookingId,
          method: verificationResult.verificationMethod
        });
        
        return await this.recordStep('verify_booking', true, duration, undefined, undefined, { 
          bookingId: verificationResult.bookingId,
          verificationMethod: verificationResult.verificationMethod,
          confirmationDetails: verificationResult.confirmationDetails
        });
      } else {
        this.logger.warn(`⚠️ Booking verification failed`, {
          duration,
          method: verificationResult.verificationMethod,
          error: verificationResult.error,
          fallbackRequired: verificationResult.fallbackRequired
        });
        
        return await this.recordStep('verify_booking', false, duration, verificationResult.error, undefined, {
          verificationMethod: verificationResult.verificationMethod,
          fallbackRequired: verificationResult.fallbackRequired
        });
      }

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this.enhanceError(error);
      
      this.logger.error('❌ Booking verification failed with exception', {
        error: enhancedError.message,
        duration
      });
      
      return await this.recordStep('verify_booking', false, duration, enhancedError.message);
    }
  }

  /**
   * Initialize screenshot directory
   */
  private async initScreenshotDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create screenshot directory', { error });
    }
  }

  /**
   * Record step result
   */
  private async recordStep(
    step: string, 
    success: boolean, 
    duration: number, 
    error?: string, 
    screenshot?: string,
    details?: Record<string, any>
  ): Promise<StepResult> {
    return {
      step,
      success,
      duration,
      error,
      screenshot,
      details
    };
  }

  /**
   * Take error screenshot
   */
  private async takeErrorScreenshot(page: Page, attempt: number, errorCode: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error-${attempt}-${errorCode}-${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      
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

  /**
   * Enhance error with proper classification
   */
  private enhanceError(error: any): EnhancedBookingError {
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

  /**
   * Save booking result to database
   */
  private async saveBookingResult(config: EnhancedBookingConfig, result: Partial<BookingResult>): Promise<void> {
    try {
      await prisma.bookingResult.create({
        data: {
          userId: config.userId,
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          warehouseName: `Склад ${config.warehouseId}`,
          bookingDate: config.date,
          timeSlot: '09:00-18:00',
          boxTypes: [`Type ${config.boxTypeId}`],
          coefficient: config.coefficient,
          bookingId: result.bookingId,
          status: result.success ? 'SUCCESS' : 'FAILED',
          errorMessage: result.error,
          details: result.details as any,
        },
      });

      this.logger.info('✅ Booking result saved to database');
    } catch (error) {
      this.logger.error('Failed to save booking result', { error });
    }
  }

  /**
   * Send success notification
   */
  private async sendSuccessNotification(config: EnhancedBookingConfig, bookingId?: string): Promise<void> {
    try {
      const message = `🎉 Слот успешно забронирован!\n\n` +
        `📦 Поставка: ${config.supplyId}\n` +
        `🏢 Склад: ${config.warehouseId}\n` +
        `📅 Дата: ${config.date}\n` +
        `🆔 ID бронирования: ${bookingId || 'N/A'}`;

      await this.telegramService.sendNotification(config.userId, message);
      this.logger.info('✅ Success notification sent');
    } catch (error) {
      this.logger.error('Failed to send success notification', { error });
    }
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(config: EnhancedBookingConfig, error: EnhancedBookingError, attempt: number): Promise<void> {
    try {
      const message = `❌ Ошибка бронирования слота\n\n` +
        `📦 Поставка: ${config.supplyId}\n` +
        `🏢 Склад: ${config.warehouseId}\n` +
        `📅 Дата: ${config.date}\n` +
        `🧾 Код ошибки: ${error.code}\n` +
        `🔁 Попытка: ${attempt}\n` +
        `🚫 Ошибка: ${error.message}`;

      await this.telegramService.sendNotification(config.userId, message);
      this.logger.info('✅ Failure notification sent');
    } catch (notificationError) {
      this.logger.error('Failed to send failure notification', { error: notificationError });
    }
  }

  /**
   * Delay utility
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if booking is in progress
   */
  isBookingInProgress(): boolean {
    return this.isBooking;
  }

  /**
   * Stop the service and cleanup resources
   */
  async stop(): Promise<void> {
    this.isBooking = false;
    
    // Принудительно останавливаем мониторинг
    if (this.monitor) {
      this.monitor.forceStop();
    }
    
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.logger.info('🛑 Enhanced Auto Booking Service stopped');
  }
}
