// ===== SELECTOR STRATEGIES =====

import { Page } from 'playwright';
import { Logger } from '../logging/logger';

// ===== INTERFACES =====

export interface SelectorStrategy {
  name: string;
  selectors: string[];
  priority: number;
  fallbackSelectors?: string[];
  validation?: (element: any) => Promise<boolean>;
  retryCount?: number;
  delayMs?: number;
}

export interface SelectorResult {
  element: any;
  strategy: string;
  selector: string;
  duration: number;
  attempts: number;
}

export interface SelectorConfig {
  enableFallback: boolean;
  enableValidation: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableSmartSelectors: boolean;
}

// ===== SELECTOR STRATEGIES MANAGER =====

export class SelectorStrategiesManager {
  private logger: Logger;
  private config: SelectorConfig;
  private strategies: Map<string, SelectorStrategy> = new Map();
  private selectorHistory: Map<string, { success: number; failure: number; lastUsed: number }> = new Map();

  constructor(config: SelectorConfig) {
    this.config = config;
    this.logger = new Logger('INFO', { context: 'SelectorStrategiesManager' });
  }

  // ===== STRATEGY MANAGEMENT =====

  registerStrategy(strategy: SelectorStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.info(`📝 Registered selector strategy: ${strategy.name}`);
  }

  createStrategy(
    name: string,
    selectors: string[],
    options?: {
      priority?: number;
      fallbackSelectors?: string[];
      validation?: (element: any) => Promise<boolean>;
      retryCount?: number;
      delayMs?: number;
    }
  ): SelectorStrategy {
    const strategy: SelectorStrategy = {
      name,
      selectors,
      priority: options?.priority || 1,
      fallbackSelectors: options?.fallbackSelectors,
      validation: options?.validation,
      retryCount: options?.retryCount || 3,
      delayMs: options?.delayMs || 100
    };

    this.registerStrategy(strategy);
    return strategy;
  }

  // ===== SMART SELECTOR GENERATION =====

  generateSmartSelectors(baseSelectors: string[], elementType: string): string[] {
    const smartSelectors: string[] = [...baseSelectors];

    // Add data-testid variations
    baseSelectors.forEach(selector => {
      if (selector.includes('data-testid')) {
        const testId = selector.match(/data-testid="([^"]+)"/)?.[1];
        if (testId) {
          smartSelectors.push(`[data-testid*="${testId}"]`);
          smartSelectors.push(`[data-testid^="${testId}"]`);
          smartSelectors.push(`[data-testid$="${testId}"]`);
        }
      }
    });

    // Add class variations
    baseSelectors.forEach(selector => {
      if (selector.startsWith('.')) {
        const className = selector.substring(1);
        smartSelectors.push(`[class*="${className}"]`);
        smartSelectors.push(`[class^="${className}"]`);
        smartSelectors.push(`[class$="${className}"]`);
      }
    });

    // Add role-based selectors
    if (elementType === 'button') {
      smartSelectors.push('button');
      smartSelectors.push('[role="button"]');
      smartSelectors.push('input[type="button"]');
      smartSelectors.push('input[type="submit"]');
    } else if (elementType === 'input') {
      smartSelectors.push('input');
      smartSelectors.push('textarea');
      smartSelectors.push('[contenteditable="true"]');
    } else if (elementType === 'link') {
      smartSelectors.push('a');
      smartSelectors.push('[role="link"]');
    }

