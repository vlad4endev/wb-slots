// ===== SERVICE ERROR UTILITIES =====

import { UnifiedErrorHandler, createServiceErrorContext, ServiceErrorResult } from './unified-error-handler';

/**
 * Обертка для методов сервисов с автоматической обработкой ошибок
 */
export function withServiceErrorHandling<T extends any[], R>(
  serviceName: string,
  methodName: string,
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | ServiceErrorResult> => {
    try {
      return await handler(...args);
    } catch (error) {
      const context = createServiceErrorContext(serviceName, methodName);
      return UnifiedErrorHandler.handleServiceError(error, context);
    }
  };
}

/**
 * Обертка для методов сервисов с retry логикой
 */
export function withServiceErrorHandlingAndRetry<T extends any[], R>(
  serviceName: string,
  methodName: string,
  handler: (...args: T) => Promise<R>,
  maxRetries: number = 3,
  delay: number = 1000
) {
  return async (...args: T): Promise<R | ServiceErrorResult> => {
    const context = createServiceErrorContext(serviceName, methodName);
    
    try {
      return await UnifiedErrorHandler.handleWithRetry(
        () => handler(...args),
        maxRetries,
        delay,
        context
      );
    } catch (error) {
      return UnifiedErrorHandler.handleServiceError(error, context);
    }
  };
}

/**
 * Обертка для методов сервисов с автоматической очисткой
 */
export function withServiceErrorHandlingAndCleanup<T extends any[], R>(
  serviceName: string,
  methodName: string,
  handler: (...args: T) => Promise<R>,
  cleanup: (...args: T) => Promise<void>
) {
  return async (...args: T): Promise<R | ServiceErrorResult> => {
    const context = createServiceErrorContext(serviceName, methodName);
    
    try {
      return await UnifiedErrorHandler.handleWithCleanup(
        () => handler(...args),
        () => cleanup(...args),
        context
      );
    } catch (error) {
      return UnifiedErrorHandler.handleServiceError(error, context);
    }
  };
}

/**
 * Утилита для создания метода сервиса с автоматической обработкой ошибок
 */
export function createServiceMethod<T extends any[], R>(
  serviceName: string,
  methodName: string,
  handler: (...args: T) => Promise<R>,
  options?: {
    retry?: {
      maxRetries: number;
      delay: number;
    };
    cleanup?: (...args: T) => Promise<void>;
  }
) {
  let wrappedHandler = handler;
  
  if (options?.retry) {
    wrappedHandler = withServiceErrorHandlingAndRetry(
      serviceName,
      methodName,
      wrappedHandler,
      options.retry.maxRetries,
      options.retry.delay
    );
  }
  
  if (options?.cleanup) {
    wrappedHandler = withServiceErrorHandlingAndCleanup(
      serviceName,
      methodName,
      wrappedHandler,
      options.cleanup
    );
  }
  
  if (!options?.retry && !options?.cleanup) {
    wrappedHandler = withServiceErrorHandling(
      serviceName,
      methodName,
      wrappedHandler
    );
  }
  
  return wrappedHandler;
}

/**
 * Декоратор для классов сервисов
 */
export function ServiceErrorHandling(serviceName: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        
        // Обертываем все методы класса
        const prototype = Object.getPrototypeOf(this);
        const propertyNames = Object.getOwnPropertyNames(prototype);
        
        propertyNames.forEach(propertyName => {
          if (propertyName !== 'constructor' && typeof prototype[propertyName] === 'function') {
            const originalMethod = prototype[propertyName];
            prototype[propertyName] = withServiceErrorHandling(
              serviceName,
              propertyName,
              originalMethod.bind(this)
            );
          }
        });
      }
    };
  };
}

/**
 * Утилита для проверки результата сервиса
 */
export function isServiceError<T>(result: T | ServiceErrorResult): result is ServiceErrorResult {
  return result && typeof result === 'object' && 'success' in result && result.success === false;
}

/**
 * Утилита для извлечения данных из результата сервиса
 */
export function extractServiceResult<T>(result: T | ServiceErrorResult): T | null {
  if (isServiceError(result)) {
    return null;
  }
  return result as T;
}

/**
 * Утилита для обработки результата сервиса с fallback
 */
export function handleServiceResult<T, F>(
  result: T | ServiceErrorResult,
  fallback: F
): T | F {
  if (isServiceError(result)) {
    return fallback;
  }
  return result as T;
}

const serviceErrorUtils = {
  withServiceErrorHandling,
  withServiceErrorHandlingAndRetry,
  withServiceErrorHandlingAndCleanup,
  createServiceMethod,
  ServiceErrorHandling,
  isServiceError,
  extractServiceResult,
  handleServiceResult
};

export default serviceErrorUtils;
