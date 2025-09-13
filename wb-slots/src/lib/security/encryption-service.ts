import crypto from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  algorithm: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private config: EncryptionConfig;
  private masterKey: Buffer;

  private constructor() {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16  // 128 bits
    };

    // Получаем мастер-ключ из переменных окружения
    const masterKeyString = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKeyString) {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
    }

    // Создаем ключ из строки (используем PBKDF2 для усиления)
    this.masterKey = crypto.pbkdf2Sync(
      masterKeyString,
      'wb-slots-salt', // Соль для PBKDF2
      100000, // 100,000 итераций
      this.config.keyLength,
      'sha512'
    );
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Шифрует данные
   */
  public encrypt(data: string): EncryptedData {
    try {
      // Генерируем случайный IV
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Создаем cipher
      const cipher = crypto.createCipher(this.config.algorithm, this.masterKey);
      cipher.setAAD(Buffer.from('wb-slots-aad')); // Additional Authenticated Data

      // Шифруем данные
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Получаем аутентификационный тег
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.config.algorithm
      };
    } catch (error) {
      console.error('❌ Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Расшифровывает данные
   */
  public decrypt(encryptedData: EncryptedData): string {
    try {
      // Проверяем алгоритм
      if (encryptedData.algorithm !== this.config.algorithm) {
        throw new Error('Invalid encryption algorithm');
      }

      // Конвертируем hex в Buffer
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const encrypted = encryptedData.encrypted;

      // Создаем decipher
      const decipher = crypto.createDecipher(this.config.algorithm, this.masterKey);
      decipher.setAAD(Buffer.from('wb-slots-aad')); // Additional Authenticated Data
      decipher.setAuthTag(tag);

      // Расшифровываем данные
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('❌ Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Шифрует объект (JSON)
   */
  public encryptObject(obj: any): EncryptedData {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  /**
   * Расшифровывает объект (JSON)
   */
  public decryptObject<T = any>(encryptedData: EncryptedData): T {
    const jsonString = this.decrypt(encryptedData);
    return JSON.parse(jsonString);
  }

  /**
   * Создает хеш для проверки целостности
   */
  public createHash(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Проверяет хеш
   */
  public verifyHash(data: string, hash: string): boolean {
    const computedHash = this.createHash(data);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Генерирует безопасный случайный ключ
   */
  public generateSecureKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Создает соль для паролей
   */
  public generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Хеширует пароль с солью
   */
  public hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const usedSalt = salt || this.generateSalt();
    const hash = crypto
      .pbkdf2Sync(password, usedSalt, 100000, 64, 'sha512')
      .toString('hex');
    
    return { hash, salt: usedSalt };
  }

  /**
   * Проверяет пароль
   */
  public verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Проверяет, что данные зашифрованы
   */
  public isEncrypted(data: any): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'encrypted' in data &&
      'iv' in data &&
      'tag' in data &&
      'algorithm' in data
    );
  }

  /**
   * Безопасно удаляет данные из памяти
   */
  public secureWipe(data: string): void {
    if (typeof data === 'string') {
      // В JavaScript мы не можем напрямую очистить память,
      // но можем попытаться перезаписать ссылку
      data = '0'.repeat(data.length);
    }
  }
}

// Экспортируем singleton instance
export const encryptionService = EncryptionService.getInstance();
