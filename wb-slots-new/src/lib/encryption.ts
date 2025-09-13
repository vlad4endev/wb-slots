import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n';
  
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

export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new EncryptionError(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function maskToken(token: string): string {
  if (token.length <= 8) {
    return '*'.repeat(token.length);
  }
  return token.substring(0, 4) + '*'.repeat(token.length - 8) + token.substring(token.length - 4);
}
