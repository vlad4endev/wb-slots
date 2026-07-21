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
import { bookingLockService } from './booking-lock-service';
import { centralizedErrorHandler, CentralizedBookingErrorHandler } from './centralized-booking-error-handler';
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

interface BookingFinalAnalytics {
  taskId: string;
  userId: string;
  totalAttempts: number;
  totalTime: number;
  lastErrorCode: string | null;
  retryableCount: number;
  success: boolean;
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

// ===== AUTO BOOKING SERVICE =====
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

  private createStepResult(
    stepId: string,
    success: boolean,
    duration: number,
    metadata: Record<string, any> = {},
    error?: string
  ): StepResult {
    return {
      step: stepId,
      success,
      duration,
      error: error || null,
      details: metadata,
    };
  }

  /**
   * Enhanced booking with comprehensive error handling and retry logic
   * ИСПРАВЛЕНО: 
   * - Добавлен гарантированный cleanup браузера в любом случае
   * - Добавлен distributed lock для предотвращения concurrent bookings
   */
  async startBooking(config: EnhancedBookingConfig): Promise<BookingResult> {
    // КРИТИЧНО: Проверяем in-memory флаг (защита от повторного вызова в том же процессе)
    if (this.isBooking) {
      throw new EnhancedBookingError('Booking is already in progress in current process', 'ALREADY_RUNNING');
    }

    // КРИТИЧНО: Получаем distributed lock (защита от concurrent bookings в разных процессах)
    const lock = await bookingLockService.acquireLock(config.userId, {
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId,
      ttlSeconds: 600, // 10 минут TTL
      metadata: {
        startedAt: new Date().toISOString(),
        config: {
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          date: config.date,
        },
      },
    });

    if (!lock) {
      // Проверяем информацию о существующей блокировке
      const existingLock = await bookingLockService.getLockInfo(config.userId);
      
      const errorMessage = existingLock 
        ? `Booking already in progress for user ${config.userId}. Started at ${existingLock.acquiredAt.toISOString()}, expires at ${existingLock.expiresAt.toISOString()}`
        : `Failed to acquire booking lock for user ${config.userId}`;
      
      this.logger.warn(errorMessage, { existingLock });
      throw new EnhancedBookingError(errorMessage, 'BOOKING_LOCKED');
    }

    this.logger.info('🔒 Booking lock acquired', {
      lockId: lock.id,
      userId: config.userId,
      taskId: config.taskId,
      expiresAt: lock.expiresAt,
    });

    this.isBooking = true;
    const startTime = Date.now();
    const retryConfig = { ...this.defaultRetryConfig, ...config.retryConfig };
    const timeoutConfig = { ...this.defaultTimeoutConfig, ...config.timeoutConfig };
    
    // Начинаем сессию мониторинга
    this.currentSessionId = this.monitor.startSession(config.taskId, config.userId);
    
    let lastError: EnhancedBookingError | null = null;
    let lastStepResults: StepResult[] = [];
    let finalStatus: 'success' | 'failed' = 'failed';

    this.logger.info('🚀 Starting enhanced auto-booking process', { 
      taskId: config.taskId,
      userId: config.userId,
      slotId: config.slotId,
      supplyId: config.supplyId,
      retryConfig, 
      timeoutConfig 
    });

    // Отслеживаем начало попытки бронирования
    await this.analyticsService.trackBookingEvent('attempt', {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId,
      metadata: { retryConfig, timeoutConfig, slotId: config.slotId }
    });

    let totalAttempts = 0;
    let retryableCount = 0;
    let lastErrorCode: string | null = null;
    let finalAnalytics: BookingFinalAnalytics | null = null;

    try {
      for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        totalAttempts = attempt;
        const attemptStartTime = Date.now();
        let attemptDuration = 0;
        let shouldRetry = false;
        let attemptError: EnhancedBookingError | null = null;

        this.logger.info('Booking attempt started', {
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          slotId: config.slotId,
          userId: config.userId,
          supplyId: config.supplyId,
        });

        try {
          const attemptResult = await this.runSingleBookingAttempt(
            config,
            timeoutConfig,
            attempt,
            retryConfig.maxAttempts
          );

          attemptDuration = Date.now() - attemptStartTime;

          lastStepResults = attemptResult.details?.stepResults
            ? [...attemptResult.details.stepResults]
            : [];

          if (attemptResult.success) {
            finalStatus = 'success';
            lastError = null;
            lastErrorCode = null;

            const totalTime = Date.now() - startTime;
            finalAnalytics = {
              taskId: config.taskId,
              userId: config.userId,
              totalAttempts,
              totalTime,
              lastErrorCode,
              retryableCount,
              success: true,
            };

            const verificationStep = attemptResult.details?.stepResults?.find(
              (step) => step.step === 'verify-booking'
            );

            await this.analyticsService.trackBookingEvent('success', {
              userId: config.userId,
              taskId: config.taskId,
              supplyId: config.supplyId,
              warehouseId: config.warehouseId,
              executionTime: attemptDuration,
              metadata: {
                attempt,
                maxAttempts: retryConfig.maxAttempts,
                retryable: false,
                errorCode: null,
                slotId: config.slotId,
                bookingId: attemptResult.bookingId ?? null,
                verificationMethod: verificationStep?.details?.verificationMethod,
                coefficient: config.coefficient,
              },
            });

            await this.saveBookingResult(config, {
              success: true,
              bookingId: attemptResult.bookingId,
              details: attemptResult.details,
            });

            await this.sendSuccessNotification(config, attemptResult.bookingId);

            await this.logRunMessage(config.runId, 'INFO', 'Auto-booking completed', {
              bookingId: attemptResult.bookingId,
              attempt,
              totalAttempts,
              totalTime,
              slotId: config.slotId,
              analytics: finalAnalytics,
            });

            this.logger.info('🎉 Booking completed successfully', {
              attempt,
              maxAttempts: retryConfig.maxAttempts,
              attemptDuration,
              totalTime,
              slotId: config.slotId,
              userId: config.userId,
              bookingId: attemptResult.bookingId,
            });

            this.logger.info('📊 Auto-booking final analytics', {
              ...finalAnalytics,
              slotId: config.slotId,
            });

            return {
              success: true,
              bookingId: attemptResult.bookingId,
              details: attemptResult.details,
              attemptCount: attempt,
              executionTime: totalTime,
            };
          }

          const isRetryable = attempt < retryConfig.maxAttempts;
          attemptError = new EnhancedBookingError(
            attemptResult.error ?? 'Unknown booking error',
            'BOOKING_FAILED',
            isRetryable
          );
          attemptError.context = {
            ...(attemptError.context ?? {}),
            stepResults: attemptResult.details?.stepResults ?? [],
          };

          lastError = attemptError;
          lastErrorCode = attemptError.code;
          lastStepResults = attemptResult.details?.stepResults
            ? [...attemptResult.details.stepResults]
            : [];
          shouldRetry = isRetryable;

          if (shouldRetry) {
            retryableCount++;
          }

          const logMethod = shouldRetry ? this.logger.warn.bind(this.logger) : this.logger.error.bind(this.logger);
          logMethod('Booking attempt completed without success', {
            attempt,
            maxAttempts: retryConfig.maxAttempts,
            attemptDuration,
            slotId: config.slotId,
            userId: config.userId,
            error: attemptError.message,
            errorCode: attemptError.code,
            retryable: shouldRetry,
            errorName: attemptError.name,
          });
        } catch (error) {
          attemptDuration = Date.now() - attemptStartTime;
          let enhancedError: EnhancedBookingError;
          let screenshotStep: StepResult | null = null;
          let sessionDeactivated = false;

          try {
            const errorHandlingResult = await centralizedErrorHandler.handleError(error, {
              step: `booking_attempt_${attempt}`,
              userId: config.userId,
              taskId: config.taskId,
              supplyId: config.supplyId,
              warehouseId: config.warehouseId,
              page: undefined,
              attempt,
              metadata: { config, retryConfig, timeoutConfig },
            });

            enhancedError = errorHandlingResult.error;
            sessionDeactivated = !!errorHandlingResult.sessionDeactivated;

            if (enhancedError.context?.stepResults) {
              lastStepResults = enhancedError.context.stepResults;
            }

            if (errorHandlingResult.screenshot) {
              screenshotStep = await this.recordStep(
                `error_screenshot_attempt_${attempt}`,
                true,
                0,
                undefined,
                errorHandlingResult.screenshot
              );
            }

            enhancedError.context = {
              ...(enhancedError.context ?? {}),
              sessionDeactivated,
            };
          } catch (handlerError) {
            enhancedError =
              error instanceof EnhancedBookingError
                ? error
                : new EnhancedBookingError(
                    handlerError instanceof Error ? handlerError.message : String(handlerError),
                    'BOOKING_FAILED',
                    false,
                    handlerError instanceof Error ? handlerError : undefined
                  );
          }

          if (screenshotStep) {
            lastStepResults = [...lastStepResults, screenshotStep];
          }

          attemptError = enhancedError;
          lastError = enhancedError;
          lastErrorCode = enhancedError.code;

          shouldRetry = attempt < retryConfig.maxAttempts && enhancedError.isRetryable;
          if (shouldRetry) {
            retryableCount++;
          }

          this.logger.error('Booking attempt failed with exception', {
            attempt,
            maxAttempts: retryConfig.maxAttempts,
            attemptDuration,
            slotId: config.slotId,
            userId: config.userId,
            error: enhancedError.message,
            errorCode: enhancedError.code,
            retryable: enhancedError.isRetryable,
            sessionDeactivated: attemptError.context?.sessionDeactivated ?? false,
            screenshot: !!screenshotStep,
            errorName: enhancedError.name,
          });
        }

        if (attemptError && !attemptError.context?.stepResults?.length && lastStepResults.length) {
          attemptError.context = {
            ...(attemptError.context ?? {}),
            stepResults: lastStepResults,
          };
        }

        if (!shouldRetry) {
          break;
        }

        await this.analyticsService.trackBookingEvent('retry', {
          userId: config.userId,
          taskId: config.taskId,
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          executionTime: attemptDuration,
          metadata: {
            attempt,
            maxAttempts: retryConfig.maxAttempts,
            retryable: true,
            errorCode: attemptError?.code ?? lastErrorCode,
            slotId: config.slotId,
            coefficient: config.coefficient,
            sessionDeactivated: attemptError?.context?.sessionDeactivated ?? false,
          },
        });

        const delay = Math.min(
          retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        this.logger.info('Retry scheduled', {
          attempt,
          nextAttempt: attempt + 1,
          maxAttempts: retryConfig.maxAttempts,
          delay,
          attemptDuration,
          slotId: config.slotId,
          userId: config.userId,
          errorCode: attemptError?.code ?? lastErrorCode,
        });

        await this.delay(delay);
      }
    } finally {
      try {
        const session = this.monitor.endSession(finalStatus);
        if (session) {
          try {
            await this.monitor.saveSessionReport(session);
          } catch (reportError) {
            this.logger.warn('Failed to save monitoring session', {
              error: reportError instanceof Error ? reportError.message : 'Unknown'
            });
          }
        }
      } catch (monitorError) {
        this.logger.warn('Failed to finalize monitoring session', {
          error: monitorError instanceof Error ? monitorError.message : 'Unknown'
        });
      }

      try {
        if (lock) {
          const released = await bookingLockService.releaseLock(lock.id);
          if (released) {
            this.logger.info('🔓 Booking lock released', { lockId: lock.id, userId: config.userId });
          } else {
            this.logger.warn('⚠️ Failed to release booking lock', { lockId: lock.id, userId: config.userId });
          }
        }
      } catch (lockError) {
        this.logger.error('Lock release error', {
          error: lockError instanceof Error ? lockError.message : 'Unknown',
          lockId: lock.id,
          userId: config.userId
        });
      }

      this.isBooking = false;
      this.currentSessionId = null;
    }

    // All attempts failed
    const totalTime = Date.now() - startTime;
    const finalError =
      lastError ||
      new EnhancedBookingError('Unknown booking error', 'UNKNOWN_ERROR');

    lastErrorCode = finalError.code;
    finalAnalytics = {
      taskId: config.taskId,
      userId: config.userId,
      totalAttempts,
      totalTime,
      lastErrorCode,
      retryableCount,
      success: false,
    };

    await this.analyticsService.trackBookingEvent('failure', {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId,
      executionTime: totalTime,
      errorReason: finalError.message,
      retryCount: totalAttempts,
      metadata: {
        attempt: totalAttempts,
        maxAttempts: retryConfig.maxAttempts,
        retryable: finalError.isRetryable,
        errorCode: finalError.code,
        slotId: config.slotId,
        retryableCount,
      },
    });

    await this.saveBookingResult(config, {
      success: false,
      error: finalError.message,
      details: {
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date,
        bookedAt: new Date().toISOString(),
        stepResults: lastStepResults,
      }
    });

    await this.sendFailureNotification(config, finalError, totalAttempts);

    await this.logRunMessage(config.runId, 'ERROR', 'Auto-booking failed', {
      errorCode: finalError.code,
      errorMessage: finalError.message,
      attempts: totalAttempts,
      totalTime,
      slotId: config.slotId,
      retryableCount,
      analytics: finalAnalytics,
    });

    this.logger.error('💥 Booking failed', {
      totalAttempts,
      totalTime,
      slotId: config.slotId,
      userId: config.userId,
      error: finalError.message,
      errorCode: finalError.code,
      retryable: finalError.isRetryable,
      errorName: finalError.name,
    });

    this.logger.info('📊 Auto-booking final analytics', {
      ...finalAnalytics,
      slotId: config.slotId,
    });

    return {
      success: false,
      error: finalError.message,
      details: {
        supplyId: config.supplyId,
        warehouseId: config.warehouseId,
        date: config.date,
        bookedAt: new Date().toISOString(),
        stepResults: lastStepResults,
      },
      attemptCount: totalAttempts,
      executionTime: totalTime
    };
  }

