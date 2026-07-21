import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, maskToken } from '@/lib/encryption';

describe('Encryption', () => {
  const testData = 'test-token-12345';
  const testKey = 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n';

  beforeEach(() => {
    // Устанавливаем тестовый ключ шифрования
    process.env.ENCRYPTION_KEY = testKey;
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', () => {
      const encrypted = encrypt(testData);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(testData);
      expect(encrypted.length).toBeGreaterThan(testData.length);
    });

    it('should produce different encrypted data for same input', () => {
      const encrypted1 = encrypt(testData);
      const encrypted2 = encrypt(testData);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const encrypted = encrypt('');
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe('');
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', () => {
      const encrypted = encrypt(testData);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(testData);
    });

    it('should handle null input', () => {
      const decrypted = decrypt(null);
      
      expect(decrypted).toBe('');
    });

    it('should handle undefined input', () => {
      const decrypted = decrypt(undefined);
      
      expect(decrypted).toBe('');
    });

    it('should handle empty string', () => {
      const decrypted = decrypt('');
      
      expect(decrypted).toBe('');
    });

    it('should handle plain text tokens', () => {
      const plainToken = 'plain-token-123';
      const decrypted = decrypt(plainToken);
      
      expect(decrypted).toBe(plainToken);
    });

    it('should handle short tokens as plain text', () => {
      const shortToken = 'short';
      const decrypted = decrypt(shortToken);
      
      expect(decrypted).toBe(shortToken);
    });

    it('should handle invalid base64 gracefully', () => {
      const invalidBase64 = 'invalid-base64-data!@#';
      
      expect(() => decrypt(invalidBase64)).not.toThrow();
      const result = decrypt(invalidBase64);
      expect(result).toBe(invalidBase64);
    });
  });

  describe('maskToken', () => {
    it('should mask long tokens', () => {
      const longToken = 'very-long-token-123456789';
      const masked = maskToken(longToken);
      
      expect(masked).toMatch(/^.{4}\*+.{4}$/);
      expect(masked.length).toBe(longToken.length);
    });

    it('should mask short tokens completely', () => {
      const shortToken = 'short';
      const masked = maskToken(shortToken);
      
      expect(masked).toBe('*****');
    });

    it('should handle very short tokens', () => {
      const veryShortToken = 'ab';
      const masked = maskToken(veryShortToken);
      
      expect(masked).toBe('**');
    });

    it('should handle single character tokens', () => {
      const singleChar = 'a';
      const masked = maskToken(singleChar);
      
      expect(masked).toBe('*');
    });
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('should work with various data types', () => {
      const testCases = [
        'simple-token',
        'token-with-special-chars!@#$%^&*()',
        'token-with-unicode-привет-мир',
        'token-with-numbers-123456789',
        'very-long-token-' + 'a'.repeat(1000),
      ];

      testCases.forEach(testCase => {
        const encrypted = encrypt(testCase);
        const decrypted = decrypt(encrypted);
        
        expect(decrypted).toBe(testCase);
      });
    });
  });
});
