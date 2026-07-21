// ===== SESSION AUTO-REFRESH SCHEDULER =====

import { WBSessionManager, getUnifiedSessionManager } from './index';
import { Logger } from '../logging/logger';
import { prisma } from '../prisma';

// ===== TYPES =====

export interface SchedulerConfig {
  checkInterval: number; // интервал проверки в миллисекундах
  batchSize: number; // количество сессий для обработки за раз
  maxConcurrent: number; // максимальное количество одновременных обновлений
  enabled: boolean;
}

export interface SchedulerStats {
  totalChecks: number;
  sessionsRefreshed: number;
  sessionsExpired: number;
  errors: number;
  lastRun: Date | null;
  nextRun: Date | null;
}

// ===== CONSTANTS =====

const DEFAULT_CONFIG: SchedulerConfig = {
  checkInterval: 30 * 60 * 1000, // 30 минут
  batchSize: 10,
  maxConcurrent: 3,
  enabled: true
};

// ===== MAIN CLASS =====

export class SessionScheduler {
  private static instance: SessionScheduler;
  private logger: Logger;
  private sessionManager: WBSessionManager;
  private config: SchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private stats: SchedulerStats = {
    totalChecks: 0,
    sessionsRefreshed: 0,
    sessionsExpired: 0,
    errors: 0,
    lastRun: null,
    nextRun: null
  };

  private constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger('INFO', { service: 'SessionScheduler' });
    this.sessionManager = getUnifiedSessionManager();
  }

  public static getInstance(config?: Partial<SchedulerConfig>): SessionScheduler {
    if (!SessionScheduler.instance) {
      SessionScheduler.instance = new SessionScheduler(config);
    }
    return SessionScheduler.instance;
  }

  /**
   * Запуск планировщика
   */
  public start(): void {
    if (!this.config.enabled) {
      this.logger.info('Scheduler is disabled');
      return;
    }

    if (this.intervalId) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.logger.info('Starting session scheduler', {
      checkInterval: this.config.checkInterval,
      batchSize: this.config.batchSize,
      maxConcurrent: this.config.maxConcurrent
    });

    // Запускаем немедленно
    this.runCheck();

    // Устанавливаем интервал
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.config.checkInterval);

    this.stats.nextRun = new Date(Date.now() + this.config.checkInterval);
  }

  /**
   * Остановка планировщика
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Session scheduler stopped');
    }
  }

  /**
   * Выполнение проверки сессий
   */
  private async runCheck(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Previous check is still running, skipping');
      return;
    }

    this.isRunning = true;
    this.stats.totalChecks++;
    this.stats.lastRun = new Date();

    try {
      this.logger.info('Starting session check', { 
        checkNumber: this.stats.totalChecks 
      });

      // Получаем сессии, которые нужно проверить
      const sessionsToCheck = await this.getSessionsToCheck();
      
      if (sessionsToCheck.length === 0) {
        this.logger.info('No sessions to check');
        return;
      }

      this.logger.info('Found sessions to check', { 
        count: sessionsToCheck.length 
      });

      // Обрабатываем сессии батчами
      await this.processSessionsBatch(sessionsToCheck);

      // Очищаем истекшие сессии
      const cleanedCount = await this.sessionManager.cleanupExpiredSessions();
      if (cleanedCount > 0) {
        this.stats.sessionsExpired += cleanedCount;
        this.logger.info('Cleaned up expired sessions', { count: cleanedCount });
      }

    } catch (error) {
      this.stats.errors++;
      this.logger.error('Session check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      this.isRunning = false;
      this.stats.nextRun = new Date(Date.now() + this.config.checkInterval);
      
      this.logger.info('Session check completed', {
        totalChecks: this.stats.totalChecks,
        sessionsRefreshed: this.stats.sessionsRefreshed,
        sessionsExpired: this.stats.sessionsExpired,
        errors: this.stats.errors
      });
    }
  }

  /**
   * Получение сессий для проверки
   */
  private async getSessionsToCheck(): Promise<Array<{ id: string; userId: string; createdAt: Date; expiresAt: Date }>> {
    try {
      const now = new Date();
      const refreshThreshold = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000 * 0.8)); // 80% от 7 дней

      const sessions = await prisma.wBSession.findMany({
        where: {
          isActive: true,
          createdAt: {
            lt: refreshThreshold // Сессии старше 80% от максимального возраста
          },
          expiresAt: {
            gt: now // Но еще не истекшие
          }
        },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          expiresAt: true
        },
        orderBy: {
          createdAt: 'asc' // Сначала старые сессии
        },
        take: this.config.batchSize
      });

      return sessions;
    } catch (error) {
      this.logger.error('Failed to get sessions to check', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  /**
   * Обработка батча сессий
   */
  private async processSessionsBatch(sessions: Array<{ id: string; userId: string; createdAt: Date; expiresAt: Date }>): Promise<void> {
    const chunks = this.chunkArray(sessions, this.config.maxConcurrent);
    
    for (const chunk of chunks) {
      const promises = chunk.map(session => this.processSession(session));
      await Promise.allSettled(promises);
      
      // Небольшая задержка между батчами
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(1000);
      }
    }
  }

  /**
   * Обработка одной сессии
   */
  private async processSession(session: { id: string; userId: string; createdAt: Date; expiresAt: Date }): Promise<void> {
    try {
      this.logger.info('Processing session', { 
        sessionId: session.id, 
        userId: session.userId 
      });

      const result = await this.sessionManager.autoRefreshSession(session.userId);
      
      if (result.success) {
        this.stats.sessionsRefreshed++;
        this.logger.info('Session refreshed successfully', { 
          sessionId: session.id, 
          userId: session.userId 
        });
      } else {
        this.logger.warn('Session refresh failed', { 
          sessionId: session.id, 
          userId: session.userId,
          error: result.error 
        });
      }
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Session processing failed', { 
        sessionId: session.id, 
        userId: session.userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Разделение массива на чанки
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Задержка
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Получение статистики
   */
  public getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Сброс статистики
   */
  public resetStats(): void {
    this.stats = {
      totalChecks: 0,
      sessionsRefreshed: 0,
      sessionsExpired: 0,
      errors: 0,
      lastRun: null,
      nextRun: null
    };
  }

  /**
   * Обновление конфигурации
   */
  public updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const wasRunning = !!this.intervalId;
    
    if (wasRunning) {
      this.stop();
    }
    
    this.config = { ...this.config, ...newConfig };
    
    if (wasRunning && this.config.enabled) {
      this.start();
    }
    
    this.logger.info('Scheduler config updated', this.config);
  }

  /**
   * Принудительный запуск проверки
   */
  public async forceCheck(): Promise<void> {
    this.logger.info('Force check requested');
    await this.runCheck();
  }

  /**
   * Остановка сервиса
   */
  public async stop(): Promise<void> {
    this.stop();
    await this.sessionManager.stop();
    this.logger.info('SessionScheduler stopped');
  }
}

// ===== SINGLETON INSTANCE =====

export const sessionScheduler = SessionScheduler.getInstance();
