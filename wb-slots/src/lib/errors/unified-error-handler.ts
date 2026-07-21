// ===== UNIFIED ERROR HANDLING SYSTEM =====

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Logger } from '../logging/logger';

// ===== TYPES =====

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  body?: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    context?: ErrorContext;
    timestamp: string;
    requestId?: string;
  };
}

export interface ServiceErrorResult {
  success: false;
  error: string;
  code?: string;
  details?: any;
  context?: ErrorContext;
}

// ===== ERROR CODES =====

export enum ErrorCode {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Business Logic
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  
  // External Services
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // System
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Booking Specific
  BOOKING_FAILED = 'BOOKING_FAILED',
  SLOT_NOT_AVAILABLE = 'SLOT_NOT_AVAILABLE',
  SUPPLY_NOT_FOUND = 'SUPPLY_NOT_FOUND',
  BOOKING_CONFLICT = 'BOOKING_CONFLICT',
}

// ===== ERROR CLASSES =====

export class UnifiedError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public context?: ErrorContext,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'UnifiedError';
  }
}

// ===== ERROR DETECTION =====

export class ErrorDetector {
  static detectErrorType(error: unknown): { code: ErrorCode; statusCode: number; message: string } {
    // AuthError
    if (error instanceof Error && error.name === 'AuthError') {
      return {
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        statusCode: 401,
        message: 'Authentication required'
      };
    }

    // ZodError
    if (error instanceof z.ZodError) {
      return {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        message: 'Validation error',
      };
    }

    // Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          code: ErrorCode.RESOURCE_ALREADY_EXISTS,
          statusCode: 409,
          message: 'Resource already exists'
        };
      }

      if (error.message.includes('Foreign key constraint')) {
        return {
          code: ErrorCode.VALIDATION_ERROR,
          statusCode: 400,
          message: 'Invalid reference to related resource'
        };
      }

      if (error.message.includes('Record to update not found')) {
        return {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          statusCode: 404,
          message: 'Resource not found'
        };
      }

      // Network errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return {
          code: ErrorCode.NETWORK_ERROR,
          statusCode: 503,
          message: 'Service unavailable'
        };
      }

      // Rate limiting
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        return {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          statusCode: 429,
          message: 'Rate limit exceeded'
        };
      }

      // Timeout
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        return {
          code: ErrorCode.TIMEOUT_ERROR,
          statusCode: 408,
          message: 'Request timeout'
        };
      }

      // Booking specific errors
      if (error.message.includes('booking') && error.message.includes('failed')) {
        return {
          code: ErrorCode.BOOKING_FAILED,
          statusCode: 400,
          message: 'Booking failed'
        };
      }

      if (error.message.includes('slot') && error.message.includes('not available')) {
        return {
          code: ErrorCode.SLOT_NOT_AVAILABLE,
          statusCode: 409,
          message: 'Slot not available'
        };
      }
    }

    // Default
    return {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      statusCode: 500,
      message: 'Internal server error'
    };
  }
}

// ===== UNIFIED ERROR HANDLER =====

export class UnifiedErrorHandler {
  private static logger = new Logger('INFO', { service: 'UnifiedErrorHandler' });

