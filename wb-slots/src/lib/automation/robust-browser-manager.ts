// ===== ROBUST BROWSER MANAGER =====

import { chromium, Browser, BrowserContext, Page, LaunchOptions, BrowserContextOptions } from 'playwright';
import { Logger } from '../logging/logger';
import { RetryConfig } from '../services/core/interfaces';

// ===== INTERFACES =====

export interface BrowserConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent: string;
  locale: string;
  timezoneId: string;
  enableAntibot: boolean;
  enableHumanBehavior: boolean;
  enableAdaptiveTimeouts: boolean;
  enableSelectorResilience: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export interface AdaptiveTimeoutConfig {
  baseTimeout: number;
  maxTimeout: number;
  minTimeout: number;
  adaptationFactor: number;
  networkQualityThreshold: number;
}

export interface BrowserHealthStatus {
  isHealthy: boolean;
  lastError?: string;
  uptime: number;
  memoryUsage: number;
  networkLatency: number;
  pageLoadTimes: number[];
  errorCount: number;
  successRate: number;
}

export interface BrowserMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  averagePageLoadTime: number;
  memoryUsage: number;
  networkLatency: number;
  errorRate: number;
}

// ===== ROBUST BROWSER MANAGER =====

export class RobustBrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private config: BrowserConfig;
  private adaptiveTimeoutConfig: AdaptiveTimeoutConfig;
  private retryConfig: RetryConfig;
  private startTime: number = 0;
  private metrics: BrowserMetrics;
  private healthStatus: BrowserHealthStatus;
  private networkQualityHistory: number[] = [];
  private pageLoadTimes: number[] = [];
  private errorCount: number = 0;
  private successCount: number = 0;

  constructor(
    config: BrowserConfig,
    adaptiveTimeoutConfig: AdaptiveTimeoutConfig,
    retryConfig: RetryConfig
  ) {
    this.config = config;
    this.adaptiveTimeoutConfig = adaptiveTimeoutConfig;
    this.retryConfig = retryConfig;
    this.logger = new Logger('INFO', { context: 'RobustBrowserManager' });
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      averagePageLoadTime: 0,
      memoryUsage: 0,
      networkLatency: 0,
      errorRate: 0
    };

    this.healthStatus = {
      isHealthy: true,
      uptime: 0,
      memoryUsage: 0,
      networkLatency: 0,
      pageLoadTimes: [],
      errorCount: 0,
      successRate: 100
    };
  }

  // ===== BROWSER LIFECYCLE =====

  async initialize(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🚀 Initializing robust browser manager');
      
      // Launch browser with robust configuration
      await this.launchBrowser();
      
      // Create context with enhanced settings
      await this.createContext();
      
      // Create page with adaptive timeouts
      await this.createPage();
      
      // Setup monitoring and health checks
      await this.setupMonitoring();
      
      // Setup anti-detection if enabled
      if (this.config.enableAntibot) {
        await this.setupAntiDetection();
      }
      
      // Setup human behavior simulation if enabled
      if (this.config.enableHumanBehavior) {
        await this.setupHumanBehavior();
      }
      
      this.startTime = Date.now();
      this.healthStatus.uptime = 0;
      
      const duration = Date.now() - startTime;
      this.logger.info(`✅ Browser manager initialized successfully in ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Failed to initialize browser manager after ${duration}ms`, { error });
      await this.cleanup();
      throw error;
    }
  }

  private async launchBrowser(): Promise<void> {
    const launchOptions: LaunchOptions = {
      headless: this.config.headless,
      args: this.getRobustBrowserArgs(),
      timeout: 60000, // 60 seconds timeout for browser launch
    };

    if (this.config.proxy) {
      launchOptions.proxy = this.config.proxy;
    }

    this.browser = await chromium.launch(launchOptions);
    
    // Setup browser event listeners
    this.browser.on('disconnected', () => {
      this.logger.warn('🔌 Browser disconnected');
      this.healthStatus.isHealthy = false;
    });

    // Note: targetcreated event might not be available in all Playwright versions
    // this.browser.on('targetcreated', (target) => {
    //   this.logger.debug('🎯 New browser target created', { targetType: (target as any).type() });
    // });
  }

  private getRobustBrowserArgs(): string[] {
    return [
      // Stability and performance
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
      '--disable-blink-features=AutomationControlled',
      
      // Memory and resource management
      '--max_old_space_size=4096',
      '--memory-pressure-off',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      
      // Network and performance
      '--aggressive-cache-discard',
      '--disable-back-forward-cache',
      '--disable-ipc-flooding-protection',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-client-side-phishing-detection',
      '--disable-sync-preferences',
      '--disable-translate',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-features=TranslateUI',
      
      // Window and display
      `--window-size=${this.config.viewport.width},${this.config.viewport.height}`,
      '--window-position=100,100',
      
      // User agent
      `--user-agent=${this.config.userAgent}`
    ];
  }

  private async createContext(): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const contextOptions: BrowserContextOptions = {
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      locale: this.config.locale,
      timezoneId: this.config.timezoneId,
      ignoreHTTPSErrors: true,
      acceptDownloads: false,
      bypassCSP: true,
      javaScriptEnabled: true,
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    };

    this.context = await this.browser.newContext(contextOptions);
    
    // Setup context event listeners
    this.context.on('page', (page) => {
      this.logger.debug('📄 New page created in context');
      this.setupPageEventListeners(page);
    });

    this.context.on('close', () => {
      this.logger.warn('🔒 Browser context closed');
    });
  }

  private async createPage(): Promise<void> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    this.page = await this.context.newPage();
    
    // Set adaptive timeouts
    const currentTimeout = this.calculateAdaptiveTimeout();
    this.page.setDefaultTimeout(currentTimeout);
    this.page.setDefaultNavigationTimeout(currentTimeout * 2);
    
    // Setup page event listeners
    this.setupPageEventListeners(this.page);
    
    this.logger.info(`📄 Page created with adaptive timeout: ${currentTimeout}ms`);
  }

  private setupPageEventListeners(page: Page): void {
    // Network monitoring
    page.on('request', (request) => {
      this.metrics.totalRequests++;
      this.logger.debug('🌐 Request started', { 
        url: request.url(),
        method: request.method() 
      });
    });

    page.on('response', (response) => {
      const request = response.request();
      const responseTime = Date.now() - (request as any).timestamp();
      
      this.metrics.successfulRequests++;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime) / 
        this.metrics.successfulRequests;
      
      this.logger.debug('✅ Response received', { 
        url: response.url(),
        status: response.status(),
        responseTime 
      });
    });

    page.on('requestfailed', (request) => {
      this.metrics.failedRequests++;
      this.errorCount++;
      this.logger.warn('❌ Request failed', { 
        url: request.url(),
        failure: request.failure()?.errorText 
      });
    });

    // Page load monitoring
    page.on('load', () => {
      const loadTime = Date.now();
      this.pageLoadTimes.push(loadTime);
      this.metrics.averagePageLoadTime = 
        this.pageLoadTimes.reduce((sum, time) => sum + time, 0) / this.pageLoadTimes.length;
      
      this.logger.debug('📄 Page loaded', { loadTime });
    });

    // Error monitoring
    page.on('pageerror', (error) => {
      this.errorCount++;
      this.logger.error('💥 Page error occurred', { error: error.message });
    });

    page.on('crash', () => {
      this.errorCount++;
      this.healthStatus.isHealthy = false;
      this.logger.error('💥 Page crashed');
    });
  }

  private async setupMonitoring(): Promise<void> {
    // Start periodic health checks
    setInterval(() => {
      this.updateHealthStatus();
    }, 30000); // Every 30 seconds

    // Start memory monitoring
    setInterval(() => {
      this.updateMemoryUsage();
    }, 10000); // Every 10 seconds

    // Start network quality monitoring
    setInterval(() => {
      this.updateNetworkQuality();
    }, 5000); // Every 5 seconds
  }

  private async setupAntiDetection(): Promise<void> {
    if (!this.page) return;

    try {
      // Remove webdriver property
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      // Override plugins
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      // Override languages
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ru-RU', 'ru', 'en-US', 'en'],
        });
      });

      // Override permissions
      await this.page.addInitScript(() => {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission } as any) :
            originalQuery(parameters)
        );
      });

      // Override chrome runtime
      await this.page.addInitScript(() => {
        (window as any).chrome = {
          runtime: {},
        };
      });

      this.logger.info('🛡️ Anti-detection measures applied');
    } catch (error) {
      this.logger.warn('⚠️ Failed to apply some anti-detection measures', { error });
    }
  }

  private async setupHumanBehavior(): Promise<void> {
    if (!this.page) return;

    try {
      // Random mouse movements
      await this.page.addInitScript(() => {
        let mouseX = 0;
        let mouseY = 0;
        
        document.addEventListener('mousemove', (e) => {
          mouseX = e.clientX;
          mouseY = e.clientY;
        });

        // Simulate random mouse movements
        setInterval(() => {
          const randomX = mouseX + (Math.random() - 0.5) * 10;
          const randomY = mouseY + (Math.random() - 0.5) * 10;
          
          const event = new MouseEvent('mousemove', {
            clientX: randomX,
            clientY: randomY,
            bubbles: true
          });
          
          document.dispatchEvent(event);
        }, 1000 + Math.random() * 2000);
      });

      // Random scroll behavior
      await this.page.addInitScript(() => {
        setInterval(() => {
          if (Math.random() < 0.1) { // 10% chance
            const scrollAmount = Math.random() * 100;
            window.scrollBy(0, scrollAmount);
          }
        }, 3000 + Math.random() * 5000);
      });

      this.logger.info('🤖 Human behavior simulation enabled');
    } catch (error) {
      this.logger.warn('⚠️ Failed to setup human behavior simulation', { error });
    }
  }

  // ===== ADAPTIVE TIMEOUTS =====

  private calculateAdaptiveTimeout(): number {
    if (!this.config.enableAdaptiveTimeouts) {
      return this.adaptiveTimeoutConfig.baseTimeout;
    }

    const networkQuality = this.getNetworkQuality();
    const baseTimeout = this.adaptiveTimeoutConfig.baseTimeout;
    const adaptationFactor = this.adaptiveTimeoutConfig.adaptationFactor;

    // Adjust timeout based on network quality
    let adjustedTimeout = baseTimeout;
    
    if (networkQuality < this.adaptiveTimeoutConfig.networkQualityThreshold) {
      // Poor network quality - increase timeout
      adjustedTimeout = baseTimeout * (1 + adaptationFactor);
    } else {
      // Good network quality - decrease timeout
      adjustedTimeout = baseTimeout * (1 - adaptationFactor * 0.5);
    }

    // Ensure timeout is within bounds
    return Math.max(
      this.adaptiveTimeoutConfig.minTimeout,
      Math.min(adjustedTimeout, this.adaptiveTimeoutConfig.maxTimeout)
    );
  }

  private getNetworkQuality(): number {
    if (this.networkQualityHistory.length === 0) {
      return 1.0; // Default to good quality
    }

    const averageLatency = this.networkQualityHistory.reduce((sum, latency) => sum + latency, 0) / 
                          this.networkQualityHistory.length;
    
    // Convert latency to quality score (0-1, where 1 is best)
    return Math.max(0, 1 - (averageLatency / 1000)); // Assuming 1000ms is very poor
  }

  private updateNetworkQuality(): void {
    if (!this.page) return;

    // Measure network latency
    this.page.evaluate(() => {
      const start = performance.now();
      return fetch('/favicon.ico', { method: 'HEAD' })
        .then(() => performance.now() - start)
        .catch(() => 1000); // Default to poor quality on error
    }).then((latency) => {
      this.networkQualityHistory.push(latency);
      
      // Keep only last 10 measurements
      if (this.networkQualityHistory.length > 10) {
        this.networkQualityHistory.shift();
      }
      
      this.metrics.networkLatency = latency;
    }).catch(() => {
      // Ignore errors in network quality measurement
    });
  }

  // ===== HEALTH MONITORING =====

  private updateHealthStatus(): void {
    if (!this.browser || !this.context || !this.page) {
      this.healthStatus.isHealthy = false;
      return;
    }

    const uptime = Date.now() - this.startTime;
    const totalRequests = this.metrics.totalRequests;
    const successRate = totalRequests > 0 ? 
      (this.metrics.successfulRequests / totalRequests) * 100 : 100;

    this.healthStatus = {
      isHealthy: this.browser.isConnected() && successRate > 80,
      uptime,
      memoryUsage: this.metrics.memoryUsage,
      networkLatency: this.metrics.networkLatency,
      pageLoadTimes: [...this.pageLoadTimes],
      errorCount: this.errorCount,
      successRate
    };

    // Log health status if unhealthy
    if (!this.healthStatus.isHealthy) {
      this.logger.warn('⚠️ Browser health degraded', this.healthStatus);
    }
  }

  private updateMemoryUsage(): void {
    if (!this.page) return;

    this.page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    }).then((memoryUsage) => {
      this.metrics.memoryUsage = memoryUsage;
    }).catch(() => {
      // Ignore memory measurement errors
    });
  }

  // ===== PUBLIC METHODS =====

  async navigateTo(url: string, options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const startTime = Date.now();
    const timeout = options?.timeout || this.calculateAdaptiveTimeout();
    const waitUntil = options?.waitUntil || 'networkidle';

    try {
      this.logger.info(`🧭 Navigating to: ${url}`);
      
      await this.page.goto(url, {
        timeout,
        waitUntil,
        referer: 'https://www.google.com/'
      });

      const duration = Date.now() - startTime;
      this.successCount++;
      this.logger.info(`✅ Navigation completed in ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.errorCount++;
      this.logger.error(`❌ Navigation failed after ${duration}ms`, { error, url });
      throw error;
    }
  }

  async findElement(selectors: string[], options?: { timeout?: number; visible?: boolean }): Promise<any> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const timeout = options?.timeout || this.calculateAdaptiveTimeout();
    const visible = options?.visible !== false;

    for (const selector of selectors) {
      try {
        this.logger.debug(`🔍 Trying selector: ${selector}`);
        
        const element = await this.page.waitForSelector(selector, {
          timeout,
          state: visible ? 'visible' : 'attached'
        });

        if (element) {
          this.logger.debug(`✅ Element found with selector: ${selector}`);
          return element;
        }
      } catch (error) {
        this.logger.debug(`❌ Selector failed: ${selector}`, { error });
        continue;
      }
    }

    throw new Error(`Element not found with any of the provided selectors: ${selectors.join(', ')}`);
  }

  async clickElement(selectors: string[], description: string, options?: { 
    timeout?: number; 
    humanBehavior?: boolean; 
    scrollIntoView?: boolean;
    delay?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const element = await this.findElement(selectors, { timeout: options?.timeout });
    
    if (options?.scrollIntoView !== false) {
      await element.scrollIntoViewIfNeeded();
    }

    if (options?.humanBehavior) {
      // Simulate human-like clicking
      await this.page.hover(selectors[0]);
      await this.delay(100 + Math.random() * 200);
    }

    if (options?.delay) {
      await this.delay(options.delay);
    }

    await element.click();
    this.logger.info(`🖱️ Clicked element: ${description}`);
  }

  async fillInput(selectors: string[], text: string, options?: { 
    timeout?: number; 
    humanBehavior?: boolean;
    clear?: boolean;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const element = await this.findElement(selectors, { timeout: options?.timeout });
    
    if (options?.clear !== false) {
      await element.fill('');
    }

    if (options?.humanBehavior) {
      // Simulate human-like typing
      await element.type(text, { delay: 50 + Math.random() * 100 });
    } else {
      await element.fill(text);
    }

    this.logger.info(`⌨️ Filled input with text: ${text.substring(0, 50)}...`);
  }

  async waitForElement(selectors: string[], options?: { 
    timeout?: number; 
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
  }): Promise<any> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const timeout = options?.timeout || this.calculateAdaptiveTimeout();
    const state = options?.state || 'visible';

    for (const selector of selectors) {
      try {
        this.logger.debug(`⏳ Waiting for element: ${selector}`);
        
        const element = await this.page.waitForSelector(selector, {
          timeout,
          state
        });

        if (element) {
          this.logger.debug(`✅ Element appeared: ${selector}`);
          return element;
        }
      } catch (error) {
        this.logger.debug(`❌ Element did not appear: ${selector}`, { error });
        continue;
      }
    }

    throw new Error(`Element did not appear with any of the provided selectors: ${selectors.join(', ')}`);
  }

  async takeScreenshot(options?: { 
    path?: string; 
    fullPage?: boolean; 
    quality?: number;
  }): Promise<Buffer> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const screenshot = await this.page.screenshot({
      path: options?.path,
      fullPage: options?.fullPage || false,
      quality: options?.quality || 80
    });

    this.logger.info(`📸 Screenshot taken`);
    return screenshot;
  }

  async getPageContent(): Promise<{ url: string; title: string; content: string }> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const content = await this.page.content();
    const url = this.page.url();
    const title = await this.page.title();

    return { url, title, content };
  }

  // ===== UTILITY METHODS =====

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getHealthStatus(): BrowserHealthStatus {
    return { ...this.healthStatus };
  }

  getMetrics(): BrowserMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return this.healthStatus.isHealthy;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.logger.info('🧹 Browser manager cleaned up');
    } catch (error) {
      this.logger.error('❌ Error during cleanup', { error });
    }
  }
}
