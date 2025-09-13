import { NextRequest, NextResponse } from 'next/server';
import { rateLimitService } from './rate-limit-service';

export interface RateLimitOptions {
  configName?: string;
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (request: NextRequest, result: any) => void;
}

/**
 * Middleware для rate limiting
 */
export function createRateLimitMiddleware(options: RateLimitOptions = {}) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Генерируем ключ для rate limiting
      const key = options.keyGenerator 
        ? options.keyGenerator(request)
        : generateDefaultKey(request);

      // Проверяем rate limit
      const result = await rateLimitService.checkRateLimit(
        key,
        options.configName || 'general_api'
      );

      if (!result.allowed) {
        // Rate limit превышен
        if (options.onLimitReached) {
          options.onLimitReached(request, result);
        }

        console.warn(`⚠️ Rate limit exceeded for key: ${key}`);

        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: result.retryAfter,
            resetTime: result.resetTime,
          },
          {
            status: 429,
            headers: {
              'Retry-After': result.retryAfter?.toString() || '60',
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.resetTime.toString(),
            },
          }
        );
      }

      // Выполняем обработчик
      const response = await handler(request);

      // Добавляем заголовки rate limit
      response.headers.set('X-RateLimit-Limit', '100');
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

      return response;

    } catch (error) {
      console.error('❌ Rate limit middleware error:', error);
      
      // В случае ошибки пропускаем rate limiting
      return handler(request);
    }
  };
}

/**
 * Генерирует ключ по умолчанию на основе IP и User-Agent
 */
function generateDefaultKey(request: NextRequest): string {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const userAgentHash = hashString(userAgent);
  
  return `${ip}:${userAgentHash}`;
}

/**
 * Получает IP адрес клиента
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Создает хеш строки
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Rate limit middleware для WB API
 */
export const wbApiRateLimit = createRateLimitMiddleware({
  configName: 'wb_api',
  keyGenerator: (request) => {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    return `wb_api:${userId}`;
  },
  onLimitReached: (request, result) => {
    console.warn(`🚨 WB API rate limit exceeded for user: ${request.headers.get('x-user-id')}`);
  },
});

/**
 * Rate limit middleware для Telegram API
 */
export const telegramApiRateLimit = createRateLimitMiddleware({
  configName: 'telegram_api',
  keyGenerator: (request) => {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    return `telegram_api:${userId}`;
  },
  onLimitReached: (request, result) => {
    console.warn(`🚨 Telegram API rate limit exceeded for user: ${request.headers.get('x-user-id')}`);
  },
});

/**
 * Rate limit middleware для пользователей
 */
export const userRateLimit = createRateLimitMiddleware({
  configName: 'user_requests',
  keyGenerator: (request) => {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    return `user:${userId}`;
  },
  onLimitReached: (request, result) => {
    console.warn(`🚨 User rate limit exceeded: ${request.headers.get('x-user-id')}`);
  },
});

/**
 * Rate limit middleware для задач
 */
export const taskRateLimit = createRateLimitMiddleware({
  configName: 'task_execution',
  keyGenerator: (request) => {
    const taskId = request.headers.get('x-task-id') || 'unknown';
    return `task:${taskId}`;
  },
  onLimitReached: (request, result) => {
    console.warn(`🚨 Task rate limit exceeded: ${request.headers.get('x-task-id')}`);
  },
});

/**
 * Декоратор для применения rate limiting к API функциям
 */
export function withRateLimit(
  configName: string = 'general_api',
  keyGenerator?: (request: NextRequest) => string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      const middleware = createRateLimitMiddleware({
        configName,
        keyGenerator,
      });

      return middleware(request, async (req) => {
        return method.call(this, req, ...args);
      });
    };

    return descriptor;
  };
}

/**
 * Утилита для проверки rate limit в коде
 */
export async function checkRateLimit(
  key: string,
  configName: string = 'general_api'
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const result = await rateLimitService.checkRateLimit(key, configName);
  
  if (!result.allowed) {
    console.warn(`⚠️ Rate limit exceeded for key: ${key} (${configName})`);
  }
  
  return {
    allowed: result.allowed,
    retryAfter: result.retryAfter,
  };
}

/**
 * Утилита для ожидания снятия rate limit
 */
export async function waitForRateLimit(
  key: string,
  configName: string = 'general_api',
  maxWaitTime: number = 300000 // 5 минут
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const result = await rateLimitService.checkRateLimit(key, configName);
    
    if (result.allowed) {
      return true;
    }
    
    if (result.retryAfter) {
      const waitTime = Math.min(result.retryAfter * 1000, 5000); // Максимум 5 секунд
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 секунда по умолчанию
    }
  }
  
  return false;
}
