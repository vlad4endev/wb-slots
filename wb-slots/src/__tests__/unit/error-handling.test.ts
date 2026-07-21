// ===== UNIT TESTS FOR ERROR HANDLING =====

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError, 
  ConflictError, 
  DatabaseError, 
  NetworkError, 
  RateLimitError, 
  BookingError, 
  SessionError, 
  BrowserError, 
  ErrorFactory, 
  ErrorHandler, 
  ErrorLogger 
} from '../../lib/errors/error-handling';

// ===== MOCKS =====
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../lib/logging/logger', () => ({
  Logger: vi.fn(() => mockLogger),
}));

// Mock console methods
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ===== TEST SUITE =====
describe('Error Classes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('AppError', () => {
    it('should create error with message and context', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      
      expect(error.message).toBe('Invalid input');
      expect(error.context).toEqual({ field: 'email' });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'ValidationError',
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        isOperational: true,
        context: { field: 'email' },
        stack: expect.any(String),
      });
    });
  });

  describe('ValidationError', () => {
    it('should have correct properties', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should have correct properties', () => {
      const error = new AuthenticationError('Invalid credentials');
      
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('AuthorizationError', () => {
    it('should have correct properties', () => {
      const error = new AuthorizationError('Insufficient permissions');
      
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.statusCode).toBe(403);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('NotFoundError', () => {
    it('should have correct properties', () => {
      const error = new NotFoundError('Resource');
      
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('ConflictError', () => {
    it('should have correct properties', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error.statusCode).toBe(409);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('DatabaseError', () => {
    it('should have correct properties', () => {
      const error = new DatabaseError('CONNECTION', 'Database connection failed');
      
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.databaseOperation).toBe('CONNECTION');
    });
  });

  describe('NetworkError', () => {
    it('should have correct properties', () => {
      const error = new NetworkError('External Service', 'Service unavailable');
      
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.isOperational).toBe(true);
      expect(error.service).toBe('External Service');
    });
  });

  describe('RateLimitError', () => {
    it('should have correct properties', () => {
      const error = new RateLimitError('External Service');
      
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.isOperational).toBe(true);
      expect(error.service).toBe('External Service');
    });
  });

  describe('BookingError', () => {
    it('should have correct properties', () => {
      const error = new BookingError('Booking failed', 'BOOKING_FAILED', 'slot-123');
      
      expect(error.code).toBe('BOOKING_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.bookingCode).toBe('BOOKING_FAILED');
      expect(error.slotId).toBe('slot-123');
    });
  });

  describe('SessionError', () => {
    it('should have correct properties', () => {
      const error = new SessionError('Session expired');
      
      expect(error.code).toBe('SESSION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('BrowserError', () => {
    it('should have correct properties', () => {
      const error = new BrowserError('Browser launch failed');
      
      expect(error.code).toBe('BROWSER_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });
  });
});

describe('ErrorFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createValidationError', () => {
    it('should create ValidationError', () => {
      const error = ErrorFactory.createValidationError('Invalid input', { field: 'email' });
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.context).toEqual({ field: 'email' });
    });
  });

  describe('createAuthenticationError', () => {
    it('should create AuthenticationError', () => {
      const error = ErrorFactory.createAuthenticationError('Invalid credentials');
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid credentials');
    });
  });

  describe('createAuthorizationError', () => {
    it('should create AuthorizationError', () => {
      const error = ErrorFactory.createAuthorizationError('Insufficient permissions');
      
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('createNotFoundError', () => {
    it('should create NotFoundError', () => {
      const error = ErrorFactory.createNotFoundError('Resource');
      
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('createConflictError', () => {
    it('should create ConflictError', () => {
      const error = ErrorFactory.createConflictError('Resource already exists');
      
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Resource already exists');
    });
  });

  describe('createDatabaseError', () => {
    it('should create DatabaseError', () => {
      const error = ErrorFactory.createDatabaseError('CONNECTION', 'Database connection failed');
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.message).toBe('Database connection failed');
      expect(error.databaseOperation).toBe('CONNECTION');
    });
  });

  describe('createNetworkError', () => {
    it('should create NetworkError', () => {
      const error = ErrorFactory.createNetworkError('External Service', 'Service unavailable');
      
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe('Service unavailable');
      expect(error.service).toBe('External Service');
    });
  });

  describe('createRateLimitError', () => {
    it('should create RateLimitError', () => {
      const error = ErrorFactory.createRateLimitError('External Service');
      
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Rate limit exceeded for External Service');
      expect(error.service).toBe('External Service');
    });
  });

  describe('createBookingError', () => {
    it('should create BookingError', () => {
      const error = ErrorFactory.createBookingError('Booking failed', 'BOOKING_FAILED', 'slot-123');
      
      expect(error).toBeInstanceOf(BookingError);
      expect(error.message).toBe('Booking failed');
      expect(error.bookingCode).toBe('BOOKING_FAILED');
      expect(error.slotId).toBe('slot-123');
    });
  });
});

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('should return AppError as is', () => {
      const appError = new ValidationError('Invalid input');
      const result = ErrorHandler.handle(appError);
      
      expect(result).toBe(appError);
    });

    it('should handle database unique constraint errors', () => {
      const dbError = new Error('Unique constraint failed on field email');
      const result = ErrorHandler.handle(dbError);
      
      expect(result).toBeInstanceOf(ConflictError);
      expect(result.message).toBe('Resource already exists');
    });

    it('should handle database foreign key constraint errors', () => {
      const dbError = new Error('Foreign key constraint failed');
      const result = ErrorHandler.handle(dbError);
      
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Invalid reference to related resource');
    });

    it('should handle database connection errors', () => {
      const dbError = new Error('Connection to database failed');
      const result = ErrorHandler.handle(dbError);
      
      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database connection failed');
      expect(result.databaseOperation).toBe('CONNECTION');
    });

    it('should handle network connection errors', () => {
      const networkError = new Error('ECONNREFUSED: Connection refused');
      const result = ErrorHandler.handle(networkError);
      
      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Service unavailable');
      expect(result.service).toBe('External Service');
    });

    it('should handle network DNS errors', () => {
      const networkError = new Error('ENOTFOUND: getaddrinfo ENOTFOUND api.example.com');
      const result = ErrorHandler.handle(networkError);
      
      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Service unavailable');
      expect(result.service).toBe('External Service');
    });

    it('should handle rate limiting errors', () => {
      const rateLimitError = new Error('429 Too Many Requests');
      const result = ErrorHandler.handle(rateLimitError);
      
      expect(result).toBeInstanceOf(RateLimitError);
      expect(result.message).toBe('Rate limit exceeded for External Service');
      expect(result.service).toBe('External Service');
    });

    it('should handle authentication errors', () => {
      const authError = new Error('401 Unauthorized');
      const result = ErrorHandler.handle(authError);
      
      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should handle authorization errors', () => {
      const authError = new Error('403 Forbidden');
      const result = ErrorHandler.handle(authError);
      
      expect(result).toBeInstanceOf(AuthorizationError);
      expect(result.message).toBe('Insufficient permissions');
    });

    it('should handle not found errors', () => {
      const notFoundError = new Error('404 Not Found');
      const result = ErrorHandler.handle(notFoundError);
      
      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe('Resource not found');
    });

    it('should handle generic Error objects', () => {
      const genericError = new Error('Generic error');
      const result = ErrorHandler.handle(genericError);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Unknown error');
    });

    it('should handle non-Error objects', () => {
      const nonError = 'String error';
      const result = ErrorHandler.handle(nonError);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Unknown error occurred');
      expect(result.context).toEqual({ originalError: nonError });
    });
  });
});

describe('ErrorLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('should log error with context', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const context = { userId: 'user-123' };
      
      ErrorLogger.log(error, context);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Operational error:',
        expect.objectContaining({
          name: 'ValidationError',
          message: 'Invalid input',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          isOperational: true,
          context: { field: 'email' },
          additionalContext: { userId: 'user-123' },
        })
      );
    });

    it('should log error without context', () => {
      const error = new ValidationError('Invalid input');
      
      ErrorLogger.log(error);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Operational error:',
        expect.objectContaining({
          name: 'ValidationError',
          message: 'Invalid input',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          isOperational: true,
          context: undefined,
          additionalContext: undefined,
        })
      );
    });
  });
});

// ===== INTEGRATION TESTS =====
describe('Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

    it('should handle complete error flow', () => {
      // Arrange
      const originalError = new Error('Connection to database failed');
      const context = { operation: 'user_creation' };
      
      // Act
      const handledError = ErrorHandler.handle(originalError);
      ErrorLogger.log(handledError, context);
      
      // Assert
      expect(handledError).toBeInstanceOf(DatabaseError);
      expect(handledError.message).toBe('Database connection failed');
      expect(handledError.databaseOperation).toBe('CONNECTION');
      expect(console.warn).toHaveBeenCalledWith(
        'Operational error:',
        expect.objectContaining({
          name: 'DatabaseError',
          message: 'Database connection failed',
          code: 'DATABASE_ERROR',
          statusCode: 500,
          isOperational: true,
          additionalContext: { operation: 'user_creation' },
        })
      );
    });

  it('should handle error chain', () => {
    // Arrange
    const originalError = new Error('Network request failed');
    const wrappedError = new Error('ECONNREFUSED: Connection refused');
    wrappedError.cause = originalError;
    
    // Act
    const handledError = ErrorHandler.handle(wrappedError);
    
    // Assert
    expect(handledError).toBeInstanceOf(NetworkError);
    expect(handledError.message).toBe('Service unavailable');
    expect(handledError.service).toBe('External Service');
  });
});