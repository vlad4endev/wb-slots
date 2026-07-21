import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function shouldUseSecureCookies(request?: NextRequest): boolean {
  const override = process.env.AUTH_COOKIE_SECURE?.toLowerCase();
  if (override === 'true') {
    return true;
  }
  if (override === 'false') {
    return false;
  }

  if (request) {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      const proto = forwardedProto.split(',')[0]?.trim();
      if (proto) {
        return proto === 'https';
      }
    }

    const origin = request.headers.get('origin');
    if (origin?.startsWith('https://')) {
      return true;
    }

    if (request.nextUrl?.protocol === 'https:') {
      return true;
    }
  }

  return false;
}

export function setAuthCookie(response: NextResponse, token: string, request?: NextRequest): void {
  const secure = shouldUseSecureCookies(request);

  response.cookies.set({
    name: 'auth-token',
    value: token,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearAuthCookie(response: NextResponse, request?: NextRequest): void {
  const secure = shouldUseSecureCookies(request);

  response.cookies.set({
    name: 'auth-token',
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