    // Add text-based selectors
    baseSelectors.forEach(selector => {
      if (selector.includes('text=')) {
        const text = selector.match(/text="([^"]+)"/)?.[1];
        if (text) {
          smartSelectors.push(`text="${text}"`);
          smartSelectors.push(`text=/.*${text}.*/i`);
          smartSelectors.push(`text=/^${text}$/i`);
        }
      }
    });

    // Add position-based selectors
    smartSelectors.push(':nth-child(1)');
    smartSelectors.push(':nth-child(2)');
    smartSelectors.push(':nth-child(3)');
    smartSelectors.push(':last-child');
    smartSelectors.push(':first-child');

    // Remove duplicates and return
    return Array.from(new Set(smartSelectors));
  }

  // ===== ELEMENT FINDING =====

  async findElement(
    page: Page,
    strategyName: string,
    options?: {
      timeout?: number;
      visible?: boolean;
      enableFallback?: boolean;
    }
  ): Promise<SelectorResult> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyName}`);
    }

    const timeout = options?.timeout || this.config.timeout;
    const visible = options?.visible !== false;
    const enableFallback = options?.enableFallback !== false;

    const startTime = Date.now();
    let attempts = 0;

    // Try primary selectors
    for (const selector of strategy.selectors) {
      try {
        attempts++;
        this.logger.debug(`🔍 Trying selector: ${selector} (attempt ${attempts})`);

        const element = await page.waitForSelector(selector, {
          timeout: Math.min(timeout / strategy.selectors.length, 5000),
          state: visible ? 'visible' : 'attached'
        });

        if (element) {
          // Validate element if validation function provided
          if (strategy.validation && this.config.enableValidation) {
            const isValid = await strategy.validation(element);
            if (!isValid) {
              this.logger.debug(`❌ Element validation failed for selector: ${selector}`);
              continue;
            }
          }

          const duration = Date.now() - startTime;
          this.updateSelectorHistory(selector, true);
          
          this.logger.info(`✅ Element found with selector: ${selector} in ${duration}ms`);
          
          return {
            element,
            strategy: strategyName,
            selector,
            duration,
            attempts
          };
        }
      } catch (error) {
        this.logger.debug(`❌ Selector failed: ${selector}`, { error });
        this.updateSelectorHistory(selector, false);
        
        // Add delay between attempts
        if (strategy.delayMs) {
          await this.delay(strategy.delayMs);
        }
      }
    }

    // Try fallback selectors if enabled
    if (enableFallback && strategy.fallbackSelectors) {
      this.logger.info(`🔄 Trying fallback selectors for strategy: ${strategyName}`);
      
      for (const selector of strategy.fallbackSelectors) {
        try {
          attempts++;
          this.logger.debug(`🔍 Trying fallback selector: ${selector} (attempt ${attempts})`);

          const element = await page.waitForSelector(selector, {
            timeout: Math.min(timeout / strategy.fallbackSelectors.length, 5000),
            state: visible ? 'visible' : 'attached'
          });

          if (element) {
            const duration = Date.now() - startTime;
            this.updateSelectorHistory(selector, true);
            
            this.logger.info(`✅ Element found with fallback selector: ${selector} in ${duration}ms`);
            
            return {
              element,
              strategy: strategyName,
              selector,
              duration,
              attempts
            };
          }
        } catch (error) {
          this.logger.debug(`❌ Fallback selector failed: ${selector}`, { error });
          this.updateSelectorHistory(selector, false);
          
          if (strategy.delayMs) {
            await this.delay(strategy.delayMs);
          }
        }
      }
    }

    // Generate and try smart selectors if enabled
    if (this.config.enableSmartSelectors) {
      this.logger.info(`🧠 Trying smart selectors for strategy: ${strategyName}`);
      
      const smartSelectors = this.generateSmartSelectors(strategy.selectors, 'element');
      
      for (const selector of smartSelectors) {
        if (strategy.selectors.includes(selector) || 
            (strategy.fallbackSelectors && strategy.fallbackSelectors.includes(selector))) {
          continue; // Skip already tried selectors
        }

        try {
          attempts++;
          this.logger.debug(`🔍 Trying smart selector: ${selector} (attempt ${attempts})`);

          const element = await page.waitForSelector(selector, {
            timeout: 2000, // Shorter timeout for smart selectors
            state: visible ? 'visible' : 'attached'
          });

          if (element) {
            const duration = Date.now() - startTime;
            this.updateSelectorHistory(selector, true);
            
            this.logger.info(`✅ Element found with smart selector: ${selector} in ${duration}ms`);
            
            return {
              element,
              strategy: strategyName,
              selector,
              duration,
              attempts
            };
          }
        } catch (error) {
          this.logger.debug(`❌ Smart selector failed: ${selector}`, { error });
          this.updateSelectorHistory(selector, false);
        }
      }
    }

    const duration = Date.now() - startTime;
    throw new Error(`Element not found with strategy: ${strategyName} after ${attempts} attempts in ${duration}ms`);
  }

  async findElementWithMultipleStrategies(
    page: Page,
    strategyNames: string[],
    options?: {
      timeout?: number;
      visible?: boolean;
      enableFallback?: boolean;
    }
  ): Promise<SelectorResult> {
    const timeout = options?.timeout || this.config.timeout;
    const perStrategyTimeout = timeout / strategyNames.length;

    for (const strategyName of strategyNames) {
      try {
        this.logger.debug(`🎯 Trying strategy: ${strategyName}`);
        
        const result = await this.findElement(page, strategyName, {
          ...options,
          timeout: perStrategyTimeout
        });

        this.logger.info(`✅ Element found with strategy: ${strategyName}`);
        return result;
      } catch (error) {
        this.logger.debug(`❌ Strategy failed: ${strategyName}`, { error });
        continue;
      }
    }

    throw new Error(`Element not found with any of the strategies: ${strategyNames.join(', ')}`);
  }

  // ===== SELECTOR OPTIMIZATION =====

  private updateSelectorHistory(selector: string, success: boolean): void {
    const history = this.selectorHistory.get(selector) || {
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

    this.selectorHistory.set(selector, history);
  }

  getSelectorStats(selector: string): { success: number; failure: number; successRate: number; lastUsed: number } | null {
    const history = this.selectorHistory.get(selector);
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

  getBestSelectors(limit: number = 10): Array<{ selector: string; stats: any }> {
    const selectors = Array.from(this.selectorHistory.entries())
      .map(([selector, history]) => ({
        selector,
        stats: this.getSelectorStats(selector)!
      }))
      .filter(item => item.stats)
      .sort((a, b) => b.stats.successRate - a.stats.successRate)
      .slice(0, limit);

    return selectors;
  }

  optimizeStrategy(strategyName: string): SelectorStrategy | null {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      return null;
    }

    // Reorder selectors by success rate
    const optimizedSelectors = strategy.selectors
      .map(selector => ({
        selector,
        stats: this.getSelectorStats(selector)
      }))
      .filter(item => item.stats)
      .sort((a, b) => (b.stats?.successRate || 0) - (a.stats?.successRate || 0))
      .map(item => item.selector);

    const optimizedStrategy: SelectorStrategy = {
      ...strategy,
      selectors: optimizedSelectors
    };

    this.logger.info(`🔧 Optimized strategy: ${strategyName}`);
    return optimizedStrategy;
  }

  // ===== UTILITY METHODS =====

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAllStrategies(): SelectorStrategy[] {
    return Array.from(this.strategies.values());
  }

  getStrategy(name: string): SelectorStrategy | undefined {
    return this.strategies.get(name);
  }

  removeStrategy(name: string): boolean {
    return this.strategies.delete(name);
  }

  clearHistory(): void {
    this.selectorHistory.clear();
    this.logger.info('🧹 Selector history cleared');
  }

  exportStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [selector, history] of Array.from(this.selectorHistory.entries())) {
      const total = history.success + history.failure;
      stats[selector] = {
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

// ===== CONVENIENCE FUNCTIONS =====

export function createSelectorStrategies(
  selectors: string[],
  name: string,
  options?: {
    priority?: number;
    fallbackSelectors?: string[];
    validation?: (element: any) => Promise<boolean>;
    retryCount?: number;
    delayMs?: number;
  }
): SelectorStrategy {
  return {
    name,
    selectors,
    priority: options?.priority || 1,
    fallbackSelectors: options?.fallbackSelectors,
    validation: options?.validation,
    retryCount: options?.retryCount || 3,
    delayMs: options?.delayMs || 100
  };
}

export function createCommonSelectors(): Record<string, SelectorStrategy> {
  return {
    loginButton: createSelectorStrategies([
      '[data-testid="login-button"]',
      '.login-btn',
      'button:has-text("Войти")',
      'button:has-text("Login")',
      '[type="submit"]:has-text("Войти")'
    ], 'login-button', {
      priority: 1,
      fallbackSelectors: [
        'button[class*="login"]',
        'a[href*="login"]',
        '[role="button"]:has-text("Войти")'
      ]
    }),

    usernameInput: createSelectorStrategies([
      'input[name="username"]',
      'input[name="email"]',
      'input[type="email"]',
      '#username',
      '#email',
      '[data-testid="username"]',
      '[data-testid="email"]'
    ], 'username-input', {
      priority: 1,
      fallbackSelectors: [
        'input[placeholder*="логин"]',
        'input[placeholder*="email"]',
        'input[placeholder*="username"]'
      ]
    }),

    passwordInput: createSelectorStrategies([
      'input[name="password"]',
      'input[type="password"]',
      '#password',
      '[data-testid="password"]'
    ], 'password-input', {
      priority: 1,
      fallbackSelectors: [
        'input[placeholder*="пароль"]',
        'input[placeholder*="password"]'
      ]
    }),

    submitButton: createSelectorStrategies([
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Отправить")',
      'button:has-text("Submit")',
      '[data-testid="submit"]'
    ], 'submit-button', {
      priority: 1,
      fallbackSelectors: [
        'button[class*="submit"]',
        'button[class*="send"]',
        '[role="button"]:has-text("Отправить")'
      ]
    }),

    suppliesLink: createSelectorStrategies([
      'a[href*="supplies"]',
      'a:has-text("Поставки")',
      'a:has-text("Supplies")',
      '[data-testid="supplies"]'
    ], 'supplies-link', {
      priority: 1,
      fallbackSelectors: [
        'a[class*="supplies"]',
        'a[class*="delivery"]',
        '[role="link"]:has-text("Поставки")'
      ]
    }),

    slotButton: createSelectorStrategies([
      'button:has-text("Забронировать")',
      'button:has-text("Book")',
      '[data-testid="book-slot"]',
      'button[class*="book"]',
      'button[class*="reserve"]'
    ], 'slot-button', {
      priority: 1,
      fallbackSelectors: [
        'button:has-text("Выбрать")',
        'button:has-text("Select")',
        '[role="button"]:has-text("Забронировать")'
      ]
    })
  };
}
