// ===== IMPROVED ENCRYPTION SYSTEM =====

import crypto from 'crypto';

// ===== TYPES =====

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
  algorithm: string;
  timestamp: number;
}

export interface DecryptionResult {
  decrypted: string;
  isValid: boolean;
  error?: string;
}

// ===== CONSTANTS =====

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// ===== ERROR CLASSES =====

export class EncryptionError extends Error {
  constructor(message: string, public code: string = 'ENCRYPTION_ERROR') {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string, public code: string = 'DECRYPTION_ERROR') {
    super(message);
    this.name = 'DecryptionError';
  }
}

// ===== MAIN CLASS =====

export class ImprovedEncryption {
  private static instance: ImprovedEncryption;
  private masterKey: Buffer;

  private constructor() {
    this.masterKey = this.getOrCreateMasterKey();
  }

  public static getInstance(): ImprovedEncryption {
    if (!ImprovedEncryption.instance) {
      ImprovedEncryption.instance = new ImprovedEncryption();
    }
    return ImprovedEncryption.instance;
  }

  /**
   * Получение или создание мастер-ключа
   */
  private getOrCreateMasterKey(): Buffer {
    const keyString = process.env.ENCRYPTION_KEY || this.generateKey();
    
    try {
      // Если ключ в base64, декодируем
      if (keyString.length === 44 && keyString.endsWith('=')) {
        return Buffer.from(keyString, 'base64');
      }
      
      // Если ключ не в base64, создаем хеш
      return crypto.createHash('sha256').update(keyString).digest();
    } catch (error) {
      throw new EncryptionError('Invalid encryption key format');
    }
  }

  /**
   * Генерация нового ключа
   */
  private generateKey(): string {
    const key = crypto.randomBytes(KEY_LENGTH);
    return key.toString('base64');
  }

  /**
   * Шифрование данных
   */
  public encrypt(data: string): EncryptionResult {
    try {
      if (!data || typeof data !== 'string') {
        throw new EncryptionError('Invalid data for encryption');
      }

      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
      
      // Добавляем AAD для дополнительной безопасности
      cipher.setAAD(Buffer.from('wb-slots-aad', 'utf8'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: ALGORITHM,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new EncryptionError(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Расшифровка данных
   */
  public decrypt(encryptionResult: EncryptionResult): DecryptionResult {
    try {
      if (!encryptionResult || typeof encryptionResult !== 'object') {
        return {
          decrypted: '',
          isValid: false,
          error: 'Invalid encryption result format'
        };
      }

      const { encrypted, iv, tag, algorithm } = encryptionResult;

      if (!encrypted || !iv || !tag) {
        return {
          decrypted: '',
          isValid: false,
          error: 'Missing required encryption components'
        };
      }

      if (algorithm !== ALGORITHM) {
        return {
          decrypted: '',
          isValid: false,
          error: 'Unsupported encryption algorithm'
        };
      }

      const ivBuffer = Buffer.from(iv, 'hex');
      const tagBuffer = Buffer.from(tag, 'hex');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, ivBuffer);
      decipher.setAAD(Buffer.from('wb-slots-aad', 'utf8'));
      decipher.setAuthTag(tagBuffer);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        decrypted,
        isValid: true
      };
    } catch (error) {
      return {
        decrypted: '',
        isValid: false,
        error: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Шифрование с автоматическим форматированием
   */
  public encryptString(data: string): string {
    const result = this.encrypt(data);
    return this.formatEncryptionResult(result);
  }

  /**
   * Расшифровка с автоматическим парсингом
   */
  public decryptString(encryptedData: string | null | undefined): string {
    if (!encryptedData) {
      return '';
    }

    // Проверяем, является ли это уже расшифрованным текстом
    if (this.isPlainText(encryptedData)) {
      return encryptedData;
    }

    try {
      const encryptionResult = this.parseEncryptionResult(encryptedData);
      const result = this.decrypt(encryptionResult);
      
      if (!result.isValid) {
        console.warn('Decryption failed, returning original data:', result.error);
        return encryptedData;
      }
      
      return result.decrypted;
    } catch (error) {
      console.warn('Failed to parse encryption result, returning original data:', error);
      return encryptedData;
    }
  }

  /**
   * Проверка, является ли строка обычным текстом
   */
  private isPlainText(data: string): boolean {
    // Если строка короткая и не содержит base64 символов
    if (data.length < 50 && !data.includes('=') && !data.includes('/') && !data.includes('+')) {
      return true;
    }
    
    // Если строка не содержит JSON структуру
    if (!data.includes('"encrypted"') && !data.includes('"iv"') && !data.includes('"tag"')) {
      return true;
    }
    
    return false;
  }

  /**
   * Форматирование результата шифрования в строку
   */
  private formatEncryptionResult(result: EncryptionResult): string {
    return JSON.stringify(result);
  }

  /**
   * Парсинг строки в результат шифрования
   */
  private parseEncryptionResult(data: string): EncryptionResult {
    try {
      const parsed = JSON.parse(data);
      
      if (!parsed.encrypted || !parsed.iv || !parsed.tag) {
        throw new Error('Invalid encryption result structure');
      }
      
      return parsed;
    } catch (error) {
      throw new DecryptionError('Failed to parse encryption result');
    }
  }

  /**
   * Шифрование объекта
   */
  public encryptObject(obj: any): string {
    const jsonString = JSON.stringify(obj);
    return this.encryptString(jsonString);
  }

  /**
   * Расшифровка объекта
   */
  public decryptObject<T = any>(encryptedData: string | null | undefined): T | null {
    try {
      const decryptedString = this.decryptString(encryptedData);
      if (!decryptedString) {
        return null;
      }
      return JSON.parse(decryptedString);
    } catch (error) {
      console.warn('Failed to decrypt object:', error);
      return null;
    }
  }

  /**
   * Валидация зашифрованных данных
   */
  public validateEncryptedData(encryptedData: string): boolean {
    try {
      const result = this.parseEncryptionResult(encryptedData);
      return !!(result.encrypted && result.iv && result.tag && result.algorithm);
    } catch {
      return false;
    }
  }

  /**
   * Генерация нового ключа (для настройки)
   */
  public static generateNewKey(): string {
    const key = crypto.randomBytes(KEY_LENGTH);
    return key.toString('base64');
  }

  /**
   * Маскирование токена для логирования
   */
  public static maskToken(token: string): string {
    if (!token || token.length <= 8) {
      return '*'.repeat(token.length || 8);
    }
    return token.substring(0, 4) + '*'.repeat(token.length - 8) + token.substring(token.length - 4);
  }
}

// ===== CONVENIENCE FUNCTIONS =====

const encryption = ImprovedEncryption.getInstance();

/**
 * Шифрование строки (обратная совместимость)
 */
export function encrypt(data: string): string {
  return encryption.encryptString(data);
}

/**
 * Расшифровка строки (обратная совместимость)
 */
export function decrypt(encryptedData: string | null | undefined): string {
  return encryption.decryptString(encryptedData);
}

/**
 * Шифрование объекта
 */
export function encryptObject(obj: any): string {
  return encryption.encryptObject(obj);
}

/**
 * Расшифровка объекта
 */
export function decryptObject<T = any>(encryptedData: string | null | undefined): T | null {
  return encryption.decryptObject<T>(encryptedData);
}

/**
 * Маскирование токена
 */
export function maskToken(token: string): string {
  return ImprovedEncryption.maskToken(token);
}

/**
 * Генерация нового ключа
 */
export function generateKey(): string {
  return ImprovedEncryption.generateNewKey();
}

// ===== EXPORTS =====

export default encryption;
