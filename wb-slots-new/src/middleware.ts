import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'wb-slots-super-secret-jwt-key-2024');

export async function middleware(request: NextRequest) {
  console.log('Middleware checking:', request.nextUrl.pathname);
  
  // Пропускаем маршруты авторизации и главную страницу
  if (request.nextUrl.pathname.startsWith('/auth/') || 
      request.nextUrl.pathname.startsWith('/api/auth/login') ||
      request.nextUrl.pathname.startsWith('/api/auth/register') ||
      request.nextUrl.pathname === '/') {
    console.log('Skipping auth route or home page:', request.nextUrl.pathname);
    return NextResponse.next();
  }

  // Проверяем только защищенные маршруты
  if (request.nextUrl.pathname.startsWith('/dashboard') || 
      request.nextUrl.pathname.startsWith('/tasks') ||
      request.nextUrl.pathname.startsWith('/settings') ||
      request.nextUrl.pathname.startsWith('/api/auth/me') ||
      request.nextUrl.pathname.startsWith('/api/settings/')) {
    
    const token = request.cookies.get('auth-token')?.value;
    console.log('Token found:', !!token);
    
    if (!token) {
      console.log('No token, redirecting to home page');
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
      console.log('Token payload:', payload);
      console.log('Token valid, proceeding');
      
      // Токен валиден, продолжаем
      return NextResponse.next();
      
    } catch (error) {
      console.log('Token verification error:', error);
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
    '/api/auth/me',
    '/api/tasks/:path*',
    '/api/tokens/:path*',
    '/api/warehouses/:path*',
    '/api/settings/:path*',
    '/api/dashboard/:path*',
    '/api/wb-auth/:path*',
  ],
};
