/**
 * Валидация переменных окружения при старте приложения
 * Проверяет наличие всех критичных переменных для production
 */

import { requireEnv, EnvError } from '../env';
import { logger } from '../logging';

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface EnvRule {
  key: string;
  required: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

const ENV_RULES: EnvRule[] = [
  {
    key: 'DATABASE_URL',
    required: true,
    validator: (value) => value.startsWith('postgresql://'),
    errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
  },
  {
    key: 'REDIS_URL',
    required: true,
    validator: (value) => value.startsWith('redis://'),
    errorMessage: 'REDIS_URL must be a valid Redis connection string',
  },
  {
    key: 'JWT_SECRET',
    required: true,
    validator: (value) => value.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters long',
  },
  {
    key: 'ENCRYPTION_KEY',
    required: true,
    validator: (value) => {
      try {
        const keyBuffer = Buffer.from(value, 'base64');
        return keyBuffer.length === 32;
      } catch {
        return false;
      }
    },
    errorMessage: 'ENCRYPTION_KEY must be a valid 32-byte base64 string',
  },
  {
    key: 'APP_BASE_URL',
    required: false,
    validator: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    errorMessage: 'APP_BASE_URL must be a valid URL',
  },
  {
    key: 'CORS_ORIGIN',
    required: false,
    validator: (value) => {
      if (value === '*') return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    errorMessage: 'CORS_ORIGIN must be a valid URL or "*"',
  },
];

/**
 * Валидация всех переменных окружения
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key];

    if (!value) {
      if (rule.required) {
        if (isProduction) {
          errors.push(`Required environment variable ${rule.key} is not set`);
        } else {
          warnings.push(`Required environment variable ${rule.key} is not set (using fallback in development)`);
        }
      }
      continue;
    }

    if (rule.validator && !rule.validator(value)) {
      const message = rule.errorMessage || `Invalid value for ${rule.key}`;
      if (isProduction) {
        errors.push(message);
      } else {
        warnings.push(`${message} (warning in development)`);
      }
    }
  }

  // Дополнительные проверки для production
  if (isProduction) {
    // Проверка на использование тестовых значений
    const jwtSecret = process.env.JWT_SECRET || '';
    if (jwtSecret.includes('dev') || jwtSecret.includes('test') || jwtSecret.length < 32) {
      errors.push('JWT_SECRET appears to be a test/development value. Use a strong secret in production.');
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || '';
    if (encryptionKey.includes('test') || encryptionKey.includes('dev')) {
      errors.push('ENCRYPTION_KEY appears to be a test/development value. Use a secure key in production.');
    }

    // Проверка CORS
    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin || corsOrigin === '*') {
      warnings.push('CORS_ORIGIN is set to "*" or not set. This is insecure for production.');
    }
  }

  const isValid = errors.length === 0;

  if (errors.length > 0 || warnings.length > 0) {
    logger.warn('Environment validation result', {
      isValid,
      errors,
      warnings,
      isProduction,
    });
  }

  return {
    isValid,
    errors,
    warnings,
  };
}

/**
 * Проверка и валидация при старте приложения
 * Выбрасывает ошибку если в production есть критические проблемы
 */
export function ensureEnvironmentValid(): void {
  const result = validateEnvironment();
  const isProduction = process.env.NODE_ENV === 'production';

  if (result.errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${result.errors.join('\n')}`;
    logger.error(errorMessage);

    if (isProduction) {
      throw new EnvError(errorMessage);
    } else {
      logger.warn('Environment validation errors found, but continuing in development mode');
    }
  }

  if (result.warnings.length > 0) {
    logger.warn(`Environment validation warnings:\n${result.warnings.join('\n')}`);
  }

  if (result.isValid) {
    logger.info('Environment validation passed');
  }
}

