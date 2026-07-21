import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { User } from '@prisma/client';
import { requireEnv, getEnv } from './env';
import { logger } from './logging';

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = new TextEncoder().encode(
    requireEnv('JWT_SECRET', 'wb-slots-super-secret-jwt-key-2024-dev-only')
  );
  const expiresIn = getEnv('JWT_EXPIRES_IN', '30d'); // Увеличиваем до 30 дней
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const secret = new TextEncoder().encode(
    requireEnv('JWT_SECRET', 'wb-slots-super-secret-jwt-key-2024-dev-only')
  );

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as JWTPayload;
  } catch (error) {
    throw new AuthError('Invalid or expired token', 401);
  }
}

export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('No token found in request');
      }
      return null;
    }

    const payload = await verifyToken(token);
    
    // Поддерживаем как sub, так и userId для совместимости
    const userId = payload.sub || payload.userId;
    
    if (!userId) {
      logger.warn({ payload }, 'JWT payload does not contain sub or userId');
      return null;
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      logger.warn({ userId }, 'User not found for token payload - user may have been deleted or token is invalid');
      return null;
    }

    if (!user.isActive) {
      logger.warn({ userId: user.id }, 'User is inactive');
      return null;
    }

    if (process.env.NODE_ENV === 'development') {
      logger.debug({ userId: user.id, email: user.email }, 'User authenticated successfully');
    }
    
    return user;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Error in getCurrentUser');
    return null;
  }
}

export function extractTokenFromRequest(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Token found in Authorization header');
    }
    return token;
  }

  // Try cookie
  const token = request.cookies.get('auth-token')?.value;
  if (token) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Token found in cookie');
    }
    return token;
  }

  // Не логируем отсутствие токена, это нормальная ситуация для публичных маршрутов
  return null;
}

export async function requireAuth(request: NextRequest): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

export async function requireAdmin(request: NextRequest): Promise<User> {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    throw new AuthError('Admin access required', 403);
  }
  return user;
}

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

export async function getServerSession(request: NextRequest): Promise<{ user: JWTPayload } | null> {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return null;

    const payload = await verifyToken(token);
    return { user: payload };
  } catch (error) {
    return null;
  }
}

// NextAuth.js configuration for compatibility
export const authOptions = {
  providers: [],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: requireEnv('JWT_SECRET', 'wb-slots-super-secret-jwt-key-2024-dev-only'),
};
