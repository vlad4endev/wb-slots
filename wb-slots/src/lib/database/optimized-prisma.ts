// ========================================
// Optimized Prisma Configuration with Connection Pooling
// ========================================

import { PrismaClient } from '@prisma/client';
import { Logger } from '../logging/logger';

export interface DatabaseConfig {
  connectionLimit: number;
  connectionTimeout: number;
  queryTimeout: number;
  transactionTimeout: number;
  enableLogging: boolean;
  logLevel: 'query' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  slowQueryThreshold: number; // milliseconds
}

export interface ConnectionPoolStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingClients: number;
  averageQueryTime: number;
  slowQueries: number;
}

export class OptimizedPrismaClient {
  private prisma: PrismaClient;
  private logger: Logger;
  private config: DatabaseConfig;
  private metrics: {
    queryCount: number;
    totalQueryTime: number;
    slowQueries: number;
    errors: number;
  };

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.logger = new Logger('INFO', { service: 'OptimizedPrismaClient' });
    this.config = {
      connectionLimit: 20,
      connectionTimeout: 10000,
      queryTimeout: 30000,
      transactionTimeout: 60000,
      enableLogging: process.env.NODE_ENV === 'development',
      logLevel: 'query',
      enableMetrics: true,
      slowQueryThreshold: 1000,
      ...config
    };

    this.metrics = {
      queryCount: 0,
      totalQueryTime: 0,
      slowQueries: 0,
      errors: 0
    };

    this.initializePrisma();
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Execute query with performance monitoring
   */
  async executeQuery<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation(this.prisma);
      const executionTime = Date.now() - startTime;
      
      this.updateMetrics(executionTime, false);
      
      if (this.config.enableLogging && executionTime > this.config.slowQueryThreshold) {
        this.logger.warn('Slow query detected', {
          operation: operationName,
          executionTime,
          threshold: this.config.slowQueryThreshold
        });
      }
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime, true);
      
      this.logger.error('Database query failed', {
        operation: operationName,
        executionTime,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Execute transaction with retry logic
   */
  async executeTransaction<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeQuery(
          (prisma) => prisma.$transaction(operation, {
            timeout: this.config.transactionTimeout
          }),
          `${operationName}_transaction_attempt_${attempt}`
        );
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          this.logger.error('Transaction failed after all retries', {
            operation: operationName,
            maxRetries,
            error: error.message
          });
          throw lastError;
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Get connection pool statistics
   */
  async getConnectionPoolStats(): Promise<ConnectionPoolStats> {
    try {
      // Get basic connection info from Prisma
      const result = await this.prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      ` as any[];

      const stats = result[0];
      
      return {
        activeConnections: parseInt(stats.active_connections) || 0,
        idleConnections: parseInt(stats.idle_connections) || 0,
        totalConnections: parseInt(stats.total_connections) || 0,
        waitingClients: 0, // Not directly available in PostgreSQL
        averageQueryTime: this.metrics.queryCount > 0 
          ? this.metrics.totalQueryTime / this.metrics.queryCount 
          : 0,
        slowQueries: this.metrics.slowQueries
      };
    } catch (error) {
      this.logger.error('Failed to get connection pool stats', { error: error.message });
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        waitingClients: 0,
        averageQueryTime: 0,
        slowQueries: 0
      };
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageQueryTime: this.metrics.queryCount > 0 
        ? this.metrics.totalQueryTime / this.metrics.queryCount 
        : 0,
      errorRate: this.metrics.queryCount > 0 
        ? (this.metrics.errors / this.metrics.queryCount) * 100 
        : 0
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      queryCount: 0,
      totalQueryTime: 0,
      slowQueries: 0,
      errors: 0
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
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
    await this.prisma.$disconnect();
  }

  // Private methods

  private initializePrisma(): void {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.buildConnectionString()
        }
      },
      log: this.config.enableLogging ? [
        { level: this.config.logLevel, emit: 'event' }
      ] : [],
      errorFormat: 'pretty'
    });

    // Add query logging middleware
    this.prisma.$use(async (params, next) => {
      const start = Date.now();
      
      try {
        const result = await next(params);
        const duration = Date.now() - start;
        
        if (this.config.enableLogging) {
          this.logger.debug('Database query executed', {
            model: params.model,
            action: params.action,
            duration
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        this.logger.error('Database query failed', {
          model: params.model,
          action: params.action,
          duration,
          error: error.message
        });
        throw error;
      }
    });

    // Add connection event listeners
    this.prisma.$on('query', (e) => {
      if (this.config.enableLogging) {
        this.logger.debug('SQL Query', {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target
        });
      }
    });
  }

  private buildConnectionString(): string {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Add connection pooling parameters
    const url = new URL(baseUrl);
    url.searchParams.set('connection_limit', this.config.connectionLimit.toString());
    url.searchParams.set('connect_timeout', this.config.connectionTimeout.toString());
    url.searchParams.set('pool_timeout', '20');
    url.searchParams.set('statement_timeout', this.config.queryTimeout.toString());
    url.searchParams.set('idle_in_transaction_session_timeout', this.config.transactionTimeout.toString());

    return url.toString();
  }

  private updateMetrics(executionTime: number, isError: boolean): void {
    this.metrics.queryCount++;
    this.metrics.totalQueryTime += executionTime;
    
    if (executionTime > this.config.slowQueryThreshold) {
      this.metrics.slowQueries++;
    }
    
    if (isError) {
      this.metrics.errors++;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let optimizedPrismaInstance: OptimizedPrismaClient | null = null;

export function getOptimizedPrismaClient(config?: Partial<DatabaseConfig>): OptimizedPrismaClient {
  if (!optimizedPrismaInstance) {
    optimizedPrismaInstance = new OptimizedPrismaClient(config);
  }
  return optimizedPrismaInstance;
}

// Export optimized Prisma client
export const optimizedPrisma = getOptimizedPrismaClient();
