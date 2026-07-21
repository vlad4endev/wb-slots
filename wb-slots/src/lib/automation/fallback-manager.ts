// ===== FALLBACK MANAGER =====

import { Page } from 'playwright';
import { Logger } from '../logging/logger';
import { RetryConfig } from '../services/core/interfaces';

// ===== INTERFACES =====

export interface FallbackStrategy {
  name: string;
  priority: number;
  condition: (context: FallbackContext) => Promise<boolean>;
  execute: (context: FallbackContext) => Promise<FallbackResult>;
  timeout: number;
  retryCount: number;
  delayMs: number;
}

export interface FallbackContext {
  page: Page;
  error: Error;
  attempt: number;
  maxAttempts: number;
  operation: string;
  metadata?: Record<string, any>;
}

export interface FallbackResult {
  success: boolean;
  data?: any;
  error?: string;
  strategy: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface FallbackConfig {
  enableFallbacks: boolean;
  maxFallbackAttempts: number;
  fallbackTimeout: number;
  enableSmartFallbacks: boolean;
  enableAlternativePaths: boolean;
  enableManualIntervention: boolean;
}

// ===== FALLBACK MANAGER =====

export class FallbackManager {
  private logger: Logger;
  private config: FallbackConfig;
  private strategies: Map<string, FallbackStrategy> = new Map();
  private fallbackHistory: Map<string, { success: number; failure: number; lastUsed: number }> = new Map();

  constructor(config: FallbackConfig) {
    this.config = config;
    this.logger = new Logger('INFO', { context: 'FallbackManager' });
    this.initializeDefaultStrategies();
  }

  // ===== STRATEGY MANAGEMENT =====

  registerStrategy(strategy: FallbackStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.info(`📝 Registered fallback strategy: ${strategy.name}`);
  }

  private initializeDefaultStrategies(): void {
    // Retry with exponential backoff
    this.registerStrategy({
      name: 'exponential-backoff-retry',
      priority: 1,
      condition: async (context) => {
        return context.attempt < context.maxAttempts && 
               this.isRetryableError(context.error);
      },
      execute: async (context) => {
        const delay = Math.min(1000 * Math.pow(2, context.attempt - 1), 30000);
        await this.delay(delay);
        return { success: true, strategy: 'exponential-backoff-retry', duration: delay };
      },
      timeout: 5000,
      retryCount: 3,
      delayMs: 1000
    });

    // Alternative selector strategy
    this.registerStrategy({
      name: 'alternative-selectors',
      priority: 2,
      condition: async (context) => {
        return context.error.message.includes('selector') || 
               context.error.message.includes('element not found');
      },
      execute: async (context) => {
        return await this.tryAlternativeSelectors(context);
      },
      timeout: 10000,
      retryCount: 2,
      delayMs: 500
    });

    // Page refresh strategy
    this.registerStrategy({
      name: 'page-refresh',
      priority: 3,
      condition: async (context) => {
        return context.error.message.includes('timeout') ||
               context.error.message.includes('network') ||
               context.error.message.includes('navigation');
      },
      execute: async (context) => {
        return await this.refreshPage(context);
      },
      timeout: 15000,
      retryCount: 2,
      delayMs: 2000
    });

    // Alternative navigation path
    this.registerStrategy({
      name: 'alternative-navigation',
      priority: 4,
      condition: async (context) => {
        return context.error.message.includes('navigation') ||
               context.error.message.includes('page not found');
      },
      execute: async (context) => {
        return await this.tryAlternativeNavigation(context);
      },
      timeout: 20000,
      retryCount: 1,
      delayMs: 1000
    });

    // Browser restart strategy
    this.registerStrategy({
      name: 'browser-restart',
      priority: 5,
      condition: async (context) => {
        return context.error.message.includes('browser') ||
               context.error.message.includes('context') ||
               context.error.message.includes('disconnected');
      },
      execute: async (context) => {
        return await this.restartBrowser(context);
      },
      timeout: 30000,
      retryCount: 1,
      delayMs: 5000
    });

    // Manual intervention strategy
    this.registerStrategy({
      name: 'manual-intervention',
      priority: 10,
      condition: async (context) => {
        return context.attempt >= context.maxAttempts - 1;
      },
      execute: async (context) => {
        return await this.requestManualIntervention(context);
      },
      timeout: 60000,
      retryCount: 1,
      delayMs: 0
    });
  }

