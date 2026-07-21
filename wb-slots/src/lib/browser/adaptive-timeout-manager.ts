// ===== ADAPTIVE TIMEOUT MANAGER =====

import { Logger } from '../logging/logger';

// ===== TYPES =====

export interface TimeoutMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface AdaptiveTimeoutConfig {
  baseTimeout: number;
  minTimeout: number;
  maxTimeout: number;
  learningRate: number;
  historySize: number;
  enableAdaptation: boolean;
}

export interface TimeoutProfile {
  operation: string;
  currentTimeout: number;
  successRate: number;
  averageDuration: number;
  sampleCount: number;
  lastUpdated: Date;
}

// ===== CONSTANTS =====

const DEFAULT_CONFIG: AdaptiveTimeoutConfig = {
  baseTimeout: 30000,
  minTimeout: 5000,
  maxTimeout: 120000,
  learningRate: 0.1,
  historySize: 100,
  enableAdaptation: true
};

// ===== MAIN CLASS =====

export class AdaptiveTimeoutManager {
  private static instance: AdaptiveTimeoutManager;
  private logger: Logger;
  private config: AdaptiveTimeoutConfig;
  private metrics: TimeoutMetrics[] = [];
  private profiles: Map<string, TimeoutProfile> = new Map();

  private constructor(config?: Partial<AdaptiveTimeoutConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger('INFO', { service: 'AdaptiveTimeoutManager' });
  }

  public static getInstance(config?: Partial<AdaptiveTimeoutConfig>): AdaptiveTimeoutManager {
    if (!AdaptiveTimeoutManager.instance) {
      AdaptiveTimeoutManager.instance = new AdaptiveTimeoutManager(config);
    }
    return AdaptiveTimeoutManager.instance;
  }

  /**
   * Получение адаптивного таймаута для операции
   */
  getTimeout(operation: string, context?: Record<string, any>): number {
    if (!this.config.enableAdaptation) {
      return this.config.baseTimeout;
    }

    const profile = this.profiles.get(operation);
    if (!profile) {
      // Создаем новый профиль
      const newProfile: TimeoutProfile = {
        operation,
        currentTimeout: this.config.baseTimeout,
        successRate: 1.0,
        averageDuration: this.config.baseTimeout,
        sampleCount: 0,
        lastUpdated: new Date()
      };
      this.profiles.set(operation, newProfile);
      return this.config.baseTimeout;
    }

    // Применяем контекстные модификаторы
    let timeout = profile.currentTimeout;
    
    if (context) {
      // Увеличиваем таймаут для медленных операций
      if (context.slowOperation) {
        timeout *= 1.5;
      }
      
      // Увеличиваем таймаут для сетевых операций
      if (context.networkOperation) {
        timeout *= 1.3;
      }
      
      // Уменьшаем таймаут для быстрых операций
      if (context.fastOperation) {
        timeout *= 0.8;
      }
    }

    // Ограничиваем таймаут
    timeout = Math.max(this.config.minTimeout, Math.min(timeout, this.config.maxTimeout));

    this.logger.debug(`Adaptive timeout for ${operation}`, {
      baseTimeout: profile.currentTimeout,
      adjustedTimeout: timeout,
      successRate: profile.successRate,
      context
    });

    return Math.round(timeout);
  }

  /**
   * Запись метрик операции
   */
  recordMetrics(metrics: TimeoutMetrics): void {
    if (!this.config.enableAdaptation) {
      return;
    }

    // Добавляем метрики
    this.metrics.push(metrics);
    
    // Ограничиваем размер истории
    if (this.metrics.length > this.config.historySize) {
      this.metrics = this.metrics.slice(-this.config.historySize);
    }

    // Обновляем профиль
    this.updateProfile(metrics);

    this.logger.debug('Timeout metrics recorded', {
      operation: metrics.operation,
      duration: metrics.duration,
      success: metrics.success
    });
  }

