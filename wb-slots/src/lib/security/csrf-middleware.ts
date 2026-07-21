/**
 * CSRF Middleware для Next.js
 * Автоматическая проверка CSRF токенов для state-changing операций
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFMiddleware } from './csrf';
import { logger } from '../logging';

/**
 * Обертка для API handlers с CSRF защитой
 */
export function withCSRFProtection<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>
) {
  return async (...args: T): Promise<NextResponse<R>> => {
    const request = args[0] as NextRequest;

    // Проверяем CSRF только для state-changing методов
    const csrfCheck = await validateCSRFMiddleware(request);

    if (!csrfCheck.isValid) {
      logger.warn('CSRF validation failed', {
        path: request.nextUrl.pathname,
        method: request.method,
        error: csrfCheck.error,
      });

      return NextResponse.json(
        {
          success: false,
          error: csrfCheck.error || 'CSRF validation failed',
        },
        { status: 403 }
      ) as NextResponse<R>;
    }

    return handler(...args);
  };
}

/**
 * Получить CSRF токен для отправки клиенту
 */
export function getCSRFToken(): string {
  // Импортируем динамически чтобы избежать циклических зависимостей
  const { generateCSRFToken } = require('./csrf');
  return generateCSRFToken();
}

