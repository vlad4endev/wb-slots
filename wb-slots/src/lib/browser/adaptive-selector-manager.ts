// ===== ADAPTIVE SELECTOR MANAGER =====

import { Page, ElementHandle } from 'playwright';
import { Logger } from '../logging/logger';

// ===== TYPES =====

export interface SelectorStrategy {
  name: string;
  selectors: string[];
  priority: number;
  fallback?: boolean;
}

export interface SelectorResult {
  element: ElementHandle | null;
  selector: string;
  strategy: string;
  confidence: number;
  timeToFind: number;
}

export interface SelectorConfig {
  maxWaitTime: number;
  retryDelay: number;
  enableFallback: boolean;
  enableSmartSearch: boolean;
  enableXPath: boolean;
}

// ===== CONSTANTS =====

const DEFAULT_CONFIG: SelectorConfig = {
  maxWaitTime: 30000,
  retryDelay: 1000,
  enableFallback: true,
  enableSmartSearch: true,
  enableXPath: true
};

// ===== MAIN CLASS =====

export class AdaptiveSelectorManager {
  private static instance: AdaptiveSelectorManager;
  private logger: Logger;
  private config: SelectorConfig;
  private selectorCache: Map<string, SelectorResult> = new Map();

  private constructor(config?: Partial<SelectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger('INFO', { service: 'AdaptiveSelectorManager' });
  }

  public static getInstance(config?: Partial<SelectorConfig>): AdaptiveSelectorManager {
    if (!AdaptiveSelectorManager.instance) {
      AdaptiveSelectorManager.instance = new AdaptiveSelectorManager(config);
    }
    return AdaptiveSelectorManager.instance;
  }

  /**
   * Поиск элемента с адаптивными стратегиями
   */
  async findElement(
    page: Page,
    strategies: SelectorStrategy[],
    context?: string
  ): Promise<SelectorResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(strategies, context);

    // Проверяем кэш
    if (this.selectorCache.has(cacheKey)) {
      const cached = this.selectorCache.get(cacheKey)!;
      this.logger.info('Using cached selector result', { 
        selector: cached.selector, 
        strategy: cached.strategy 
      });
      return cached;
    }

    // Сортируем стратегии по приоритету
    const sortedStrategies = strategies.sort((a, b) => b.priority - a.priority);

