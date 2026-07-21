import crypto from 'crypto';
import { requireEnv } from './env';
import { logger } from './logging';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

function getEncryptionKey(): Buffer {
  // В production требуется обязательное наличие ENCRYPTION_KEY
  // В development используется fallback значение с предупреждением
  const key = requireEnv(
    'ENCRYPTION_KEY',
    'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n' // base64 тестовый ключ только для development
  );
  
  try {
    const keyBuffer = Buffer.from(key, 'base64');
    // Для AES-256-CBC нужен ключ длиной 32 байта
    if (keyBuffer.length !== 32) {
      // Если ключ не 32 байта, создаем хеш
      return crypto.createHash('sha256').update(keyBuffer).digest();
    }
    return keyBuffer;
  } catch (error) {
    throw new EncryptionError('Invalid ENCRYPTION_KEY format');
  }
}

export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine iv + encrypted data
    const combined = Buffer.concat([
      iv,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    throw new EncryptionError(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function decrypt(encryptedData: string | null | undefined): string {
  try {
    // Проверяем на null/undefined
    if (!encryptedData) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Decrypt received null/undefined, returning empty string');
      }
      return '';
    }

    // Логируем начало расшифровки только в development
    if (process.env.NODE_ENV === 'development') {
      logger.debug({ dataLength: encryptedData.length }, 'Starting token decryption');
    }
    
    // Проверяем, не является ли это уже расшифрованным токеном
    // Если токен содержит только обычные символы и не является base64, 
    // то это скорее всего уже расшифрованный токен
    if (encryptedData.length < 50 && !encryptedData.includes('=') && !encryptedData.includes('/') && !encryptedData.includes('+')) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Token appears to be plain text, returning as-is');
      }
      return encryptedData;
    }
    
    const key = getEncryptionKey();
    
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Проверяем минимальную длину
    if (combined.length < IV_LENGTH) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug({ combinedLength: combined.length }, 'Data too short for encrypted token, returning as plain text');
      }
      return encryptedData;
    }
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug({ decryptedLength: decrypted.length }, 'Token decrypted successfully');
    }
    
    return decrypted;
  } catch (error) {
    // Ошибки расшифровки логируем всегда как ERROR
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      encryptedDataLength: encryptedData?.length || 0,
      encryptedDataPreview: encryptedData?.substring(0, 50) || 'undefined'
    }, 'Token decryption failed');
    
    // Если расшифровка не удалась, возможно это plain text токен
    // Логируем предупреждение и возвращаем как есть
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Attempting to return as plain text token');
    }
    return encryptedData || '';
  }
}

export function maskToken(token: string): string {
  if (token.length <= 8) {
    return '*'.repeat(token.length);
  }
  return token.substring(0, 4) + '*'.repeat(token.length - 8) + token.substring(token.length - 4);
}
