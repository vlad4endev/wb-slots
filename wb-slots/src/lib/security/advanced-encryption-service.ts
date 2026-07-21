// ===== ADVANCED ENCRYPTION SERVICE =====

import * as crypto from 'crypto';
import { Logger } from '../logging/logger';

// ===== INTERFACES =====

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
  iterations: number;
  keyDerivationAlgorithm: string;
  enableKeyRotation: boolean;
  keyRotationInterval: number; // in milliseconds
  enableKeyStrengthValidation: boolean;
  minKeyStrength: number; // bits
}

export interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  salt: string;
  algorithm: string;
  keyId: string;
  timestamp: number;
  version: string;
}

export interface KeyInfo {
  id: string;
  version: number;
  createdAt: number;
  expiresAt?: number;
  isActive: boolean;
  strength: number; // bits
  algorithm: string;
}

export interface KeyRotationResult {
  success: boolean;
  oldKeyId: string;
  newKeyId: string;
  reencryptedCount: number;
  errors: string[];
}

// ===== ADVANCED ENCRYPTION SERVICE =====

export class AdvancedEncryptionService {
  private static instance: AdvancedEncryptionService;
  private logger: Logger;
  private config: EncryptionConfig;
  private keys: Map<string, Buffer> = new Map();
  private keyInfo: Map<string, KeyInfo> = new Map();
  private currentKeyId: string = '';
  private keyRotationTimer?: NodeJS.Timeout;

  private constructor() {
    this.logger = new Logger('INFO', { context: 'AdvancedEncryptionService' });
    
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16, // 128 bits
      saltLength: 32, // 256 bits
      iterations: 100000, // PBKDF2 iterations
      keyDerivationAlgorithm: 'sha512',
      enableKeyRotation: true,
      keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      enableKeyStrengthValidation: true,
      minKeyStrength: 256 // 256 bits minimum
    };

