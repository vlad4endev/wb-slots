// ===== SECURITY MODULE EXPORTS =====

// Core security services
export { AdvancedEncryptionService } from './advanced-encryption-service';
export { TwoFactorAuthService } from './two-factor-auth-service';
export { SecurityAuditService } from './security-audit-service';
export { AdvancedInputValidationService } from './advanced-input-validation-service';
export { SecurityMiddleware } from './security-middleware';

// Existing security services
export { EncryptionService } from './encryption-service';
export { RateLimitService } from './rate-limit-service';
export { CaptchaService } from './captcha-service';
export { ApiKeysService } from './api-keys-service';

// Types and interfaces
export type {
  EncryptionConfig,
  EncryptedData,
  KeyInfo,
  KeyRotationResult
} from './advanced-encryption-service';

export type {
  TOTPConfig,
  TwoFactorSetup,
  TwoFactorVerification,
  BackupCode,
  TwoFactorUser
} from './two-factor-auth-service';

export type {
  SecurityEvent,
  SecurityAlert,
  SecurityMetrics,
  SecurityConfig,
  SecurityEventType,
  SecurityAlertType,
  SecuritySeverity
} from './security-audit-service';

export type {
  ValidationRule,
  ValidationResult,
  ValidationError,
  SecurityValidationConfig,
  ValidationType
} from './advanced-input-validation-service';

export type {
  SecurityMiddlewareConfig,
  SecurityContext
} from './security-middleware';

// Factory functions
export function createSecurityServices() {
  const { AdvancedEncryptionService } = require('./advanced-encryption-service');
  const { TwoFactorAuthService } = require('./two-factor-auth-service');
  const { SecurityAuditService } = require('./security-audit-service');
  const { AdvancedInputValidationService } = require('./advanced-input-validation-service');
  const { SecurityMiddleware } = require('./security-middleware');
  
  return {
    encryption: AdvancedEncryptionService.getInstance(),
    twoFactor: TwoFactorAuthService.getInstance(),
    audit: SecurityAuditService.getInstance(),
    validation: AdvancedInputValidationService.getInstance(),
    middleware: SecurityMiddleware.getInstance()
  };
}

// Security utilities
export function generateSecureToken(length: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const crypto = require('crypto');
  const actualSalt = salt || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const crypto = require('crypto');
  const { hash: computedHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
}
