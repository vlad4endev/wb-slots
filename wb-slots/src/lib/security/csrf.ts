/**
 * CSRF (Cross-Site Request Forgery) защита
 * Генерация и проверка CSRF токенов
 */

import crypto from 'crypto';
import { logger } from '../logging';
import { requireEnv } from '../env';

const CSRF_TOKEN_SECRET =
  process.env.CSRF_TOKEN_SECRET ||
  requireEnv('JWT_SECRET', 'wb-slots-super-secret-jwt-key-2024-dev-only');
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 час

interface CSRFToken {
  token: string;
  expiresAt: number;
}

/**
 * Генерация CSRF токена
 */
export function generateCSRFToken(): string {
  const randomBytes = crypto.randomBytes(32);
  const timestamp = Date.now().toString();
  const data = `${randomBytes.toString('hex')}-${timestamp}`;
  
  const hmac = crypto.createHmac('sha256', CSRF_TOKEN_SECRET);
  hmac.update(data);
  const signature = hmac.digest('hex');
  
  return `${data}-${signature}`;
}

/**
 * Валидация CSRF токена
 */
export function validateCSRFToken(token: string): boolean {
  try {
    const parts = token.split('-');
    if (parts.length < 3) {
      return false;
    }

    const signature = parts[parts.length - 1];
    const data = parts.slice(0, -1).join('-');

    const hmac = crypto.createHmac('sha256', CSRF_TOKEN_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('CSRF token signature mismatch');
      return false;
    }

    // Проверка срока действия (если токен содержит timestamp)
    const timestampMatch = data.match(/\d{13}$/);
    if (timestampMatch) {
      const timestamp = parseInt(timestampMatch[0], 10);
      const age = Date.now() - timestamp;
      if (age > CSRF_TOKEN_EXPIRY) {
        logger.warn('CSRF token expired');
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('CSRF token validation error', { error });
    return false;
  }
}

/**
 * Извлечение CSRF токена из запроса
 */
export function getCSRFTokenFromRequest(headers: Headers): string | null {
  // Проверяем заголовок
  const headerToken = headers.get('X-CSRF-Token');
  if (headerToken) {
    return headerToken;
  }

  // Проверяем cookie (для форм)
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const csrfCookie = cookies.find(c => c.startsWith('csrf-token='));
    if (csrfCookie) {
      return csrfCookie.split('=')[1];
    }
  }

  return null;
}

/**
 * Middleware для проверки CSRF токена
 */
export async function validateCSRFMiddleware(
  request: Request,
  allowedMethods: string[] = ['POST', 'PUT', 'DELETE', 'PATCH']
): Promise<{ isValid: boolean; error?: string }> {
  const method = request.method;

  // Пропускаем безопасные методы
  if (!allowedMethods.includes(method)) {
    return { isValid: true };
  }

  // Пропускаем для публичных API (опционально)
  const url = new URL(request.url);
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/health'];
  if (publicPaths.some(path => url.pathname.startsWith(path))) {
    return { isValid: true };
  }

  const token = getCSRFTokenFromRequest(request.headers);

  if (!token) {
    return {
      isValid: false,
      error: 'CSRF token is missing',
    };
  }

  if (!validateCSRFToken(token)) {
    return {
      isValid: false,
      error: 'Invalid or expired CSRF token',
    };
  }

  return { isValid: true };
}

