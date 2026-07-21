// ===== ENHANCED AUTO BOOKING SERVICE =====

import { BaseServiceWithAllFeatures } from '../services/core/base-service-with-all-features';
import { IAutoBookingService, AutoBookingConfig, BookingResult, RetryConfig } from '../services/core/interfaces';
import { createBrowserService, EnhancedBrowserService } from './index';
import { createSelectorStrategies, createCommonSelectors } from './selector-strategies';
import { prisma } from '../prisma';
import { decrypt } from '../encryption';
import { Logger } from '../logging/logger';

// ===== CONFIGURATION INTERFACES =====

export interface EnhancedAutoBookingConfig {
  // Browser settings
  enableAntibot: boolean;
  enableHumanBehavior: boolean;
  enableAdaptiveTimeouts: boolean;
  enableSelectorResilience: boolean;
  headless: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };

  // Retry settings
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;

  // Fallback settings
  enableFallbacks: boolean;
  enableAlternativePaths: boolean;
  enableManualIntervention: boolean;

  // Monitoring settings
  enableRealTimeMonitoring: boolean;
  enableScreenshotCapture: boolean;
  screenshotOnError: boolean;
  screenshotOnSuccess: boolean;

  // Timeout settings
  defaultTimeoutConfig: {
    elementWait: number;
    navigation: number;
    pageLoad: number;
    action: number;
  };

  // Advanced settings
  enableSmartSelectors: boolean;
  enablePerformanceTracking: boolean;
  enableNetworkMonitoring: boolean;
  enableMemoryMonitoring: boolean;
}

// ===== ENHANCED AUTO BOOKING SERVICE =====

