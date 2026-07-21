// ===== UNIVERSAL BROWSER SERVICE =====

import { Page, ElementHandle } from 'playwright';
import { robustBrowserManager, BrowserInstance } from './robust-browser-manager';
import { adaptiveSelectorManager, SelectorStrategy, SelectorResult } from './adaptive-selector-manager';
import { adaptiveTimeoutManager, TimeoutMetrics } from './adaptive-timeout-manager';
import { antibotProtection, DetectionResult } from './antibot-protection';
import { Logger } from '../logging/logger';

// ===== TYPES =====

export interface BrowserServiceConfig {
  instanceId: string;
  enableAntibot: boolean;
  enableAdaptiveTimeouts: boolean;
  enableSelectorResilience: boolean;
  enableHumanBehavior: boolean;
  customConfig?: any;
}

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metrics: {
    duration: number;
    attempts: number;
    detectionResult?: DetectionResult;
  };
}

export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
  retries?: number;
}

export interface ElementInteractionOptions {
  timeout?: number;
  retries?: number;
  humanBehavior?: boolean;
  scrollIntoView?: boolean;
}

// ===== MAIN CLASS =====

export class UniversalBrowserService {
  private static instance: UniversalBrowserService;
  private logger: Logger;
  private currentInstance: BrowserInstance | null = null;
  private config: BrowserServiceConfig;

  private constructor(config: BrowserServiceConfig) {
    this.config = config;
    this.logger = new Logger('INFO', { service: 'UniversalBrowserService' });
  }

  public static async create(config: BrowserServiceConfig): Promise<UniversalBrowserService> {
    const service = new UniversalBrowserService(config);
    await service.initialize();
    return service;
  }

  /**
   * Инициализация сервиса
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Universal Browser Service', { 
        instanceId: this.config.instanceId 
      });

      // Создаем экземпляр браузера
      this.currentInstance = await robustBrowserManager.createInstance(
        this.config.instanceId,
        this.config.customConfig
      );

      // Применяем антибот защиту
      if (this.config.enableAntibot) {
        await antibotProtection.applyProtection(this.currentInstance.page);
      }

      this.logger.info('Universal Browser Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Universal Browser Service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Навигация к URL
   */
  async navigateTo(
    url: string, 
    options: NavigationOptions = {}
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = options.retries || 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        this.logger.info(`Navigating to ${url} (attempt ${attempts})`);

        if (!this.currentInstance) {
          throw new Error('Browser instance not initialized');
        }

        const timeout = this.config.enableAdaptiveTimeouts
          ? adaptiveTimeoutManager.getTimeout('navigation', { networkOperation: true })
          : options.timeout || 60000;

        await this.currentInstance.page.goto(url, {
          waitUntil: options.waitUntil || 'domcontentloaded',
          timeout
        });

        // Проверяем на обнаружение ботов
        let detectionResult: DetectionResult | undefined;
        if (this.config.enableAntibot) {
          detectionResult = await antibotProtection.checkDetection(this.currentInstance.page);
          if (detectionResult.isDetected) {
            this.logger.warn('Bot detection triggered', detectionResult);
            if (attempts < maxAttempts) {
              await this.delay(5000);
              continue;
            }
          }
        }

        // Записываем метрики
        if (this.config.enableAdaptiveTimeouts) {
          const metrics: TimeoutMetrics = {
            operation: 'navigation',
            duration: Date.now() - startTime,
            success: true,
            timestamp: new Date(),
            context: { url, attempts }
          };
          adaptiveTimeoutManager.recordMetrics(metrics);
        }

        return {
          success: true,
          metrics: {
            duration: Date.now() - startTime,
            attempts,
            detectionResult
          }
        };

      } catch (error) {
        this.logger.warn(`Navigation attempt ${attempts} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (attempts >= maxAttempts) {
          // Записываем метрики неудачи
          if (this.config.enableAdaptiveTimeouts) {
            const metrics: TimeoutMetrics = {
              operation: 'navigation',
              duration: Date.now() - startTime,
              success: false,
              timestamp: new Date(),
              context: { url, attempts, error: error instanceof Error ? error.message : 'Unknown error' }
            };
            adaptiveTimeoutManager.recordMetrics(metrics);
          }

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Navigation failed',
            metrics: {
              duration: Date.now() - startTime,
              attempts
            }
          };
        }

        await this.delay(2000 * attempts);
      }
    }

    return {
      success: false,
      error: 'Navigation failed after all attempts',
      metrics: {
        duration: Date.now() - startTime,
        attempts
      }
    };
  }

  /**
   * Поиск элемента с адаптивными стратегиями
   */
  async findElement(
    strategies: SelectorStrategy[],
    context?: string,
    options: ElementInteractionOptions = {}
  ): Promise<OperationResult<ElementHandle>> {
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = options.retries || 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        this.logger.info(`Finding element (attempt ${attempts})`, { context });

        if (!this.currentInstance) {
          throw new Error('Browser instance not initialized');
        }

        const result = await adaptiveSelectorManager.findElement(
          this.currentInstance.page,
          strategies,
          context
        );

        if (result.element) {
          // Прокручиваем элемент в видимость
          if (options.scrollIntoView) {
            await result.element.scrollIntoViewIfNeeded();
          }

          return {
            success: true,
            data: result.element,
            metrics: {
              duration: Date.now() - startTime,
              attempts
            }
          };
        } else {
          throw new Error('Element not found with any strategy');
        }

      } catch (error) {
        this.logger.warn(`Element search attempt ${attempts} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          context
        });

