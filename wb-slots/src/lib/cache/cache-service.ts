// ========================================
// Universal Cache Service with Redis
// ========================================

import { Redis } from 'ioredis';
import { Logger } from '../logging/logger';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix?: string;
  serialize?: boolean;
  compress?: boolean;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  refresh?: boolean;
  fallback?: () => Promise<any>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

export class CacheService {
  private redis: Redis;
  private logger: Logger;
  private stats: CacheStats;
  private defaultConfig: CacheConfig;

  constructor(redis: Redis, defaultConfig: Partial<CacheConfig> = {}) {
    this.redis = redis;
    this.logger = new Logger('INFO', { service: 'CacheService' });
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0
    };
    this.defaultConfig = {
      ttl: 300, // 5 minutes default
      prefix: 'wb-slots',
      serialize: true,
      compress: false,
      ...defaultConfig
    };
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const cacheKey = this.buildKey(key);
      const value = await this.redis.get(cacheKey);
      
      if (value === null) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      
      return this.deserialize(value);
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key);
      const ttl = options.ttl || this.defaultConfig.ttl;
      const serializedValue = this.serialize(value);
      
      await this.redis.setex(cacheKey, ttl, serializedValue);
      
      // Set tags if provided
      if (options.tags && options.tags.length > 0) {
        await this.setTags(cacheKey, options.tags);
      }
      
      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get or set pattern with automatic refresh
   */
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, fetch and set
    try {
      const value = await fetcher();
      await this.set(key, value, options);
      return value;
    } catch (error) {
      // If fetcher fails and we have fallback, try fallback
      if (options.fallback) {
        try {
          const fallbackValue = await options.fallback();
          await this.set(key, fallbackValue, { ...options, ttl: 60 }); // Short TTL for fallback
          return fallbackValue;
        } catch (fallbackError) {
          this.logger.error('Both fetcher and fallback failed', { 
            key, 
            error: error.message, 
            fallbackError: fallbackError.message 
          });
          throw error;
        }
      }
      throw error;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key);
      const result = await this.redis.del(cacheKey);
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const cacheKey = this.buildKey(pattern);
      const keys = await this.redis.keys(cacheKey);
      if (keys.length === 0) return 0;
      
      const result = await this.redis.del(...keys);
      this.stats.deletes += result;
      return result;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache delete pattern error', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Delete keys by tags
   */
  async deleteByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;
      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        const keys = await this.redis.smembers(tagKey);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(tagKey);
          totalDeleted += keys.length;
        }
      }
      this.stats.deletes += totalDeleted;
      return totalDeleted;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache delete by tags error', { tags, error: error.message });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async getTTL(key: string): Promise<number> {
    try {
      const cacheKey = this.buildKey(key);
      return await this.redis.ttl(cacheKey);
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache TTL error', { key, error: error.message });
      return -1;
    }
  }

  /**
   * Extend TTL for key
   */
  async extendTTL(key: string, ttl: number): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key);
      const result = await this.redis.expire(cacheKey, ttl);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache extend TTL error', { key, ttl, error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0
    };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      const pattern = this.buildKey('*');
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.stats.deletes += keys.length;
      return true;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Cache clear error', { error: error.message });
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      return { status: 'unhealthy', latency };
    }
  }

  // Private methods

  private buildKey(key: string): string {
    return `${this.defaultConfig.prefix}:${key}`;
  }

  private buildTagKey(tag: string): string {
    return `${this.defaultConfig.prefix}:tags:${tag}`;
  }

  private async setTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      await this.redis.sadd(tagKey, key);
    }
  }

  private serialize(value: any): string {
    if (!this.defaultConfig.serialize) {
      return String(value);
    }
    return JSON.stringify(value);
  }

  private deserialize<T>(value: string): T {
    if (!this.defaultConfig.serialize) {
      return value as T;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      this.logger.error('Cache deserialize error', { value, error: error.message });
      return value as T;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null;

export function getCacheService(redis?: Redis, config?: Partial<CacheConfig>): CacheService {
  if (!cacheServiceInstance) {
    if (!redis) {
      throw new Error('Redis instance is required for first initialization');
    }
    cacheServiceInstance = new CacheService(redis, config);
  }
  return cacheServiceInstance;
}