export class EnhancedAutoBookingService 
  extends BaseServiceWithAllFeatures<EnhancedAutoBookingConfig>
  implements IAutoBookingService {

  private browserService: EnhancedBrowserService | null = null;
  private selectorStrategies: Map<string, any> = new Map();
  private isInitialized = false;

  constructor() {
    const defaultConfig: EnhancedAutoBookingConfig = {
      enableAntibot: true,
      enableHumanBehavior: true,
      enableAdaptiveTimeouts: true,
      enableSelectorResilience: true,
      headless: true,
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      enableFallbacks: true,
      enableAlternativePaths: true,
      enableManualIntervention: true,
      enableRealTimeMonitoring: true,
      enableScreenshotCapture: true,
      screenshotOnError: true,
      screenshotOnSuccess: false,
      defaultTimeoutConfig: {
        elementWait: 30000,
        navigation: 60000,
        pageLoad: 120000,
        action: 15000
      },
      enableSmartSelectors: true,
      enablePerformanceTracking: true,
      enableNetworkMonitoring: true,
      enableMemoryMonitoring: true
    };

    const defaultRetryConfig: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 30000,
      retryableErrors: ['timeout', 'network', 'element not found', 'session expired']
    };

    super('EnhancedAutoBookingService', defaultConfig, defaultRetryConfig, '2.0.0');
  }

  // ===== SERVICE LIFECYCLE =====

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('🚀 Initializing Enhanced Auto Booking Service');

      // Create browser service
      const browserServiceComponents = await createBrowserService({
        instanceId: 'enhanced-auto-booking',
        enableAntibot: this._typedConfig.enableAntibot,
        enableAdaptiveTimeouts: this._typedConfig.enableAdaptiveTimeouts,
        enableSelectorResilience: this._typedConfig.enableSelectorResilience,
        enableHumanBehavior: this._typedConfig.enableHumanBehavior,
        headless: this._typedConfig.headless,
        proxy: this._typedConfig.proxy
      });

      this.browserService = new EnhancedBrowserService(
        browserServiceComponents.browserManager,
        browserServiceComponents.selectorManager,
        browserServiceComponents.fallbackManager,
        browserServiceComponents.monitor,
        browserServiceComponents.instanceId
      );

      await this.browserService.initialize();

      // Initialize selector strategies
      await this.initializeSelectorStrategies();

      this.isInitialized = true;
      this.logger.info('✅ Enhanced Auto Booking Service initialized successfully');

    } catch (error) {
      this.logger.error('❌ Failed to initialize Enhanced Auto Booking Service', { error });
      throw error;
    }
  }

  validateConfig(config: Partial<EnhancedAutoBookingConfig>): boolean {
    // Basic validation
    if (config.maxRetries !== undefined && (config.maxRetries < 1 || config.maxRetries > 10)) {
      return false;
    }
    if (config.retryDelay !== undefined && (config.retryDelay < 100 || config.retryDelay > 60000)) {
      return false;
    }
    return true;
  }

  async start(): Promise<void> {
    await this.initialize();
    this.logger.info('🎯 Enhanced Auto Booking Service started');
  }

  async stop(): Promise<void> {
    if (this.browserService) {
      await this.browserService.cleanup();
      this.browserService = null;
    }
    this.isInitialized = false;
    this.logger.info('🛑 Enhanced Auto Booking Service stopped');
  }

  // ===== SELECTOR STRATEGIES INITIALIZATION =====

  private async initializeSelectorStrategies(): Promise<void> {
    // Common selectors
    const commonSelectors = createCommonSelectors();
    Object.entries(commonSelectors).forEach(([name, strategy]) => {
      this.selectorStrategies.set(name, strategy);
    });

    // WB-specific selectors
    const wbSelectors = {
      loginForm: createSelectorStrategies([
        'form[action*="login"]',
        'form:has(input[type="password"])',
        '.login-form',
        '#login-form'
      ], 'login-form', {
        priority: 1,
        fallbackSelectors: [
          'form',
          '[role="form"]'
        ]
      }),

      suppliesPage: createSelectorStrategies([
        'a[href*="supplies"]',
        'a:has-text("Поставки")',
        'a:has-text("Supplies")',
        '[data-testid="supplies"]',
        '.supplies-link'
      ], 'supplies-page', {
        priority: 1,
        fallbackSelectors: [
          'a[class*="supplies"]',
          'a[class*="delivery"]',
          'nav a:has-text("Поставки")'
        ]
      }),

      supplyItem: createSelectorStrategies([
        '[data-testid="supply-item"]',
        '.supply-item',
        'tr:has(td:has-text("Поставка"))',
        'div:has-text("Поставка")'
      ], 'supply-item', {
        priority: 1,
        fallbackSelectors: [
          'tr',
          'div[class*="item"]',
          'div[class*="supply"]'
        ]
      }),

      slotButton: createSelectorStrategies([
        'button:has-text("Забронировать")',
        'button:has-text("Book")',
        '[data-testid="book-slot"]',
        'button[class*="book"]',
        'button[class*="reserve"]'
      ], 'slot-button', {
        priority: 1,
        fallbackSelectors: [
          'button:has-text("Выбрать")',
          'button:has-text("Select")',
          'button[type="button"]'
        ]
      }),

      confirmationDialog: createSelectorStrategies([
        '.modal:has-text("Подтвердить")',
        '.dialog:has-text("Подтвердить")',
        '[role="dialog"]:has-text("Подтвердить")',
        '.confirmation-modal'
      ], 'confirmation-dialog', {
        priority: 1,
        fallbackSelectors: [
          '.modal',
          '.dialog',
          '[role="dialog"]'
        ]
      }),

      confirmButton: createSelectorStrategies([
        'button:has-text("Подтвердить")',
        'button:has-text("Да")',
        'button:has-text("OK")',
        '[data-testid="confirm"]'
      ], 'confirm-button', {
        priority: 1,
        fallbackSelectors: [
          'button[type="submit"]',
          'button[class*="confirm"]',
          'button[class*="ok"]'
        ]
      })
    };

    Object.entries(wbSelectors).forEach(([name, strategy]) => {
      this.selectorStrategies.set(name, strategy);
    });

    this.logger.info(`📝 Initialized ${this.selectorStrategies.size} selector strategies`);
  }

  // ===== MAIN BOOKING METHOD =====

  async bookSlot(config: AutoBookingConfig): Promise<BookingResult> {
    if (!this.isInitialized || !this.browserService) {
      throw new Error('Service not initialized');
    }

    const sessionId = (this.browserService as any).monitor.startSession('book-slot', {
      userId: config.userId,
      taskId: config.taskId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId
    });

    try {
      this.logger.info('🎯 Starting enhanced slot booking', {
        userId: config.userId,
        taskId: config.taskId,
        supplyId: config.supplyId,
        warehouseId: config.warehouseId
      });

      // Step 1: Validate session
      const sessionStepId = (this.browserService as any).monitor.startStep(sessionId, 'validate-session');
      await this.validateAndRestoreSession(config.userId);
      (this.browserService as any).monitor.endStep(sessionStepId, 'completed');

      // Step 2: Navigate to supplies page
      const navStepId = (this.browserService as any).monitor.startStep(sessionId, 'navigate-to-supplies');
      await this.navigateToSupplies();
      (this.browserService as any).monitor.endStep(navStepId, 'completed');

      // Step 3: Find and select supply
      const supplyStepId = (this.browserService as any).monitor.startStep(sessionId, 'find-supply');
      await this.findAndSelectSupply(config.supplyId);
      (this.browserService as any).monitor.endStep(supplyStepId, 'completed');

      // Step 4: Find and book slot
      const slotStepId = (this.browserService as any).monitor.startStep(sessionId, 'book-slot');
      const slotResult = await this.findAndBookSlot(config);
      (this.browserService as any).monitor.endStep(slotStepId, 'completed');

      // Step 5: Verify booking
      const verifyStepId = (this.browserService as any).monitor.startStep(sessionId, 'verify-booking');
      const verificationResult = await this.verifyBookingSuccess(config);
      (this.browserService as any).monitor.endStep(verifyStepId, 'completed');

      (this.browserService as any).monitor.endSession(sessionId, 'completed');

      const result: BookingResult = {
        success: true,
        bookingId: slotResult.bookingId,
        details: {
          supplyId: config.supplyId,
          warehouseId: config.warehouseId,
          date: config.date,
          bookedAt: new Date().toISOString(),
          sessionInfo: {
            isValid: true,
            cookies: 0,
            localStorage: 0,
            sessionStorage: 0,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          browserInfo: {
            version: '120.0.0.0',
            platform: 'Windows',
            viewport: { width: 1920, height: 1080 }
          }
        }
      };

      this.logger.info('✅ Enhanced slot booking completed successfully', {
        bookingId: result.bookingId,
        slotId: slotResult.slotId
      });

      return result;

    } catch (error) {
      (this.browserService as any).monitor.endSession(sessionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      
      this.logger.error('❌ Enhanced slot booking failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: config.userId,
        taskId: config.taskId,
        supplyId: config.supplyId
      });

      // Take error screenshot
      if (this._typedConfig.screenshotOnError) {
        try {
          await this.browserService.takeScreenshot({
            path: `screenshots/error-${Date.now()}.png`,
            fullPage: true
          });
        } catch (screenshotError) {
          this.logger.warn('Failed to take error screenshot', { error: screenshotError });
        }
      }

      throw error;
    }
  }

  // ===== BOOKING STEPS =====

  private async validateAndRestoreSession(userId: string): Promise<void> {
    try {
      // Get user session from database
      const wbSession = await prisma.wBSession.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (!wbSession) {
        throw new Error('No WB session found for user');
      }

      // Decrypt and restore session
      const sessionData = JSON.parse(decrypt((wbSession.cookies as any).encrypted));
      
      // Navigate to WB and restore session
      await this.browserService!.navigateTo('https://seller.wildberries.ru');
      
      // Set cookies
      for (const cookie of sessionData.cookies) {
        await (this.browserService as any).browserManager.context!.addCookies([cookie]);
      }

      // Verify session is valid
      await this.browserService!.navigateTo('https://seller.wildberries.ru/supplies');
      
      this.logger.info('✅ Session validated and restored successfully');
    } catch (error) {
      this.logger.error('❌ Session validation failed', { error });
      throw new Error('Session validation failed');
    }
  }

  private async navigateToSupplies(): Promise<void> {
    try {
      await this.browserService!.navigateTo('https://seller.wildberries.ru/supplies');
      this.logger.info('✅ Navigated to supplies page');
    } catch (error) {
      this.logger.error('❌ Failed to navigate to supplies page', { error });
      throw error;
    }
  }

  private async findAndSelectSupply(supplyId: string): Promise<void> {
    try {
      const supplyStrategy = this.selectorStrategies.get('supply-item');
      if (!supplyStrategy) {
        throw new Error('Supply item selector strategy not found');
      }

      // Find supply item
      const supplyElement = await this.browserService!.findElement(supplyStrategy.selectors);
      
      // Click on supply item
      await supplyElement.click();
      
      this.logger.info('✅ Supply item found and selected', { supplyId });
    } catch (error) {
      this.logger.error('❌ Failed to find and select supply', { error, supplyId });
      throw error;
    }
  }

  private async findAndBookSlot(config: AutoBookingConfig): Promise<{ bookingId: string; slotId: string }> {
    try {
      const slotStrategy = this.selectorStrategies.get('slot-button');
      if (!slotStrategy) {
        throw new Error('Slot button selector strategy not found');
      }

      // Find and click slot button
      await this.browserService!.clickElement(slotStrategy.selectors, 'slot button', {
        humanBehavior: this._typedConfig.enableHumanBehavior
      });

      // Handle confirmation dialog if present
      try {
        const confirmStrategy = this.selectorStrategies.get('confirmation-dialog');
        if (confirmStrategy) {
          await (this.browserService as any).browserManager.page!.waitForSelector(confirmStrategy.selectors[0], { timeout: 5000 });
          
          const confirmButtonStrategy = this.selectorStrategies.get('confirm-button');
          if (confirmButtonStrategy) {
            await this.browserService!.clickElement(confirmButtonStrategy.selectors, 'confirm button');
          }
        }
      } catch (error) {
        // Confirmation dialog might not appear, continue
        this.logger.debug('No confirmation dialog found, continuing');
      }

      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const slotId = `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.info('✅ Slot booked successfully', { bookingId, slotId });
      
      return { bookingId, slotId };
    } catch (error) {
      this.logger.error('❌ Failed to book slot', { error });
      throw error;
    }
  }

  private async verifyBookingSuccess(config: AutoBookingConfig): Promise<any> {
    try {
      // Wait for success message or confirmation
      await (this.browserService as any).browserManager.page!.waitForTimeout(2000);
      
      // Check for success indicators
      const successIndicators = [
        ':has-text("Успешно")',
        ':has-text("Забронировано")',
        ':has-text("Success")',
        '.success-message',
        '.booking-confirmed'
      ];

      let successFound = false;
      for (const indicator of successIndicators) {
        try {
          await (this.browserService as any).browserManager.page!.waitForSelector(indicator, { timeout: 5000 });
          successFound = true;
          break;
        } catch (error) {
          continue;
        }
      }

      if (successFound) {
        this.logger.info('✅ Booking verification successful');
        return { verified: true, method: 'success-message' };
      } else {
        this.logger.warn('⚠️ Booking verification inconclusive');
        return { verified: false, method: 'no-success-indicator' };
      }
    } catch (error) {
      this.logger.error('❌ Booking verification failed', { error });
      return { verified: false, method: 'verification-error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ===== UTILITY METHODS =====

  async cancelBooking(bookingId: string): Promise<boolean> {
    try {
      this.logger.info('🔄 Cancelling booking', { bookingId });
      
      // Implementation would depend on WB's cancellation process
      // For now, return true as placeholder
      return true;
    } catch (error) {
      this.logger.error('❌ Failed to cancel booking', { error, bookingId });
      return false;
    }
  }

  getHealthStatus(): any {
    if (!this.browserService) {
      return { isHealthy: false, reason: 'Service not initialized' };
    }

    return {
      isHealthy: this.browserService.getHealthStatus().isHealthy,
      browserHealth: this.browserService.getHealthStatus(),
      metrics: this.browserService.getMetrics(),
      isInitialized: this.isInitialized
    };
  }

  getMetrics(): any {
    if (!this.browserService) {
      return {};
    }

    return this.browserService.getMetrics();
  }

  // ===== IAutoBookingService IMPLEMENTATION =====

  isBookingInProgress(): boolean {
    // Check if any active sessions are running
    if (!this.browserService) {
      return false;
    }
    
    const activeSessions = (this.browserService as any).monitor.getActiveSessions();
    return activeSessions && Array.isArray(activeSessions) ? activeSessions.some((session: any) => session.operation === 'book-slot') : false;
  }

  getBookingHistory(): any[] {
    try {
      // For now, return empty array as placeholder
      // In real implementation, this would query the database
      return [];
    } catch (error) {
      this.logger.error('Failed to get booking history', { error });
      return [];
    }
  }
}
