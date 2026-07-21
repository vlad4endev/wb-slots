// ===== USAGE EXAMPLE - SOLID COMPLIANT AUTO BOOKING =====

import { Logger } from '../../logging/logger';
import { createBookingServiceFactory, IBookingServiceFactory } from '../factory/booking-service-factory';
import { RefactoredAutoBookingConfig, NotificationConfig } from '../interfaces/segregated-interfaces';

// ===== EXAMPLE USAGE =====

export class AutoBookingExample {
  private factory: IBookingServiceFactory;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('AutoBookingExample');
    this.initializeFactory();
  }

  private initializeFactory(): void {
    const notificationConfig: NotificationConfig = {
      telegram: {
        enabled: true,
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || ''
      },
      webhook: {
        enabled: true,
        url: process.env.WEBHOOK_URL || '',
        headers: {
          'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN || ''}`
        }
      }
    };

    this.factory = createBookingServiceFactory({
      logger: this.logger,
      notificationConfig
    });
  }

  async performBooking(): Promise<void> {
    const config: RefactoredAutoBookingConfig = {
      userId: 'user123',
      taskId: 'task456',
      supplyId: 'supply789',
      warehouseId: 123,
      date: '2024-01-15',
      boxTypeId: 2,
      baseUrl: 'https://seller.wildberries.ru',
      retryConfig: {
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
      },
      browserConfig: {
        headless: false, // For debugging
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timeout: 60000
      },
      navigationConfig: {
        baseUrl: 'https://seller.wildberries.ru',
        timeout: 60000,
        retryAttempts: 3
      }
    };

    try {
      const autoBookingService = this.factory.createAutoBookingService();
      
      this.logger.info('Starting booking process...');
      const result = await autoBookingService.performBooking(config);
      
      if (result.success) {
        this.logger.info('Booking completed successfully!', {
          bookingId: result.bookingId,
          executionTime: result.executionTime,
          steps: result.steps.length
        });
      } else {
        this.logger.error('Booking failed:', {
          error: result.error,
          executionTime: result.executionTime,
          steps: result.steps
        });
      }

    } catch (error) {
      this.logger.error('Unexpected error during booking:', error);
    }
  }

  async getBookingHistory(): Promise<void> {
    try {
      const autoBookingService = this.factory.createAutoBookingService();
      const history = await autoBookingService.getBookingHistory('user123', 10);
      
      this.logger.info('Booking history:', {
        total: history.length,
        successful: history.filter(h => h.success).length,
        failed: history.filter(h => !h.success).length
      });

    } catch (error) {
      this.logger.error('Error getting booking history:', error);
    }
  }

  async getBookingStats(): Promise<void> {
    try {
      const autoBookingService = this.factory.createAutoBookingService();
      const stats = await autoBookingService.getBookingStats('user123');
      
      this.logger.info('Booking statistics:', {
        total: stats.total,
        successRate: `${stats.successRate.toFixed(2)}%`,
        averageExecutionTime: `${stats.averageExecutionTime.toFixed(2)}ms`,
        mostCommonErrors: stats.mostCommonErrors.slice(0, 3)
      });

    } catch (error) {
      this.logger.error('Error getting booking stats:', error);
    }
  }

  async getSuccessRate(): Promise<void> {
    try {
      const autoBookingService = this.factory.createAutoBookingService();
      const successRate = await autoBookingService.getSuccessRate('user123', 30);
      
      this.logger.info('Success rate for last 30 days:', {
        successRate: `${successRate.toFixed(2)}%`
      });

    } catch (error) {
      this.logger.error('Error getting success rate:', error);
    }
  }
}

// ===== INDIVIDUAL SERVICE USAGE EXAMPLES =====

export class IndividualServiceExamples {
  private factory: IBookingServiceFactory;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('IndividualServiceExamples');
    this.factory = createBookingServiceFactory({
      logger: this.logger
    });
  }

  async browserManagerExample(): Promise<void> {
    const browserManager = this.factory.createBrowserManager();
    
    try {
      const { browser, context } = await browserManager.initialize({
        headless: true,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timeout: 60000
      });

      const page = await browserManager.createPage(context);
      await page.goto('https://example.com');
      
      this.logger.info('Browser example completed successfully');
      
      await browserManager.cleanup(browser);
    } catch (error) {
      this.logger.error('Browser example failed:', error);
    }
  }

  async sessionManagerExample(): Promise<void> {
    const sessionManager = this.factory.createSessionManager();
    
    try {
      const sessionInfo = await sessionManager.validateSession('user123');
      this.logger.info('Session validation result:', sessionInfo);
      
      if (!sessionInfo.isValid) {
        this.logger.warn('Session is invalid, user needs to login');
      }
    } catch (error) {
      this.logger.error('Session manager example failed:', error);
    }
  }

  async notificationServiceExample(): Promise<void> {
    const notificationService = this.factory.createNotificationService();
    
    try {
      await notificationService.sendSuccess({
        title: 'Test Success',
        message: 'This is a test success notification',
        type: 'success',
        data: { test: true }
      });

      await notificationService.sendError({
        title: 'Test Error',
        message: 'This is a test error notification',
        type: 'error',
        data: { test: true }
      });

      this.logger.info('Notification examples completed successfully');
    } catch (error) {
      this.logger.error('Notification example failed:', error);
    }
  }

  async analyticsServiceExample(): Promise<void> {
    const analyticsService = this.factory.createAnalyticsService();
    
    try {
      const stats = await analyticsService.getBookingStats('user123');
      this.logger.info('Analytics stats:', stats);
      
      const history = await analyticsService.getBookingHistory('user123', 5);
      this.logger.info('Recent bookings:', history.length);
      
      const successRate = await analyticsService.getSuccessRate('user123', 7);
      this.logger.info('Weekly success rate:', `${successRate.toFixed(2)}%`);
      
    } catch (error) {
      this.logger.error('Analytics example failed:', error);
    }
  }
}

// ===== MAIN EXECUTION =====

async function main() {
  const example = new AutoBookingExample();
  
  // Run examples
  await example.performBooking();
  await example.getBookingHistory();
  await example.getBookingStats();
  await example.getSuccessRate();
  
  // Individual service examples
  const individualExamples = new IndividualServiceExamples();
  await individualExamples.browserManagerExample();
  await individualExamples.sessionManagerExample();
  await individualExamples.notificationServiceExample();
  await individualExamples.analyticsServiceExample();
}

// Export for use in other modules
export { main as runSolidExamples };
