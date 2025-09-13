import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { User } from '@prisma/client';

export interface JWTPayload {
  userId: string;
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
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'wb-slots-super-secret-jwt-key-2024');
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d'; // Увеличиваем до 30 дней
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'wb-slots-super-secret-jwt-key-2024');

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
      console.log('No token found in request');
      return null;
    }

    const payload = await verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      console.log('User not found for token payload:', payload);
      console.log('This might indicate that the user was deleted or the token is invalid');
      return null;
    }

    if (!user.isActive) {
      console.log('User is inactive:', user.id);
      return null;
    }

    console.log('User authenticated successfully:', { id: user.id, email: user.email });
    return user;
  } catch (error) {
    console.log('Error in getCurrentUser:', error);
    return null;
  }
}

export function extractTokenFromRequest(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('Token found in Authorization header');
    return token;
  }

  // Try cookie
  const token = request.cookies.get('auth-token')?.value;
  if (token) {
    console.log('Token found in cookie');
    return token;
  }

  console.log('No token found in request headers or cookies');
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

export function setAuthCookie(response: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFlag = isProduction ? 'Secure; ' : '';
  
  response.headers.set(
    'Set-Cookie',
    `auth-token=${token}; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  );
}

export function clearAuthCookie(response: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFlag = isProduction ? 'Secure; ' : '';
  
  response.headers.set(
    'Set-Cookie',
    `auth-token=; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=0`
  );
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
