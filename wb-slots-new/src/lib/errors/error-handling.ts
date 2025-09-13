// ===== IMPROVED ERROR HANDLING SYSTEM =====

// ===== BASE ERROR CLASSES =====

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      stack: this.stack,
    };
  }
}

// ===== DOMAIN ERRORS =====

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string, field?: string, value?: any) {
    super(message, { field, value });
  }
}

export class BusinessRuleError extends AppError {
  readonly code = 'BUSINESS_RULE_ERROR';
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(message: string, rule?: string, context?: Record<string, any>) {
    super(message, { rule, ...context });
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  readonly isOperational = true;

  constructor(resource: string, id?: string) {
    super(`${resource} not found`, { resource, id });
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
  readonly isOperational = true;

  constructor(message: string, conflictingResource?: string) {
    super(message, { conflictingResource });
  }
}

// ===== AUTHENTICATION & AUTHORIZATION ERRORS =====

export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly statusCode = 401;
  readonly isOperational = true;

  constructor(message: string = 'Authentication required') {
    super(message);
  }
}

export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;
  readonly isOperational = true;

  constructor(message: string = 'Insufficient permissions') {
    super(message);
  }
}

// ===== EXTERNAL SERVICE ERRORS =====

export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly isOperational = true;

  constructor(
    service: string,
    message: string,
    public readonly response?: any
  ) {
    super(message, { service, response });
  }
}

export class RateLimitError extends ExternalServiceError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly statusCode = 429;

  constructor(service: string, retryAfter?: number) {
    super(service, 'Rate limit exceeded', { retryAfter });
  }
}

export class NetworkError extends ExternalServiceError {
  readonly code = 'NETWORK_ERROR';
  readonly statusCode = 503;

  constructor(service: string, message: string) {
    super(service, message);
  }
}

// ===== INFRASTRUCTURE ERRORS =====

export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(operation: string, message: string, originalError?: Error) {
    super(message, { operation }, originalError);
  }
}

export class EncryptionError extends AppError {
  readonly code = 'ENCRYPTION_ERROR';
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(operation: string, message: string, originalError?: Error) {
    super(message, { operation }, originalError);
  }
}

// ===== APPLICATION ERRORS =====

export class TaskError extends AppError {
  readonly code = 'TASK_ERROR';
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(message: string, taskId?: string, context?: Record<string, any>) {
    super(message, { taskId, ...context });
  }
}

export class SlotSearchError extends AppError {
  readonly code = 'SLOT_SEARCH_ERROR';
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(message: string, searchId?: string, context?: Record<string, any>) {
    super(message, { searchId, ...context });
  }
}

export class BookingError extends AppError {
  readonly code = 'BOOKING_ERROR';
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(message: string, slotId?: string, context?: Record<string, any>) {
    super(message, { slotId, ...context });
  }
}

// ===== ERROR FACTORY =====

export class ErrorFactory {
  static createValidationError(message: string, field?: string, value?: any): ValidationError {
    return new ValidationError(message, field, value);
  }

  static createBusinessRuleError(message: string, rule?: string, context?: Record<string, any>): BusinessRuleError {
    return new BusinessRuleError(message, rule, context);
  }

  static createNotFoundError(resource: string, id?: string): NotFoundError {
    return new NotFoundError(resource, id);
  }

  static createConflictError(message: string, conflictingResource?: string): ConflictError {
    return new ConflictError(message, conflictingResource);
  }

  static createAuthenticationError(message?: string): AuthenticationError {
    return new AuthenticationError(message);
  }

  static createAuthorizationError(message?: string): AuthorizationError {
    return new AuthorizationError(message);
  }

  static createExternalServiceError(service: string, message: string, response?: any): ExternalServiceError {
    return new ExternalServiceError(service, message, response);
  }

  static createRateLimitError(service: string, retryAfter?: number): RateLimitError {
    return new RateLimitError(service, retryAfter);
  }

  static createNetworkError(service: string, message: string): NetworkError {
    return new NetworkError(service, message);
  }

  static createDatabaseError(operation: string, message: string, originalError?: Error): DatabaseError {
    return new DatabaseError(operation, message, originalError);
  }

  static createEncryptionError(operation: string, message: string, originalError?: Error): EncryptionError {
    return new EncryptionError(operation, message, originalError);
  }

  static createTaskError(message: string, taskId?: string, context?: Record<string, any>): TaskError {
    return new TaskError(message, taskId, context);
  }

  static createSlotSearchError(message: string, searchId?: string, context?: Record<string, any>): SlotSearchError {
    return new SlotSearchError(message, searchId, context);
  }

  static createBookingError(message: string, slotId?: string, context?: Record<string, any>): BookingError {
    return new BookingError(message, slotId, context);
  }
}

// ===== ERROR HANDLER =====

