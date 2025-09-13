import puppeteer, { Browser, Page } from 'puppeteer';
import { decrypt } from '../encryption';
import { TelegramService } from './telegram-service';
import { execSync } from 'child_process';
import * as path from 'path';

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
  prisma?: any; // Делаем prisma опциональным для fallback
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  screenshot?: string;
}

export class AutoBookingService {
  private browser: Browser | null = null;
  private isBooking = false;

  /**
   * Найти путь к Chrome
   */
  private findChromePath(): string | undefined {
    try {
      // Попробуем найти Chrome в стандартных местах
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      ];

      for (const chromePath of possiblePaths) {
        try {
          if (chromePath && require('fs').existsSync(chromePath)) {
            return chromePath;
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }

      // Попробуем найти через where команду
      try {
        const chromePath = execSync('where chrome', { encoding: 'utf8' }).trim();
        if (chromePath) {
          return chromePath;
        }
      } catch (e) {
        // Игнорируем ошибки
      }

      return undefined;
    } catch (error) {
      console.warn('Could not find Chrome path:', error);
      return undefined;
    }
  }

  /**
   * Запустить процесс бронирования
   */
  async startBooking(config: BookingConfig): Promise<BookingResult> {
    if (this.isBooking) {
      throw new Error('Booking is already in progress');
    }

    this.isBooking = true;

    try {
      // Используем переданный prisma
      if (!config.prisma) {
        throw new Error('Prisma client is required');
      }
      
      const prismaClient = config.prisma;

      // Получаем WB сессию пользователя
      const wbSession = await prismaClient.wBSession.findFirst({
        where: {
          userId: config.userId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!wbSession) {
        throw new Error('No active WB session found');
      }

      // Расшифровываем cookies
      const cookiesData = wbSession.cookies as any;
      let decryptedCookies;
      
      console.log('Session cookies data structure:', {
        hasEncrypted: !!cookiesData.encrypted,
        encryptedType: typeof cookiesData.encrypted
      });
      
      try {
        // Пытаемся расшифровать как дополнительные данные (с localStorage/sessionStorage)
        decryptedCookies = JSON.parse(decrypt(cookiesData.encrypted));
        console.log('Decrypted as additional data format:', {
          hasCookies: !!decryptedCookies.cookies,
          hasLocalStorage: !!decryptedCookies.localStorage,
          hasSessionStorage: !!decryptedCookies.sessionStorage
        });
      } catch (error) {
        // Если не получилось, пытаемся как простые куки
        try {
          const simpleCookies = JSON.parse(decrypt(cookiesData.encrypted));
          decryptedCookies = {
            cookies: simpleCookies,
            localStorage: {},
            sessionStorage: {}
          };
          console.log('Decrypted as simple cookies format:', {
            cookiesType: typeof simpleCookies,
            cookiesKeys: Object.keys(simpleCookies)
          });
        } catch (error2) {
          console.error('Failed to decrypt session data:', error2);
          throw new Error('Failed to decrypt session data');
        }
      }

      // Запускаем браузер
      await this.launchBrowser();

      if (!this.browser) {
        throw new Error('Failed to launch browser');
      }

      const page = await this.browser.newPage();

      try {
        // Настраиваем антидетект параметры
        await this.setupAntiDetection(page);
        
        // Устанавливаем cookies
        await this.setCookies(page, JSON.stringify(decryptedCookies));

        // Переходим на страницу бронирования
        const bookingUrl = this.buildBookingUrl(config);
        await page.goto(bookingUrl, { waitUntil: 'networkidle2' });

        // Выполняем бронирование
        const bookingResult = await this.performBooking(page, config);

        // Отправляем уведомление
        if (bookingResult.success) {
          await this.sendBookingNotification(config, bookingResult);
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

  /**
   * Запустить браузер с антидетект настройками
   */
  private async launchBrowser(): Promise<void> {
    if (this.browser) {
      return;
    }

    // Находим путь к Chrome
    const chromePath = this.findChromePath();
    console.log('Chrome path found:', chromePath);

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: chromePath || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
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
        ],
      });
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure Chrome is installed or set PUPPETEER_EXECUTABLE_PATH environment variable.`);
    }
  }

  /**
   * Перехватить CSRF токен из сетевых запросов
   */
  private async interceptCSRFToken(page: Page): Promise<string | null> {
    return new Promise((resolve) => {
      let csrfToken: string | null = null;
      
      const requestHandler = (request: any) => {
        const url = request.url();
        if (url.includes('seller.wildberries.ru') && (url.includes('api') || url.includes('csrf'))) {
          const headers = request.headers();
          if (headers['x-csrf-token']) {
            csrfToken = headers['x-csrf-token'];
            console.log('Found CSRF token in request headers:', csrfToken);
          }
        }
      };
      
      const responseHandler = (response: any) => {
        const url = response.url();
        if (url.includes('seller.wildberries.ru') && response.status() === 200) {
          response.headers().then((headers: any) => {
            if (headers['x-csrf-token']) {
              csrfToken = headers['x-csrf-token'];
              console.log('Found CSRF token in response headers:', csrfToken);
            }
          }).catch(() => {});
        }
      };
      
      page.on('request', requestHandler);
      page.on('response', responseHandler);
      
      // Очищаем обработчики через 10 секунд
      setTimeout(() => {
        page.off('request', requestHandler);
        page.off('response', responseHandler);
        resolve(csrfToken);
      }, 10000);
    });
  }

  /**
   * Настроить антидетект параметры страницы
   */
  private async setupAntiDetection(page: Page): Promise<void> {
    // Удаляем признаки автоматизации
    await page.evaluateOnNewDocument(() => {
      // Удаляем webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Удаляем automation флаги
      delete (window as any).chrome;
      delete (window as any).navigator.webdriver;
      
      // Переопределяем permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
      
      // Переопределяем plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Переопределяем languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      });
    });

    // Устанавливаем реалистичные размеры окна
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Устанавливаем дополнительные заголовки
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
  }

  /**
   * Установить cookies, localStorage и sessionStorage в браузер
   */
  private async setCookies(page: Page, cookies: string): Promise<void> {
    try {
      console.log('Raw cookies string:', typeof cookies === 'string' ? cookies.substring(0, 200) + '...' : 'Not a string');
      
      const cookieData = JSON.parse(cookies);
      console.log('Cookie data structure:', {
        hasCookies: !!cookieData.cookies,
        cookiesType: typeof cookieData.cookies,
        cookiesKeys: cookieData.cookies ? Object.keys(cookieData.cookies) : [],
        hasLocalStorage: !!cookieData.localStorage,
        hasSessionStorage: !!cookieData.sessionStorage,
        fullCookieData: cookieData
      });
      
      // Устанавливаем куки - конвертируем объект в формат Puppeteer
      if (cookieData.cookies) {
        let puppeteerCookies = [];
        
        if (typeof cookieData.cookies === 'object' && !Array.isArray(cookieData.cookies)) {
          // Куки в формате объекта {name: value}
          puppeteerCookies = Object.entries(cookieData.cookies).map(([name, value]) => ({
            name,
            value: String(value),
            domain: '.wildberries.ru',
            path: '/',
            httpOnly: false,
            secure: true,
            sameSite: 'Lax' as const
          }));
        } else if (Array.isArray(cookieData.cookies)) {
          // Куки уже в формате Puppeteer
          puppeteerCookies = cookieData.cookies;
        } else {
          console.warn('Unknown cookies format:', typeof cookieData.cookies);
        }
        
        if (puppeteerCookies.length > 0) {
          console.log('Setting cookies:', puppeteerCookies.length, 'cookies');
          await page.setCookie(...puppeteerCookies);
        } else {
          console.warn('No cookies to set');
        }
      } else {
        console.warn('No cookies found in cookieData');
      }
      
      // Устанавливаем localStorage
      if (cookieData.localStorage && typeof cookieData.localStorage === 'object') {
        await page.evaluateOnNewDocument((localStorageData) => {
          Object.keys(localStorageData).forEach(key => {
            localStorage.setItem(key, localStorageData[key]);
          });
        }, cookieData.localStorage);
      }
      
      // Устанавливаем sessionStorage
      if (cookieData.sessionStorage && typeof cookieData.sessionStorage === 'object') {
        await page.evaluateOnNewDocument((sessionStorageData) => {
          Object.keys(sessionStorageData).forEach(key => {
            sessionStorage.setItem(key, sessionStorageData[key]);
          });
        }, cookieData.sessionStorage);
      }
      
    } catch (error) {
      console.error('Failed to set cookies:', error);
      console.error('Raw cookies that failed to parse:', cookies);
      throw new Error(`Invalid cookie format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Построить URL для бронирования
   */
  private buildBookingUrl(config: BookingConfig): string {
    const baseUrl = 'https://seller.wildberries.ru/';
    const params = new URLSearchParams({
      slotId: config.slotId,
      supplyId: config.supplyId,
      warehouseId: config.warehouseId.toString(),
      boxTypeId: config.boxTypeId.toString(),
      date: config.date,
    });

    return `${baseUrl}booking?${params.toString()}`;
  }

  /**
   * Выполнить бронирование через API WB
   */
  private async performBooking(page: Page, config: BookingConfig): Promise<BookingResult> {
    try {
      // Запускаем перехват CSRF токенов
      const csrfInterceptor = this.interceptCSRFToken(page);
      
      // Переходим на главную страницу WB Seller для получения токенов
      await page.goto('https://seller.wildberries.ru/', { waitUntil: 'networkidle2' });
      
      // Ждем загрузки и получаем CSRF токен
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Получаем токены из различных источников
      const tokens = await page.evaluate(() => {
        // Пробуем разные способы получения CSRF токена
        let csrfToken = null;
        
        // 1. Из meta тега
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (metaToken) csrfToken = metaToken;
        
        // 2. Из localStorage
        if (!csrfToken) {
          csrfToken = localStorage.getItem('csrfToken') || 
                     localStorage.getItem('_csrf') || 
                     localStorage.getItem('csrf_token');
        }
        
        // 3. Из cookies
        if (!csrfToken) {
          const cookieMatch = document.cookie.match(/csrf[_-]?token=([^;]+)/i);
          if (cookieMatch) csrfToken = cookieMatch[1];
        }
        
        // 4. Из window объекта
        if (!csrfToken && (window as any).csrfToken) {
          csrfToken = (window as any).csrfToken;
        }
        
        // 5. Ищем в скриптах на странице
        if (!csrfToken) {
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const content = script.textContent || '';
            const match = content.match(/csrf[_-]?token["\s]*[:=]["\s]*["']([^"']+)["']/i);
            if (match) {
              csrfToken = match[1];
              break;
            }
          }
        }
        
        // 6. Пробуем получить через API запрос
        if (!csrfToken) {
          try {
            // Ищем в ответах на AJAX запросы
            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/v1/user/profile', false);
            xhr.send();
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              csrfToken = response.csrfToken || response._csrf;
            }
          } catch (e) {
            // Игнорируем ошибки
          }
        }
        
        return {
          csrfToken,
          sessionId: localStorage.getItem('sessionId') || 
                    document.cookie.match(/sessionId=([^;]+)/)?.[1] ||
                    document.cookie.match(/session_id=([^;]+)/)?.[1],
          xSuppId: localStorage.getItem('xSuppId') || 
                  document.cookie.match(/xSuppId=([^;]+)/)?.[1] ||
                  document.cookie.match(/x_supp_id=([^;]+)/)?.[1],
          // Дополнительные токены
          authToken: localStorage.getItem('authToken') || 
                    localStorage.getItem('token') ||
                    document.cookie.match(/auth[_-]?token=([^;]+)/i)?.[1],
          userId: localStorage.getItem('userId') || 
                 localStorage.getItem('user_id') ||
                 document.cookie.match(/user[_-]?id=([^;]+)/i)?.[1]
        };
      });

      console.log('Extracted tokens:', {
        csrfToken: tokens.csrfToken ? 'Found' : 'Not found',
        sessionId: tokens.sessionId ? 'Found' : 'Not found',
        xSuppId: tokens.xSuppId ? 'Found' : 'Not found',
        authToken: tokens.authToken ? 'Found' : 'Not found',
        userId: tokens.userId ? 'Found' : 'Not found'
      });

      // Проверяем перехваченный CSRF токен
      const interceptedToken = await csrfInterceptor;
      if (interceptedToken && !tokens.csrfToken) {
        tokens.csrfToken = interceptedToken;
        console.log('Using intercepted CSRF token');
      }
      
      if (!tokens.csrfToken) {
        // Если CSRF токен не найден, пробуем альтернативный подход
        console.log('CSRF token not found, trying alternative approach...');
        
        // Переходим на страницу бронирования и ищем токен там
        await page.goto(`https://seller.wildberries.ru/ns/sm/supply-manager/api/v1/supply/booking`, { 
          waitUntil: 'networkidle2' 
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const alternativeTokens = await page.evaluate(() => {
          // Ищем токен в ответе страницы
          const bodyText = document.body.textContent || '';
          const csrfMatch = bodyText.match(/csrf[_-]?token["\s]*[:=]["\s]*["']([^"']+)["']/i);
          
          return {
            csrfToken: csrfMatch ? csrfMatch[1] : null,
            // Пробуем получить из заголовков ответа
            responseHeaders: Array.from(document.querySelectorAll('*')).map(el => 
              el.getAttribute('data-csrf-token') || el.getAttribute('data-csrf')
            ).filter(Boolean)
          };
        });
        
        if (alternativeTokens.csrfToken) {
          tokens.csrfToken = alternativeTokens.csrfToken;
          console.log('Found CSRF token via alternative approach');
        } else {
          throw new Error('CSRF token not found in any location');
        }
      }

      // Выполняем API запрос для бронирования
      const bookingResponse = await page.evaluate(async (bookingData) => {
        try {
          // Сначала пробуем получить актуальный CSRF токен через API
          let currentCsrfToken = bookingData.tokens.csrfToken;
          
          try {
            const csrfResponse = await fetch('https://seller.wildberries.ru/ns/sm/supply-manager/api/v1/supply/booking', {
              method: 'GET',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://seller.wildberries.ru/',
                'Origin': 'https://seller.wildberries.ru'
              }
            });
            
            if (csrfResponse.ok) {
              const csrfData = await csrfResponse.json().catch(() => ({}));
              if (csrfData.csrfToken) {
                currentCsrfToken = csrfData.csrfToken;
              }
            }
          } catch (e) {
            console.log('Could not get fresh CSRF token, using cached one');
          }
          
          // Создаем заголовки, исключая undefined значения
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': currentCsrfToken || '',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://seller.wildberries.ru/',
            'Origin': 'https://seller.wildberries.ru',
            'User-Agent': navigator.userAgent,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          };
          
          // Добавляем дополнительные заголовки только если они есть
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
            credentials: 'include', // Важно для передачи cookies
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
            csrfToken: currentCsrfToken
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
      }, {
        ...config,
        tokens
      });

      if (!bookingResponse.success) {
        throw new Error(`Booking API error: ${bookingResponse.status} - ${JSON.stringify(bookingResponse.data)}`);
      }

      // Делаем скриншот успешного бронирования
      const screenshot = await page.screenshot({ encoding: 'base64' });

      return {
        success: true,
        bookingId: bookingResponse.data.bookingId || 'unknown',
        screenshot: `data:image/png;base64,${screenshot}`,
      };

    } catch (error) {
      console.error('Booking failed:', error);
      
      // Делаем скриншот ошибки
      const screenshot = await page.screenshot({ encoding: 'base64' });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Booking failed',
        screenshot: `data:image/png;base64,${screenshot}`,
      };
    }
  }

  /**
   * Отправить уведомление о бронировании
   */
  private async sendBookingNotification(config: BookingConfig, result: BookingResult): Promise<void> {
    try {
      const telegramService = new TelegramService(config.prisma);
      
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

  /**
   * Остановить сервис
   */
  async stop(): Promise<void> {
    this.isBooking = false;
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Проверить статус бронирования
   */
  isBookingInProgress(): boolean {
    return this.isBooking;
  }
}

// Экспортируем singleton instance
export const autoBookingService = new AutoBookingService();