    for (const strategy of sortedStrategies) {
      try {
        this.logger.info(`Trying strategy: ${strategy.name}`, { 
          selectors: strategy.selectors.length 
        });

        const result = await this.tryStrategy(page, strategy, context);
        
        if (result.element) {
          result.timeToFind = Date.now() - startTime;
          
          // Кэшируем успешный результат
          this.selectorCache.set(cacheKey, result);
          
          this.logger.info(`Element found with strategy: ${strategy.name}`, {
            selector: result.selector,
            confidence: result.confidence,
            timeToFind: result.timeToFind
          });

          return result;
        }
      } catch (error) {
        this.logger.warn(`Strategy ${strategy.name} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    // Если все стратегии не сработали, пробуем умный поиск
    if (this.config.enableSmartSearch) {
      const smartResult = await this.smartSearch(page, strategies, context);
      if (smartResult.element) {
        smartResult.timeToFind = Date.now() - startTime;
        this.selectorCache.set(cacheKey, smartResult);
        return smartResult;
      }
    }

    // Возвращаем неуспешный результат
    return {
      element: null,
      selector: '',
      strategy: 'none',
      confidence: 0,
      timeToFind: Date.now() - startTime
    };
  }

  /**
   * Попытка стратегии поиска
   */
  private async tryStrategy(
    page: Page,
    strategy: SelectorStrategy,
    context?: string
  ): Promise<SelectorResult> {
    for (const selector of strategy.selectors) {
      try {
        // Ждем элемент с таймаутом
        const element = await page.waitForSelector(selector, { 
          timeout: this.config.maxWaitTime / strategy.selectors.length 
        });

        if (element) {
          // Проверяем видимость элемента
          const isVisible = await element.isVisible();
          if (!isVisible) {
            this.logger.warn('Element found but not visible', { selector });
            continue;
          }

          // Вычисляем уверенность
          const confidence = this.calculateConfidence(selector, strategy, isVisible);

          return {
            element,
            selector,
            strategy: strategy.name,
            confidence,
            timeToFind: 0 // Будет установлено позже
          };
        }
      } catch (error) {
        this.logger.debug(`Selector failed: ${selector}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    return {
      element: null,
      selector: '',
      strategy: strategy.name,
      confidence: 0,
      timeToFind: 0
    };
  }

  /**
   * Умный поиск элементов
   */
  private async smartSearch(
    page: Page,
    strategies: SelectorStrategy[],
    context?: string
  ): Promise<SelectorResult> {
    this.logger.info('Starting smart search', { context });

    try {
      // Собираем все селекторы
      const allSelectors = strategies.flatMap(s => s.selectors);
      
      // Пробуем найти элементы по тексту
      if (context) {
        const textSelectors = [
          `text="${context}"`,
          `text=/.*${context}.*/i`,
          `[title*="${context}"]`,
          `[alt*="${context}"]`,
          `[aria-label*="${context}"]`
        ];

        for (const selector of textSelectors) {
          try {
            const element = await page.waitForSelector(selector, { timeout: 5000 });
            if (element && await element.isVisible()) {
              return {
                element,
                selector,
                strategy: 'smart-text-search',
                confidence: 0.7,
                timeToFind: 0
              };
            }
          } catch {
            continue;
          }
        }
      }

      // Пробуем XPath поиск
      if (this.config.enableXPath) {
        const xpathSelectors = this.generateXPathSelectors(strategies, context);
        
        for (const xpath of xpathSelectors) {
          try {
            const element = await page.waitForSelector(`xpath=${xpath}`, { timeout: 5000 });
            if (element && await element.isVisible()) {
              return {
                element,
                selector: xpath,
                strategy: 'smart-xpath-search',
                confidence: 0.6,
                timeToFind: 0
              };
            }
          } catch {
            continue;
          }
        }
      }

      // Пробуем поиск по частичным селекторам
      const partialSelectors = this.generatePartialSelectors(allSelectors);
      
      for (const selector of partialSelectors) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 5000 });
          if (element && await element.isVisible()) {
            return {
              element,
              selector,
              strategy: 'smart-partial-search',
              confidence: 0.5,
              timeToFind: 0
            };
          }
        } catch {
          continue;
        }
      }

    } catch (error) {
      this.logger.warn('Smart search failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return {
      element: null,
      selector: '',
      strategy: 'smart-search',
      confidence: 0,
      timeToFind: 0
    };
  }

  /**
   * Генерация XPath селекторов
   */
  private generateXPathSelectors(strategies: SelectorStrategy[], context?: string): string[] {
    const xpaths: string[] = [];

    // Базовые XPath селекторы
    xpaths.push('//button[contains(@class, "btn")]');
    xpaths.push('//input[@type="text" or @type="email" or @type="password"]');
    xpaths.push('//a[contains(@href, "supplies")]');
    xpaths.push('//div[contains(@class, "supply")]');

    if (context) {
      xpaths.push(`//*[contains(text(), "${context}")]`);
      xpaths.push(`//*[contains(@title, "${context}")]`);
      xpaths.push(`//*[contains(@aria-label, "${context}")]`);
    }

    // Генерируем XPath из CSS селекторов
    for (const strategy of strategies) {
      for (const selector of strategy.selectors) {
        const xpath = this.cssToXPath(selector);
        if (xpath) {
          xpaths.push(xpath);
        }
      }
    }

    return xpaths;
  }

  /**
   * Генерация частичных селекторов
   */
  private generatePartialSelectors(selectors: string[]): string[] {
    const partials: string[] = [];

    for (const selector of selectors) {
      // Извлекаем части селектора
      const parts = selector.split(/[ >+~]/);
      
      for (const part of parts) {
        if (part.length > 3 && !part.includes('*')) {
          partials.push(part);
        }
      }

      // Генерируем селекторы по классам
      const classMatches = selector.match(/\.[\w-]+/g);
      if (classMatches) {
        for (const className of classMatches) {
          partials.push(`[class*="${className.substring(1)}"]`);
        }
      }

      // Генерируем селекторы по атрибутам
      const attrMatches = selector.match(/\[([\w-]+)[*^$]?=.*?\]/g);
      if (attrMatches) {
        for (const attr of attrMatches) {
          partials.push(attr);
        }
      }
    }

    return [...new Set(partials)]; // Убираем дубликаты
  }

  /**
   * Конвертация CSS селектора в XPath
   */
  private cssToXPath(selector: string): string | null {
    try {
      // Простые конвертации
      if (selector.startsWith('#')) {
        return `//*[@id="${selector.substring(1)}"]`;
      }
      
      if (selector.startsWith('.')) {
        return `//*[contains(@class, "${selector.substring(1)}")]`;
      }
      
      if (selector.includes('[') && selector.includes(']')) {
        const tag = selector.split('[')[0] || '*';
        const attr = selector.match(/\[([\w-]+)=['"](.*?)['"]\]/);
        if (attr) {
          return `//${tag}[@${attr[1]}="${attr[2]}"]`;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Вычисление уверенности в найденном элементе
   */
  private calculateConfidence(selector: string, strategy: SelectorStrategy, isVisible: boolean): number {
    let confidence = 0.5; // Базовая уверенность

    // Увеличиваем уверенность для более специфичных селекторов
    if (selector.includes('[data-testid]')) confidence += 0.3;
    if (selector.includes('[id=')) confidence += 0.2;
    if (selector.includes('[class=')) confidence += 0.1;
    if (selector.includes('text=')) confidence += 0.2;

    // Учитываем приоритет стратегии
    confidence += (strategy.priority / 100) * 0.2;

    // Учитываем видимость
    if (isVisible) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Генерация ключа кэша
   */
  private generateCacheKey(strategies: SelectorStrategy[], context?: string): string {
    const strategyNames = strategies.map(s => s.name).sort().join(',');
    const contextPart = context ? `:${context}` : '';
    return `${strategyNames}${contextPart}`;
  }

  /**
   * Очистка кэша
   */
  clearCache(): void {
    this.selectorCache.clear();
    this.logger.info('Selector cache cleared');
  }

  /**
   * Получение статистики кэша
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: Array<{
      key: string;
      strategy: string;
      confidence: number;
    }>;
  } {
    const entries = Array.from(this.selectorCache.entries()).map(([key, result]) => ({
      key,
      strategy: result.strategy,
      confidence: result.confidence
    }));

    return {
      size: this.selectorCache.size,
      hitRate: 0, // TODO: Реализовать подсчет hit rate
      entries
    };
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig: Partial<SelectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Selector configuration updated', this.config);
  }
}

// ===== SINGLETON INSTANCE =====

export const adaptiveSelectorManager = AdaptiveSelectorManager.getInstance();
