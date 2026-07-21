// ===== TWO-FACTOR AUTHENTICATION SERVICE =====

import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { Logger } from '../logging/logger';

// ===== INTERFACES =====

export interface TOTPConfig {
  issuer: string;
  algorithm: 'sha1' | 'sha256' | 'sha512';
  digits: 6 | 8;
  period: number; // seconds
  window: number; // tolerance window
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface TwoFactorVerification {
  isValid: boolean;
  isBackupCode: boolean;
  remainingBackupCodes: number;
  error?: string;
}

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

export interface TwoFactorUser {
  userId: string;
  isEnabled: boolean;
  secret?: string;
  backupCodes: BackupCode[];
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ===== TWO-FACTOR AUTHENTICATION SERVICE =====

export class TwoFactorAuthService {
  private static instance: TwoFactorAuthService;
  private logger: Logger;
  private config: TOTPConfig;
  private users: Map<string, TwoFactorUser> = new Map();

  private constructor() {
    this.logger = new Logger('INFO', { context: 'TwoFactorAuthService' });
    
    this.config = {
      issuer: 'WB Slots',
      algorithm: 'sha256',
      digits: 6,
      period: 30,
      window: 1
    };
  }

  public static getInstance(): TwoFactorAuthService {
    if (!TwoFactorAuthService.instance) {
      TwoFactorAuthService.instance = new TwoFactorAuthService();
    }
    return TwoFactorAuthService.instance;
  }

  // ===== SETUP 2FA =====

  async setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
    try {
      this.logger.info(`🔐 Setting up 2FA for user: ${userId}`);

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.config.issuer} (${userId})`,
        issuer: this.config.issuer,
        length: 32
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes(10);

      // Create QR code URL
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Store user data
      const userData: TwoFactorUser = {
        userId,
        isEnabled: false, // Will be enabled after verification
        secret: secret.base32,
        backupCodes: backupCodes.map(code => ({
          code,
          used: false,
          createdAt: new Date()
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.users.set(userId, userData);

      this.logger.info(`✅ 2FA setup completed for user: ${userId}`);

      return {
        secret: secret.base32!,
        qrCodeUrl,
        backupCodes: backupCodes,
        manualEntryKey: secret.base32!
      };
    } catch (error) {
      this.logger.error('❌ Failed to setup 2FA', { error, userId });
      throw new Error('Failed to setup 2FA');
    }
  }

  // ===== VERIFICATION =====

  async verifyTwoFactor(userId: string, token: string): Promise<TwoFactorVerification> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return {
          isValid: false,
          isBackupCode: false,
          remainingBackupCodes: 0,
          error: '2FA not configured for user'
        };
      }

      // Check if 2FA is enabled
      if (!user.isEnabled) {
        return {
          isValid: false,
          isBackupCode: false,
          remainingBackupCodes: user.backupCodes.filter(code => !code.used).length,
          error: '2FA not enabled'
        };
      }

      // Check backup codes first
      const backupCodeResult = this.verifyBackupCode(user, token);
      if (backupCodeResult.isValid) {
        return {
          isValid: true,
          isBackupCode: true,
          remainingBackupCodes: user.backupCodes.filter(code => !code.used).length
        };
      }

      // Verify TOTP token
      const totpResult = this.verifyTOTPToken(user, token);
      if (totpResult.isValid) {
        user.lastUsed = new Date();
        user.updatedAt = new Date();
        return {
          isValid: true,
          isBackupCode: false,
          remainingBackupCodes: user.backupCodes.filter(code => !code.used).length
        };
      }

      return {
        isValid: false,
        isBackupCode: false,
        remainingBackupCodes: user.backupCodes.filter(code => !code.used).length,
        error: 'Invalid token'
      };
    } catch (error) {
      this.logger.error('❌ 2FA verification failed', { error, userId });
      return {
        isValid: false,
        isBackupCode: false,
        remainingBackupCodes: 0,
        error: 'Verification failed'
      };
    }
  }

  private verifyTOTPToken(user: TwoFactorUser, token: string): { isValid: boolean; error?: string } {
    try {
      if (!user.secret) {
        return { isValid: false, error: 'No secret configured' };
      }

      const verified = speakeasy.totp.verify({
        secret: user.secret,
        encoding: 'base32',
        token,
        window: this.config.window,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        step: this.config.period
      });

      return { isValid: verified };
    } catch (error) {
      return { isValid: false, error: 'TOTP verification failed' };
    }
  }

  private verifyBackupCode(user: TwoFactorUser, token: string): { isValid: boolean; error?: string } {
    const backupCode = user.backupCodes.find(code => 
      code.code === token && !code.used
    );

    if (!backupCode) {
      return { isValid: false, error: 'Invalid backup code' };
    }

    // Mark backup code as used
    backupCode.used = true;
    backupCode.usedAt = new Date();
    user.updatedAt = new Date();

    this.logger.info(`🔑 Backup code used for user: ${user.userId}`);
    return { isValid: true };
  }

  // ===== ENABLE/DISABLE 2FA =====

  async enableTwoFactor(userId: string, verificationToken: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify the token before enabling
      const verification = await this.verifyTwoFactor(userId, verificationToken);
      if (!verification.isValid) {
        throw new Error('Invalid verification token');
      }

      user.isEnabled = true;
      user.updatedAt = new Date();

      this.logger.info(`✅ 2FA enabled for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('❌ Failed to enable 2FA', { error, userId });
      return false;
    }
  }

