import puppeteer, { Browser, Page } from 'puppeteer';
import { decrypt } from '../../encryption';
import { TelegramService } from '../telegram-service';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// ===== TYPES =====
export interface BookingConfig {
  taskId: string;
  userId: string;
  runId: string;
  slotId: string;
  supplyId: string;
  warehouseId: number;
  boxTypeId: number;
  date: string;
  coefficient: number;
  prisma: PrismaClient;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  screenshot?: string;
}

export interface DecryptedSessionData {
  cookies: Record<string, string> | Array<{ name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: string }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface WBSessionTokens {
  csrfToken: string | null;
  sessionId: string | null;
  xSuppId: string | null;
  authToken: string | null;
  userId: string | null;
}

// ===== CONSTANTS =====
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
];

const BROWSER_ARGS = [
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
  '--disable-ipc-flooding-protection',
  '--no-default-browser-check',
  '--no-pings',
  '--password-store=basic',
  '--use-mock-keychain',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=TranslateUI',
  '--disable-ipc-flooding-protection',
  '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// ===== ERROR CLASSES =====
export class BookingError extends Error {
  constructor(message: string, public code: string, public originalError?: Error) {
    super(message);
    this.name = 'BookingError';
  }
}

export class SessionError extends BookingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'SESSION_ERROR', originalError);
  }
}

export class BrowserError extends BookingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'BROWSER_ERROR', originalError);
  }
}

// ===== UTILITY FUNCTIONS =====
class ChromePathFinder {
  static findChromePath(): string | undefined {
    try {
      // Check standard paths
      for (const chromePath of CHROME_PATHS) {
        if (chromePath && this.pathExists(chromePath)) {
          return chromePath;
        }
      }

      // Try system command
      return this.findChromeViaCommand();
    } catch (error) {
      console.warn('Could not find Chrome path:', error);
      return undefined;
    }
  }

  private static pathExists(path: string): boolean {
    try {
      return require('fs').existsSync(path);
    } catch {
      return false;
    }
  }

  private static findChromeViaCommand(): string | undefined {
    try {
      const chromePath = execSync('where chrome', { encoding: 'utf8' }).trim();
      return chromePath || undefined;
    } catch {
      return undefined;
    }
  }
}

class SessionDataDecryptor {
  static decryptSessionData(encryptedData: string): DecryptedSessionData {
    try {
      const decrypted = decrypt(encryptedData);
      const parsed = JSON.parse(decrypted);
      
      // Handle different data formats
      if (this.isExtendedFormat(parsed)) {
        return parsed;
      } else {
        return this.convertToExtendedFormat(parsed);
      }
    } catch (error) {
      throw new SessionError('Failed to decrypt session data', error as Error);
    }
  }

  private static isExtendedFormat(data: any): boolean {
    return data && typeof data === 'object' && 
           'cookies' in data && 'localStorage' in data && 'sessionStorage' in data;
  }

  private static convertToExtendedFormat(simpleData: any): DecryptedSessionData {
    return {
      cookies: simpleData,
      localStorage: {},
      sessionStorage: {}
    };
  }
}

class BrowserManager {
  private browser: Browser | null = null;

  async launchBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    const chromePath = ChromePathFinder.findChromePath();
    console.log('Chrome path found:', chromePath);

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: chromePath || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: BROWSER_ARGS,
      });

      return this.browser;
    } catch (error) {
      throw new BrowserError(
        `Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure Chrome is installed or set PUPPETEER_EXECUTABLE_PATH environment variable.`,
        error as Error
      );
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new BrowserError('Browser not launched');
    }
    return this.browser.newPage();
  }
}

class AntiDetectionSetup {
  static async setupPage(page: Page): Promise<void> {
    // Remove automation indicators
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      delete (window as any).chrome;
      delete (window as any).navigator.webdriver;
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      });
    });

    // Set realistic viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
  }
}

