// ===== SECURITY MIDDLEWARE =====

import { NextRequest, NextResponse } from 'next/server';
import { AdvancedInputValidationService } from './advanced-input-validation-service';
import { SecurityAuditService } from './security-audit-service';
import { TwoFactorAuthService } from './two-factor-auth-service';
import { Logger } from '../logging/logger';

// ===== INTERFACES =====

export interface SecurityMiddlewareConfig {
  enableInputValidation: boolean;
  enableSecurityAudit: boolean;
  enableTwoFactorCheck: boolean;
  enableRateLimiting: boolean;
  enableIPBlocking: boolean;
  enableUserLockout: boolean;
  validationRules: Record<string, any>;
  requireTwoFactor: string[]; // Routes that require 2FA
  skipValidation: string[]; // Routes to skip validation
  securityHeaders: boolean;
  corsConfig: {
    origin: string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  route: string;
  method: string;
  headers: Record<string, string>;
}

// ===== SECURITY MIDDLEWARE =====

export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private logger: Logger;
  private config: SecurityMiddlewareConfig;
  private validationService: AdvancedInputValidationService;
  private auditService: SecurityAuditService;
  private twoFactorService: TwoFactorAuthService;

  private constructor() {
    this.logger = new Logger('INFO', { context: 'SecurityMiddleware' });
    
    this.config = {
      enableInputValidation: true,
      enableSecurityAudit: true,
      enableTwoFactorCheck: true,
      enableRateLimiting: true,
      enableIPBlocking: true,
      enableUserLockout: true,
      validationRules: {},
      requireTwoFactor: ['/api/admin', '/api/settings', '/api/wb-auth'],
      skipValidation: ['/api/health', '/api/status'],
      securityHeaders: true,
      corsConfig: {
        origin: ['http://localhost:3000', 'https://yourdomain.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
      }
    };

    this.validationService = AdvancedInputValidationService.getInstance();
    this.auditService = SecurityAuditService.getInstance();
    this.twoFactorService = TwoFactorAuthService.getInstance();
  }

  public static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware();
    }
    return SecurityMiddleware.instance;
  }

  // ===== MAIN MIDDLEWARE FUNCTION =====

  async processRequest(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now();
    const context = this.createSecurityContext(request);

    try {
      // 1. IP Blocking Check
      if (this.config.enableIPBlocking) {
        const ipBlocked = await this.checkIPBlocking(context);
        if (ipBlocked) {
          return this.createSecurityResponse('IP_BLOCKED', 403, context);
        }
      }

      // 2. User Lockout Check
      if (this.config.enableUserLockout && context.userId) {
        const userLocked = await this.checkUserLockout(context);
        if (userLocked) {
          return this.createSecurityResponse('USER_LOCKED', 423, context);
        }
      }

      // 3. Input Validation
      if (this.config.enableInputValidation) {
        const validationResult = await this.validateInput(request, context);
        if (!validationResult.isValid) {
          await this.auditService.logEvent({
            type: 'SECURITY_VIOLATION',
            severity: 'MEDIUM',
            userId: context.userId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            resource: context.route,
            action: 'INVALID_INPUT',
            details: {
              errors: validationResult.errors,
              method: context.method
            }
          });
          return this.createValidationErrorResponse(validationResult.errors, context);
        }
      }

      // 4. Two-Factor Authentication Check
      if (this.config.enableTwoFactorCheck && context.userId) {
        const twoFactorResult = await this.checkTwoFactorAuth(request, context);
        if (!twoFactorResult.isValid) {
          return this.createTwoFactorErrorResponse(twoFactorResult, context);
        }
      }

      // 5. Security Headers
      if (this.config.securityHeaders) {
        // Headers will be added to response
      }

      // 6. Execute Handler
      const response = await handler(request);

      // 7. Add Security Headers
      if (this.config.securityHeaders) {
        this.addSecurityHeaders(response);
      }

      // 8. Audit Success
      if (this.config.enableSecurityAudit) {
        await this.auditService.logEvent({
          type: 'API_ACCESS',
          severity: 'LOW',
          userId: context.userId,
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          resource: context.route,
          action: context.method,
          details: {
            statusCode: response.status,
            duration: Date.now() - startTime
          }
        });
      }

      return response;
    } catch (error) {
      // Log security error
      await this.auditService.logEvent({
        type: 'SYSTEM_ERROR',
        severity: 'HIGH',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        resource: context.route,
        action: 'MIDDLEWARE_ERROR',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }
      });

      this.logger.error('❌ Security middleware error', { error, context });
      return this.createSecurityResponse('INTERNAL_ERROR', 500, context);
    }
  }

  // ===== SECURITY CHECKS =====

  private async checkIPBlocking(context: SecurityContext): Promise<boolean> {
    return this.auditService.isIPBlocked(context.ipAddress);
  }

  private async checkUserLockout(context: SecurityContext): Promise<boolean> {
    if (!context.userId) return false;
    return this.auditService.isUserLocked(context.userId);
  }

  private async validateInput(
    request: NextRequest,
    context: SecurityContext
  ): Promise<{ isValid: boolean; errors: any[] }> {
    try {
      // Skip validation for certain routes
      if (this.config.skipValidation.includes(context.route)) {
        return { isValid: true, errors: [] };
      }

      // Get request body
      let body = {};
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          const text = await request.text();
          if (text) {
            body = JSON.parse(text);
          }
        } catch {
          // If body parsing fails, continue with empty body
        }
      }

      // Get query parameters
      const query = Object.fromEntries(request.nextUrl.searchParams.entries());

      // Combine all input data
      const inputData = { ...body, ...query };

      // Validate input
      const validationResult = await this.validationService.validateInput(
        inputData,
        this.config.validationRules
      );

      return {
        isValid: validationResult.isValid,
        errors: validationResult.errors
      };
    } catch (error) {
      this.logger.error('❌ Input validation failed', { error, context });
      return { isValid: false, errors: [{ message: 'Validation error' }] };
    }
  }

  private async checkTwoFactorAuth(
    request: NextRequest,
    context: SecurityContext
  ): Promise<{ isValid: boolean; requiresTwoFactor: boolean; error?: string }> {
    if (!context.userId) {
      return { isValid: true, requiresTwoFactor: false };
    }

    // Check if route requires 2FA
    const requiresTwoFactor = this.config.requireTwoFactor && Array.isArray(this.config.requireTwoFactor) 
      ? this.config.requireTwoFactor.some(route => context.route.startsWith(route))
      : false;

    if (!requiresTwoFactor) {
      return { isValid: true, requiresTwoFactor: false };
    }

    // Check if user has 2FA enabled
    const twoFactorStatus = this.twoFactorService.getTwoFactorStatus(context.userId);
    if (!twoFactorStatus.isEnabled) {
      return {
        isValid: false,
        requiresTwoFactor: true,
        error: 'Two-factor authentication is required for this action'
      };
    }

    // Check for 2FA token in request
    const twoFactorToken = request.headers.get('x-two-factor-token');
    if (!twoFactorToken) {
      return {
        isValid: false,
        requiresTwoFactor: true,
        error: 'Two-factor authentication token is required'
      };
    }

    // Verify 2FA token
    const verification = await this.twoFactorService.verifyTwoFactor(
      context.userId,
      twoFactorToken
    );

    if (!verification.isValid) {
      await this.auditService.logEvent({
        type: 'TWO_FACTOR_FAILED',
        severity: 'MEDIUM',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        resource: context.route,
        action: 'TWO_FACTOR_VERIFICATION',
        details: {
          error: verification.error,
          isBackupCode: verification.isBackupCode
        }
      });

      return {
        isValid: false,
        requiresTwoFactor: true,
        error: verification.error || 'Invalid two-factor authentication token'
      };
    }

    return { isValid: true, requiresTwoFactor: true };
  }

  // ===== RESPONSE CREATION =====

  private createSecurityContext(request: NextRequest): SecurityContext {
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const userId = request.headers.get('x-user-id') || undefined;
    const sessionId = request.headers.get('x-session-id') || undefined;

    return {
      userId,
      sessionId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      route: request.nextUrl.pathname,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    };
  }

  private createSecurityResponse(
    reason: string,
    status: number,
    context: SecurityContext
  ): NextResponse {
    const response = NextResponse.json(
      {
        success: false,
        error: reason,
        message: this.getSecurityMessage(reason),
        timestamp: new Date().toISOString()
      },
      { status }
    );

    this.addSecurityHeaders(response);
    return response;
  }

  private createValidationErrorResponse(
    errors: any[],
    context: SecurityContext
  ): NextResponse {
    const response = NextResponse.json(
      {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        errors,
        timestamp: new Date().toISOString()
      },
      { status: 400 }
    );

    this.addSecurityHeaders(response);
    return response;
  }

  private createTwoFactorErrorResponse(
    twoFactorResult: any,
    context: SecurityContext
  ): NextResponse {
    const response = NextResponse.json(
      {
        success: false,
        error: 'TWO_FACTOR_REQUIRED',
        message: twoFactorResult.error || 'Two-factor authentication required',
        requiresTwoFactor: twoFactorResult.requiresTwoFactor,
        timestamp: new Date().toISOString()
      },
      { status: 403 }
    );

    this.addSecurityHeaders(response);
    return response;
  }

  // ===== SECURITY HEADERS =====

  private addSecurityHeaders(response: NextResponse): void {
    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    
    response.headers.set('Content-Security-Policy', csp);
    
    // HSTS (only for HTTPS)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  }

  // ===== UTILITY METHODS =====

  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwarded) return forwarded.split(',')[0].trim();
    
    return '127.0.0.1';
  }

  private getSecurityMessage(reason: string): string {
    const messages: Record<string, string> = {
      'IP_BLOCKED': 'Your IP address has been blocked due to suspicious activity',
      'USER_LOCKED': 'Your account has been temporarily locked',
      'TWO_FACTOR_REQUIRED': 'Two-factor authentication is required',
      'VALIDATION_ERROR': 'Input validation failed',
      'INTERNAL_ERROR': 'An internal error occurred'
    };
    
    return messages[reason] || 'Security check failed';
  }

  // ===== CONFIGURATION =====

  updateConfig(newConfig: Partial<SecurityMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('🔧 Security middleware configuration updated');
  }

  addValidationRule(route: string, rules: any): void {
    this.config.validationRules[route] = rules;
  }

  addTwoFactorRoute(route: string): void {
    if (!this.config.requireTwoFactor.includes(route)) {
      this.config.requireTwoFactor.push(route);
    }
  }

  removeTwoFactorRoute(route: string): void {
    const index = this.config.requireTwoFactor.indexOf(route);
    if (index > -1) {
      this.config.requireTwoFactor.splice(index, 1);
    }
  }

  // ===== CLEANUP =====

  cleanup(): void {
    this.logger.info('🧹 Security middleware cleaned up');
  }
}
