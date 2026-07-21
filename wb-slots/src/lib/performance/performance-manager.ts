// ========================================
// Performance Manager - Centralized Performance Optimization
// ========================================

import { OptimizedPrismaClient } from '../database/optimized-prisma';
import { OptimizedRedisClient } from '../redis/optimized-redis';
import { CacheService } from '../cache/cache-service';
import { WBApiCacheService } from '../cache/wb-api-cache';
import { RetryService } from '../retry/retry-service';
import { Logger } from '../logging/logger';

export interface PerformanceConfig {
  database: {
    connectionLimit: number;
    queryTimeout: number;
    enableLogging: boolean;
    slowQueryThreshold: number;
  };
  redis: {
    maxConnections: number;
    minConnections: number;
    commandTimeout: number;
    enablePipelining: boolean;
  };
  cache: {
    defaultTTL: number;
    enableAutoRefresh: boolean;
    refreshThreshold: number;
  };
  retry: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    alertThresholds: {
      slowQueries: number;
      highErrorRate: number;
      lowHitRate: number;
    };
  };
}

export interface PerformanceMetrics {
  database: {
    activeConnections: number;
    averageQueryTime: number;
    slowQueries: number;
    errorRate: number;
  };
  redis: {
    activeConnections: number;
    averageResponseTime: number;
    successRate: number;
    hitRate: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    totalOperations: number;
  };
  retry: {
    totalAttempts: number;
    successRate: number;
    averageAttempts: number;
    retryableErrors: number;
  };
  overall: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export class PerformanceManager {
  private prisma: OptimizedPrismaClient;
  private redis: OptimizedRedisClient;
  private cache: CacheService;
  private wbApiCache: WBApiCacheService;
  private retryService: RetryService;
  private logger: Logger;
  private config: PerformanceConfig;
  private metricsInterval: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.logger = new Logger('INFO', { service: 'PerformanceManager' });
    this.startTime = Date.now();
    this.config = {
      database: {
        connectionLimit: 20,
        queryTimeout: 30000,
        enableLogging: process.env.NODE_ENV === 'development',
        slowQueryThreshold: 1000
      },
      redis: {
        maxConnections: 20,
        minConnections: 5,
        commandTimeout: 5000,
        enablePipelining: true
      },
      cache: {
        defaultTTL: 300,
        enableAutoRefresh: true,
        refreshThreshold: 10
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      monitoring: {
        enableMetrics: true,
        metricsInterval: 60000, // 1 minute
        alertThresholds: {
          slowQueries: 10,
          highErrorRate: 5,
          lowHitRate: 80
        }
      },
      ...config
    };

    this.initializeServices();
    this.startMonitoring();
  }

  /**
   * Get all performance metrics
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    const [
      databaseStats,
      redisStats,
      cacheStats,
      retryStats,
      memoryUsage,
      cpuUsage
    ] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getRedisMetrics(),
      this.getCacheMetrics(),
      this.getRetryMetrics(),
      this.getMemoryUsage(),
      this.getCpuUsage()
    ]);

    const overallStatus = this.calculateOverallStatus(databaseStats, redisStats, cacheStats, retryStats);

    return {
      database: databaseStats,
      redis: redisStats,
      cache: cacheStats,
      retry: retryStats,
      overall: {
        status: overallStatus,
        uptime: Date.now() - this.startTime,
        memoryUsage,
        cpuUsage
      }
    };
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics() {
    const [poolStats, prismaMetrics] = await Promise.all([
      this.prisma.getConnectionPoolStats(),
      this.prisma.getMetrics()
    ]);

    return {
      activeConnections: poolStats.activeConnections,
      averageQueryTime: prismaMetrics.averageQueryTime,
      slowQueries: prismaMetrics.slowQueries,
      errorRate: prismaMetrics.errorRate
    };
  }

  /**
   * Get Redis metrics
   */
  async getRedisMetrics() {
    const redisMetrics = this.redis.getMetrics();
    
    return {
      activeConnections: redisMetrics.totalConnections,
      averageResponseTime: redisMetrics.averageResponseTime,
      successRate: redisMetrics.successRate,
      hitRate: 0 // Redis doesn't have hit rate, this would be from cache
    };
  }

  /**
   * Get cache metrics
   */
  async getCacheMetrics() {
    const cacheStats = this.cache.getStats();
    
    return {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: cacheStats.hitRate,
      totalOperations: cacheStats.hits + cacheStats.misses
    };
  }

  /**
   * Get retry metrics
   */
  async getRetryMetrics() {
    const retryStats = this.retryService.getStats();
    
    return {
      totalAttempts: retryStats.totalAttempts,
      successRate: retryStats.totalAttempts > 0 
        ? (retryStats.successfulAttempts / retryStats.totalAttempts) * 100 
        : 100,
      averageAttempts: retryStats.averageAttempts,
      retryableErrors: retryStats.retryableErrors
    };
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      database: { status: 'healthy' | 'unhealthy'; latency: number };
      redis: { status: 'healthy' | 'unhealthy'; latency: number };
      cache: { status: 'healthy' | 'unhealthy'; latency: number };
    };
  }> {
    const [databaseHealth, redisHealth, cacheHealth] = await Promise.all([
      this.prisma.healthCheck(),
      this.redis.healthCheck(),
      this.cache.healthCheck()
    ]);

    const overallStatus = databaseHealth.status === 'healthy' && 
                         redisHealth.status === 'healthy' && 
                         cacheHealth.status === 'healthy' 
                         ? 'healthy' 
                         : 'unhealthy';

    return {
      status: overallStatus,
      services: {
        database: databaseHealth,
        redis: redisHealth,
        cache: cacheHealth
      }
    };
  }

