// ========================================
// Optimized Redis Client with Connection Pooling
// ========================================

import Redis, { RedisOptions, Cluster } from 'ioredis';
import { Logger } from '../logging/logger';

export interface RedisPoolConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: number;
  connectTimeout: number;
  commandTimeout: number;
  // Connection pool settings
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
}

export interface RedisPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  averageResponseTime: number;
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  hitRate: number;
}

export class OptimizedRedisClient {
  private redis: Redis | Cluster;
  private logger: Logger;
  private config: RedisPoolConfig;
  private stats: RedisPoolStats;
  private isCluster: boolean;

  constructor(config: Partial<RedisPoolConfig> = {}) {
    this.logger = new Logger('INFO', { service: 'OptimizedRedisClient' });
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Connection pool settings
      maxConnections: 20,
      minConnections: 5,
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      ...config
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      averageResponseTime: 0,
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      hitRate: 0
    };

    this.isCluster = this.config.host.includes(',');
    this.initializeRedis();
  }

  /**
   * Get Redis instance
   */
  getClient(): Redis | Cluster {
    return this.redis;
  }

  /**
   * Execute command with performance monitoring
   */
  async executeCommand<T>(
    command: string,
    ...args: any[]
  ): Promise<T> {
    const startTime = Date.now();
    this.stats.totalCommands++;

    try {
      const result = await (this.redis as any)[command](...args);
      const executionTime = Date.now() - startTime;
      
      this.stats.successfulCommands++;
      this.updateResponseTime(executionTime);
      
      this.logger.debug('Redis command executed', {
        command,
        args: args.slice(0, 2), // Log only first 2 args for security
        executionTime
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.failedCommands++;
      this.updateResponseTime(executionTime);
      
      this.logger.error('Redis command failed', {
        command,
        args: args.slice(0, 2),
        executionTime,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get value with caching stats
   */
  async get(key: string): Promise<string | null> {
    return this.executeCommand<string | null>('get', key);
  }

  /**
   * Set value with TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.executeCommand('setex', key, ttl, value);
    }
    return this.executeCommand('set', key, value);
  }

  /**
   * Set value with TTL (milliseconds)
   */
  async setWithTTL(key: string, value: string, ttlMs: number): Promise<'OK'> {
    return this.executeCommand('psetex', key, ttlMs, value);
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<number> {
    return this.executeCommand('del', key);
  }

  /**
   * Delete multiple keys
   */
  async delMultiple(keys: string[]): Promise<number> {
    return this.executeCommand('del', ...keys);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<number> {
    return this.executeCommand('exists', key);
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    return this.executeCommand('ttl', key);
  }

  /**
   * Set TTL for key
   */
  async expire(key: string, seconds: number): Promise<number> {
    return this.executeCommand('expire', key, seconds);
  }

  /**
   * Get keys by pattern
   */
  async keys(pattern: string): Promise<string[]> {
    return this.executeCommand('keys', pattern);
  }

  /**
   * Increment value
   */
  async incr(key: string): Promise<number> {
    return this.executeCommand('incr', key);
  }

  /**
   * Increment by value
   */
  async incrby(key: string, increment: number): Promise<number> {
    return this.executeCommand('incrby', key, increment);
  }

  /**
   * Hash operations
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.executeCommand('hget', key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.executeCommand('hset', key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.executeCommand('hgetall', key);
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.executeCommand('hdel', key, field);
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.executeCommand('lpush', key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.executeCommand('rpush', key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    return this.executeCommand('lpop', key);
  }

  async rpop(key: string): Promise<string | null> {
    return this.executeCommand('rpop', key);
  }

  async llen(key: string): Promise<number> {
    return this.executeCommand('llen', key);
  }

  /**
   * Set operations
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.executeCommand('sadd', key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.executeCommand('srem', key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.executeCommand('smembers', key);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.executeCommand('sismember', key, member);
  }

  /**
   * Sorted set operations
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.executeCommand('zadd', key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.executeCommand('zrange', key, start, stop);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.executeCommand('zrem', key, ...members);
  }

  /**
   * Pipeline operations for better performance
   */
  async pipeline(commands: Array<{ command: string; args: any[] }>): Promise<any[]> {
    const startTime = Date.now();
    this.stats.totalCommands++;

    try {
      const pipeline = this.redis.pipeline();
      
      for (const { command, args } of commands) {
        (pipeline as any)[command](...args);
      }

      const results = await pipeline.exec();
      const executionTime = Date.now() - startTime;
      
      this.stats.successfulCommands++;
      this.updateResponseTime(executionTime);
      
      this.logger.debug('Redis pipeline executed', {
        commandCount: commands.length,
        executionTime
      });

      return results || [];
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.failedCommands++;
      this.updateResponseTime(executionTime);
      
      this.logger.error('Redis pipeline failed', {
        commandCount: commands.length,
        executionTime,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Transaction operations
   */
  async multi(commands: Array<{ command: string; args: any[] }>): Promise<any[]> {
    const startTime = Date.now();
    this.stats.totalCommands++;

    try {
      const multi = this.redis.multi();
      
      for (const { command, args } of commands) {
        (multi as any)[command](...args);
      }

      const results = await multi.exec();
      const executionTime = Date.now() - startTime;
      
      this.stats.successfulCommands++;
      this.updateResponseTime(executionTime);
      
      this.logger.debug('Redis transaction executed', {
        commandCount: commands.length,
        executionTime
      });

      return results || [];
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.failedCommands++;
      this.updateResponseTime(executionTime);
      
      this.logger.error('Redis transaction failed', {
        commandCount: commands.length,
        executionTime,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): RedisPoolStats {
    return { ...this.stats };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.stats,
      successRate: this.stats.totalCommands > 0 
        ? (this.stats.successfulCommands / this.stats.totalCommands) * 100 
        : 100,
      errorRate: this.stats.totalCommands > 0 
        ? (this.stats.failedCommands / this.stats.totalCommands) * 100 
        : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      averageResponseTime: 0,
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      hitRate: 0
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = Date.now();
    try {
      await this.executeCommand('ping');
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      return { status: 'unhealthy', latency };
    }
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  // Private methods

  private initializeRedis(): void {
    const redisOptions: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      retryDelayOnFailover: this.config.retryDelayOnFailover,
      enableReadyCheck: this.config.enableReadyCheck,
      lazyConnect: this.config.lazyConnect,
      keepAlive: this.config.keepAlive,
      family: this.config.family,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      // Connection pool settings
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      retryDelayOnFailover: this.config.retryDelayOnFailover,
      // Enable connection pooling
      enableOfflineQueue: false,
      // Performance optimizations
      enableAutoPipelining: true,
      maxLoadingTimeout: 10000,
      // Monitoring
      onConnect: () => {
        this.logger.info('Redis connected');
        this.stats.totalConnections++;
      },
      onReady: () => {
        this.logger.info('Redis ready');
      },
      onError: (error) => {
        this.logger.error('Redis error', { error: error.message });
      },
      onClose: () => {
        this.logger.info('Redis connection closed');
      },
      onReconnecting: () => {
        this.logger.info('Redis reconnecting');
      }
    };

    if (this.isCluster) {
      // Cluster configuration
      const clusterNodes = this.config.host.split(',').map(host => ({
        host: host.trim(),
        port: this.config.port
      }));

      this.redis = new Redis.Cluster(clusterNodes, {
        ...redisOptions,
        redisOptions: {
          ...redisOptions,
          password: this.config.password
        },
        enableOfflineQueue: false,
        maxRedirections: 16,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        retryDelayOnClusterDown: 300,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest
      });
    } else {
      this.redis = new Redis(redisOptions);
    }
  }

  private updateResponseTime(executionTime: number): void {
    if (this.stats.totalCommands === 1) {
      this.stats.averageResponseTime = executionTime;
    } else {
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime * (this.stats.totalCommands - 1) + executionTime) / 
        this.stats.totalCommands;
    }
  }
}

// Singleton instance
let optimizedRedisInstance: OptimizedRedisClient | null = null;

export function getOptimizedRedisClient(config?: Partial<RedisPoolConfig>): OptimizedRedisClient {
  if (!optimizedRedisInstance) {
    optimizedRedisInstance = new OptimizedRedisClient(config);
  }
  return optimizedRedisInstance;
}

// Export optimized Redis client
export const optimizedRedis = getOptimizedRedisClient();