    this.initializeKeys();
    this.startKeyRotation();
  }

  public static getInstance(): AdvancedEncryptionService {
    if (!AdvancedEncryptionService.instance) {
      AdvancedEncryptionService.instance = new AdvancedEncryptionService();
    }
    return AdvancedEncryptionService.instance;
  }

  // ===== KEY MANAGEMENT =====

  private initializeKeys(): void {
    try {
      // Get master key from environment
      const masterKeyString = process.env.ENCRYPTION_MASTER_KEY;
      if (!masterKeyString) {
        throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
      }

      // Validate key strength
      if (this.config.enableKeyStrengthValidation) {
        const keyStrength = this.calculateKeyStrength(masterKeyString);
        if (keyStrength < this.config.minKeyStrength) {
          throw new Error(`Master key strength (${keyStrength} bits) is below minimum requirement (${this.config.minKeyStrength} bits)`);
        }
        this.logger.info(`🔐 Master key strength: ${keyStrength} bits`);
      }

      // Generate initial key
      const keyId = this.generateKeyId();
      const key = this.deriveKey(masterKeyString, keyId);
      
      this.keys.set(keyId, key);
      this.keyInfo.set(keyId, {
        id: keyId,
        version: 1,
        createdAt: Date.now(),
        isActive: true,
        strength: this.calculateKeyStrength(masterKeyString),
        algorithm: this.config.algorithm
      });

      this.currentKeyId = keyId;
      this.logger.info(`🔑 Initial encryption key created: ${keyId}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize encryption keys', { error });
      throw error;
    }
  }

  private deriveKey(masterKey: string, keyId: string): Buffer {
    const salt = crypto.randomBytes(this.config.saltLength);
    const key = crypto.pbkdf2Sync(
      masterKey,
      salt,
      this.config.iterations,
      this.config.keyLength,
      this.config.keyDerivationAlgorithm
    );
    return key;
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private calculateKeyStrength(key: string): number {
    // Calculate entropy-based key strength
    const entropy = this.calculateEntropy(key);
    return Math.floor(entropy * 8); // Convert to bits
  }

  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  // ===== KEY ROTATION =====

  private startKeyRotation(): void {
    if (!this.config.enableKeyRotation) {
      return;
    }

    this.keyRotationTimer = setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        this.logger.error('❌ Key rotation failed', { error });
      }
    }, this.config.keyRotationInterval);

    this.logger.info(`🔄 Key rotation scheduled every ${this.config.keyRotationInterval / (24 * 60 * 60 * 1000)} days`);
  }

  async rotateKeys(): Promise<KeyRotationResult> {
    this.logger.info('🔄 Starting key rotation');
    
    const result: KeyRotationResult = {
      success: false,
      oldKeyId: this.currentKeyId,
      newKeyId: '',
      reencryptedCount: 0,
      errors: []
    };

    try {
      // Generate new key
      const newKeyId = this.generateKeyId();
      const masterKeyString = process.env.ENCRYPTION_MASTER_KEY!;
      const newKey = this.deriveKey(masterKeyString, newKeyId);

      // Store new key
      this.keys.set(newKeyId, newKey);
      this.keyInfo.set(newKeyId, {
        id: newKeyId,
        version: (this.keyInfo.get(this.currentKeyId)?.version || 0) + 1,
        createdAt: Date.now(),
        isActive: true,
        strength: this.calculateKeyStrength(masterKeyString),
        algorithm: this.config.algorithm
      });

      // Mark old key as inactive
      const oldKeyInfo = this.keyInfo.get(this.currentKeyId);
      if (oldKeyInfo) {
        oldKeyInfo.isActive = false;
        oldKeyInfo.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days grace period
      }

      result.newKeyId = newKeyId;
      this.currentKeyId = newKeyId;

      // In a real implementation, you would re-encrypt all data here
      // For now, we'll just log the rotation
      this.logger.info(`✅ Key rotation completed: ${result.oldKeyId} -> ${result.newKeyId}`);

      result.success = true;
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.logger.error('❌ Key rotation failed', { error });
      return result;
    }
  }

  // ===== ENCRYPTION/DECRYPTION =====

  async encrypt(data: string, keyId?: string): Promise<EncryptedData> {
    try {
      const activeKeyId = keyId || this.currentKeyId;
      const key = this.keys.get(activeKeyId);
      
      if (!key) {
        throw new Error(`Encryption key not found: ${activeKeyId}`);
      }

      const iv = crypto.randomBytes(this.config.ivLength);
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
      
      // Set additional authenticated data
      (cipher as any).setAAD(Buffer.from('wb-slots-aad', 'utf8'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = (cipher as any).getAuthTag();
      const salt = crypto.randomBytes(this.config.saltLength);

      const result: EncryptedData = {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex'),
        algorithm: this.config.algorithm,
        keyId: activeKeyId,
        timestamp: Date.now(),
        version: '2.0.0'
      };

      this.logger.debug('🔐 Data encrypted successfully', { keyId: activeKeyId, dataLength: data.length });
      return result;
    } catch (error) {
      this.logger.error('❌ Encryption failed', { error });
      throw new Error('Encryption failed');
    }
  }

  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      const key = this.keys.get(encryptedData.keyId);
      
      if (!key) {
        throw new Error(`Decryption key not found: ${encryptedData.keyId}`);
      }

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
      
      // Set additional authenticated data
      (decipher as any).setAAD(Buffer.from('wb-slots-aad', 'utf8'));
      (decipher as any).setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('🔓 Data decrypted successfully', { keyId: encryptedData.keyId });
      return decrypted;
    } catch (error) {
      this.logger.error('❌ Decryption failed', { error, keyId: encryptedData.keyId });
      throw new Error('Decryption failed');
    }
  }

  // ===== LEGACY SUPPORT =====

  async decryptLegacy(encryptedText: string): Promise<string> {
    try {
      // Support for legacy encrypted data format
      if (!encryptedText.startsWith('hex:')) {
        throw new Error('Invalid legacy encrypted data format');
      }

      const combined = Buffer.from(encryptedText.slice(4), 'hex');
      const iv = combined.subarray(0, this.config.ivLength);
      const tag = combined.subarray(this.config.ivLength, this.config.ivLength + this.config.tagLength);
      const encrypted = combined.subarray(this.config.ivLength + this.config.tagLength);

      // Try to decrypt with current key
      const key = this.keys.get(this.currentKeyId);
      if (!key) {
        throw new Error('Current decryption key not found');
      }

      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
      (decipher as any).setAAD(Buffer.from('wb-slots-aad', 'utf8'));
      (decipher as any).setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('🔓 Legacy data decrypted successfully');
      return decrypted;
    } catch (error) {
      this.logger.error('❌ Legacy decryption failed', { error });
      throw new Error('Legacy decryption failed');
    }
  }

  // ===== KEY MANAGEMENT API =====

  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  getKeyInfo(keyId: string): KeyInfo | undefined {
    return this.keyInfo.get(keyId);
  }

  getAllKeys(): KeyInfo[] {
    return Array.from(this.keyInfo.values());
  }

  getActiveKeys(): KeyInfo[] {
    return Array.from(this.keyInfo.values()).filter(key => key.isActive);
  }

  async validateKeyStrength(key: string): Promise<{ isValid: boolean; strength: number; message: string }> {
    const strength = this.calculateKeyStrength(key);
    const isValid = strength >= this.config.minKeyStrength;
    
    return {
      isValid,
      strength,
      message: isValid 
        ? `Key strength is adequate (${strength} bits)`
        : `Key strength is insufficient (${strength} bits, minimum ${this.config.minKeyStrength} bits)`
    };
  }

  // ===== SECURITY UTILITIES =====

  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  async hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const actualSalt = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
    
    return { hash, salt: actualSalt };
  }

  async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const { hash: computedHash } = await this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  // ===== CLEANUP =====

  cleanup(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      this.keyRotationTimer = undefined;
    }
    
    // Clear sensitive data
    this.keys.clear();
    this.keyInfo.clear();
    
    this.logger.info('🧹 Advanced encryption service cleaned up');
  }
}
