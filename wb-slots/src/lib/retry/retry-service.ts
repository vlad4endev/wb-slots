// ========================================
// Universal Retry Service with Exponential Backoff
// ========================================

import { Logger } from '../logging/logger';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
  retryableStatusCodes: number[];
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  lastAttemptTime: number;
}

export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageAttempts: number;
  averageTime: number;
  retryableErrors: number;
  nonRetryableErrors: number;
}

export class RetryService {
  private logger: Logger;
  private stats: RetryStats;
  private defaultConfig: RetryConfig;

  constructor(defaultConfig: Partial<RetryConfig> = {}) {
    this.logger = new Logger('INFO', { service: 'RetryService' });
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageAttempts: 0,
      averageTime: 0,
      retryableErrors: 0,
      nonRetryableErrors: 0
    };
    this.defaultConfig = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENETUNREACH',
        'EAI_AGAIN',
        'Request timeout',
        'Network error',
        'Connection error'
      ],
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      ...defaultConfig
    };
  }

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    operationName: string = 'unknown'
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();
    let lastError: Error;
    let attempts = 0;

    this.logger.debug(`Starting retry operation: ${operationName}`, {
      maxAttempts: finalConfig.maxAttempts,
      initialDelay: finalConfig.initialDelay
    });

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      attempts = attempt;
      const attemptStartTime = Date.now();

      try {
        const result = await operation();
        const totalTime = Date.now() - startTime;
        const lastAttemptTime = Date.now() - attemptStartTime;

        this.updateStats(true, attempts, totalTime, false);
        
        this.logger.info(`Operation succeeded: ${operationName}`, {
          attempt,
          totalTime,
          lastAttemptTime
        });

        return {
          success: true,
          result,
          attempts,
          totalTime,
          lastAttemptTime
        };
      } catch (error) {
        lastError = error as Error;
        const attemptTime = Date.now() - attemptStartTime;
        const isRetryable = this.isRetryableError(error, finalConfig);

        this.logger.warn(`Operation failed: ${operationName}`, {
          attempt,
          maxAttempts: finalConfig.maxAttempts,
          error: error.message,
          isRetryable,
          attemptTime
        });

        if (!isRetryable || attempt === finalConfig.maxAttempts) {
          const totalTime = Date.now() - startTime;
          this.updateStats(false, attempts, totalTime, !isRetryable);
          
          this.logger.error(`Operation failed permanently: ${operationName}`, {
            attempts,
            totalTime,
            error: error.message,
            isRetryable
          });

          return {
            success: false,
            error: lastError,
            attempts,
            totalTime,
            lastAttemptTime: attemptTime
          };
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, finalConfig);
        
        this.logger.debug(`Retrying operation: ${operationName}`, {
          attempt,
          nextAttempt: attempt + 1,
          delay
        });

        await this.sleep(delay);
      }
    }

    // This should never be reached, but just in case
    const totalTime = Date.now() - startTime;
    this.updateStats(false, attempts, totalTime, false);
    
    return {
      success: false,
      error: lastError!,
      attempts,
      totalTime,
      lastAttemptTime: 0
    };
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    operationName: string = 'unknown',
    circuitBreakerConfig: {
      failureThreshold: number;
      recoveryTimeout: number;
      monitoringPeriod: number;
    } = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 60000
    }
  ): Promise<RetryResult<T>> {
    // Simple circuit breaker implementation
    const circuitKey = `circuit_breaker_${operationName}`;
    const circuitState = this.getCircuitState(circuitKey, circuitBreakerConfig);

    if (circuitState === 'OPEN') {
      this.logger.warn(`Circuit breaker is OPEN for: ${operationName}`);
      return {
        success: false,
        error: new Error('Circuit breaker is open'),
        attempts: 0,
        totalTime: 0,
        lastAttemptTime: 0
      };
    }

    const result = await this.execute(operation, config, operationName);

    // Update circuit breaker state
    this.updateCircuitState(circuitKey, result.success, circuitBreakerConfig);

    return result;
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageAttempts: 0,
      averageTime: 0,
      retryableErrors: 0,
      nonRetryableErrors: 0
    };
  }

  /**
   * Health check
   */
  healthCheck(): { status: 'healthy' | 'unhealthy'; stats: RetryStats } {
    const successRate = this.stats.totalAttempts > 0 
      ? (this.stats.successfulAttempts / this.stats.totalAttempts) * 100 
      : 100;

    return {
      status: successRate > 80 ? 'healthy' : 'unhealthy',
      stats: this.getStats()
    };
  }

  // Private methods

  private isRetryableError(error: any, config: RetryConfig): boolean {
    // Check error message
    if (error.message) {
      for (const retryableError of config.retryableErrors) {
        if (error.message.includes(retryableError)) {
          return true;
        }
      }
    }

    // Check error code
    if (error.code) {
      for (const retryableError of config.retryableErrors) {
        if (error.code === retryableError) {
          return true;
        }
      }
    }

    // Check HTTP status code
    if (error.status || error.statusCode) {
      const statusCode = error.status || error.statusCode;
      return config.retryableStatusCodes.includes(statusCode);
    }

    // Check if it's a network error
    if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
      return true;
    }

    return false;
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(0, Math.floor(delay));
  }

  private updateStats(success: boolean, attempts: number, totalTime: number, nonRetryable: boolean): void {
    this.stats.totalAttempts++;
    
    if (success) {
      this.stats.successfulAttempts++;
    } else {
      this.stats.failedAttempts++;
      if (nonRetryable) {
        this.stats.nonRetryableErrors++;
      } else {
        this.stats.retryableErrors++;
      }
    }

    // Update averages
    this.stats.averageAttempts = this.stats.totalAttempts > 0 
      ? (this.stats.averageAttempts * (this.stats.totalAttempts - 1) + attempts) / this.stats.totalAttempts
      : attempts;

    this.stats.averageTime = this.stats.totalAttempts > 0
      ? (this.stats.averageTime * (this.stats.totalAttempts - 1) + totalTime) / this.stats.totalAttempts
      : totalTime;
  }

  private getCircuitState(circuitKey: string, config: any): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    // Simple in-memory circuit breaker state
    // In production, this should be stored in Redis or similar
    const state = (global as any).circuitBreakerStates || {};
    const circuitState = state[circuitKey];
    
    if (!circuitState) {
      return 'CLOSED';
    }

    const now = Date.now();
    
    if (circuitState.state === 'OPEN') {
      if (now - circuitState.lastFailureTime > config.recoveryTimeout) {
        return 'HALF_OPEN';
      }
      return 'OPEN';
    }

    return circuitState.state;
  }

  private updateCircuitState(circuitKey: string, success: boolean, config: any): void {
    const state = (global as any).circuitBreakerStates || {};
    const now = Date.now();
    
    if (!state[circuitKey]) {
      state[circuitKey] = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0
      };
    }

    const circuitState = state[circuitKey];

    if (success) {
      if (circuitState.state === 'HALF_OPEN') {
        circuitState.state = 'CLOSED';
        circuitState.failureCount = 0;
      }
    } else {
      circuitState.failureCount++;
      circuitState.lastFailureTime = now;
      
      if (circuitState.failureCount >= config.failureThreshold) {
        circuitState.state = 'OPEN';
      }
    }

    (global as any).circuitBreakerStates = state;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let retryServiceInstance: RetryService | null = null;

export function getRetryService(config?: Partial<RetryConfig>): RetryService {
  if (!retryServiceInstance) {
    retryServiceInstance = new RetryService(config);
  }
  return retryServiceInstance;
}

// Predefined configurations for different services
export const RETRY_CONFIGS = {
  WB_API: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'Request timeout'],
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  },
  TELEGRAM: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    jitter: true,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'Network error'],
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  },
  EMAIL: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'Connection error'],
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  },
  DATABASE: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'Connection terminated'],
    retryableStatusCodes: []
  }
};
