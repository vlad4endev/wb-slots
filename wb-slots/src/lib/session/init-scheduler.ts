// ===== SESSION SCHEDULER INITIALIZATION =====

import { sessionScheduler } from './session-scheduler';
import { Logger } from '../logging/logger';

const logger = new Logger('INFO', { service: 'SessionSchedulerInit' });

/**
 * Инициализация планировщика сессий
 */
export function initializeSessionScheduler(): void {
  try {
    logger.info('Initializing session scheduler...');
    
    // Запускаем планировщик
    sessionScheduler.start();
    
    logger.info('Session scheduler initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize session scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Остановка планировщика сессий
 */
export function stopSessionScheduler(): void {
  try {
    logger.info('Stopping session scheduler...');
    
    sessionScheduler.stop();
    
    logger.info('Session scheduler stopped successfully');
  } catch (error) {
    logger.error('Failed to stop session scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Graceful shutdown
 */
export function gracefulShutdown(): void {
  logger.info('Graceful shutdown initiated');
  stopSessionScheduler();
}

// Обработка сигналов завершения
if (typeof process !== 'undefined') {
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('beforeExit', gracefulShutdown);
}
