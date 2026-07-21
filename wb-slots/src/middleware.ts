import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { requireEnv } from '@/lib/env';
import { logger } from '@/lib/logging';

// В production требуется обязательное наличие JWT_SECRET
// В development используется fallback значение с предупреждением
const JWT_SECRET = new TextEncoder().encode(
  requireEnv('JWT_SECRET', 'wb-slots-super-secret-jwt-key-2024-dev-only')
);

// Публичные маршруты, не требующие аутентификации.
// Всё остальное, что попадает в matcher ниже, теперь по умолчанию защищено —
// раньше matcher и реальная проверка (if ниже) были рассинхронизированы:
// /api/tasks, /api/tokens, /api/warehouses, /api/dashboard, /api/wb-auth
// входили в matcher, но НЕ входили в условие проверки токена, поэтому
// проходили через middleware вообще без аутентификации.
const PUBLIC_PATH_PREFIXES = [
  '/auth/',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/telegram',
  '/api/auth/telegram-widget',
  '/api/auth/logout',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  // В middleware логируем только в development для отладки
  // В production избегаем лишнего логирования для производительности
  if (process.env.NODE_ENV === 'development') {
    logger.debug({ pathname: request.nextUrl.pathname }, 'Middleware checking path');
  }

  // Пропускаем маршруты авторизации и главную страницу
  if (isPublicPath(request.nextUrl.pathname)) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug({ pathname: request.nextUrl.pathname }, 'Skipping auth route or home page');
    }
    return NextResponse.next();
  }

  // Всё, что попало сюда и входит в matcher ниже, требует валидного токена
  {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      // Логируем предупреждение только для защищенных маршрутов
      logger.warn({ pathname: request.nextUrl.pathname }, 'No token found, redirecting');
      
      // Если нет токена, перенаправляем на главную страницу
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Not authenticated' },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    try {
      // Проверяем токен с помощью jose (Edge Runtime compatible)
      const { payload } = await jwtVerify(token, JWT_SECRET);
      
      // Логируем успешную проверку только в development
      if (process.env.NODE_ENV === 'development') {
        logger.debug({ userId: payload.sub }, 'Token verified successfully');
      }
      
      // Токен валиден, продолжаем
      return NextResponse.next();
      
    } catch (error) {
      // Ошибки верификации токена логируем как WARN (потенциальная проблема безопасности)
      logger.warn({ 
        pathname: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Token verification failed');
      // Токен невалиден или истек, удаляем cookie и перенаправляем
      const response = request.nextUrl.pathname.startsWith('/api/')
        ? NextResponse.json(
            { success: false, error: 'Invalid or expired token' },
            { status: 401 }
          )
        : NextResponse.redirect(new URL('/', request.url));
      
      response.cookies.set('auth-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
      
      return response;
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tasks/:path*',
    '/settings/:path*',
    // Всё под /api/ защищено по умолчанию; исключения — только явный allowlist
    // в PUBLIC_PATH_PREFIXES выше (логин/регистрация/telegram-вход/logout).
    // Раньше сюда нужно было вручную добавлять каждую новую группу роутов —
    // это и привело к тому, что /api/debug/*, /api/admin/*, /api/wb-session/*
    // не проверялись вовсе.
    '/api/:path*',
  ],
};
