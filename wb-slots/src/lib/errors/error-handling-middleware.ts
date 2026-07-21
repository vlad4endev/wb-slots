// ===== ERROR HANDLING MIDDLEWARE =====

import { NextRequest, NextResponse } from 'next/server';
import { UnifiedErrorHandler, createErrorContextFromRequest } from './unified-error-handler';

/**
 * Middleware для автоматической обработки ошибок в API routes
 */
export function withApiErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>
) {
  return async (...args: T): Promise<NextResponse<R>> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Извлекаем NextRequest из аргументов
      const request = args.find(arg => arg && typeof arg === 'object' && 'method' in arg) as NextRequest;
      
      const context = request ? createErrorContextFromRequest(request) : {};
      
      return UnifiedErrorHandler.handleApiError(error, context) as NextResponse<R>;
    }
  };
}

/**
 * Middleware для обработки ошибок с дополнительным контекстом
 */
export function withApiErrorHandlingAndContext<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>,
  contextProvider?: (...args: T) => Record<string, any>
) {
  return async (...args: T): Promise<NextResponse<R>> => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args.find(arg => arg && typeof arg === 'object' && 'method' in arg) as NextRequest;
      
      let context = request ? createErrorContextFromRequest(request) : {};
      
      if (contextProvider) {
        const additionalContext = contextProvider(...args);
        context = { ...context, ...additionalContext };
      }
      
      return UnifiedErrorHandler.handleApiError(error, context) as NextResponse<R>;
    }
  };
}

/**
 * Middleware для обработки ошибок с автоматической очисткой
 */
export function withApiErrorHandlingAndCleanup<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>,
  cleanup: (...args: T) => Promise<void>
) {
  return async (...args: T): Promise<NextResponse<R>> => {
    try {
      return await handler(...args);
    } catch (error) {
      try {
        await cleanup(...args);
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
      }
      
      const request = args.find(arg => arg && typeof arg === 'object' && 'method' in arg) as NextRequest;
      const context = request ? createErrorContextFromRequest(request) : {};
      
      return UnifiedErrorHandler.handleApiError(error, context) as NextResponse<R>;
    }
  };
}

/**
 * Middleware для обработки ошибок с retry логикой
 */
export function withApiErrorHandlingAndRetry<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>,
  maxRetries: number = 3,
  delay: number = 1000
) {
  return async (...args: T): Promise<NextResponse<R>> => {
    const request = args.find(arg => arg && typeof arg === 'object' && 'method' in arg) as NextRequest;
    const context = request ? createErrorContextFromRequest(request) : {};
    
    try {
      return await UnifiedErrorHandler.handleWithRetry(
        () => handler(...args),
        maxRetries,
        delay,
        context
      );
    } catch (error) {
      return UnifiedErrorHandler.handleApiError(error, context) as NextResponse<R>;
    }
  };
}

/**
 * Утилита для создания API handler с автоматической обработкой ошибок
 */
export function createApiHandler<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>,
  options?: {
    contextProvider?: (...args: T) => Record<string, any>;
    cleanup?: (...args: T) => Promise<void>;
    retry?: {
      maxRetries: number;
      delay: number;
    };
  }
) {
  let wrappedHandler = handler;
  
  if (options?.retry) {
    wrappedHandler = withApiErrorHandlingAndRetry(
      wrappedHandler,
      options.retry.maxRetries,
      options.retry.delay
    );
  }
  
  if (options?.cleanup) {
    wrappedHandler = withApiErrorHandlingAndCleanup(
      wrappedHandler,
      options.cleanup
    );
  }
  
  if (options?.contextProvider) {
    wrappedHandler = withApiErrorHandlingAndContext(
      wrappedHandler,
      options.contextProvider
    );
  } else {
    wrappedHandler = withApiErrorHandling(wrappedHandler);
  }
  
  return wrappedHandler;
}

const errorHandlingMiddleware = {
  withApiErrorHandling,
  withApiErrorHandlingAndContext,
  withApiErrorHandlingAndCleanup,
  withApiErrorHandlingAndRetry,
  createApiHandler
};

export default errorHandlingMiddleware;
