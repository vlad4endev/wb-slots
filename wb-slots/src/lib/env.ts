/**
 * Утилиты для работы с переменными окружения
 * Обеспечивает безопасную валидацию обязательных переменных окружения
 */

export class EnvError extends Error {
  constructor(key: string) {
    super(`Required environment variable ${key} is not set`);
    this.name = 'EnvError';
  }
}

/**
 * Получает значение переменной окружения
 * В production выбрасывает ошибку, если переменная не установлена
 * В development возвращает fallback значение с предупреждением
 * 
 * @param key - имя переменной окружения
 * @param fallback - значение по умолчанию (используется только в development)
 * @returns значение переменной окружения
 * @throws {EnvError} если переменная не установлена в production
 */
export function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new EnvError(key);
    }
    
    // В development используем fallback с предупреждением
    if (fallback) {
      console.warn(
        `⚠️  Environment variable ${key} is not set. Using fallback value. ` +
        `This should be set before deploying to production.`
      );
      return fallback;
    }
    
    throw new EnvError(key);
  }
  
  return value;
}

/**
 * Получает значение переменной окружения с типизацией
 * Преобразует строковое значение в число
 * 
 * @param key - имя переменной окружения
 * @param fallback - значение по умолчанию
 * @returns число или fallback
 */
export function requireEnvNumber(key: string, fallback?: number): number {
  const value = process.env[key];
  
  if (!value) {
    if (fallback !== undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️  Environment variable ${key} is not set. Using fallback: ${fallback}`);
      }
      return fallback;
    }
    throw new EnvError(key);
  }
  
  const numValue = parseInt(value, 10);
  if (isNaN(numValue)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  
  return numValue;
}

/**
 * Получает значение переменной окружения как boolean
 * 
 * @param key - имя переменной окружения
 * @param fallback - значение по умолчанию
 * @returns boolean значение
 */
export function requireEnvBoolean(key: string, fallback?: boolean): boolean {
  const value = process.env[key];
  
  if (!value) {
    if (fallback !== undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️  Environment variable ${key} is not set. Using fallback: ${fallback}`);
      }
      return fallback;
    }
    throw new EnvError(key);
  }
  
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Получает опциональное значение переменной окружения
 * 
 * @param key - имя переменной окружения
 * @param fallback - значение по умолчанию если переменная не установлена
 * @returns значение переменной или fallback
 */
export function getEnv(key: string, fallback: string = ''): string {
  return process.env[key] || fallback;
}