class CookieManager {
  static async setCookies(page: Page, sessionData: DecryptedSessionData): Promise<void> {
    try {
      if (sessionData.cookies) {
        const puppeteerCookies = this.convertToPuppeteerFormat(sessionData.cookies);
        if (puppeteerCookies.length > 0) {
          await page.setCookie(...puppeteerCookies);
        }
      }

      // Set localStorage
      if (sessionData.localStorage && typeof sessionData.localStorage === 'object') {
        await page.evaluateOnNewDocument((localStorageData) => {
          Object.keys(localStorageData).forEach(key => {
            localStorage.setItem(key, localStorageData[key]);
          });
        }, sessionData.localStorage);
      }

      // Set sessionStorage
      if (sessionData.sessionStorage && typeof sessionData.sessionStorage === 'object') {
        await page.evaluateOnNewDocument((sessionStorageData) => {
          Object.keys(sessionStorageData).forEach(key => {
            sessionStorage.setItem(key, sessionStorageData[key]);
          });
        }, sessionData.sessionStorage);
      }
    } catch (error) {
      throw new SessionError('Failed to set cookies', error as Error);
    }
  }

  private static convertToPuppeteerFormat(cookies: any): Array<{ name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: string }> {
    if (Array.isArray(cookies)) {
      return cookies;
    }

    if (typeof cookies === 'object' && !Array.isArray(cookies)) {
      return Object.entries(cookies).map(([name, value]) => ({
        name,
        value: String(value),
        domain: '.wildberries.ru',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax' as const
      }));
    }

    return [];
  }
}

class TokenExtractor {
  static async extractTokens(page: Page): Promise<WBSessionTokens> {
    return await page.evaluate(() => {
      let csrfToken = null;
      
      // Try different methods to get CSRF token
      const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (metaToken) csrfToken = metaToken;
      
      if (!csrfToken) {
        csrfToken = localStorage.getItem('csrfToken') || 
                   localStorage.getItem('_csrf') || 
                   localStorage.getItem('csrf_token');
      }
      
      if (!csrfToken) {
        const cookieMatch = document.cookie.match(/csrf[_-]?token=([^;]+)/i);
        if (cookieMatch) csrfToken = cookieMatch[1];
      }
      
      if (!csrfToken && (window as any).csrfToken) {
        csrfToken = (window as any).csrfToken;
      }
      
      return {
        csrfToken,
        sessionId: localStorage.getItem('sessionId') || 
                  document.cookie.match(/sessionId=([^;]+)/)?.[1] ||
                  document.cookie.match(/session_id=([^;]+)/)?.[1],
        xSuppId: localStorage.getItem('xSuppId') || 
                document.cookie.match(/xSuppId=([^;]+)/)?.[1] ||
                document.cookie.match(/x_supp_id=([^;]+)/)?.[1],
        authToken: localStorage.getItem('authToken') || 
                  localStorage.getItem('token') ||
                  document.cookie.match(/auth[_-]?token=([^;]+)/i)?.[1],
        userId: localStorage.getItem('userId') || 
               localStorage.getItem('user_id') ||
               document.cookie.match(/user[_-]?id=([^;]+)/i)?.[1]
      };
    });
  }
}

class BookingAPI {
  static async performBooking(page: Page, config: BookingConfig, tokens: WBSessionTokens): Promise<BookingResult> {
    try {
      const bookingResponse = await page.evaluate(async (bookingData) => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': bookingData.tokens.csrfToken || '',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://seller.wildberries.ru/',
            'Origin': 'https://seller.wildberries.ru',
            'User-Agent': navigator.userAgent,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          };
          
          if (bookingData.tokens.authToken) {
            headers['Authorization'] = `Bearer ${bookingData.tokens.authToken}`;
          }
          if (bookingData.tokens.sessionId) {
            headers['X-Session-ID'] = bookingData.tokens.sessionId;
          }
          if (bookingData.tokens.userId) {
            headers['X-User-ID'] = bookingData.tokens.userId;
          }
          
          const response = await fetch('https://seller.wildberries.ru/ns/sm/supply-manager/api/v1/supply/booking', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              slotId: bookingData.slotId,
              supplyId: bookingData.supplyId,
              warehouseId: bookingData.warehouseId,
              boxTypeId: bookingData.boxTypeId,
              date: bookingData.date,
              coefficient: bookingData.coefficient || 1.0
            })
          });

          const responseData = await response.json().catch(() => ({}));
          
          return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: responseData,
            headers: Object.fromEntries(response.headers.entries()),
            csrfToken: bookingData.tokens.csrfToken
          };
        } catch (error) {
          return {
            success: false,
            status: 0,
            statusText: 'Network Error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' },
            headers: {},
            csrfToken: bookingData.tokens.csrfToken
          };
        }
      }, { ...config, tokens });

      if (!bookingResponse.success) {
        throw new BookingError(
          `Booking API error: ${bookingResponse.status} - ${JSON.stringify(bookingResponse.data)}`,
          'API_ERROR'
        );
      }

      const screenshot = await page.screenshot({ encoding: 'base64' });

      return {
        success: true,
        bookingId: bookingResponse.data.bookingId || 'unknown',
        screenshot: `data:image/png;base64,${screenshot}`,
      };

    } catch (error) {
      console.error('Booking failed:', error);
      
      const screenshot = await page.screenshot({ encoding: 'base64' });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Booking failed',
        screenshot: `data:image/png;base64,${screenshot}`,
      };
    }
  }
}