  /**
   * Обновление профиля операции
   */
  private updateProfile(metrics: TimeoutMetrics): void {
    const profile = this.profiles.get(metrics.operation);
    
    if (!profile) {
      // Создаем новый профиль
      const newProfile: TimeoutProfile = {
        operation: metrics.operation,
        currentTimeout: this.config.baseTimeout,
        successRate: metrics.success ? 1.0 : 0.0,
        averageDuration: metrics.duration,
        sampleCount: 1,
        lastUpdated: new Date()
      };
      this.profiles.set(metrics.operation, newProfile);
      return;
    }

    // Обновляем статистики
    profile.sampleCount++;
    profile.lastUpdated = new Date();
    
    // Обновляем среднюю продолжительность (экспоненциальное сглаживание)
    profile.averageDuration = (profile.averageDuration * 0.9) + (metrics.duration * 0.1);
    
    // Обновляем процент успеха
    const successCount = this.metrics
      .filter(m => m.operation === metrics.operation && m.success)
      .length;
    profile.successRate = successCount / profile.sampleCount;

    // Адаптируем таймаут
    this.adaptTimeout(profile, metrics);

    this.logger.info(`Profile updated for ${metrics.operation}`, {
      successRate: profile.successRate,
      averageDuration: profile.averageDuration,
      currentTimeout: profile.currentTimeout,
      sampleCount: profile.sampleCount
    });
  }

  /**
   * Адаптация таймаута на основе метрик
   */
  private adaptTimeout(profile: TimeoutProfile, metrics: TimeoutMetrics): void {
    const learningRate = this.config.learningRate;
    
    if (metrics.success) {
      // Если операция успешна, но заняла много времени
      if (metrics.duration > profile.currentTimeout * 0.8) {
        // Увеличиваем таймаут
        profile.currentTimeout = Math.min(
          profile.currentTimeout * (1 + learningRate),
          this.config.maxTimeout
        );
      }
      // Если операция успешна и быстрая
      else if (metrics.duration < profile.currentTimeout * 0.3) {
        // Уменьшаем таймаут
        profile.currentTimeout = Math.max(
          profile.currentTimeout * (1 - learningRate),
          this.config.minTimeout
        );
      }
    } else {
      // Если операция не удалась из-за таймаута
      if (metrics.duration >= profile.currentTimeout * 0.95) {
        // Увеличиваем таймаут
        profile.currentTimeout = Math.min(
          profile.currentTimeout * (1 + learningRate * 2),
          this.config.maxTimeout
        );
      }
    }

    // Ограничиваем таймаут
    profile.currentTimeout = Math.max(
      this.config.minTimeout,
      Math.min(profile.currentTimeout, this.config.maxTimeout)
    );
  }

  /**
   * Получение профиля операции
   */
  getProfile(operation: string): TimeoutProfile | null {
    return this.profiles.get(operation) || null;
  }

  /**
   * Получение всех профилей
   */
  getAllProfiles(): TimeoutProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Получение статистики
   */
  getStats(): {
    totalOperations: number;
    totalMetrics: number;
    profilesCount: number;
    averageSuccessRate: number;
    averageTimeout: number;
  } {
    const profiles = Array.from(this.profiles.values());
    const totalOperations = profiles.reduce((sum, p) => sum + p.sampleCount, 0);
    const averageSuccessRate = profiles.length > 0 
      ? profiles.reduce((sum, p) => sum + p.successRate, 0) / profiles.length 
      : 0;
    const averageTimeout = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.currentTimeout, 0) / profiles.length
      : this.config.baseTimeout;

    return {
      totalOperations,
      totalMetrics: this.metrics.length,
      profilesCount: this.profiles.size,
      averageSuccessRate,
      averageTimeout
    };
  }

  /**
   * Сброс профиля операции
   */
  resetProfile(operation: string): void {
    this.profiles.delete(operation);
    this.metrics = this.metrics.filter(m => m.operation !== operation);
    this.logger.info(`Profile reset for operation: ${operation}`);
  }

  /**
   * Сброс всех профилей
   */
  resetAllProfiles(): void {
    this.profiles.clear();
    this.metrics = [];
    this.logger.info('All profiles reset');
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig: Partial<AdaptiveTimeoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Timeout configuration updated', this.config);
  }

  /**
   * Экспорт профилей
   */
  exportProfiles(): string {
    return JSON.stringify({
      config: this.config,
      profiles: Array.from(this.profiles.entries()),
      metrics: this.metrics.slice(-50) // Последние 50 метрик
    }, null, 2);
  }

  /**
   * Импорт профилей
   */
  importProfiles(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.config) {
        this.config = { ...this.config, ...parsed.config };
      }
      
      if (parsed.profiles) {
        this.profiles = new Map(parsed.profiles);
      }
      
      if (parsed.metrics) {
        this.metrics = parsed.metrics.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }
      
      this.logger.info('Profiles imported successfully');
    } catch (error) {
      this.logger.error('Failed to import profiles', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// ===== SINGLETON INSTANCE =====

export const adaptiveTimeoutManager = AdaptiveTimeoutManager.getInstance();
