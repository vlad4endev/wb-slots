// ===== NAVIGATION SERVICE - SRP: Навигация по сайту =====

import { Page } from 'playwright';
import { ILogger } from '../../core/interfaces';

export interface NavigationConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface NavigationResult {
  success: boolean;
  url: string;
  error?: string;
  duration: number;
}

export interface INavigationService {
  navigateToSupplies(page: Page, config: NavigationConfig): Promise<NavigationResult>;
  navigateToSupply(page: Page, supplyId: string, config: NavigationConfig): Promise<NavigationResult>;
  waitForPageLoad(page: Page, timeout: number): Promise<boolean>;
  scrollToElement(page: Page, selector: string): Promise<boolean>;
}

export class NavigationService implements INavigationService {
  private readonly selectors = {
    supplies: {
      page: [
        'a[href*="/supplies"]',
        '[data-testid="supplies-link"]',
        '.supplies-link',
        'a:has-text("Поставки")'
      ],
      table: [
        '.supplies-table',
        '[data-testid="supplies-table"]',
        'table',
        '.table'
      ]
    },
    supply: {
      item: [
        `[data-supply-id="${supplyId}"]`,
        `[data-testid="supply-${supplyId}"]`,
        `.supply-item:has-text("${supplyId}")`,
        `tr:has-text("${supplyId}")`,
        `*:contains("${supplyId}")`
      ],
      planButton: [
        'button:has-text("Запланировать поставку")',
        '[data-testid="plan-supply"]',
        '.plan-supply-btn',
        'button[class*="plan"]',
        'button:contains("План")'
      ]
    }
  };

  constructor(private logger: ILogger) {}

  async navigateToSupplies(page: Page, config: NavigationConfig): Promise<NavigationResult> {
    const startTime = Date.now();
    this.logger.info('Navigating to supplies page...');

    try {
      // Try multiple navigation strategies
      const strategies = [
        () => page.goto(`${config.baseUrl}/supplies`, { waitUntil: 'networkidle', timeout: config.timeout }),
        () => page.goto(`${config.baseUrl}/seller/supplies`, { waitUntil: 'networkidle', timeout: config.timeout }),
        () => page.goto(`${config.baseUrl}/seller`, { waitUntil: 'networkidle', timeout: config.timeout })
      ];

      let lastError: Error | null = null;
      for (const strategy of strategies) {
        try {
          await strategy();
          const success = await this.waitForPageLoad(page, config.timeout);
          if (success) {
            const duration = Date.now() - startTime;
            this.logger.info(`Successfully navigated to supplies page in ${duration}ms`);
            return {
              success: true,
              url: page.url(),
              duration
            };
          }
        } catch (error) {
          lastError = error as Error;
          this.logger.warn(`Navigation strategy failed: ${error}`);
        }
      }

      throw lastError || new Error('All navigation strategies failed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to navigate to supplies page:', error);
      return {
        success: false,
        url: page.url(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  async navigateToSupply(page: Page, supplyId: string, config: NavigationConfig): Promise<NavigationResult> {
    const startTime = Date.now();
    this.logger.info(`Navigating to supply: ${supplyId}`);

    try {
      // First navigate to supplies page
      const suppliesResult = await this.navigateToSupplies(page, config);
      if (!suppliesResult.success) {
        return suppliesResult;
      }

      // Find and click on supply
      const supplyFound = await this.findAndClickSupply(page, supplyId);
      if (!supplyFound) {
        throw new Error(`Supply ${supplyId} not found`);
      }

      // Wait for supply page to load
      const pageLoaded = await this.waitForPageLoad(page, config.timeout);
      if (!pageLoaded) {
        throw new Error('Supply page did not load properly');
      }

      const duration = Date.now() - startTime;
      this.logger.info(`Successfully navigated to supply ${supplyId} in ${duration}ms`);
      return {
        success: true,
        url: page.url(),
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to navigate to supply ${supplyId}:`, error);
      return {
        success: false,
        url: page.url(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  async waitForPageLoad(page: Page, timeout: number): Promise<boolean> {
    try {
      await page.waitForLoadState('networkidle', { timeout });
      return true;
    } catch (error) {
      this.logger.warn('Page load timeout, but continuing...');
      return false;
    }
  }

  async scrollToElement(page: Page, selector: string): Promise<boolean> {
    try {
      await page.locator(selector).scrollIntoViewIfNeeded();
      return true;
    } catch (error) {
      this.logger.warn(`Failed to scroll to element: ${selector}`);
      return false;
    }
  }

  private async findAndClickSupply(page: Page, supplyId: string): Promise<boolean> {
    const selectors = this.selectors.supply.item.map(s => s.replace('{supplyId}', supplyId));
    
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          this.logger.info(`Found and clicked supply using selector: ${selector}`);
          return true;
        }
      } catch (error) {
        this.logger.debug(`Selector failed: ${selector}`, error);
      }
    }

    // Try scrolling and searching
    await this.scrollAndSearch(page, supplyId);
    
    // Try again after scrolling
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          this.logger.info(`Found and clicked supply after scrolling using selector: ${selector}`);
          return true;
        }
      } catch (error) {
        this.logger.debug(`Selector failed after scrolling: ${selector}`, error);
      }
    }

    return false;
  }

  private async scrollAndSearch(page: Page, supplyId: string): Promise<void> {
    this.logger.info('Scrolling to search for supply...');
    
    try {
      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(1000);
      
      // Scroll to top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
      await page.waitForTimeout(1000);
    } catch (error) {
      this.logger.warn('Error during scrolling:', error);
    }
  }
}
