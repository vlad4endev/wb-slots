// ===== BOOKING SERVICE FACTORY - DIP: Инверсия зависимостей =====

import { ILogger } from '../../core/interfaces';
import { RefactoredAutoBookingService } from '../refactored-auto-booking-service';
import { BrowserManager, IBrowserManager } from '../browser/browser-manager';
import { SessionManager, ISessionManager } from '../session/session-manager';
import { NavigationService, INavigationService } from '../navigation/navigation-service';
import { BookingService, IBookingService } from '../booking/booking-service';
import { NotificationService, INotificationService, NotificationConfig } from '../notification/notification-service';
import { AnalyticsService, IAnalyticsService } from '../analytics/analytics-service';
import { ErrorHandler, IErrorHandler } from '../error/error-handler';

export interface BookingServiceFactoryConfig {
  logger: ILogger;
  notificationConfig?: NotificationConfig;
}

export interface IBookingServiceFactory {
  createAutoBookingService(): RefactoredAutoBookingService;
  createBrowserManager(): IBrowserManager;
  createSessionManager(): ISessionManager;
  createNavigationService(): INavigationService;
  createBookingService(): IBookingService;
  createNotificationService(): INotificationService;
  createAnalyticsService(): IAnalyticsService;
  createErrorHandler(): IErrorHandler;
}

export class BookingServiceFactory implements IBookingServiceFactory {
  constructor(private config: BookingServiceFactoryConfig) {}

  createAutoBookingService(): RefactoredAutoBookingService {
    const browserManager = this.createBrowserManager();
    const sessionManager = this.createSessionManager();
    const navigationService = this.createNavigationService();
    const bookingService = this.createBookingService();
    const notificationService = this.createNotificationService();
    const analyticsService = this.createAnalyticsService();
    const errorHandler = this.createErrorHandler();

    return new RefactoredAutoBookingService(
      this.config.logger,
      browserManager,
      sessionManager,
      navigationService,
      bookingService,
      notificationService,
      analyticsService,
      errorHandler
    );
  }

  createBrowserManager(): IBrowserManager {
    return new BrowserManager(this.config.logger);
  }

  createSessionManager(): ISessionManager {
    return new SessionManager(this.config.logger);
  }

  createNavigationService(): INavigationService {
    return new NavigationService(this.config.logger);
  }

  createBookingService(): IBookingService {
    return new BookingService(this.config.logger);
  }

  createNotificationService(): INotificationService {
    return new NotificationService(
      this.config.logger,
      this.config.notificationConfig || this.getDefaultNotificationConfig()
    );
  }

  createAnalyticsService(): IAnalyticsService {
    return new AnalyticsService(this.config.logger);
  }

  createErrorHandler(): IErrorHandler {
    return new ErrorHandler(this.config.logger);
  }

  private getDefaultNotificationConfig(): NotificationConfig {
    return {
      telegram: {
        enabled: false,
        botToken: '',
        chatId: ''
      },
      email: {
        enabled: false,
        smtp: {
          host: '',
          port: 587,
          secure: false,
          auth: {
            user: '',
            pass: ''
          }
        },
        from: '',
        to: []
      },
      webhook: {
        enabled: false,
        url: '',
        headers: {}
      }
    };
  }
}

// Singleton factory instance
let factoryInstance: BookingServiceFactory | null = null;

export function createBookingServiceFactory(config: BookingServiceFactoryConfig): IBookingServiceFactory {
  if (!factoryInstance) {
    factoryInstance = new BookingServiceFactory(config);
  }
  return factoryInstance;
}

export function getBookingServiceFactory(): IBookingServiceFactory {
  if (!factoryInstance) {
    throw new Error('BookingServiceFactory not initialized. Call createBookingServiceFactory first.');
  }
  return factoryInstance;
}