export class ErrorHandler {
  static handle(error: unknown): AppError {
    // If it's already our custom error, return it
    if (error instanceof AppError) {
      return error;
    }

    // Handle known error types
    if (error instanceof Error) {
      // Database errors
      if (error.message.includes('Unique constraint')) {
        return ErrorFactory.createConflictError('Resource already exists');
      }

      if (error.message.includes('Foreign key constraint')) {
        return ErrorFactory.createValidationError('Invalid reference to related resource');
      }

      if (error.message.includes('Connection')) {
        return ErrorFactory.createDatabaseError('CONNECTION', 'Database connection failed', error);
      }

      // Network errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return ErrorFactory.createNetworkError('External Service', 'Service unavailable');
      }

      // Rate limiting
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        return ErrorFactory.createRateLimitError('External Service');
      }

      // Authentication
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return ErrorFactory.createAuthenticationError('Invalid credentials');
      }

      // Authorization
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return ErrorFactory.createAuthorizationError('Insufficient permissions');
      }

      // Not found
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return ErrorFactory.createNotFoundError('Resource');
      }

      // Generic error
      return new AppError('Unknown error', undefined, error) as AppError;
    }

    // Handle non-Error objects
    return new AppError('Unknown error occurred', { originalError: error }) as AppError;
  }
}

// ===== ERROR LOGGER =====

export class ErrorLogger {
  static log(error: AppError, context?: Record<string, any>): void {
    const logData = {
      ...error.toJSON(),
      context: { ...error.context, ...context },
      timestamp: new Date().toISOString(),
    };

    if (error.isOperational) {
      console.warn('Operational error:', logData);
    } else {
      console.error('System error:', logData);
    }
  }

  static logAndThrow(error: AppError, context?: Record<string, any>): never {
    this.log(error, context);
    throw error;
  }
}

// ===== ERROR RESPONSE BUILDER =====

export class ErrorResponseBuilder {
  static build(error: AppError, includeStack = false): {
    success: false;
    error: {
      code: string;
      message: string;
      statusCode: number;
      context?: Record<string, any>;
      stack?: string;
    };
  } {
    const response: any = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      },
    };

    if (error.context) {
      response.error.context = error.context;
    }

    if (includeStack && error.stack) {
      response.error.stack = error.stack;
    }

    return response;
  }

  static buildForClient(error: AppError): {
    success: false;
    error: {
      code: string;
      message: string;
      context?: Record<string, any>;
    };
  } {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        context: error.context,
      },
    };
  }
}

// ===== ASYNC ERROR WRAPPER =====

export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = ErrorHandler.handle(error);
      ErrorLogger.log(appError, { args });
      throw appError;
    }
  };
}

// ===== VALIDATION HELPERS =====

export class ValidationHelper {
  static validateRequired(value: any, fieldName: string): void {
    if (value === undefined || value === null || value === '') {
      throw ErrorFactory.createValidationError(`${fieldName} is required`, fieldName, value);
    }
  }

  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw ErrorFactory.createValidationError('Invalid email format', 'email', email);
    }
  }

  static validateRange(value: number, min: number, max: number, fieldName: string): void {
    if (value < min || value > max) {
      throw ErrorFactory.createValidationError(
        `${fieldName} must be between ${min} and ${max}`,
        fieldName,
        value
      );
    }
  }

  static validateArrayNotEmpty(array: any[], fieldName: string): void {
    if (!Array.isArray(array) || array.length === 0) {
      throw ErrorFactory.createValidationError(`${fieldName} must not be empty`, fieldName, array);
    }
  }
}

// ===== USAGE EXAMPLES =====

/*
// In your service methods:
export class SlotSearchService {
  async searchSlots(config: SlotSearchConfig): Promise<Slot[]> {
    try {
      // Validate input
      ValidationHelper.validateRequired(config.warehouseIds, 'warehouseIds');
      ValidationHelper.validateArrayNotEmpty(config.warehouseIds, 'warehouseIds');
      ValidationHelper.validateRange(config.coefficientMin, 0, 20, 'coefficientMin');
      ValidationHelper.validateRange(config.coefficientMax, 0, 20, 'coefficientMax');

      // Business logic
      if (config.coefficientMin > config.coefficientMax) {
        throw ErrorFactory.createBusinessRuleError(
          'Minimum coefficient cannot be greater than maximum coefficient',
          'COEFFICIENT_RANGE',
          { coefficientMin: config.coefficientMin, coefficientMax: config.coefficientMax }
        );
      }

      // External service call
      const slots = await this.wbClient.searchSlots(config);
      return slots;

    } catch (error) {
      const appError = ErrorHandler.handle(error);
      ErrorLogger.log(appError, { config });
      throw appError;
    }
  }
}

// In your API routes:
export async function POST(request: NextRequest) {
  try {
    const result = await slotSearchService.searchSlots(config);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorHandler.handle(error);
    ErrorLogger.log(appError);
    
    return NextResponse.json(
      ErrorResponseBuilder.buildForClient(appError),
      { status: appError.statusCode }
    );
  }
}
*/