  /**
   * Initialize browser with enhanced configuration
   */
  private async runSingleBookingAttempt(
    config: EnhancedBookingConfig,
    timeoutConfig: TimeoutConfig,
    attempt: number,
    maxAttempts: number
  ): Promise<BookingResult> {
    this.logger.info('runSingle booking attempt started', {
      attempt,
      maxAttempts,
      slotId: config.slotId,
      userId: config.userId,
      supplyId: config.supplyId,
    });
    this.monitor.startStep(`attempt-${attempt}`, `Booking Attempt ${attempt}`, {
      config,
      attempt,
      maxAttempts,
    });

    const resources: { browser: Browser | null; context: BrowserContext | null; page: Page | null } = {
      browser: null,
      context: null,
      page: null,
    };
    const stepResults: StepResult[] = [];
    let stopPeriodicScreenshots: (() => void) | null = null;
    const attemptTimerStart = Date.now();

    try {
      this.monitor.startStep('browser-init', 'Initialize Browser and Page');
      const { browser, context, page } = await this.initializeBrowser(timeoutConfig);
      resources.browser = browser;
      resources.context = context;
      resources.page = page;
      this.monitor.endStep(true, undefined, { browserInitialized: true });
      stepResults.push(await this.recordStep('browser_init', true, 0));

      stopPeriodicScreenshots = await this.monitor.startPeriodicScreenshots(page, 15000);

      this.monitor.startStep('session-validation', 'Validate and Restore Session');
      const sessionResult = await this.validateAndRestoreSession(page, config.userId);
      this.monitor.endStep(sessionResult.success, sessionResult.error);
      stepResults.push(sessionResult);

      if (!sessionResult.success) {
        await this.monitor.captureScreenshot(page, 'session-validation-failed', 'error');
        throw new SessionExpiredError('Session validation failed');
      }

      this.monitor.startStep('navigation', 'Navigate to Supplies Page');
      const navResult = await this.enhancedNavigateToSupplies(resources.page!, timeoutConfig);
      this.monitor.endStep(navResult.success, navResult.error);
      stepResults.push(navResult);

      this.monitor.startStep('find-supply', 'Find and Select Supply', { supplyId: config.supplyId });
      const supplyResult = await this.enhancedFindSupply(resources.page!, config.supplyId, timeoutConfig);
      this.monitor.endStep(supplyResult.success, supplyResult.error);
      stepResults.push(supplyResult);

      this.monitor.startStep('perform-booking', 'Perform Slot Booking');
      const bookingResult = await this.enhancedPerformBooking(resources.page!, config, timeoutConfig);
      this.monitor.endStep(bookingResult.success, bookingResult.error);
      stepResults.push(bookingResult);

      this.monitor.startStep('verify-booking', 'Verify Booking Success');
      const verificationResult = await this.verifyBookingSuccess(resources.page!, config);
      this.monitor.endStep(verificationResult.success, verificationResult.error, verificationResult.details);
      stepResults.push(verificationResult);

      await this.monitor.captureScreenshot(resources.page!, 'booking-success', 'success');

      this.monitor.endStep(true);

      const attemptDuration = Date.now() - attemptTimerStart;
      this.logger.info('runSingle booking attempt succeeded', {
        attempt,
        maxAttempts,
        slotId: config.slotId,
        userId: config.userId,
        duration: attemptDuration,
        bookingId: verificationResult.details?.bookingId,
      });

      return {
        success: true,
        bookingId: verificationResult.details?.bookingId,
        details: {
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          date: config.date,
          bookedAt: new Date().toISOString(),
          stepResults: [...stepResults],
        },
      };
    } catch (error) {
      const attemptDuration = Date.now() - attemptTimerStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof EnhancedBookingError ? error.code : 'UNKNOWN_ERROR';
      const retryable = error instanceof EnhancedBookingError ? error.isRetryable : false;

      this.monitor.endStep(false, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof EnhancedBookingError) {
        error.context = {
          ...(error.context ?? {}),
          stepResults,
        };
      } else if (error && typeof error === 'object') {
        (error as any).context = {
          ...((error as any).context ?? {}),
          stepResults,
        };
      }

      this.logger.error('runSingle booking attempt failed', {
        attempt,
        maxAttempts,
        slotId: config.slotId,
        userId: config.userId,
        duration: attemptDuration,
        error: errorMessage,
        errorCode,
        retryable,
      });

      throw error;
    } finally {
      if (stopPeriodicScreenshots) {
        try {
          stopPeriodicScreenshots();
        } catch (stopError) {
          this.logger.warn('Failed to stop periodic screenshots', { error: stopError });
        }
      }

      await this.safeCloseBrowserResources(resources);
    }
  }