  async disableTwoFactor(userId: string, verificationToken: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify the token before disabling
      const verification = await this.verifyTwoFactor(userId, verificationToken);
      if (!verification.isValid) {
        throw new Error('Invalid verification token');
      }

      user.isEnabled = false;
      user.updatedAt = new Date();

      this.logger.info(`❌ 2FA disabled for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('❌ Failed to disable 2FA', { error, userId });
      return false;
    }
  }

  // ===== BACKUP CODES =====

  async regenerateBackupCodes(userId: string, verificationToken: string): Promise<string[]> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify the token before regenerating
      const verification = await this.verifyTwoFactor(userId, verificationToken);
      if (!verification.isValid) {
        throw new Error('Invalid verification token');
      }

      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes(10);
      user.backupCodes = newBackupCodes.map(code => ({
        code,
        used: false,
        createdAt: new Date()
      }));
      user.updatedAt = new Date();

      this.logger.info(`🔄 Backup codes regenerated for user: ${userId}`);
      return newBackupCodes;
    } catch (error) {
      this.logger.error('❌ Failed to regenerate backup codes', { error, userId });
      throw error;
    }
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  // ===== USER MANAGEMENT =====

  isTwoFactorEnabled(userId: string): boolean {
    const user = this.users.get(userId);
    return user?.isEnabled || false;
  }

  getTwoFactorStatus(userId: string): {
    isEnabled: boolean;
    hasBackupCodes: boolean;
    remainingBackupCodes: number;
    lastUsed?: Date;
  } {
    const user = this.users.get(userId);
    if (!user) {
      return {
        isEnabled: false,
        hasBackupCodes: false,
        remainingBackupCodes: 0
      };
    }

    return {
      isEnabled: user.isEnabled,
      hasBackupCodes: user.backupCodes.length > 0,
      remainingBackupCodes: user.backupCodes.filter(code => !code.used).length,
      lastUsed: user.lastUsed
    };
  }

  // ===== SECURITY UTILITIES =====

  generateRecoveryCode(): string {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  async generateQRCode(secret: string, userId: string): Promise<string> {
    try {
      const otpauthUrl = speakeasy.otpauthURL({
        secret,
        label: `${this.config.issuer} (${userId})`,
        issuer: this.config.issuer,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period
      });

      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      this.logger.error('❌ Failed to generate QR code', { error });
      throw new Error('Failed to generate QR code');
    }
  }

  // ===== VALIDATION =====

  validateTokenFormat(token: string): { isValid: boolean; error?: string } {
    if (!token) {
      return { isValid: false, error: 'Token is required' };
    }

    if (this.config.digits === 6) {
      if (!/^\d{6}$/.test(token)) {
        return { isValid: false, error: 'Token must be 6 digits' };
      }
    } else if (this.config.digits === 8) {
      if (!/^\d{8}$/.test(token)) {
        return { isValid: false, error: 'Token must be 8 digits' };
      }
    }

    return { isValid: true };
  }

  validateBackupCodeFormat(code: string): { isValid: boolean; error?: string } {
    if (!code) {
      return { isValid: false, error: 'Backup code is required' };
    }

    if (!/^[A-F0-9]{8}$/.test(code)) {
      return { isValid: false, error: 'Backup code must be 8 hexadecimal characters' };
    }

    return { isValid: true };
  }

  // ===== AUDIT LOGGING =====

  logTwoFactorEvent(userId: string, event: string, details?: any): void {
    this.logger.info(`🔐 2FA Event: ${event}`, {
      userId,
      event,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // ===== CLEANUP =====

  cleanup(): void {
    this.users.clear();
    this.logger.info('🧹 Two-factor authentication service cleaned up');
  }
}
