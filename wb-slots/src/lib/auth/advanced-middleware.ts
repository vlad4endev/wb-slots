import { NextRequest, NextResponse } from 'next/server';
import { advancedAuthManager } from './advanced-auth-manager';
import { Logger } from '../logging/logger';

// ===== TYPES =====

export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  session: {
    id: string;
    sessionId: string;
    expiresAt: Date;
    lastUsedAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  };
  permissions: string[];
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RouteConfig {
  requireAuth: boolean;
  requiredPermissions?: string[];
  requiredRole?: string;
  securityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rateLimit?: {
    requests: number;
    window: number; // в миллисекундах
  };
  enableAuditLog?: boolean;
  customValidation?: (context: AuthContext) => Promise<boolean>;
}

// ===== ROUTE CONFIGURATIONS =====

const routeConfigs: Record<string, RouteConfig> = {
  // API Routes
  '/api/auth/me': {
    requireAuth: true,
    securityLevel: 'LOW',
    enableAuditLog: true,
  },
  '/api/settings': {
    requireAuth: true,
    requiredPermissions: ['settings:read'],
    securityLevel: 'MEDIUM',
    enableAuditLog: true,
  },
  '/api/settings/update': {
    requireAuth: true,
    requiredPermissions: ['settings:write'],
    securityLevel: 'HIGH',
    enableAuditLog: true,
  },
  '/api/wb-auth': {
    requireAuth: true,
    requiredPermissions: ['wb:auth'],
    securityLevel: 'HIGH',
    enableAuditLog: true,
  },
  '/api/auto-booking': {
    requireAuth: true,
    requiredPermissions: ['booking:create'],
    securityLevel: 'CRITICAL',
    enableAuditLog: true,
    rateLimit: {
      requests: 10,
      window: 60 * 1000, // 1 минута
    },
  },
  '/api/admin': {
    requireAuth: true,
    requiredRole: 'ADMIN',
    securityLevel: 'CRITICAL',
    enableAuditLog: true,
  },
  
  // Page Routes
  '/dashboard': {
    requireAuth: true,
    securityLevel: 'LOW',
    enableAuditLog: true,
  },
  '/settings': {
    requireAuth: true,
    requiredPermissions: ['settings:read'],
    securityLevel: 'MEDIUM',
    enableAuditLog: true,
  },
  '/wb-auth': {
    requireAuth: true,
    requiredPermissions: ['wb:auth'],
    securityLevel: 'HIGH',
    enableAuditLog: true,
  },
  '/auto-booking': {
    requireAuth: true,
    requiredPermissions: ['booking:create'],
    securityLevel: 'CRITICAL',
    enableAuditLog: true,
  },
};

// ===== RATE LIMITING =====

class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  isAllowed(key: string, limit: number, window: number): boolean {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + window });
      return true;
    }

    if (record.count >= limit) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingRequests(key: string, limit: number, window: number): number {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      return limit;
    }

    return Math.max(0, limit - record.count);
  }
}

const rateLimiter = new RateLimiter();

// ===== ADVANCED MIDDLEWARE =====