  /**
   * Обработка ошибок для API endpoints
   */
  static handleApiError(
    error: unknown,
    context: ErrorContext = {},
    customMessage?: string
  ): NextResponse<ErrorResponse> {
    const errorInfo = ErrorDetector.detectErrorType(error);
    const requestId = context.requestId || this.generateRequestId();

    // Логируем ошибку
    this.logger.error('API Error', {
      code: errorInfo.code,
      message: errorInfo.message,
      originalError: error instanceof Error ? error.message : 'Unknown error',
      context,
      requestId,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Формируем ответ
    const response: ErrorResponse = {
      success: false,
      error: {
        code: errorInfo.code,
        message: customMessage || errorInfo.message,
        context: {
          ...context,
          requestId,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    // Добавляем детали для определенных типов ошибок
    if (error instanceof z.ZodError) {
      response.error.details = error.errors;
    }

    if (error instanceof Error && error.name === 'AuthError' && (error as any).statusCode === 403) {
      response.error.code = ErrorCode.AUTHORIZATION_DENIED;
      response.error.message = 'Access denied';
    }

    return NextResponse.json(response, { status: errorInfo.statusCode });
  }

  /**
   * Обработка ошибок для сервисов
   */
  static handleServiceError(
    error: unknown,
    context: ErrorContext = {}
  ): ServiceErrorResult {
    const errorInfo = ErrorDetector.detectErrorType(error);
    const requestId = context.requestId || this.generateRequestId();

    // Логируем ошибку
    this.logger.error('Service Error', {
      code: errorInfo.code,
      message: errorInfo.message,
      originalError: error instanceof Error ? error.message : 'Unknown error',
      context,
      requestId,
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      error: errorInfo.message,
      code: errorInfo.code,
      context: {
        ...context,
        requestId,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Обработка ошибок с автоматической очисткой ресурсов
   */
  static async handleWithCleanup<T>(
    operation: () => Promise<T>,
    cleanup: () => Promise<void>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      try {
        await cleanup();
      } catch (cleanupError) {
        this.logger.warn('Cleanup failed', {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error',
          context
        });
      }
      throw error;
    }
  }

  /**
   * Обработка ошибок с retry логикой
   */
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context: ErrorContext = {}
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        const errorInfo = ErrorDetector.detectErrorType(error);
        
        // Не повторяем для определенных типов ошибок
        if (!this.isRetryableError(errorInfo.code)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        this.logger.warn('Retry attempt', {
          attempt,
          maxRetries,
          error: errorInfo.message,
          context
        });
        
        await this.sleep(delay * attempt);
      }
    }
    
    throw lastError;
  }

  /**
   * Проверка, можно ли повторить операцию при данной ошибке
   */
  private static isRetryableError(code: ErrorCode): boolean {
    const retryableErrors = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      ErrorCode.DATABASE_ERROR
    ];
    
    return retryableErrors.includes(code);
  }

  /**
   * Генерация уникального ID запроса
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Задержка
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== DECORATORS =====

/**
 * Декоратор для автоматической обработки ошибок в API endpoints
 */
export function withErrorHandling(context?: Partial<ErrorContext>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        if (method && typeof method.apply === 'function') {
          return await method.apply(this, args);
        } else {
          throw new Error('Method is not callable');
        }
      } catch (error) {
        const errorContext: ErrorContext = {
          endpoint: propertyName,
          method: 'POST', // Можно улучшить для определения метода
          ...context
        };
        
        return UnifiedErrorHandler.handleApiError(error, errorContext);
      }
    };
  };
}

/**
 * Декоратор для автоматической обработки ошибок в сервисах
 */
export function withServiceErrorHandling(context?: Partial<ErrorContext>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        if (method && typeof method.apply === 'function') {
          return await method.apply(this, args);
        } else {
          throw new Error('Method is not callable');
        }
      } catch (error) {
        const errorContext: ErrorContext = {
          endpoint: `${target.constructor.name}.${propertyName}`,
          ...context
        };
        
        return UnifiedErrorHandler.handleServiceError(error, errorContext);
      }
    };
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Создание контекста ошибки из NextRequest
 */
export function createErrorContextFromRequest(request: NextRequest, additionalContext?: Partial<ErrorContext>): ErrorContext {
  return {
    method: request.method,
    endpoint: request.nextUrl.pathname,
    requestId: request.headers.get('x-request-id') || undefined,
    ...additionalContext
  };
}

/**
 * Создание контекста ошибки для сервисов
 */
export function createServiceErrorContext(serviceName: string, methodName: string, additionalContext?: Partial<ErrorContext>): ErrorContext {
  return {
    endpoint: `${serviceName}.${methodName}`,
    ...additionalContext
  };
}

// ===== EXPORTS =====

export default UnifiedErrorHandler;
