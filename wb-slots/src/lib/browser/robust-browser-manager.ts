// ===== ROBUST BROWSER MANAGER =====

import { chromium, Browser, BrowserContext, Page, LaunchOptions, BrowserContextOptions } from 'playwright';
import { Logger } from '../logging/logger';

// ===== TYPES =====

export interface BrowserConfig {
  headless: boolean;
  viewport: {
    width: number;
    height: number;
  };
  userAgent: string;
  locale: string;
  timezone: string;
  enableAntiDetection: boolean;
  enableStealth: boolean;
  enableProxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export interface TimeoutConfig {
  navigation: number;
  elementWait: number;
  actionDelay: number;
  pageLoad: number;
  scriptTimeout: number;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
}

export interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  config: BrowserConfig;
  createdAt: Date;
  lastUsed: Date;
}

// ===== CONSTANTS =====

const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: true,
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'ru-RU',
  timezone: 'Europe/Moscow',
  enableAntiDetection: true,
  enableStealth: true
};

const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  navigation: 60000,
  elementWait: 30000,
  actionDelay: 1000,
  pageLoad: 30000,
  scriptTimeout: 30000
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 2000,
  exponentialBackoff: true
};

// ===== MAIN CLASS =====

export class RobustBrowserManager {
  private static instance: RobustBrowserManager;
  private logger: Logger;
  private instances: Map<string, BrowserInstance> = new Map();
  private config: BrowserConfig;
  private timeoutConfig: TimeoutConfig;
  private retryConfig: RetryConfig;

