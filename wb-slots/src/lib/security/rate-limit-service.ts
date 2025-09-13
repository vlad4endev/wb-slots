import { Redis } from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;        // Время окна в миллисекундах
  maxRequests: number;     // Максимальное количество запросов
  keyPrefix: string;       // Префикс для ключей в Redis
  skipSuccessfulRequests?: boolean; // Пропускать успешные запросы
  skipFailedRequests?: boolean;     // Пропускать неудачные запросы
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimitService {
  private static instance: RateLimitService;
  private redis: Redis;
  private configs: Map<string, RateLimitConfig> = new Map();

  private constructor() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true, // Не подключаемся сразу
      });

      // Инициализируем конфигурации по умолчанию
      this.initializeDefaultConfigs();
    } catch (error) {
      console.error('❌ Ошибка инициализации Redis в RateLimitService:', error);
      // Создаем заглушку для Redis
      this.redis = null as any;
    }
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  private initializeDefaultConfigs(): void {
    // WB API rate limits
    this.configs.set('wb_api', {
      windowMs: 60 * 1000, // 1 минута
      maxRequests: 30,      // 30 запросов в минуту
      keyPrefix: 'rate_limit:wb_api',
    });

    this.configs.set('wb_api_strict', {
      windowMs: 60 * 1000, // 1 минута
      maxRequests: 10,      // 10 запросов в минуту (строгий лимит)
      keyPrefix: 'rate_limit:wb_api_strict',
    });

    // Telegram API rate limits
    this.configs.set('telegram_api', {
      windowMs: 60 * 1000, // 1 минута
      maxRequests: 20,      // 20 запросов в минуту
      keyPrefix: 'rate_limit:telegram_api',
    });

    // Общие API лимиты
    this.configs.set('general_api', {
      windowMs: 60 * 1000, // 1 минута
      maxRequests: 100,     // 100 запросов в минуту
      keyPrefix: 'rate_limit:general_api',
    });

    // Лимиты для пользователей
    this.configs.set('user_requests', {
      windowMs: 60 * 1000, // 1 минута
      maxRequests: 50,      // 50 запросов в минуту на пользователя
      keyPrefix: 'rate_limit:user',
    });

    // Лимиты для задач
    this.configs.set('task_execution', {
      windowMs: 5 * 60 * 1000, // 5 минут
      maxRequests: 10,          // 10 выполнений задачи за 5 минут
      keyPrefix: 'rate_limit:task',
    });
  }

  /**
   * Проверяет rate limit для указанного ключа
   */
  async checkRateLimit(
    key: string, 
    configName: string = 'general_api',
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    // Если Redis недоступен, разрешаем все запросы
    if (!this.redis) {
      console.warn('⚠️ Redis недоступен, rate limiting отключен');
      return { 
        allowed: true, 
        remaining: 1000, 
        resetTime: Date.now() + 60000,
        retryAfter: 0
      };
    }

    try {
      const config = customConfig 
        ? { ...this.configs.get(configName)!, ...customConfig }
        : this.configs.get(configName);

      if (!config) {
        throw new Error(`Rate limit config not found: ${configName}`);
      }

      const fullKey = `${config.keyPrefix}:${key}`;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Получаем текущие запросы из Redis
      const requests = await this.redis.zrangebyscore(
        fullKey,
        windowStart,
        '+inf',
        'WITHSCORES'
      );

      const currentRequests = Math.floor(requests.length / 2); // Каждый запрос = 2 элемента (score, value)

      if (currentRequests >= config.maxRequests) {
        // Rate limit превышен
        const oldestRequest = parseInt(requests[1] as string);
        const resetTime = oldestRequest + config.windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.max(0, retryAfter),
        };
      }

      // Добавляем текущий запрос
      await this.redis.zadd(fullKey, now, `${now}-${Math.random()}`);
      
      // Устанавливаем TTL для ключа
      await this.redis.expire(fullKey, Math.ceil(config.windowMs / 1000));

      // Очищаем старые запросы
      await this.redis.zremrangebyscore(fullKey, '-inf', windowStart);

      return {
        allowed: true,
        remaining: config.maxRequests - currentRequests - 1,
        resetTime: now + config.windowMs,
      };

    } catch (error) {
      console.error('❌ Rate limit check error:', error);
      
      // В случае ошибки разрешаем запрос (fail-open)
      return {
        allowed: true,
        remaining: 999,
        resetTime: Date.now() + 60000,
      };
    }
  }

  /**
   * Проверяет rate limit для WB API
   */
  async checkWBApiRateLimit(userId: string, strict: boolean = false): Promise<RateLimitResult> {
    const configName = strict ? 'wb_api_strict' : 'wb_api';
    return this.checkRateLimit(userId, configName);
  }

  /**
   * Проверяет rate limit для Telegram API
   */
  async checkTelegramApiRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'telegram_api');
  }

  /**
   * Проверяет rate limit для пользователя
   */
  async checkUserRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'user_requests');
  }

  /**
   * Проверяет rate limit для задачи
   */
  async checkTaskRateLimit(taskId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(taskId, 'task_execution');
  }

  /**
   * Получает информацию о текущем rate limit
   */
  async getRateLimitInfo(
    key: string, 
    configName: string = 'general_api'
  ): Promise<{
    current: number;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    try {
      const config = this.configs.get(configName);
      if (!config) {
        throw new Error(`Rate limit config not found: ${configName}`);
      }

      const fullKey = `${config.keyPrefix}:${key}`;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      const requests = await this.redis.zrangebyscore(
        fullKey,
        windowStart,
        '+inf'
      );

      const current = Math.floor(requests.length / 2);
      const remaining = Math.max(0, config.maxRequests - current);
      const resetTime = now + config.windowMs;

      return {
        current,
        limit: config.maxRequests,
        remaining,
        resetTime,
      };
    } catch (error) {
      console.error('❌ Rate limit info error:', error);
      return {
        current: 0,
        limit: 999,
        remaining: 999,
        resetTime: Date.now() + 60000,
      };
    }
  }

  /**
   * Сбрасывает rate limit для ключа
   */
  async resetRateLimit(key: string, configName: string = 'general_api'): Promise<boolean> {
    try {
      const config = this.configs.get(configName);
      if (!config) {
        throw new Error(`Rate limit config not found: ${configName}`);
      }

      const fullKey = `${config.keyPrefix}:${key}`;
      await this.redis.del(fullKey);
      
      console.log(`✅ Rate limit reset for key: ${key} (${configName})`);
      return true;
    } catch (error) {
      console.error('❌ Rate limit reset error:', error);
      return false;
    }
  }

  /**
   * Добавляет новую конфигурацию rate limit
   */
  addConfig(name: string, config: RateLimitConfig): void {
    this.configs.set(name, config);
    console.log(`✅ Rate limit config added: ${name}`);
  }

  /**
   * Получает все конфигурации
   */
  getConfigs(): Map<string, RateLimitConfig> {
    return new Map(this.configs);
  }

  /**
   * Очищает старые записи rate limit
   */
  async cleanup(): Promise<number> {
    try {
      const now = Date.now();
      let cleaned = 0;

      for (const [configName, config] of this.configs) {
        const pattern = `${config.keyPrefix}:*`;
        const keys = await this.redis.keys(pattern);
        
        for (const key of keys) {
          const windowStart = now - config.windowMs;
          const removed = await this.redis.zremrangebyscore(key, '-inf', windowStart);
          cleaned += removed;
        }
      }

      console.log(`✅ Rate limit cleanup completed: ${cleaned} old entries removed`);
      return cleaned;
    } catch (error) {
      console.error('❌ Rate limit cleanup error:', error);
      return 0;
    }
  }

  /**
   * Получает статистику rate limit
   */
  async getStats(): Promise<{
    totalKeys: number;
    configs: Record<string, { keys: number; totalRequests: number }>;
  }> {
    try {
      const stats: any = {
        totalKeys: 0,
        configs: {},
      };

      for (const [configName, config] of this.configs) {
        const pattern = `${config.keyPrefix}:*`;
        const keys = await this.redis.keys(pattern);
        
        let totalRequests = 0;
        for (const key of keys) {
          const count = await this.redis.zcard(key);
          totalRequests += count;
        }

        stats.configs[configName] = {
          keys: keys.length,
          totalRequests,
        };
        stats.totalKeys += keys.length;
      }

      return stats;
    } catch (error) {
      console.error('❌ Rate limit stats error:', error);
      return {
        totalKeys: 0,
        configs: {},
      };
    }
  }

  /**
   * Закрывает соединение с Redis
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Экспортируем singleton instance
export const rateLimitService = RateLimitService.getInstance();
