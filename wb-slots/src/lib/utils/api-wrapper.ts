/**
 * Универсальный wrapper для API handlers
 * Применяет rate limiting, CSRF защиту и обработку ошибок
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRateLimitMiddleware } from '../security/rate-limit-middleware';
import { withCSRFProtection } from '../security/csrf-middleware';
import { UnifiedErrorHandler } from '../errors/unified-error-handler';

interface ApiWrapperOptions {
  enableRateLimit?: boolean;
  rateLimitConfig?: string;
  enableCSRF?: boolean;
  csrfMethods?: string[];
}

/**
 * Универсальный wrapper для API handlers
 */
export function withApiWrapper<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>,
  options: ApiWrapperOptions = {}
) {
  const {
    enableRateLimit = true,
    rateLimitConfig = 'general_api',
    enableCSRF = true,
    csrfMethods = ['POST', 'PUT', 'DELETE', 'PATCH'],
  } = options;

  return async (...args: T): Promise<NextResponse<R>> => {
    const request = args[0] as NextRequest;

    try {
      // Применяем rate limiting
      if (enableRateLimit) {
        const rateLimitMiddleware = createRateLimitMiddleware({
          configName: rateLimitConfig,
          keyGenerator: (req) => {
            // Используем IP адрес и путь для уникального ключа
            const ip = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
            return `${ip}:${req.nextUrl.pathname}`;
          },
        });

        const rateLimitResult = await rateLimitMiddleware(
          request,
          async (req) => {
            // После rate limiting применяем CSRF если нужно
            if (enableCSRF && csrfMethods.includes(req.method)) {
              return withCSRFProtection(handler)(req, ...args.slice(1));
            }
            return handler(req, ...args.slice(1));
          }
        );

        return rateLimitResult as NextResponse<R>;
      }

      // Если rate limiting отключен, только CSRF
      if (enableCSRF && csrfMethods.includes(request.method)) {
        return withCSRFProtection(handler)(...args);
      }

      // Без защиты, только обработка ошибок
      return handler(...args);

    } catch (error) {
      // Унифицированная обработка ошибок
      return UnifiedErrorHandler.handleApiError(error, {
        path: request.nextUrl.pathname,
        method: request.method,
      }) as NextResponse<R>;
    }
  };
}

/**
 * Пример использования:
 * 
 * // Было:
 * export async function POST(request: NextRequest) {
 *   try {
 *     // логика
 *   } catch (error) {
 *     return NextResponse.json({ error: '...' }, { status: 500 });
 *   }
 * }
 * 
 * // Стало:
 * import { withApiWrapper } from '@/lib/utils/api-wrapper';
 * 
 * const postHandler = async (request: NextRequest) => {
 *   // логика
 *   return NextResponse.json({ success: true });
 * };
 * 
 * export const POST = withApiWrapper(postHandler, {
 *   enableRateLimit: true,
 *   rateLimitConfig: 'api_auth',
 *   enableCSRF: true,
 * });
 */