  private constructor(config?: Partial<BrowserConfig>) {
    this.config = { ...DEFAULT_BROWSER_CONFIG, ...config };
    this.timeoutConfig = { ...DEFAULT_TIMEOUT_CONFIG };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG };
    this.logger = new Logger('INFO', { service: 'RobustBrowserManager' });
  }

  public static getInstance(config?: Partial<BrowserConfig>): RobustBrowserManager {
    if (!RobustBrowserManager.instance) {
      RobustBrowserManager.instance = new RobustBrowserManager(config);
    }
    return RobustBrowserManager.instance;
  }

  /**
   * Создание нового экземпляра браузера
   */
  async createInstance(instanceId: string, customConfig?: Partial<BrowserConfig>): Promise<BrowserInstance> {
    try {
      this.logger.info('Creating new browser instance', { instanceId });

      const config = { ...this.config, ...customConfig };
      const launchOptions = this.buildLaunchOptions(config);
      const contextOptions = this.buildContextOptions(config);

      const browser = await chromium.launch(launchOptions);
      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      // Настройка таймаутов
      this.setupTimeouts(page);

      // Настройка антидетекта
      if (config.enableAntiDetection) {
        await this.setupAntiDetection(page, config);
      }

      // Настройка стелс-режима
      if (config.enableStealth) {
        await this.setupStealthMode(page, config);
      }

      const instance: BrowserInstance = {
        browser,
        context,
        page,
        config,
        createdAt: new Date(),
        lastUsed: new Date()
      };

      this.instances.set(instanceId, instance);
      this.logger.info('Browser instance created successfully', { instanceId });

      return instance;
    } catch (error) {
      this.logger.error('Failed to create browser instance', {
        instanceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получение существующего экземпляра
   */
  getInstance(instanceId: string): BrowserInstance | null {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.lastUsed = new Date();
    }
    return instance || null;
  }

  /**
   * Закрытие экземпляра браузера
   */
  async closeInstance(instanceId: string): Promise<void> {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        this.logger.warn('Instance not found for closing', { instanceId });
        return;
      }

      await instance.context.close();
      await instance.browser.close();
      this.instances.delete(instanceId);

      this.logger.info('Browser instance closed', { instanceId });
    } catch (error) {
      this.logger.error('Failed to close browser instance', {
        instanceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Очистка неиспользуемых экземпляров
   */
  async cleanupUnusedInstances(maxAge: number = 30 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [instanceId, instance] of this.instances.entries()) {
      const age = now - instance.lastUsed.getTime();
      if (age > maxAge) {
        await this.closeInstance(instanceId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Cleaned up unused browser instances', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Построение опций запуска браузера
   */
  private buildLaunchOptions(config: BrowserConfig): LaunchOptions {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-field-trial-config',
      '--disable-back-forward-cache',
      '--disable-ipc-flooding-protection',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-sync-preferences',
      '--disable-translate',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      '--use-mock-keychain'
    ];

    if (config.enableAntiDetection) {
      args.push(
        '--disable-blink-features=AutomationControlled',
        '--disable-features=TranslateUI',
        `--user-agent=${config.userAgent}`
      );
    }

    if (config.enableStealth) {
      args.push(
        '--disable-features=VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling'
      );
    }

    return {
      headless: config.headless,
      args,
      timeout: 60000
    };
  }

  /**
   * Построение опций контекста браузера
   */
  private buildContextOptions(config: BrowserConfig): BrowserContextOptions {
    const options: BrowserContextOptions = {
      viewport: config.viewport,
      userAgent: config.userAgent,
      locale: config.locale,
      timezoneId: config.timezone,
      ignoreHTTPSErrors: true,
      acceptDownloads: false
    };

    if (config.enableProxy) {
      options.proxy = {
        server: config.enableProxy.server,
        username: config.enableProxy.username,
        password: config.enableProxy.password
      };
    }

    return options;
  }

  /**
   * Настройка таймаутов
   */
  private setupTimeouts(page: Page): void {
    page.setDefaultTimeout(this.timeoutConfig.elementWait);
    page.setDefaultNavigationTimeout(this.timeoutConfig.navigation);
    page.setDefaultTimeout(this.timeoutConfig.scriptTimeout);
  }

  /**
   * Настройка антидетекта
   */
  private async setupAntiDetection(page: Page, config: BrowserConfig): Promise<void> {
    try {
      // Удаляем webdriver свойство
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      // Маскируем automation флаги
      await page.addInitScript(() => {
        // Удаляем automation флаги
        delete (window as any).chrome;
        delete (window as any).__nightmare;
        delete (window as any).__phantomas;
        delete (window as any).callPhantom;
        delete (window as any)._phantom;
        delete (window as any).phantom;

        // Переопределяем permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // Маскируем плагины
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Маскируем языки
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ru-RU', 'ru', 'en-US', 'en'],
        });
      });

      // Устанавливаем реалистичные заголовки
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      this.logger.info('Anti-detection setup completed');
    } catch (error) {
      this.logger.warn('Anti-detection setup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Настройка стелс-режима
   */
  private async setupStealthMode(page: Page, config: BrowserConfig): Promise<void> {
    try {
      // Блокируем ненужные ресурсы
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Добавляем реалистичные задержки
      await page.addInitScript(() => {
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = (callback: Function, delay: number) => {
          const jitter = Math.random() * 100; // Добавляем случайность
          return originalSetTimeout(callback, delay + jitter);
        };
      });

      this.logger.info('Stealth mode setup completed');
    } catch (error) {
      this.logger.warn('Stealth mode setup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig: Partial<BrowserConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Browser configuration updated', this.config);
  }

  /**
   * Обновление таймаутов
   */
  updateTimeouts(newTimeouts: Partial<TimeoutConfig>): void {
    this.timeoutConfig = { ...this.timeoutConfig, ...newTimeouts };
    this.logger.info('Timeout configuration updated', this.timeoutConfig);
  }

  /**
   * Получение статистики
   */
  getStats(): {
    totalInstances: number;
    instances: Array<{
      id: string;
      createdAt: Date;
      lastUsed: Date;
      age: number;
    }>;
  } {
    const instances = Array.from(this.instances.entries()).map(([id, instance]) => ({
      id,
      createdAt: instance.createdAt,
      lastUsed: instance.lastUsed,
      age: Date.now() - instance.createdAt.getTime()
    }));

    return {
      totalInstances: this.instances.size,
      instances
    };
  }

  /**
   * Остановка всех экземпляров
   */
  async stopAll(): Promise<void> {
    this.logger.info('Stopping all browser instances');
    
    const closePromises = Array.from(this.instances.keys()).map(id => this.closeInstance(id));
    await Promise.allSettled(closePromises);
    
    this.logger.info('All browser instances stopped');
  }
}

// ===== SINGLETON INSTANCE =====

export const robustBrowserManager = RobustBrowserManager.getInstance();