        if (attempts >= maxAttempts) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Element not found',
            metrics: {
              duration: Date.now() - startTime,
              attempts
            }
          };
        }

        await this.delay(1000 * attempts);
      }
    }

    return {
      success: false,
      error: 'Element not found after all attempts',
      metrics: {
        duration: Date.now() - startTime,
        attempts
      }
    };
  }

  /**
   * Клик по элементу с человеческим поведением
   */
  async clickElement(
    strategies: SelectorStrategy[],
    context?: string,
    options: ElementInteractionOptions = {}
  ): Promise<OperationResult<void>> {
    const elementResult = await this.findElement(strategies, context, options);
    
    if (!elementResult.success || !elementResult.data) {
      return {
        success: false,
        error: elementResult.error,
        metrics: elementResult.metrics
      };
    }

    try {
      const element = elementResult.data;

      if (this.config.enableHumanBehavior && options.humanBehavior !== false) {
        // Симулируем человеческое поведение
        const box = await element.boundingBox();
        if (box) {
          await antibotProtection.simulateHumanMouse(
            this.currentInstance!.page,
            box.x + box.width / 2,
            box.y + box.height / 2
          );
        }
      }

      await element.click();
      
      this.logger.info('Element clicked successfully', { context });

      return {
        success: true,
        metrics: {
          duration: elementResult.metrics.duration,
          attempts: elementResult.metrics.attempts
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Click failed',
        metrics: elementResult.metrics
      };
    }
  }

  /**
   * Ввод текста с человеческим поведением
   */
  async typeText(
    strategies: SelectorStrategy[],
    text: string,
    context?: string,
    options: ElementInteractionOptions = {}
  ): Promise<OperationResult<void>> {
    const elementResult = await this.findElement(strategies, context, options);
    
    if (!elementResult.success || !elementResult.data) {
      return {
        success: false,
        error: elementResult.error,
        metrics: elementResult.metrics
      };
    }

    try {
      const element = elementResult.data;

      if (this.config.enableHumanBehavior && options.humanBehavior !== false) {
        // Симулируем человеческое поведение
        const box = await element.boundingBox();
        if (box) {
          await antibotProtection.simulateHumanMouse(
            this.currentInstance!.page,
            box.x + box.width / 2,
            box.y + box.height / 2
          );
        }

        await antibotProtection.simulateHumanTyping(
          this.currentInstance!.page,
          '', // Селектор не нужен, так как элемент уже найден
          text
        );
      } else {
        await element.fill(text);
      }
      
      this.logger.info('Text typed successfully', { context, textLength: text.length });

      return {
        success: true,
        metrics: {
          duration: elementResult.metrics.duration,
          attempts: elementResult.metrics.attempts
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Text input failed',
        metrics: elementResult.metrics
      };
    }
  }

  /**
   * Ожидание элемента
   */
  async waitForElement(
    strategies: SelectorStrategy[],
    context?: string,
    timeout?: number
  ): Promise<OperationResult<ElementHandle>> {
    const startTime = Date.now();

    try {
      this.logger.info('Waiting for element', { context });

      if (!this.currentInstance) {
        throw new Error('Browser instance not initialized');
      }

      const waitTimeout = timeout || (this.config.enableAdaptiveTimeouts
        ? adaptiveTimeoutManager.getTimeout('elementWait')
        : 30000);

      // Создаем стратегию ожидания
      const waitStrategy: SelectorStrategy = {
        name: 'wait',
        selectors: strategies.flatMap(s => s.selectors),
        priority: 0
      };

      const result = await adaptiveSelectorManager.findElement(
        this.currentInstance.page,
        [waitStrategy],
        context
      );

      if (result.element) {
        return {
          success: true,
          data: result.element,
          metrics: {
            duration: Date.now() - startTime,
            attempts: 1
          }
        };
      } else {
        throw new Error('Element not found within timeout');
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Wait failed',
        metrics: {
          duration: Date.now() - startTime,
          attempts: 1
        }
      };
    }
  }

  /**
   * Скролл страницы
   */
  async scrollPage(direction: 'up' | 'down' = 'down'): Promise<OperationResult<void>> {
    try {
      if (!this.currentInstance) {
        throw new Error('Browser instance not initialized');
      }

      if (this.config.enableHumanBehavior) {
        await antibotProtection.simulateHumanScroll(this.currentInstance.page, direction);
      } else {
        await this.currentInstance.page.mouse.wheel(0, direction === 'down' ? 500 : -500);
      }

      return {
        success: true,
        metrics: {
          duration: 0,
          attempts: 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scroll failed',
        metrics: {
          duration: 0,
          attempts: 1
        }
      };
    }
  }

  /**
   * Получение текущего URL
   */
  getCurrentUrl(): string {
    return this.currentInstance?.page.url() || '';
  }

  /**
   * Получение заголовка страницы
   */
  async getPageTitle(): Promise<string> {
    if (!this.currentInstance) {
      return '';
    }
    return await this.currentInstance.page.title();
  }

  /**
   * Создание скриншота
   */
  async takeScreenshot(path?: string): Promise<OperationResult<string>> {
    try {
      if (!this.currentInstance) {
        throw new Error('Browser instance not initialized');
      }

      const screenshotPath = path || `screenshot-${Date.now()}.png`;
      await this.currentInstance.page.screenshot({ path: screenshotPath });

      return {
        success: true,
        data: screenshotPath,
        metrics: {
          duration: 0,
          attempts: 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot failed',
        metrics: {
          duration: 0,
          attempts: 1
        }
      };
    }
  }

  /**
   * Закрытие сервиса
   */
  async close(): Promise<void> {
    try {
      if (this.currentInstance) {
        await robustBrowserManager.closeInstance(this.config.instanceId);
        this.currentInstance = null;
      }
      this.logger.info('Universal Browser Service closed');
    } catch (error) {
      this.logger.error('Failed to close Universal Browser Service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Задержка
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Создание экземпляра сервиса
 */
export async function createBrowserService(config: BrowserServiceConfig): Promise<UniversalBrowserService> {
  return await UniversalBrowserService.create(config);
}

/**
 * Создание стратегий селекторов
 */
export function createSelectorStrategies(selectors: string[], name: string, priority: number = 100): SelectorStrategy {
  return {
    name,
    selectors,
    priority
  };
}

/**
 * Создание множественных стратегий
 */
export function createMultipleStrategies(selectorGroups: Array<{ name: string; selectors: string[]; priority?: number }>): SelectorStrategy[] {
  return selectorGroups.map(group => ({
    name: group.name,
    selectors: group.selectors,
    priority: group.priority || 100
  }));
}
