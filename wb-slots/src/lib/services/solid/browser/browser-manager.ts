// ===== BROWSER MANAGER - SRP: Управление браузером =====

import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { ILogger } from '../../core/interfaces';

export interface BrowserConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent: string;
  timeout: number;
}

export interface IBrowserManager {
  initialize(config: BrowserConfig): Promise<{ browser: Browser; context: BrowserContext }>;
  createPage(context: BrowserContext): Promise<Page>;
  setupAntiDetection(page: Page): Promise<void>;
  cleanup(browser: Browser): Promise<void>;
}

export class BrowserManager implements IBrowserManager {
  constructor(private logger: ILogger) {}

  async initialize(config: BrowserConfig): Promise<{ browser: Browser; context: BrowserContext }> {
    this.logger.info('Initializing browser...');
    
    const browser = await chromium.launch({
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext({
      viewport: config.viewport,
      userAgent: config.userAgent,
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow'
    });

    this.logger.info('Browser initialized successfully');
    return { browser, context };
  }

  async createPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    await this.setupAntiDetection(page);
    return page;
  }

  async setupAntiDetection(page: Page): Promise<void> {
    // Remove webdriver property
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Override permissions
    await page.addInitScript(() => {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // Mock plugins
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // Mock languages
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      });
    });
  }

  async cleanup(browser: Browser): Promise<void> {
    this.logger.info('Cleaning up browser...');
    await browser.close();
    this.logger.info('Browser cleaned up');
  }
}
