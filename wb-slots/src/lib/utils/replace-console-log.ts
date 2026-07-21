/**
 * Утилита для автоматической замены console.log на структурированное логирование
 * Использование: для постепенной миграции от console.log к Pino
 */

import { logger } from '../logging';

/**
 * Замена console.log на структурированное логирование
 * В production использует Pino, в development использует console для скорости
 */
export const log = {
  info: (message: string, data?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'production') {
      logger.info(data || {}, message);
    } else {
      if (data) {
        console.log(`ℹ️ ${message}`, data);
      } else {
        console.log(`ℹ️ ${message}`);
      }
    }
  },
  
  error: (message: string, error?: Error | Record<string, any>) => {
    if (process.env.NODE_ENV === 'production') {
      if (error instanceof Error) {
        logger.error({ error: error.message, stack: error.stack }, message);
      } else {
        logger.error(error || {}, message);
      }
    } else {
      if (error instanceof Error) {
        console.error(`❌ ${message}`, error);
      } else if (error) {
        console.error(`❌ ${message}`, error);
      } else {
        console.error(`❌ ${message}`);
      }
    }
  },
  
  warn: (message: string, data?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'production') {
      logger.warn(data || {}, message);
    } else {
      if (data) {
        console.warn(`⚠️ ${message}`, data);
      } else {
        console.warn(`⚠️ ${message}`);
      }
    }
  },
  
  debug: (message: string, data?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'production') {
      logger.debug(data || {}, message);
    } else {
      if (data) {
        console.debug(`🔍 ${message}`, data);
      } else {
        console.debug(`🔍 ${message}`);
      }
    }
  },
};

/**
 * Использование:
 * 
 * // Вместо:
 * console.log('User logged in', { userId: '123' });
 * 
 * // Используйте:
 * import { log } from '@/lib/utils/replace-console-log';
 * log.info('User logged in', { userId: '123' });
 */