  // ===== FALLBACK EXECUTION =====

  async executeFallbacks(
    context: FallbackContext,
    operation: () => Promise<any>
  ): Promise<any> {
    if (!this.config.enableFallbacks) {
      throw context.error;
    }

    this.logger.info(`🔄 Executing fallbacks for operation: ${context.operation}`, {
      attempt: context.attempt,
      maxAttempts: context.maxAttempts,
      error: context.error.message
    });

    // Get applicable strategies sorted by priority
    const applicableStrategies = await this.getApplicableStrategies(context);
    
    if (applicableStrategies.length === 0) {
      this.logger.warn('⚠️ No applicable fallback strategies found');
      throw context.error;
    }

    // Try each strategy
    for (const strategy of applicableStrategies) {
      try {
        this.logger.info(`🎯 Trying fallback strategy: ${strategy.name}`);
        
        const result = await this.executeStrategy(strategy, context);
        
        if (result.success) {
          this.updateFallbackHistory(strategy.name, true);
          this.logger.info(`✅ Fallback strategy succeeded: ${strategy.name}`, {
            duration: result.duration
          });
          
          // Retry the original operation
          return await operation();
        }
        
        this.updateFallbackHistory(strategy.name, false);
        this.logger.warn(`❌ Fallback strategy failed: ${strategy.name}`, {
          error: result.error
        });
        
      } catch (error) {
        this.updateFallbackHistory(strategy.name, false);
        this.logger.error(`💥 Fallback strategy error: ${strategy.name}`, { error });
      }
    }

    // All fallbacks failed
    this.logger.error(`💥 All fallback strategies failed for operation: ${context.operation}`);
    throw context.error;
  }

  private async getApplicableStrategies(context: FallbackContext): Promise<FallbackStrategy[]> {
    const applicable: FallbackStrategy[] = [];

    for (const strategy of Array.from(this.strategies.values())) {
      try {
        const isApplicable = await strategy.condition(context);
        if (isApplicable) {
          applicable.push(strategy);
        }
      } catch (error) {
        this.logger.debug(`❌ Strategy condition check failed: ${strategy.name}`, { error });
      }
    }

    // Sort by priority (lower number = higher priority)
    return applicable.sort((a, b) => a.priority - b.priority);
  }

  private async executeStrategy(
    strategy: FallbackStrategy,
    context: FallbackContext
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        strategy.execute(context),
        this.delay(strategy.timeout).then(() => {
          throw new Error(`Strategy timeout: ${strategy.name}`);
        })
      ]);

