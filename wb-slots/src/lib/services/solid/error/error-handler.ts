// ===== ERROR HANDLER - SRP: Обработка ошибок и retry логика =====

import { ILogger } from '../../core/interfaces';

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

export interface IErrorHandler {
  isRetryableError(error: Error): boolean;
  shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean;
  calculateDelay(attempt: number, config: RetryConfig): number;
  enhanceError(error: Error, context: ErrorContext): EnhancedBookingError;
  handleError(error: Error, context: ErrorContext): Promise<void>;
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

export class TimeoutError extends EnhancedBookingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TIMEOUT_ERROR', true, originalError);
  }
}

export class ErrorHandler implements IErrorHandler {
  private readonly retryableErrorCodes = [
    'SESSION_EXPIRED',
    'ELEMENT_NOT_FOUND',
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_EXCEEDED'
  ];

  constructor(private logger: ILogger) {}

  isRetryableError(error: Error): boolean {
    if (error instanceof EnhancedBookingError) {
      return error.isRetryable;
    }

    // Check for common retryable error patterns
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'rate limit',
      'too many requests',
      'service unavailable',
      'bad gateway',
      'gateway timeout'
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    return this.isRetryableError(error);
  }

  calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  enhanceError(error: Error, context: ErrorContext): EnhancedBookingError {
    if (error instanceof EnhancedBookingError) {
      return error;
    }

    const message = error.message;
    const code = this.determineErrorCode(error, context);
    const isRetryable = this.isRetryableError(error);

    return new EnhancedBookingError(
      message,
      code,
      isRetryable,
      error,
      {
        step: context.step,
        userId: context.userId,
        supplyId: context.supplyId,
        attempt: context.attempt,
        maxAttempts: context.maxAttempts
      }
    );
  }

  async handleError(error: Error, context: ErrorContext): Promise<void> {
    const enhancedError = this.enhanceError(error, context);
    
    this.logger.error(`Error in step: ${context.step}`, {
      error: enhancedError.message,
      code: enhancedError.code,
      isRetryable: enhancedError.isRetryable,
      attempt: context.attempt,
      maxAttempts: context.maxAttempts,
      userId: context.userId,
      supplyId: context.supplyId
    });

    // Log additional context for debugging
    if (enhancedError.context) {
      this.logger.debug('Error context:', enhancedError.context);
    }

    // If it's a critical error, log it as a critical issue
    if (!enhancedError.isRetryable) {
      this.logger.error('Critical booking error - not retryable:', {
        step: context.step,
        error: enhancedError.message,
        code: enhancedError.code
      });
    }
  }

  private determineErrorCode(error: Error, context: ErrorContext): string {
    const message = error.message.toLowerCase();

    // Session-related errors
    if (message.includes('session') || message.includes('login') || message.includes('auth')) {
      return 'SESSION_EXPIRED';
    }

    // Element not found errors
    if (message.includes('element') || message.includes('selector') || message.includes('not found')) {
      return 'ELEMENT_NOT_FOUND';
    }

    // Network errors
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT_ERROR';
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'RATE_LIMIT_EXCEEDED';
    }

    // Booking conflicts
    if (message.includes('conflict') || message.includes('already booked') || message.includes('unavailable')) {
      return 'BOOKING_CONFLICT';
    }

    // Default to unknown error
    return 'UNKNOWN_ERROR';
  }
}
