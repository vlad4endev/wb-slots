/**
 * 🏗️ Единая точка входа для всего приложения
 * Централизованная инициализация и управление всей системой
 */

import { 
  initializeArchitecture,
  getArchitectureManager,
  checkArchitectureHealth 
} from './architecture';
import { 
  initializeAllServices,
  checkServicesHealth,
  stopAllServices,
  restartAllServices,
  getService,
  ServiceRegistry
} from './services';
import { requireEnv } from './env';
import { logger } from './logging';
import { ensureEnvironmentValid } from './security/env-validator';

// ============================================================================
// КЛАСС ГЛАВНОГО ПРИЛОЖЕНИЯ
// ============================================================================

export class WBApplication {
  private isInitialized = false;
  private isRunning = false;
  private services: ServiceRegistry | null = null;

  constructor() {
    // Обработка сигналов завершения
    this.setupGracefulShutdown();
  }

  /**
   * Инициализация приложения
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Application already initialized');
      return;
    }

    logger.info('Initializing WB Slots Application...');
    
    try {
      // Проверяем обязательные переменные окружения
      ensureEnvironmentValid();
      logger.info('Environment variables validated');
      
      // Инициализируем архитектуру
      await initializeArchitecture();
      logger.info('Architecture initialized');
      
      // Инициализируем все сервисы
      this.services = await initializeAllServices();
      logger.info('Services initialized');
      
      this.isInitialized = true;
      logger.info('WB Slots Application initialized successfully');
      
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to initialize application');
      throw error;
    }
  }

  /**
   * Запуск приложения
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Application must be initialized before starting');
    }

    if (this.isRunning) {
      logger.warn('Application already running');
      return;
    }

    logger.info('Starting WB Slots Application...');
    
    try {
      // Запускаем все сервисы
      const manager = getArchitectureManager();
      await manager.startAllServices();
      
      this.isRunning = true;
      logger.info('WB Slots Application started successfully');
      
      // Запускаем мониторинг
      this.startHealthMonitoring();
      
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to start application');
      throw error;
    }
  }

  /**
   * Остановка приложения
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Application not running');
      return;
    }

    logger.info('Stopping WB Slots Application...');
    
    try {
      // Останавливаем все сервисы
      await stopAllServices();
      
      this.isRunning = false;
      logger.info('WB Slots Application stopped successfully');
      
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to stop application');
      throw error;
    }
  }

  /**
   * Перезапуск приложения
   */
  async restart(): Promise<void> {
    logger.info('Restarting WB Slots Application...');
    await this.stop();
    await this.start();
  }

  /**
   * Получение состояния приложения
   */
  async getStatus(): Promise<{
    initialized: boolean;
    running: boolean;
    architecture: any;
    services: any;
    summary: {
      totalServices: number;
      healthyServices: number;
      degradedServices: number;
      unhealthyServices: number;
    };
  }> {
    const architectureHealth = await checkArchitectureHealth();
    const servicesHealth = await checkServicesHealth();
    
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      architecture: architectureHealth,
      services: servicesHealth,
      summary: servicesHealth.summary
    };
  }

  /**
   * Получение сервиса
   */
  getService<T extends keyof ServiceRegistry>(name: T): ServiceRegistry[T] {
    if (!this.isInitialized) {
      throw new Error('Application not initialized');
    }
    return getService(name);
  }

  /**
   * Проверка здоровья системы
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: any;
    architecture: any;
  }> {
    const architectureHealth = await checkArchitectureHealth();
    const servicesHealth = await checkServicesHealth();
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (servicesHealth.status === 'unhealthy' || architectureHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (servicesHealth.status === 'degraded' || architectureHealth.status === 'degraded') {
      overallStatus = 'degraded';
    }
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: servicesHealth,
      architecture: architectureHealth
    };
  }

  // ============================================================================
  // ПРИВАТНЫЕ МЕТОДЫ
  // ============================================================================

  /**
   * Валидация обязательных переменных окружения
   * Выбрасывает ошибку в production, если переменные не установлены
   */
  private validateEnvironmentVariables(): void {
    // Критически важные переменные для безопасности
    const requiredVars = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
    ];

    // Проверяем каждую переменную
    for (const key of requiredVars) {
      try {
        requireEnv(key);
      } catch (error) {
        // В development разрешаем использование fallback значений
        if (process.env.NODE_ENV !== 'production') {
          logger.warn({ envVar: key }, 
            'Environment variable not set, using fallback value. This should be configured before production deployment.'
          );
        } else {
          // В production это критическая ошибка
          logger.error({ envVar: key }, 'Critical environment variable missing in production');
          throw new Error(
            `Critical: ${key} environment variable is required in production but is not set. ` +
            `Application cannot start without this variable.`
          );
        }
      }
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');
      
      try {
        await this.stop();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ 
          error: error instanceof Error ? error.message : 'Unknown error',
          signal 
        }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  private startHealthMonitoring(): void {
    // Проверяем здоровье системы каждые 30 секунд
    setInterval(async () => {
      try {
        const health = await this.healthCheck();
        
        if (health.status === 'unhealthy') {
          logger.error({ health }, 'System health check failed');
        } else if (health.status === 'degraded') {
          logger.warn({ health }, 'System health degraded');
        }
        
        // Логируем только при проблемах или раз в 5 минут
        if (health.status !== 'healthy' || Date.now() % (5 * 60 * 1000) < 30000) {
          logger.info({ 
            status: health.status,
            services: health.services.summary,
            architecture: health.architecture.summary
          }, 'Health check');
        }
        
      } catch (error) {
        logger.error({ 
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Health monitoring error');
      }
    }, 30000);
  }
}

// ============================================================================
// ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР ПРИЛОЖЕНИЯ
// ============================================================================

let globalApp: WBApplication | null = null;

/**
 * Получение глобального экземпляра приложения
 */
export function getApp(): WBApplication {
  if (!globalApp) {
    globalApp = new WBApplication();
  }
  return globalApp;
}

/**
 * Инициализация приложения
 */
export async function initializeApp(): Promise<WBApplication> {
  const app = getApp();
  await app.initialize();
  return app;
}

/**
 * Запуск приложения
 */
export async function startApp(): Promise<WBApplication> {
  const app = getApp();
  await app.start();
  return app;
}

/**
 * Остановка приложения
 */
export async function stopApp(): Promise<void> {
  const app = getApp();
  await app.stop();
}

/**
 * Перезапуск приложения
 */
export async function restartApp(): Promise<WBApplication> {
  const app = getApp();
  await app.restart();
  return app;
}

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ПРИЛОЖЕНИЕМ
// ============================================================================

/**
 * Проверка состояния приложения
 */
export async function getAppStatus(): Promise<any> {
  const app = getApp();
  return await app.getStatus();
}

/**
 * Проверка здоровья приложения
 */
export async function getAppHealth(): Promise<any> {
  const app = getApp();
  return await app.healthCheck();
}

/**
 * Получение сервиса из приложения
 */
export function getAppService<T extends keyof ServiceRegistry>(name: T): ServiceRegistry[T] {
  const app = getApp();
  return app.getService(name);
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

export const APP_VERSION = '1.0.0';
export const APP_NAME = 'WB Slots Application';

// ============================================================================
// ТИПЫ ДЛЯ ЭКСПОРТА
// ============================================================================

export type { WBApplication };
export type { ServiceRegistry } from './services';