export class AdvancedAuthMiddleware {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('INFO', { service: 'AdvancedAuthMiddleware' });
  }

  /**
   * Основной метод middleware
   */
  async handleRequest(request: NextRequest): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;
    
    try {
      this.logger.info('🔍 Processing request', { 
        pathname, 
        method: request.method,
        ip: this.getClientIP(request),
      });

      // Получаем конфигурацию маршрута
      const config = this.getRouteConfig(pathname);
      
      if (!config) {
        // Маршрут не требует авторизации
        return NextResponse.next();
      }

      // Проверяем rate limiting
      if (config.rateLimit) {
        const clientIP = this.getClientIP(request);
        const rateLimitKey = `${clientIP}:${pathname}`;
        
        if (!rateLimiter.isAllowed(rateLimitKey, config.rateLimit.requests, config.rateLimit.window)) {
          this.logger.warn('⚠️ Rate limit exceeded', { 
            pathname, 
            ip: clientIP,
            limit: config.rateLimit.requests,
            window: config.rateLimit.window,
          });

          return this.createErrorResponse('Rate limit exceeded', 429, {
            'X-RateLimit-Limit': config.rateLimit.requests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + config.rateLimit.window).toISOString(),
          });
        }
      }

      // Проверяем авторизацию
      if (config.requireAuth) {
        const authResult = await this.validateAuth(request, config);
        
        if (!authResult.success) {
          return authResult.response;
        }

        // Добавляем контекст авторизации в заголовки
        const response = NextResponse.next();
        response.headers.set('X-User-ID', authResult.context.user.id);
        response.headers.set('X-User-Role', authResult.context.user.role);
        response.headers.set('X-Session-ID', authResult.context.session.sessionId);
        response.headers.set('X-Security-Level', authResult.context.securityLevel);

        // Логируем аудит
        if (config.enableAuditLog) {
          await this.logAuditEvent(request, authResult.context, 'ACCESS_GRANTED');
        }

        return response;
      }

      return NextResponse.next();

    } catch (error) {
      this.logger.error('❌ Middleware error', { 
        error: error.message, 
        pathname,
        stack: error.stack,
      });

      return this.createErrorResponse('Internal server error', 500);
    }
  }

  /**
   * Валидация авторизации
   */
  private async validateAuth(
    request: NextRequest, 
    config: RouteConfig
  ): Promise<{ success: boolean; response?: NextResponse; context?: AuthContext }> {
    try {
      // Извлекаем токен из запроса
      const token = this.extractToken(request);
      if (!token) {
        this.logger.warn('⚠️ No token found', { pathname: request.nextUrl.pathname });
        return {
          success: false,
          response: this.createErrorResponse('Authentication required', 401),
        };
      }

      // Валидируем токен и получаем пользователя
      const user = await this.validateToken(token);
      if (!user) {
        this.logger.warn('⚠️ Invalid token', { pathname: request.nextUrl.pathname });
        return {
          success: false,
          response: this.createErrorResponse('Invalid or expired token', 401),
        };
      }

      // Получаем активную сессию
      const session = await advancedAuthManager.validateAndUpdateSession(token, request);
      if (!session) {
        this.logger.warn('⚠️ Invalid session', { 
          userId: user.id, 
          pathname: request.nextUrl.pathname 
        });
        return {
          success: false,
          response: this.createErrorResponse('Session expired or invalid', 401),
        };
      }

      // Проверяем роль
      if (config.requiredRole && user.role !== config.requiredRole) {
        this.logger.warn('⚠️ Insufficient role', { 
          userId: user.id, 
          requiredRole: config.requiredRole,
          userRole: user.role,
          pathname: request.nextUrl.pathname,
        });
        return {
          success: false,
          response: this.createErrorResponse('Insufficient permissions', 403),
        };
      }

      // Проверяем разрешения
      if (config.requiredPermissions) {
        const userPermissions = await this.getUserPermissions(user.id);
        const hasRequiredPermissions = config.requiredPermissions.every(
          permission => userPermissions.includes(permission)
        );

        if (!hasRequiredPermissions) {
          this.logger.warn('⚠️ Insufficient permissions', { 
            userId: user.id, 
            requiredPermissions: config.requiredPermissions,
            userPermissions,
            pathname: request.nextUrl.pathname,
          });
          return {
            success: false,
            response: this.createErrorResponse('Insufficient permissions', 403),
          };
        }
      }

      // Создаем контекст авторизации
      const context: AuthContext = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
        session: {
          id: session.id,
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
          lastUsedAt: session.lastUsedAt,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          deviceFingerprint: session.deviceFingerprint,
        },
        permissions: await this.getUserPermissions(user.id),
        securityLevel: config.securityLevel || 'LOW',
      };

      // Кастомная валидация
      if (config.customValidation) {
        const isValid = await config.customValidation(context);
        if (!isValid) {
          this.logger.warn('⚠️ Custom validation failed', { 
            userId: user.id, 
            pathname: request.nextUrl.pathname 
          });
          return {
            success: false,
            response: this.createErrorResponse('Custom validation failed', 403),
          };
        }
      }

      return { success: true, context };

    } catch (error) {
      this.logger.error('❌ Auth validation error', { 
        error: error.message, 
        pathname: request.nextUrl.pathname 
      });
      return {
        success: false,
        response: this.createErrorResponse('Authentication error', 500),
      };
    }
  }

  /**
   * Получение конфигурации маршрута
   */
  private getRouteConfig(pathname: string): RouteConfig | null {
    // Точное совпадение
    if (routeConfigs[pathname]) {
      return routeConfigs[pathname];
    }

    // Проверяем префиксы
    for (const [route, config] of Object.entries(routeConfigs)) {
      if (pathname.startsWith(route)) {
        return config;
      }
    }

    return null;
  }

  /**
   * Извлечение токена из запроса
   */
  private extractToken(request: NextRequest): string | null {
    // Проверяем Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Проверяем cookie
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      return token;
    }

    return null;
  }

  /**
   * Валидация токена
   */
  private async validateToken(token: string): Promise<any> {
    try {
      // Здесь должна быть логика валидации JWT токена
      // Пока используем упрощенную версию
      const { verifyToken } = await import('./auth');
      const payload = await verifyToken(token);
      
      // Получаем пользователя из базы данных
      const { prisma } = await import('../prisma');
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      return user && user.isActive ? user : null;
    } catch (error) {
      this.logger.error('❌ Token validation error', { error: error.message });
      return null;
    }
  }

  /**
   * Получение разрешений пользователя
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const { prisma } = await import('../prisma');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { permissions: true },
      });

      if (!user) return [];

      // Базовые разрешения по роли
      const rolePermissions: Record<string, string[]> = {
        'ADMIN': [
          'settings:read', 'settings:write', 'settings:delete',
          'wb:auth', 'wb:manage',
          'booking:create', 'booking:read', 'booking:update', 'booking:delete',
          'users:read', 'users:write', 'users:delete',
          'admin:access',
        ],
        'DEVELOPER': [
          'settings:read', 'settings:write',
          'wb:auth', 'wb:manage',
          'booking:create', 'booking:read', 'booking:update',
        ],
        'USER': [
          'settings:read',
          'wb:auth',
          'booking:create', 'booking:read',
        ],
      };

      const basePermissions = rolePermissions[user.role] || [];
      const customPermissions = user.permissions?.map(p => p.permission) || [];

      return [...new Set([...basePermissions, ...customPermissions])];
    } catch (error) {
      this.logger.error('❌ Failed to get user permissions', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Логирование аудита
   */
  private async logAuditEvent(
    request: NextRequest, 
    context: AuthContext, 
    action: string
  ): Promise<void> {
    try {
      const { prisma } = await import('../prisma');
      
      await prisma.auditLog.create({
        data: {
          userId: context.user.id,
          sessionId: context.session.sessionId,
          action,
          resource: request.nextUrl.pathname,
          method: request.method,
          ipAddress: this.getClientIP(request),
          userAgent: request.headers.get('user-agent'),
          details: JSON.stringify({
            securityLevel: context.securityLevel,
            permissions: context.permissions,
            timestamp: new Date().toISOString(),
          }),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('❌ Failed to log audit event', { error: error.message });
    }
  }

  /**
   * Создание ответа с ошибкой
   */
  private createErrorResponse(
    message: string, 
    status: number, 
    headers?: Record<string, string>
  ): NextResponse {
    const response = NextResponse.json(
      { success: false, error: message },
      { status }
    );

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    return response;
  }

  /**
   * Получение IP адреса клиента
   */
  private getClientIP(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.ip ||
      'unknown'
    );
  }
}

// ===== SINGLETON INSTANCE =====

export const advancedAuthMiddleware = new AdvancedAuthMiddleware();