  /**
   * Optimize performance based on current metrics
   */
  async optimizePerformance(): Promise<{
    optimizations: string[];
    warnings: string[];
    errors: string[];
  }> {
    const metrics = await this.getMetrics();
    const optimizations: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Database optimizations
    if (metrics.database.slowQueries > this.config.monitoring.alertThresholds.slowQueries) {
      warnings.push(`High number of slow queries: ${metrics.database.slowQueries}`);
      optimizations.push('Consider adding database indexes or optimizing queries');
    }

    if (metrics.database.errorRate > this.config.monitoring.alertThresholds.highErrorRate) {
      errors.push(`High database error rate: ${metrics.database.errorRate}%`);
      optimizations.push('Check database connection pool and query optimization');
    }

    // Redis optimizations
    if (metrics.redis.successRate < 95) {
      warnings.push(`Low Redis success rate: ${metrics.redis.successRate}%`);
      optimizations.push('Check Redis connection pool and network stability');
    }

    // Cache optimizations
    if (metrics.cache.hitRate < this.config.monitoring.alertThresholds.lowHitRate) {
      warnings.push(`Low cache hit rate: ${metrics.cache.hitRate}%`);
      optimizations.push('Consider adjusting cache TTL or cache keys');
    }

    // Retry optimizations
    if (metrics.retry.retryableErrors > metrics.retry.totalAttempts * 0.1) {
      warnings.push(`High number of retryable errors: ${metrics.retry.retryableErrors}`);
      optimizations.push('Check external API stability and retry configuration');
    }

    // Memory optimizations
    if (metrics.overall.memoryUsage > 80) {
      warnings.push(`High memory usage: ${metrics.overall.memoryUsage}%`);
      optimizations.push('Consider increasing memory or optimizing memory usage');
    }

    return { optimizations, warnings, errors };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.prisma.resetMetrics();
    this.redis.resetStats();
    this.cache.resetStats();
    this.retryService.resetStats();
    this.logger.info('All performance metrics reset');
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    return [
      'Enable database query caching for frequently accessed data',
      'Use Redis pipelining for bulk operations',
      'Implement connection pooling for external APIs',
      'Add database indexes for frequently queried columns',
      'Use prepared statements for repeated queries',
      'Implement circuit breaker pattern for external services',
      'Monitor and optimize memory usage',
      'Use compression for large data transfers',
      'Implement rate limiting for API endpoints',
      'Use CDN for static assets'
    ];
  }

  /**
   * Shutdown performance manager
   */
  async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    await Promise.all([
      this.prisma.disconnect(),
      this.redis.disconnect()
    ]);

    this.logger.info('Performance manager shutdown complete');
  }

  // Private methods

  private initializeServices(): void {
    this.prisma = new OptimizedPrismaClient(this.config.database);
    this.redis = new OptimizedRedisClient(this.config.redis);
    this.cache = new CacheService(this.redis.getClient(), this.config.cache);
    this.wbApiCache = new WBApiCacheService(this.cache, this.config.cache);
    this.retryService = new RetryService(this.config.retry);

    this.logger.info('Performance services initialized', {
      database: 'OptimizedPrismaClient',
      redis: 'OptimizedRedisClient',
      cache: 'CacheService',
      wbApiCache: 'WBApiCacheService',
      retry: 'RetryService'
    });
  }

  private startMonitoring(): void {
    if (!this.config.monitoring.enableMetrics) {
      return;
    }

    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        const { optimizations, warnings, errors } = await this.optimizePerformance();

        if (errors.length > 0) {
          this.logger.error('Performance issues detected', { errors });
        } else if (warnings.length > 0) {
          this.logger.warn('Performance warnings', { warnings });
        }

        if (optimizations.length > 0) {
          this.logger.info('Performance optimizations suggested', { optimizations });
        }

        // Log metrics periodically
        this.logger.debug('Performance metrics', {
          database: metrics.database,
          redis: metrics.redis,
          cache: metrics.cache,
          retry: metrics.retry,
          overall: metrics.overall
        });
      } catch (error) {
        this.logger.error('Error collecting performance metrics', { error: error.message });
      }
    }, this.config.monitoring.metricsInterval);

    this.logger.info('Performance monitoring started', {
      interval: this.config.monitoring.metricsInterval
    });
  }

  private calculateOverallStatus(
    database: any,
    redis: any,
    cache: any,
    retry: any
  ): 'healthy' | 'warning' | 'critical' {
    const issues = [];

    if (database.errorRate > 5) issues.push('database_errors');
    if (database.slowQueries > 10) issues.push('database_slow');
    if (redis.successRate < 95) issues.push('redis_errors');
    if (cache.hitRate < 80) issues.push('cache_low_hit_rate');
    if (retry.successRate < 90) issues.push('retry_issues');

    if (issues.length === 0) return 'healthy';
    if (issues.length <= 2) return 'warning';
    return 'critical';
  }

  private async getMemoryUsage(): Promise<number> {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    return Math.round((memUsage.heapUsed / totalMem) * 100);
  }

  private async getCpuUsage(): Promise<number> {
    // Simple CPU usage calculation
    // In production, use a proper CPU monitoring library
    return 0; // Placeholder
  }
}

// Singleton instance
let performanceManagerInstance: PerformanceManager | null = null;

export function getPerformanceManager(config?: Partial<PerformanceConfig>): PerformanceManager {
  if (!performanceManagerInstance) {
    performanceManagerInstance = new PerformanceManager(config);
  }
  return performanceManagerInstance;
}

// Export performance manager
export const performanceManager = getPerformanceManager();
