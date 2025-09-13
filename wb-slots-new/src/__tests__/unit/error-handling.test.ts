// ===== UNIT TESTS FOR ERROR HANDLING =====

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AppError,
  ValidationError,
  BusinessRuleError,
  NotFoundError,
  ConflictError,
  AuthenticationError,
  AuthorizationError,
  ExternalServiceError,
  RateLimitError,
  NetworkError,
  DatabaseError,
  EncryptionError,
  TaskError,
  SlotSearchError,
  BookingError,
  ErrorFactory,
  ErrorHandler,
  ErrorLogger,
  ErrorResponseBuilder,
  ValidationHelper,
} from '../../lib/errors/error-handling';

// ===== TEST SUITE =====
describe('Error Handling System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Classes', () => {
    describe('AppError', () => {
      it('should create error with message and context', () => {
        const error = new AppError('Test error', { field: 'test' });
        
        expect(error.message).toBe('Test error');
        expect(error.context).toEqual({ field: 'test' });
        expect(error.name).toBe('AppError');
      });

      it('should include original error', () => {
        const originalError = new Error('Original error');
        const error = new AppError('Test error', undefined, originalError);
        
        expect(error.originalError).toBe(originalError);
      });

      it('should serialize to JSON correctly', () => {
        const error = new AppError('Test error', { field: 'test' });
        const json = error.toJSON();
        
        expect(json).toEqual({
          name: 'AppError',
          message: 'Test error',
          context: { field: 'test' },
          stack: expect.any(String),
        });
      });
    });

    describe('ValidationError', () => {
      it('should create validation error with correct properties', () => {
        const error = new ValidationError('Invalid input', 'field', 'value');
        
        expect(error.message).toBe('Invalid input');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ field: 'field', value: 'value' });
      });
    });

    describe('BusinessRuleError', () => {
      it('should create business rule error with correct properties', () => {
        const error = new BusinessRuleError('Rule violated', 'RULE_1', { data: 'test' });
        
        expect(error.message).toBe('Rule violated');
        expect(error.code).toBe('BUSINESS_RULE_ERROR');
        expect(error.statusCode).toBe(422);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ rule: 'RULE_1', data: 'test' });
      });
    });

    describe('NotFoundError', () => {
      it('should create not found error with resource info', () => {
        const error = new NotFoundError('User', 'user-123');
        
        expect(error.message).toBe('User not found');
        expect(error.code).toBe('NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ resource: 'User', id: 'user-123' });
      });
    });

    describe('ConflictError', () => {
      it('should create conflict error with conflicting resource', () => {
        const error = new ConflictError('Resource already exists', 'user-123');
        
        expect(error.message).toBe('Resource already exists');
        expect(error.code).toBe('CONFLICT');
        expect(error.statusCode).toBe(409);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ conflictingResource: 'user-123' });
      });
    });

    describe('AuthenticationError', () => {
      it('should create authentication error with default message', () => {
        const error = new AuthenticationError();
        
        expect(error.message).toBe('Authentication required');
        expect(error.code).toBe('AUTHENTICATION_ERROR');
        expect(error.statusCode).toBe(401);
        expect(error.isOperational).toBe(true);
      });

      it('should create authentication error with custom message', () => {
        const error = new AuthenticationError('Invalid credentials');
        
        expect(error.message).toBe('Invalid credentials');
        expect(error.code).toBe('AUTHENTICATION_ERROR');
        expect(error.statusCode).toBe(401);
        expect(error.isOperational).toBe(true);
      });
    });

    describe('AuthorizationError', () => {
      it('should create authorization error with default message', () => {
        const error = new AuthorizationError();
        
        expect(error.message).toBe('Insufficient permissions');
        expect(error.code).toBe('AUTHORIZATION_ERROR');
        expect(error.statusCode).toBe(403);
        expect(error.isOperational).toBe(true);
      });

      it('should create authorization error with custom message', () => {
        const error = new AuthorizationError('Admin access required');
        
        expect(error.message).toBe('Admin access required');
        expect(error.code).toBe('AUTHORIZATION_ERROR');
        expect(error.statusCode).toBe(403);
        expect(error.isOperational).toBe(true);
      });
    });

    describe('ExternalServiceError', () => {
      it('should create external service error with service info', () => {
        const error = new ExternalServiceError('WB API', 'Service unavailable', { status: 500 });
        
        expect(error.message).toBe('Service unavailable');
        expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
        expect(error.statusCode).toBe(502);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ service: 'WB API', response: { status: 500 } });
      });
    });

    describe('RateLimitError', () => {
      it('should create rate limit error with retry info', () => {
        const error = new RateLimitError('WB API', 60);
        
        expect(error.message).toBe('Rate limit exceeded');
        expect(error.code).toBe('RATE_LIMIT_ERROR');
        expect(error.statusCode).toBe(429);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ service: 'WB API', retryAfter: 60 });
      });
    });

    describe('NetworkError', () => {
      it('should create network error with service info', () => {
        const error = new NetworkError('WB API', 'Connection failed');
        
        expect(error.message).toBe('Connection failed');
        expect(error.code).toBe('NETWORK_ERROR');
        expect(error.statusCode).toBe(503);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ service: 'WB API' });
      });
    });

    describe('DatabaseError', () => {
      it('should create database error with operation info', () => {
        const originalError = new Error('Connection failed');
        const error = new DatabaseError('SELECT', 'Query failed', originalError);
        
        expect(error.message).toBe('Query failed');
        expect(error.code).toBe('DATABASE_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(false);
        expect(error.context).toEqual({ operation: 'SELECT' });
        expect(error.originalError).toBe(originalError);
      });
    });

    describe('EncryptionError', () => {
      it('should create encryption error with operation info', () => {
        const originalError = new Error('Key invalid');
        const error = new EncryptionError('ENCRYPT', 'Encryption failed', originalError);
        
        expect(error.message).toBe('Encryption failed');
        expect(error.code).toBe('ENCRYPTION_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(false);
        expect(error.context).toEqual({ operation: 'ENCRYPT' });
        expect(error.originalError).toBe(originalError);
      });
    });

    describe('TaskError', () => {
      it('should create task error with task info', () => {
        const error = new TaskError('Task failed', 'task-123', { step: 'validation' });
        
        expect(error.message).toBe('Task failed');
        expect(error.code).toBe('TASK_ERROR');
        expect(error.statusCode).toBe(422);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ taskId: 'task-123', step: 'validation' });
      });
    });

    describe('SlotSearchError', () => {
      it('should create slot search error with search info', () => {
        const error = new SlotSearchError('Search failed', 'search-123', { warehouseId: 1 });
        
        expect(error.message).toBe('Search failed');
        expect(error.code).toBe('SLOT_SEARCH_ERROR');
        expect(error.statusCode).toBe(422);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ searchId: 'search-123', warehouseId: 1 });
      });
    });

    describe('BookingError', () => {
      it('should create booking error with slot info', () => {
        const error = new BookingError('Booking failed', 'slot-123', { warehouseId: 1 });
        
        expect(error.message).toBe('Booking failed');
        expect(error.code).toBe('BOOKING_ERROR');
        expect(error.statusCode).toBe(422);
        expect(error.isOperational).toBe(true);
        expect(error.context).toEqual({ slotId: 'slot-123', warehouseId: 1 });
      });
    });
  });

  describe('ErrorFactory', () => {
    it('should create validation error', () => {
      const error = ErrorFactory.createValidationError('Invalid input', 'field', 'value');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.context).toEqual({ field: 'field', value: 'value' });
    });

    it('should create business rule error', () => {
      const error = ErrorFactory.createBusinessRuleError('Rule violated', 'RULE_1', { data: 'test' });
      
      expect(error).toBeInstanceOf(BusinessRuleError);
      expect(error.message).toBe('Rule violated');
      expect(error.context).toEqual({ rule: 'RULE_1', data: 'test' });
    });

    it('should create not found error', () => {
      const error = ErrorFactory.createNotFoundError('User', 'user-123');
      
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('User not found');
      expect(error.context).toEqual({ resource: 'User', id: 'user-123' });
    });

    it('should create conflict error', () => {
      const error = ErrorFactory.createConflictError('Resource exists', 'user-123');
      
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Resource exists');
      expect(error.context).toEqual({ conflictingResource: 'user-123' });
    });

    it('should create authentication error', () => {
      const error = ErrorFactory.createAuthenticationError('Invalid token');
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid token');
    });

    it('should create authorization error', () => {
      const error = ErrorFactory.createAuthorizationError('Admin required');
      
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Admin required');
    });

    it('should create external service error', () => {
      const error = ErrorFactory.createExternalServiceError('WB API', 'Service down', { status: 500 });
      
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.message).toBe('Service down');
      expect(error.context).toEqual({ service: 'WB API', response: { status: 500 } });
    });

    it('should create rate limit error', () => {
      const error = ErrorFactory.createRateLimitError('WB API', 60);
      
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.context).toEqual({ service: 'WB API', retryAfter: 60 });
    });

    it('should create network error', () => {
      const error = ErrorFactory.createNetworkError('WB API', 'Connection failed');
      
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe('Connection failed');
      expect(error.context).toEqual({ service: 'WB API' });
    });

    it('should create database error', () => {
      const originalError = new Error('Connection failed');
      const error = ErrorFactory.createDatabaseError('SELECT', 'Query failed', originalError);
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.message).toBe('Query failed');
      expect(error.context).toEqual({ operation: 'SELECT' });
      expect(error.originalError).toBe(originalError);
    });

    it('should create encryption error', () => {
      const originalError = new Error('Key invalid');
      const error = ErrorFactory.createEncryptionError('ENCRYPT', 'Encryption failed', originalError);
      
      expect(error).toBeInstanceOf(EncryptionError);
      expect(error.message).toBe('Encryption failed');
      expect(error.context).toEqual({ operation: 'ENCRYPT' });
      expect(error.originalError).toBe(originalError);
    });

    it('should create task error', () => {
      const error = ErrorFactory.createTaskError('Task failed', 'task-123', { step: 'validation' });
      
      expect(error).toBeInstanceOf(TaskError);
      expect(error.message).toBe('Task failed');
      expect(error.context).toEqual({ taskId: 'task-123', step: 'validation' });
    });

    it('should create slot search error', () => {
      const error = ErrorFactory.createSlotSearchError('Search failed', 'search-123', { warehouseId: 1 });
      
      expect(error).toBeInstanceOf(SlotSearchError);
      expect(error.message).toBe('Search failed');
      expect(error.context).toEqual({ searchId: 'search-123', warehouseId: 1 });
    });

    it('should create booking error', () => {
      const error = ErrorFactory.createBookingError('Booking failed', 'slot-123', { warehouseId: 1 });
      
      expect(error).toBeInstanceOf(BookingError);
      expect(error.message).toBe('Booking failed');
      expect(error.context).toEqual({ slotId: 'slot-123', warehouseId: 1 });
    });
  });

  describe('ErrorHandler', () => {
    it('should return AppError if already AppError', () => {
      const originalError = new ValidationError('Invalid input');
      const result = ErrorHandler.handle(originalError);
      
      expect(result).toBe(originalError);
    });

    it('should handle unique constraint errors', () => {
      const error = new Error('Unique constraint failed');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(ConflictError);
      expect(result.message).toBe('Resource already exists');
    });

    it('should handle foreign key constraint errors', () => {
      const error = new Error('Foreign key constraint failed');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Invalid reference to related resource');
    });

    it('should handle connection errors', () => {
      const error = new Error('Connection failed');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database connection failed');
    });

    it('should handle network errors', () => {
      const error = new Error('ECONNREFUSED');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Service unavailable');
    });

    it('should handle rate limiting errors', () => {
      const error = new Error('429 rate limit exceeded');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(RateLimitError);
      expect(result.message).toBe('Rate limit exceeded');
    });

    it('should handle authentication errors', () => {
      const error = new Error('401 Unauthorized');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should handle authorization errors', () => {
      const error = new Error('403 Forbidden');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(AuthorizationError);
      expect(result.message).toBe('Insufficient permissions');
    });

    it('should handle not found errors', () => {
      const error = new Error('404 Not Found');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe('Resource not found');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Unknown error');
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      const result = ErrorHandler.handle(error);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Unknown error occurred');
      expect(result.context).toEqual({ originalError: 'String error' });
    });
  });

  describe('ErrorLogger', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log operational errors as warnings', () => {
      const error = new ValidationError('Invalid input');
      
      ErrorLogger.log(error, { userId: 'user-123' });
      
      expect(consoleSpy).toHaveBeenCalledWith('Operational error:', {
        name: 'ValidationError',
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        isOperational: true,
        context: { field: undefined, value: undefined },
        stack: expect.any(String),
        userId: 'user-123',
        timestamp: expect.any(String),
      });
    });

    it('should log system errors as errors', () => {
      const error = new DatabaseError('SELECT', 'Query failed');
      
      ErrorLogger.log(error, { query: 'SELECT * FROM users' });
      
      expect(console.error).toHaveBeenCalledWith('System error:', {
        name: 'DatabaseError',
        message: 'Query failed',
        code: 'DATABASE_ERROR',
        statusCode: 500,
        isOperational: false,
        context: { operation: 'SELECT' },
        stack: expect.any(String),
        query: 'SELECT * FROM users',
        timestamp: expect.any(String),
      });
    });

    it('should log and throw error', () => {
      const error = new ValidationError('Invalid input');
      
      expect(() => ErrorLogger.logAndThrow(error, { userId: 'user-123' }))
        .toThrow(error);
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('ErrorResponseBuilder', () => {
    it('should build error response without stack', () => {
      const error = new ValidationError('Invalid input', 'field', 'value');
      const response = ErrorResponseBuilder.build(error);
      
      expect(response).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          statusCode: 400,
          context: { field: 'field', value: 'value' },
        },
      });
    });

    it('should build error response with stack', () => {
      const error = new ValidationError('Invalid input', 'field', 'value');
      const response = ErrorResponseBuilder.build(error, true);
      
      expect(response).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          statusCode: 400,
          context: { field: 'field', value: 'value' },
          stack: expect.any(String),
        },
      });
    });

    it('should build client error response', () => {
      const error = new ValidationError('Invalid input', 'field', 'value');
      const response = ErrorResponseBuilder.buildForClient(error);
      
      expect(response).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          context: { field: 'field', value: 'value' },
        },
      });
    });
  });

  describe('ValidationHelper', () => {
    it('should validate required fields', () => {
      expect(() => ValidationHelper.validateRequired('value', 'field')).not.toThrow();
      expect(() => ValidationHelper.validateRequired('', 'field')).toThrow(ValidationError);
      expect(() => ValidationHelper.validateRequired(null, 'field')).toThrow(ValidationError);
      expect(() => ValidationHelper.validateRequired(undefined, 'field')).toThrow(ValidationError);
    });

    it('should validate email format', () => {
      expect(() => ValidationHelper.validateEmail('test@example.com')).not.toThrow();
      expect(() => ValidationHelper.validateEmail('invalid-email')).toThrow(ValidationError);
      expect(() => ValidationHelper.validateEmail('')).toThrow(ValidationError);
    });

    it('should validate range', () => {
      expect(() => ValidationHelper.validateRange(5, 0, 10, 'field')).not.toThrow();
      expect(() => ValidationHelper.validateRange(-1, 0, 10, 'field')).toThrow(ValidationError);
      expect(() => ValidationHelper.validateRange(11, 0, 10, 'field')).toThrow(ValidationError);
    });

    it('should validate array not empty', () => {
      expect(() => ValidationHelper.validateArrayNotEmpty([1, 2, 3], 'field')).not.toThrow();
      expect(() => ValidationHelper.validateArrayNotEmpty([], 'field')).toThrow(ValidationError);
      expect(() => ValidationHelper.validateArrayNotEmpty('not-array', 'field')).toThrow(ValidationError);
    });
  });

  describe('Async Error Wrapper', () => {
    it('should wrap async function and handle errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const wrappedFn = require('../../lib/errors/error-handling').asyncErrorHandler(mockFn);
      
      await expect(wrappedFn('arg1', 'arg2')).rejects.toThrow(AppError);
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should pass through successful results', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = require('../../lib/errors/error-handling').asyncErrorHandler(mockFn);
      
      const result = await wrappedFn('arg1', 'arg2');
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});