  private async safeCloseBrowserResources(res: {
    browser?: Browser | null;
    context?: BrowserContext | null;
    page?: Page | null;
  }): Promise<void> {
    if (res.page) {
      const pageRef = res.page;
      try {
        await pageRef.close();
      } catch (error) {
        this.logger.warn('Failed to close page safely', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      } finally {
        res.page = null;
      }
    }

    if (res.context) {
      const contextRef = res.context;
      try {
        await contextRef.close();
      } catch (error) {
        this.logger.warn('Failed to close context safely', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      } finally {
        res.context = null;
        if (this.context === contextRef) {
          this.context = null;
        }
      }
    }

    if (res.browser) {
      const browserRef = res.browser;
      try {
        await browserRef.close();
      } catch (error) {
        this.logger.warn('Failed to close browser safely', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      } finally {
        res.browser = null;
        if (this.browser === browserRef) {
          this.browser = null;
        }
      }
    }
  }

  private async logRunMessage(
    runId: string,
    level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG',
    message: string,
    meta?: Record<string, any>
  ): Promise<void> {
    if (!runId) {
      return;
    }

    try {
      await prisma.runLog.create({
        data: {
          runId,
          level: level as any,
          message,
          meta,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to write run log entry', {
        error: error instanceof Error ? error.message : 'Unknown',
        runId,
        level,
        message,
      });
    }
  }

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
   * ИСПРАВЛЕНО: Добавлена проверка cookies и критичных данных браузера
   */
  private async validateAndRestoreSession(page: Page, userId: string): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      this.logger.info('🔍 Starting browser session validation', { userId });
      
      // 1. Проверяем наличие сессии в БД
      const dbSession = await prisma.wBSession.findUnique({ 
        where: { userId },
        select: { isActive: true, expiresAt: true, sessionData: true }
      });
      
      if (!dbSession || !dbSession.isActive) {
        this.logger.warn('⚠️ No active session in database', { userId });
        throw new SessionExpiredError('No active session found, re-authentication required');
      }
      
      // 2. Проверяем истечение сессии (если expiresAt указан)
      if (dbSession.expiresAt && dbSession.expiresAt < new Date()) {
        this.logger.warn('⚠️ Session expired', { 
          userId, 
          expiresAt: dbSession.expiresAt,
          now: new Date() 
        });
        
        // Деактивируем истекшую сессию
        await prisma.wBSession.update({
          where: { userId },
          data: { 
            isActive: false, 
            deactivationReason: 'Session expired during booking validation',
            deactivatedAt: new Date()
          }
        });
        
        throw new SessionExpiredError('Session expired, re-authentication required');
      }
      
      // 3. Восстанавливаем cookies и storage в браузере ИЗ БД
      this.logger.info('🔄 Restoring session from database', { 
        userId,
        sessionDataSize: dbSession.sessionData?.length || 0
      });
      
      // ИСПРАВЛЕНИЕ: Если сессия в БД активна и не истекла - используем её
      // Декодируем sessionData и применяем cookies к browser context
      let sessionRestored = false;
      let cookiesApplied = 0;
      
      try {
        // КРИТИЧНО: Передаём page, а НЕ page.context()!
        // sessionManager.restoreSession() ожидает Page объект
        const sessionResult = await this.sessionManager.restoreSession(userId, page);
        
        if (sessionResult.isValid) {
          this.logger.info('✅ Session restored successfully from database', {
            cookiesCount: sessionResult.metadata?.cookieCount || 0,
            localStorageKeys: sessionResult.metadata?.localStorageKeys || 0,
          });
          
          // sessionManager.restoreSession() УЖЕ применил cookies и localStorage к page
          // Мы просто фиксируем успех
          cookiesApplied = sessionResult.metadata?.cookieCount || 0;
          sessionRestored = true;
        } else {
          this.logger.warn('⚠️ Session restoration returned isValid=false', { 
            error: sessionResult.error,
            needsRefresh: sessionResult.needsRefresh 
          });
          
          // Если нужно обновление - пытаемся
          if (sessionResult.needsRefresh) {
            this.logger.info('🔄 Attempting to refresh session');
            await this.sessionManager.refreshSession(userId, page, dbSession.id);
            sessionRestored = true;
          }
        }
      } catch (restoreError) {
        this.logger.warn('⚠️ Session restoration threw error (will try to continue)', { 
          error: restoreError instanceof Error ? restoreError.message : 'Unknown' 
        });
      }
      
      // ВАЖНО: Если сессия в БД активна и не истекла - продолжаем работу
      // даже если восстановление cookies частично не сработало
      if (!sessionRestored) {
        this.logger.info('ℹ️ Session restoration incomplete, but DB session is active - continuing');
        this.logger.info('💡 Браузер будет работать без восстановленных cookies из БД');
        this.logger.info('💡 Если бронирование упадёт - создайте новую сессию через /wb-auth');
      } else if (cookiesApplied === 0) {
        this.logger.warn('⚠️ Session decoded but no cookies applied - browser may not be authenticated');
      }
      
      // 4. Проверяем статус авторизации на странице WB (с безопасной навигацией)
      const navResult = await this.safeNavigate(page, 'https://seller.wildberries.ru', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
        maxRetries: 2
      });
      
      if (!navResult.success) {
        this.logger.error('Failed to navigate to WB seller page', { 
          error: navResult.error 
        });
        throw new NetworkError(`Navigation failed: ${navResult.error}`);
      }
      
      // 5. Проверяем критичные cookies для WB (опционально)
      const cookies = await page.context().cookies();
      const hasAuthCookie = cookies.some(c => 
        c.name.includes('auth') || 
        c.name.includes('session') || 
        c.name.includes('token') ||
        c.name.includes('WBToken') ||
        c.name.includes('x-supplier-id')
      );
      
      if (!hasAuthCookie) {
        this.logger.warn('⚠️ No authentication cookies found in browser context', { 
          userId, 
          cookieCount: cookies.length 
        });
        
        // ИСПРАВЛЕНИЕ: Не падаем сразу, если сессия в БД активна
        // Браузер попытается залогиниться сам или будет работать без cookies
        this.logger.info('💡 Continuing without pre-loaded cookies - браузер попытается работать');
        this.logger.info('💡 Если увидите страницу логина - создайте новую сессию через /wb-auth');
      } else {
        this.logger.info('✅ Authentication cookies found in browser', {
          cookieCount: cookies.length,
          hasCookies: true
        });
      }
      
      // 6. Проверяем, не редиректит ли на страницу логина (с безопасной навигацией)
      const currentUrl = navResult.url || page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
        this.logger.warn('⚠️ Redirected to login page', { userId, url: currentUrl });
        
        // ИСПРАВЛЕНИЕ: Даём вторую попытку с безопасной навигацией
        this.logger.info('💡 Trying to navigate to supplies page (session is active in DB)');
        
        const retryNav = await this.safeNavigate(
          page,
          'https://seller.wildberries.ru/supplies-management/all-supplies',
          {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
            maxRetries: 2
          }
        );
        
        if (!retryNav.success || retryNav.url?.includes('/login') || retryNav.url?.includes('/auth')) {
          this.logger.error('❌ Still on login page after safe navigation retry', {
            success: retryNav.success,
            url: retryNav.url,
            error: retryNav.error
          });
          throw new SessionExpiredError('Redirected to login, re-authentication required');
        }
        
        this.logger.info('✅ Successfully navigated to supplies after retry', {
          url: retryNav.url
        });
      }
      
      // 7. Проверяем статус авторизации через DOM (улучшенная проверка)
      let authCheckResult = {
        isAuthenticated: false,
        userInfo: null as any,
        checked: false,
        method: 'none' as string
      };
      
      if (hasAuthCookie && cookiesApplied > 0) {
        try {
          // ИСПРАВЛЕНО: Улучшенная DOM проверка авторизации
          authCheckResult = await this.checkDOMAuthentication(page, userId);
          
          if (!authCheckResult.isAuthenticated) {
            this.logger.warn('⚠️ User not authenticated according to DOM check', { 
              userId, 
              method: authCheckResult.method,
              cookiesApplied 
            });
            this.logger.info('💡 Continuing anyway - session is active in DB');
          } else {
            this.logger.info('✅ User authenticated confirmed by DOM', { 
              isAuthenticated: true,
              method: authCheckResult.method,
              userInfo: authCheckResult.userInfo 
            });
          }
        } catch (authCheckError) {
          this.logger.warn('⚠️ DOM auth check failed (continuing)', { 
            error: authCheckError instanceof Error ? authCheckError.message : 'Unknown' 
          });
          authCheckResult.checked = false;
        }
      } else {
        this.logger.info('ℹ️ Skipping DOM auth check (no cookies applied)', {
          hasAuthCookie,
          cookiesApplied
        });
      }
      
      // 8. Обновляем метрику использования сессии
      await prisma.wBSession.update({
        where: { userId },
        data: { 
          lastUsedAt: new Date(),
          useCount: { increment: 1 }
        }
      });

      const duration = Date.now() - stepStart;
      this.logger.info('✅ Browser session validated successfully', { 
        userId,
        duration,
        cookieCount: cookies.length,
        authChecked: authCheckResult.checked,
        authenticated: authCheckResult.isAuthenticated,
        userInfo: authCheckResult.userInfo
      });
      
      return await this.recordStep('session_validation', true, duration, undefined, undefined, {
        sessionValid: true,
        cookieCount: cookies.length,
        authChecked: authCheckResult.checked,
        authenticated: authCheckResult.isAuthenticated,
        userInfo: authCheckResult.userInfo
      });

    } catch (error) {
      const duration = Date.now() - stepStart;
      const enhancedError = this.enhanceError(error);
      
      // При SESSION_EXPIRED - деактивируем сессию в БД
      if (enhancedError.code === 'SESSION_EXPIRED') {
        await prisma.wBSession.update({
          where: { userId },
          data: { 
            isActive: false,
            deactivationReason: enhancedError.message,
            deactivatedAt: new Date()
          }
        }).catch(err => {
          this.logger.warn('Failed to deactivate session', { userId, error: err });
        });
      }
      
      this.logger.error('❌ Browser session validation failed', {
        userId,
        error: enhancedError.message,
        code: enhancedError.code,
        duration
      });
      
      return await this.recordStep('session_validation', false, duration, enhancedError.message);
    }
  }