class NotificationService {
  static async sendBookingNotification(
    config: BookingConfig, 
    result: BookingResult, 
    prisma: PrismaClient
  ): Promise<void> {
    try {
      const telegramService = new TelegramService(prisma);
      
      const message = result.success
        ? `✅ Слот успешно забронирован!\n\n` +
          `📦 ID поставки: ${config.supplyId}\n` +
          `🏪 Склад: ${config.warehouseId}\n` +
          `📦 Тип: ${config.boxTypeId}\n` +
          `📅 Дата: ${config.date}\n` +
          `💰 Коэффициент: ${config.coefficient}\n` +
          `🆔 ID бронирования: ${result.bookingId}`
        : `❌ Ошибка бронирования!\n\n` +
          `📦 ID поставки: ${config.supplyId}\n` +
          `🏪 Склад: ${config.warehouseId}\n` +
          `❌ Ошибка: ${result.error}`;

      await telegramService.sendNotification(config.userId, message);
    } catch (error) {
      console.error('Failed to send booking notification:', error);
    }
  }
}

// ===== MAIN SERVICE CLASS =====
export class RefactoredAutoBookingService {
  private browserManager = new BrowserManager();
  private isBooking = false;

  async startBooking(config: BookingConfig): Promise<BookingResult> {
    if (this.isBooking) {
      throw new BookingError('Booking is already in progress', 'ALREADY_RUNNING');
    }

    this.isBooking = true;

    try {
      // 1. Get and validate WB session
      const wbSession = await this.getWBSession(config);
      
      // 2. Decrypt session data
      const sessionData = SessionDataDecryptor.decryptSessionData(wbSession.cookies.encrypted);
      
      // 3. Launch browser and setup page
      await this.browserManager.launchBrowser();
      const page = await this.browserManager.createPage();

      try {
        // 4. Setup anti-detection and cookies
        await AntiDetectionSetup.setupPage(page);
        await CookieManager.setCookies(page, sessionData);

        // 5. Navigate to WB and extract tokens
        await page.goto('https://seller.wildberries.ru/', { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const tokens = await TokenExtractor.extractTokens(page);

        // 6. Perform booking
        const bookingResult = await BookingAPI.performBooking(page, config, tokens);

        // 7. Send notification if successful
        if (bookingResult.success) {
          await NotificationService.sendBookingNotification(config, bookingResult, config.prisma);
        }

        return bookingResult;

      } finally {
        await page.close();
      }

    } catch (error) {
      console.error('AutoBookingService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown booking error',
      };
    } finally {
      this.isBooking = false;
    }
  }

  private async getWBSession(config: BookingConfig) {
    const wbSession = await config.prisma.wBSession.findFirst({
      where: {
        userId: config.userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!wbSession) {
      throw new SessionError('No active WB session found');
    }

    return wbSession;
  }

  async stop(): Promise<void> {
    this.isBooking = false;
    await this.browserManager.closeBrowser();
  }

  isBookingInProgress(): boolean {
    return this.isBooking;
  }
}

// Export singleton instance
export const refactoredAutoBookingService = new RefactoredAutoBookingService();
