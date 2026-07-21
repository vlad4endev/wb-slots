import { chromium, Browser, BrowserContext, Page } from 'playwright';
// import { logger } from '@/lib/logger';

export interface BrowserSessionInfo {
  isOpen: boolean;
  url?: string;
  cookies?: any[];
  localStorage?: Record<string, any>;
  sessionStorage?: Record<string, any>;
  userAgent?: string;
  viewport?: { width: number; height: number };
  timestamp: Date;
}

export interface BrowserConnectionOptions {
  headless?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

export class BrowserDetectionService {
  private static instance: BrowserDetectionService;
  private connectedBrowsers: Map<string, Browser> = new Map();
  private connectedContexts: Map<string, BrowserContext> = new Map();
  private connectedPages: Map<string, Page> = new Map();

  private constructor() {}

  static getInstance(): BrowserDetectionService {
    if (!BrowserDetectionService.instance) {
      BrowserDetectionService.instance = new BrowserDetectionService();
    }
    return BrowserDetectionService.instance;
  }

  /**
   * Проверяет, открыт ли браузер и доступен ли для подключения
   */
  async detectOpenBrowser(options: BrowserConnectionOptions = {}): Promise<BrowserSessionInfo> {
    const {
      headless = false,
      timeout = 5000,
      retryAttempts = 3
    } = options;

    console.log('🔍 Detecting open browser...');

    try {
      // Попытка подключиться к существующему браузеру
      const browser = await this.connectToExistingBrowser(timeout);
      
      if (browser) {
        console.log('✅ Found existing browser, extracting session data...');
        return await this.extractSessionFromBrowser(browser);
      }

      // Если не удалось подключиться, пробуем найти через порты
      const browserInfo = await this.findBrowserByPorts();
      if (browserInfo) {
        return browserInfo;
      }

      // Последняя попытка - запуск нового браузера
      console.info('🚀 No existing browser found, starting new one...');
      return await this.startNewBrowser(headless);

    } catch (error) {
      console.error('❌ Failed to detect browser', { error: error instanceof Error ? error.message : 'Unknown error' });
      
      return {
        isOpen: false,
        timestamp: new Date()
      };
    }
  }

  /**
   * Подключение к существующему браузеру
   */
  private async connectToExistingBrowser(timeout: number): Promise<Browser | null> {
    try {
      // Попытка подключиться к браузеру через WebSocket
      const browser = await chromium.connectOverCDP('ws://localhost:9222', { timeout });
      
      if (browser && browser.isConnected()) {
        console.info('🔗 Connected to existing browser via CDP');
        return browser;
      }
    } catch (error) {
      console.debug('CDP connection failed, trying other methods...');
    }

    try {
      // Попытка подключиться через другой порт
      const browser = await chromium.connectOverCDP('ws://localhost:9223', { timeout });
      
      if (browser && browser.isConnected()) {
        console.info('🔗 Connected to existing browser via CDP (port 9223)');
        return browser;
      }
    } catch (error) {
      console.debug('Alternative CDP connection failed');
    }

    return null;
  }

  /**
   * Поиск браузера по портам
   */
  private async findBrowserByPorts(): Promise<BrowserSessionInfo | null> {
    const commonPorts = [9222, 9223, 9224, 9225, 9226];
    
    for (const port of commonPorts) {
      try {
        const browser = await chromium.connectOverCDP(`ws://localhost:${port}`, { timeout: 1000 });
        
        if (browser && browser.isConnected()) {
          console.info(`🔗 Found browser on port ${port}`);
          return await this.extractSessionFromBrowser(browser);
        }
      } catch (error) {
        // Порт недоступен, продолжаем поиск
        continue;
      }
    }

    return null;
  }