  /**
   * Enhanced navigation to supplies page
   * ИСПРАВЛЕНО: Добавлена проверка page перед использованием
   */
  private async enhancedNavigateToSupplies(page: Page, timeoutConfig: TimeoutConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      // КРИТИЧНО: Проверяем, что page доступна и не закрыта
      if (!page || page.isClosed()) {
        throw new EnhancedBookingError('Page is not available or already closed', 'PAGE_CLOSED', false);
      }
      
      this.logger.info('🌐 Navigating to seller.wildberries.ru');
      await page.goto('https://seller.wildberries.ru', {
        waitUntil: 'domcontentloaded',
        timeout: timeoutConfig.pageLoad,
      });

      await page.waitForLoadState('networkidle');

      const redirectedAutomatically = await page
        .waitForFunction(
          () =>
            location.href.includes('/supplies-management') ||
            document.body.innerText.includes('Поставки'),
          { timeout: timeoutConfig.pageLoad }
        )
        .then(() => true)
        .catch(() => false);

      if (!redirectedAutomatically || !page.url().includes('/supplies-management')) {
        this.logger.warn('⚠️ WB did not auto-redirect, navigating manually to supplies list');
        await page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
          waitUntil: 'domcontentloaded',
          timeout: timeoutConfig.pageLoad,
        });
        await page.waitForLoadState('networkidle');
      }

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
        this.logger.error('Redirected to login page', { currentUrl });
        throw new SessionExpiredError('Redirected to login page');
      }

      await page.waitForResponse(
        (resp) =>
          resp.url().includes('/supplies-management') && resp.status() === 200,
        { timeout: timeoutConfig.pageLoad }
      ).catch(() => {
        this.logger.debug('Supplies API response wait timed out (continuing)');
      });

      await page.waitForFunction(
        () => {
          const table = document.querySelector('div.All-supplies-inner table tbody');
          const legacy = document.querySelector('.supplies-page-content');
          return (
            (table && table.children.length > 0) ||
            (legacy && legacy.querySelector('table'))
          );
        },
        { timeout: 90000 }
      );

      const duration = Date.now() - stepStart;
      this.logger.info('✅ Successfully navigated to supplies page', { currentUrl, duration });
      
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
   * ИСПРАВЛЕНО: Добавлена проверка page перед использованием
   */
  private async enhancedFindSupply(page: Page, supplyId: string, timeoutConfig: TimeoutConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      // КРИТИЧНО: Проверяем, что page доступна и не закрыта
      if (!page || page.isClosed()) {
        throw new EnhancedBookingError('Page is not available or already closed', 'PAGE_CLOSED', false);
      }
      
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
   * ИСПРАВЛЕНО: Добавлена проверка page перед использованием
   */
  private async scrollAndSearch(page: Page, supplyId: string): Promise<void> {
    // КРИТИЧНО: Проверяем, что page доступна и не закрыта
    if (!page || page.isClosed()) {
      this.logger.warn('Cannot scroll - page is closed');
      return;
    }
    
    this.logger.info('📜 Scrolling to search for supply');
    
    // Scroll down in intervals to load more supplies
    for (let i = 0; i < 5; i++) {
      // Проверяем перед каждым действием
      if (page.isClosed()) {
        this.logger.warn('Page closed during scrolling');
        break;
      }
      
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
   * ИСПРАВЛЕНО: Добавлена проверка page перед использованием
   */
  private async enhancedPerformBooking(
    page: Page,
    config: EnhancedBookingConfig,
    timeoutConfig: TimeoutConfig
  ): Promise<StepResult> {
    const start = Date.now();
    const stepId = 'perform-booking';
    const { supplyId } = config;

    if (!page || page.isClosed()) {
      throw new EnhancedBookingError('Page is not available or already closed', 'PAGE_CLOSED', false);
    }

    this.logger.info('🚀 Starting enhanced perform booking', { supplyId });

    try {
      // 1️⃣ Навигация к списку поставок
      await page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
        waitUntil: 'networkidle',
        timeout: timeoutConfig.navigation,
      });

      // 2️⃣ Поиск строки поставки
      const supplyRow = page.locator(`text=${supplyId}`).first();
      await supplyRow.waitFor({ timeout: timeoutConfig.elementWait });
      await supplyRow.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);

      // 3️⃣ Открытие карточки поставки
      this.logger.info('🟣 Opening supply card', { supplyId });
      await supplyRow.click();
      await page.waitForTimeout(2000);

      // Проверка появления кнопки планирования
      await page.waitForSelector('button:has-text("Запланировать поставку")', {
        timeout: timeoutConfig.elementWait,
      });

      // 4️⃣ Нажимаем "Запланировать поставку"
      await page.click('button:has-text("Запланировать поставку")');
      this.logger.info('📅 Planning modal opened');

      // 5️⃣ Ждём появления календаря
      await page.waitForSelector(
        '[data-testid*="date-picker"], [data-testid*="date-cell"], .calendar, .datepicker',
        {
          timeout: timeoutConfig.elementWait,
        }
      );

      // 6️⃣ Получаем доступные даты
      const availableDates = await page.$$eval(
        '[data-testid*="date-cell"]:not([disabled]), .calendar-day:not(.disabled)',
        (nodes) =>
          nodes.map((node) => {
            const element = node as HTMLElement;
            return {
              text: element.innerText.trim(),
              disabled: element.hasAttribute('disabled'),
            };
          })
      );

      if (!availableDates.length) {
        throw new EnhancedBookingError('No available booking dates found', 'NO_DATES_AVAILABLE', true);
      }

      const targetDate =
        availableDates.find((date) => !date.disabled)?.text ||
        availableDates[0]?.text ||
        availableDates[1]?.text;

      if (!targetDate) {
        throw new EnhancedBookingError('Could not determine booking date', 'NO_VALID_DATE', true);
      }

      this.logger.info('📆 Selecting booking date', { targetDate });

      const dateLocator = page.locator(`text=${targetDate}`).first();
      await dateLocator.click({ timeout: timeoutConfig.elementWait });
      await page.waitForTimeout(1000);

      // 7️⃣ Кнопка «Выбрать»
      const selectButton = page.locator('button:has-text("Выбрать")');
      await selectButton.click({ timeout: timeoutConfig.elementWait });
      this.logger.info('✅ Date confirmed, waiting for booking button');

      // 8️⃣ Кнопка «Забронировать»
      const bookButton = page.locator('button:has-text("Забронировать")');
      await bookButton.waitFor({ timeout: timeoutConfig.elementWait });
      await bookButton.click();
      this.logger.info('📦 Booking action executed');

      // 9️⃣ Ждём смены статуса
      const statusLocator = page.locator(
        'text=Запланирована, text=Запланированная, [data-testid*="supply-status"]'
      );

      const statusUpdated = await this.waitForSupplyStatus(statusLocator, timeoutConfig);
      if (!statusUpdated) {
        throw new EnhancedBookingError('Booking status did not update', 'STATUS_NOT_UPDATED', true);
      }

      const duration = Date.now() - start;
      this.logger.info('🎉 Supply successfully booked', { supplyId, duration });

      return this.createStepResult(stepId, true, duration, undefined, {
        supplyId,
        bookedAt: new Date().toISOString(),
        date: targetDate,
        warehouseId: config.warehouseId,
        coefficient: config.coefficient,
      });
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('❌ Booking attempt failed', { error: message, supplyId });

      let screenshotPath: string | undefined;
      if (page && !page.isClosed()) {
        try {
          screenshotPath = await this.monitor.captureScreenshot(page, 'booking-failed', 'error');
        } catch (screenshotError) {
          this.logger.warn('Failed to capture screenshot after booking failure', {
            error: screenshotError instanceof Error ? screenshotError.message : 'Unknown error',
          });
        }
      }

      return this.createStepResult(stepId, false, duration, message, {
        screenshot: screenshotPath,
        supplyId,
      });
    }
  }
  private async waitForSupplyStatus(locator: Locator, timeoutConfig: TimeoutConfig): Promise<boolean> {
    const maxWait = timeoutConfig.elementWait * 2;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      try {
        const text = await locator.innerText({ timeout: 5000 });
        if (text && text.toLowerCase().includes('запланир')) {
          return true;
        }
      } catch {
        // игнорируем и ждём дальше
      }

      await this.delay(3000);
    }

    return false;
  }

  /**
   * Verify booking success with multiple confirmation strategies and fallback mechanisms
   * ИСПРАВЛЕНО: Добавлена проверка page перед использованием
   */
  private async verifyBookingSuccess(page: Page, config: EnhancedBookingConfig): Promise<StepResult> {
    const stepStart = Date.now();
    
    try {
      // КРИТИЧНО: Проверяем, что page доступна и не закрыта
      if (!page || page.isClosed()) {
        throw new EnhancedBookingError('Page is not available or already closed', 'PAGE_CLOSED', false);
      }
      
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
   * ИСПРАВЛЕНО: Добавлена проверка page перед использованием
   */
  private async takeErrorScreenshot(page: Page, attempt: number, errorCode: string): Promise<string> {
    try {
      // КРИТИЧНО: Проверяем, что page доступна и не закрыта
      if (!page || page.isClosed()) {
        this.logger.warn('Cannot take screenshot - page is closed', { attempt, errorCode });
        return '';
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error-${attempt}-${errorCode}-${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      
      const screenshot = await page.screenshot({ 
        fullPage: true, 
        type: 'png',
        path: filepath
      });
      
      this.logger.info('✅ Error screenshot saved', { filepath });
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
        `💰 Коэффициент: ${config.coefficient}\n` +
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
  private async sendFailureNotification(
    config: EnhancedBookingConfig,
    error: EnhancedBookingError,
    attempt: number
  ): Promise<void> {
    try {
      const message = `❌ Ошибка бронирования слота\n\n` +
        `📦 Поставка: ${config.supplyId}\n` +
        `🏢 Склад: ${config.warehouseId}\n` +
        `📅 Дата: ${config.date}\n` +
        `🧾 Код ошибки: ${error.code}\n` +
        `🔁 Попытка: ${attempt}\n` +
        `🚫 Ошибка: ${error.message}`;

      await this.telegramService.sendNotification(config.userId, message);
      this.logger.info('✅ Failure notification sent', { attempt, errorCode: error.code });
    } catch (notificationError) {
      this.logger.error('Failed to send failure notification', { error: notificationError });
    }
  }

  /**
   * НОВЫЙ МЕТОД: Проверка авторизации через DOM элементы
   * Проверяет наличие элементов, которые видны только авторизованным пользователям
   */
  private async checkDOMAuthentication(page: Page, userId: string): Promise<{
    isAuthenticated: boolean;
    userInfo: any;
    checked: boolean;
    method: string;
  }> {
    if (!page || page.isClosed()) {
      return { isAuthenticated: false, userInfo: null, checked: false, method: 'page_closed' };
    }

    try {
      this.logger.info('🔍 Checking DOM authentication status', { userId });
      
      // Множественные селекторы для проверки авторизации
      const authSelectors = [
        '[data-qa="header-username"]',
        '[data-testid="user-menu"]',
        '.user-profile',
        '.user-menu',
        '[class*="user-name"]',
        '[class*="username"]',
        'button[data-testid="user-dropdown"]',
        '.header__user',
        '[data-qa="cabinet-header"]'
      ];

      // Проверяем каждый селектор
      for (const selector of authSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const textContent = await element.textContent();
            this.logger.info(`✅ Auth element found: ${selector}`, { textContent });
            
            return {
              isAuthenticated: true,
              userInfo: { selector, text: textContent },
              checked: true,
              method: `dom_selector_${selector}`
            };
          }
        } catch (selectorError) {
          // Продолжаем проверку следующих селекторов
          continue;
        }
      }

      // Дополнительная проверка: наличие кнопки "Выход" или "Logout"
      const logoutSelectors = [
        'button:has-text("Выход")',
        'a:has-text("Выход")',
        '[data-qa="logout"]',
        '[data-testid="logout-button"]'
      ];

      for (const selector of logoutSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            this.logger.info(`✅ Logout button found: ${selector}`);
            return {
              isAuthenticated: true,
              userInfo: { selector, text: 'logout_button_found' },
              checked: true,
              method: `logout_button_${selector}`
            };
          }
        } catch {
          continue;
        }
      }

      // Проверка URL - если не на странице логина, скорее всего авторизован
      const currentUrl = page.url();
      if (!currentUrl.includes('/login') && !currentUrl.includes('/auth')) {
        this.logger.info('✅ Not on login page - likely authenticated', { currentUrl });
        return {
          isAuthenticated: true,
          userInfo: { url: currentUrl },
          checked: true,
          method: 'url_check'
        };
      }

      // Если ничего не найдено - не авторизован
      this.logger.warn('⚠️ No authentication indicators found', { currentUrl });
      return {
        isAuthenticated: false,
        userInfo: null,
        checked: true,
        method: 'no_indicators'
      };

    } catch (error) {
      this.logger.error('❌ DOM authentication check failed', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      return { isAuthenticated: false, userInfo: null, checked: false, method: 'error' };
    }
  }

  /**
   * НОВЫЙ МЕТОД: Безопасная навигация с автоматическим retry
   * Обрабатывает ошибки "Navigation interrupted", "net::ERR_ABORTED", timeout
   */
  private async safeNavigate(
    page: Page,
    url: string,
    options: {
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<{ success: boolean; error?: string; url?: string }> {
    if (!page || page.isClosed()) {
      return { success: false, error: 'Page is closed' };
    }

    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 30000;
    const maxRetries = options.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`🌐 Navigation attempt ${attempt}/${maxRetries}`, { url });
        
        await page.goto(url, { waitUntil, timeout });
        
        const finalUrl = page.url();
        this.logger.info('✅ Navigation successful', { url, finalUrl });
        
        return { success: true, url: finalUrl };

      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        
        // Проверяем тип ошибки
        const isNavigationInterrupted = errorMessage.includes('Navigation interrupted') ||
                                        errorMessage.includes('net::ERR_ABORTED') ||
                                        errorMessage.includes('Navigation timeout');
        
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout');
        const isNetworkError = errorMessage.includes('net::') || errorMessage.includes('Network');

        this.logger.warn(`⚠️ Navigation attempt ${attempt} failed`, {
          url,
          error: errorMessage,
          isNavigationInterrupted,
          isTimeout,
          isNetworkError
        });

        // Если это последняя попытка - возвращаем ошибку
        if (attempt === maxRetries) {
          return { success: false, error: errorMessage };
        }

        // Retry с задержкой
        const delay = attempt * 1000; // 1s, 2s, 3s
        this.logger.info(`⏳ Retrying navigation in ${delay}ms`, { attempt, maxRetries });
        await this.delay(delay);
      }
    }

    return { success: false, error: 'Max navigation retries exceeded' };
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
    
    if (this.context) {
      await this.context.close().catch(err => {
        this.logger.warn('Failed to close browser context', { error: err });
      });
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close().catch(err => {
        this.logger.warn('Failed to close browser', { error: err });
      });
      this.browser = null;
    }
    
    this.logger.info('🛑 Auto Booking Service stopped');
  }

}

// Export singleton instance for convenience
export const autoBookingService = new AutoBookingService();