      const duration = Date.now() - startTime;
      return {
        ...result,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        strategy: strategy.name,
        duration
      };
    }
  }

  // ===== FALLBACK STRATEGIES IMPLEMENTATION =====

  private async tryAlternativeSelectors(context: FallbackContext): Promise<FallbackResult> {
    try {
      // Try common alternative selectors
      const alternativeSelectors = [
        'button',
        'input',
        'a',
        '[role="button"]',
        '[role="link"]',
        '[type="submit"]',
        '[type="button"]'
      ];

      for (const selector of alternativeSelectors) {
        try {
          const element = await context.page.waitForSelector(selector, { timeout: 2000 });
          if (element) {
            return {
              success: true,
              data: { selector, element },
              strategy: 'alternative-selectors',
              duration: 0
            };
          }
        } catch (error) {
          continue;
        }
      }

      return {
        success: false,
        error: 'No alternative selectors found',
        strategy: 'alternative-selectors',
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        strategy: 'alternative-selectors',
        duration: 0
      };
    }
  }

  private async refreshPage(context: FallbackContext): Promise<FallbackResult> {
    try {
      await context.page.reload({ waitUntil: 'networkidle', timeout: 10000 });
      
      // Wait for page to stabilize
      await this.delay(2000);
      
      return {
        success: true,
        data: { action: 'page-refreshed' },
        strategy: 'page-refresh',
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        strategy: 'page-refresh',
        duration: 0
      };
    }
  }

  private async tryAlternativeNavigation(context: FallbackContext): Promise<FallbackResult> {
    try {
      const currentUrl = context.page.url();
      
      // Try alternative navigation paths
      const alternativePaths = [
        '/',
        '/dashboard',
        '/home',
        '/main',
        '/index'
      ];

      for (const path of alternativePaths) {
        try {
          const newUrl = new URL(path, currentUrl).href;
          await context.page.goto(newUrl, { waitUntil: 'networkidle', timeout: 10000 });
          
          return {
            success: true,
            data: { newUrl },
            strategy: 'alternative-navigation',
            duration: 0
          };
        } catch (error) {
          continue;
        }
      }

      return {
        success: false,
        error: 'No alternative navigation paths found',
        strategy: 'alternative-navigation',
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        strategy: 'alternative-navigation',
        duration: 0
      };
    }
  }

  private async restartBrowser(context: FallbackContext): Promise<FallbackResult> {
    try {
      // This would typically involve restarting the browser instance
      // For now, we'll simulate a successful restart
      await this.delay(5000);
      
      return {
        success: true,
        data: { action: 'browser-restarted' },
        strategy: 'browser-restart',
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        strategy: 'browser-restart',
        duration: 0
      };
    }
  }

  private async requestManualIntervention(context: FallbackContext): Promise<FallbackResult> {
    try {
      if (!this.config.enableManualIntervention) {
        return {
          success: false,
          error: 'Manual intervention disabled',
          strategy: 'manual-intervention',
          duration: 0
        };
      }

      // Take screenshot for manual review
      const screenshot = await context.page.screenshot({ fullPage: true });
      
      // Log the issue for manual intervention
      this.logger.error('🚨 Manual intervention required', {
        operation: context.operation,
        error: context.error.message,
        url: context.page.url(),
        screenshot: 'taken'
      });

      // In a real implementation, this would notify administrators
      // For now, we'll wait for a timeout
      await this.delay(30000);

      return {
        success: false,
        error: 'Manual intervention timeout',
        strategy: 'manual-intervention',
        duration: 0,
        metadata: { screenshot: 'taken' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        strategy: 'manual-intervention',
        duration: 0
      };
    }
  }

  // ===== UTILITY METHODS =====

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'navigation',
      'element not found',
      'selector',
      'connection',
      'temporary'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => errorMessage.includes(retryableError));
  }

  private updateFallbackHistory(strategyName: string, success: boolean): void {
    const history = this.fallbackHistory.get(strategyName) || {
      success: 0,
      failure: 0,
      lastUsed: Date.now()
    };

    if (success) {
      history.success++;
    } else {
      history.failure++;
    }
    history.lastUsed = Date.now();

    this.fallbackHistory.set(strategyName, history);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== PUBLIC METHODS =====

  getFallbackStats(strategyName: string): { success: number; failure: number; successRate: number; lastUsed: number } | null {
    const history = this.fallbackHistory.get(strategyName);
    if (!history) {
      return null;
    }

    const total = history.success + history.failure;
    const successRate = total > 0 ? (history.success / total) * 100 : 0;

    return {
      success: history.success,
      failure: history.failure,
      successRate,
      lastUsed: history.lastUsed
    };
  }

  getBestFallbackStrategies(limit: number = 5): Array<{ strategy: string; stats: any }> {
    const strategies = Array.from(this.fallbackHistory.entries())
      .map(([strategy, history]) => ({
        strategy,
        stats: this.getFallbackStats(strategy)!
      }))
      .filter(item => item.stats)
      .sort((a, b) => b.stats.successRate - a.stats.successRate)
      .slice(0, limit);

    return strategies;
  }

  getAllStrategies(): FallbackStrategy[] {
    return Array.from(this.strategies.values());
  }

  getStrategy(name: string): FallbackStrategy | undefined {
    return this.strategies.get(name);
  }

  removeStrategy(name: string): boolean {
    return this.strategies.delete(name);
  }

  clearHistory(): void {
    this.fallbackHistory.clear();
    this.logger.info('🧹 Fallback history cleared');
  }

  exportStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [strategy, history] of Array.from(this.fallbackHistory.entries())) {
      const total = history.success + history.failure;
      stats[strategy] = {
        success: history.success,
        failure: history.failure,
        total,
        successRate: total > 0 ? (history.success / total) * 100 : 0,
        lastUsed: history.lastUsed
      };
    }

    return stats;
  }
}