  /**
   * Запуск нового браузера
   */
  private async startNewBrowser(headless: boolean): Promise<BrowserSessionInfo> {
    const browser = await chromium.launch({
      headless,
      args: [
        '--remote-debugging-port=9222',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    
    // Переходим на страницу WB
    await page.goto('https://seller.wildberries.ru/');
    
    // Сохраняем ссылки для дальнейшего использования
    this.connectedBrowsers.set('default', browser);
    this.connectedContexts.set('default', context);
    this.connectedPages.set('default', page);

    console.info('🚀 New browser started and ready');

    return {
      isOpen: true,
      url: page.url(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewport: { width: 1920, height: 1080 },
      timestamp: new Date()
    };
  }

  /**
   * Извлечение данных сессии из браузера
   */
  private async extractSessionFromBrowser(browser: Browser): Promise<BrowserSessionInfo> {
    try {
      const contexts = browser.contexts();
      
      if (contexts.length === 0) {
        console.warn('⚠️ No contexts found in browser');
        return {
          isOpen: true,
          timestamp: new Date()
        };
      }

      // Берем первый доступный контекст
      const context = contexts[0];
      const pages = context.pages();
      
      if (pages.length === 0) {
        console.warn('⚠️ No pages found in browser context');
        return {
          isOpen: true,
          timestamp: new Date()
        };
      }

      // Берем первую доступную страницу
      const page = pages[0];
      
      // Извлекаем все данные сессии
      const [cookies, localStorage, sessionStorage, userAgent, viewport] = await Promise.all([
        context.cookies(),
        page.evaluate(() => {
          const storage: Record<string, any> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              storage[key] = localStorage.getItem(key);
            }
          }
          return storage;
        }),
        page.evaluate(() => {
          const storage: Record<string, any> = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              storage[key] = sessionStorage.getItem(key);
            }
          }
          return storage;
        }),
        page.evaluate(() => navigator.userAgent),
        page.viewportSize() || { width: 1920, height: 1080 }
      ]);

      console.info('📊 Session data extracted successfully', {
        cookiesCount: cookies.length,
        localStorageKeys: Object.keys(localStorage).length,
        sessionStorageKeys: Object.keys(sessionStorage).length,
        url: page.url()
      });

      return {
        isOpen: true,
        url: page.url(),
        cookies,
        localStorage,
        sessionStorage,
        userAgent,
        viewport,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Failed to extract session from browser', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        isOpen: true,
        timestamp: new Date()
      };
    }
  }

  /**
   * Подключение к существующей сессии браузера
   */
  async connectToExistingSession(userId: string, options: BrowserConnectionOptions = {}): Promise<{
    success: boolean;
    sessionData?: any;
    error?: string;
  }> {
    try {
      console.info('🔗 Connecting to existing browser session...', { userId });

      const browserInfo = await this.detectOpenBrowser(options);
      
      if (!browserInfo.isOpen) {
        return {
          success: false,
          error: 'No open browser found'
        };
      }

      // Если есть данные сессии, сохраняем их
      if (browserInfo.cookies || browserInfo.localStorage || browserInfo.sessionStorage) {
        const sessionData = {
          cookies: browserInfo.cookies || [],
          localStorage: browserInfo.localStorage || {},
          sessionStorage: browserInfo.sessionStorage || {},
          userAgent: browserInfo.userAgent,
          viewport: browserInfo.viewport,
          url: browserInfo.url,
          timestamp: browserInfo.timestamp
        };

        console.info('✅ Successfully connected to existing session', {
          userId,
          hasCookies: sessionData.cookies.length > 0,
          hasLocalStorage: Object.keys(sessionData.localStorage).length > 0,
          hasSessionStorage: Object.keys(sessionData.sessionStorage).length > 0
        });

        return {
          success: true,
          sessionData
        };
      }

      return {
        success: true,
        sessionData: {
          url: browserInfo.url,
          userAgent: browserInfo.userAgent,
          viewport: browserInfo.viewport,
          timestamp: browserInfo.timestamp
        }
      };

    } catch (error) {
      console.error('❌ Failed to connect to existing session', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Получение статуса браузера
   */
  async getBrowserStatus(): Promise<{
    isConnected: boolean;
    browserCount: number;
    contextCount: number;
    pageCount: number;
    lastCheck: Date;
  }> {
    const isConnected = this.connectedBrowsers.size > 0;
    let browserCount = 0;
    let contextCount = 0;
    let pageCount = 0;

    for (const browser of this.connectedBrowsers.values()) {
      if (browser.isConnected()) {
        browserCount++;
        const contexts = browser.contexts();
        contextCount += contexts.length;
        
        for (const context of contexts) {
          pageCount += context.pages().length;
        }
      }
    }

    return {
      isConnected,
      browserCount,
      contextCount,
      pageCount,
      lastCheck: new Date()
    };
  }

  /**
   * Закрытие всех подключений
   */
  async closeAllConnections(): Promise<void> {
    console.info('🔒 Closing all browser connections...');

    for (const [key, browser] of this.connectedBrowsers.entries()) {
      try {
        if (browser.isConnected()) {
          await browser.close();
        }
      } catch (error) {
        console.warn('⚠️ Failed to close browser', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    this.connectedBrowsers.clear();
    this.connectedContexts.clear();
    this.connectedPages.clear();

    console.info('✅ All browser connections closed');
  }

  /**
   * Получение браузера по ключу
   */
  getBrowser(key: string = 'default'): Browser | undefined {
    return this.connectedBrowsers.get(key);
  }

  /**
   * Получение контекста по ключу
   */
  getContext(key: string = 'default'): BrowserContext | undefined {
    return this.connectedContexts.get(key);
  }

  /**
   * Получение страницы по ключу
   */
  getPage(key: string = 'default'): Page | undefined {
    return this.connectedPages.get(key);
  }
}

// Экспорт синглтона
export const browserDetectionService = BrowserDetectionService.getInstance();
