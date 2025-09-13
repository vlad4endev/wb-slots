import puppeteer, { Browser, Page } from 'puppeteer';
import { WBSessionData } from './wb-session-manager';

export interface BookingCredentials {
  email: string;
  password: string;
}

export interface BookingParams {
  warehouseId: number;
  date: string;
  timeSlot: string;
  boxTypes: string[];
  supplyId?: string; // ID поставки для бронирования
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  screenshot?: string; // Base64 скриншот для отладки
}

export class WBAutoBooking {
  private browser: Browser | null = null;
  private credentials: BookingCredentials | null = null;

  constructor(credentials?: BookingCredentials) {
    this.credentials = credentials || null;
  }

  /**
   * Инициализация браузера
   */
  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: true, // В продакшене должно быть true
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }

  /**
   * Авторизация в личном кабинете WB
   */
  async login(credentials: BookingCredentials): Promise<boolean> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      // Переходим на страницу входа
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Ждем появления формы входа
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

      // Заполняем email
      await page.type('input[type="email"], input[name="email"]', credentials.email);

      // Нажимаем "Далее" или ищем поле пароля
      const nextButton = await page.$('button[type="submit"], button:contains("Далее")');
      if (nextButton) {
        await nextButton.click();
        await page.waitForTimeout(2000);
      }

      // Заполняем пароль
      await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });
      await page.type('input[type="password"], input[name="password"]', credentials.password);

      // Нажимаем "Войти"
      const loginButton = await page.$('button[type="submit"], button:contains("Войти")');
      if (loginButton) {
        await loginButton.click();
      }

      // Ждем успешной авторизации (появление элементов дашборда)
      await page.waitForSelector('[data-testid="dashboard"], .dashboard, .main-content', { 
        timeout: 15000 
      });

      // Сохраняем cookies после успешной авторизации
      const cookies = await page.cookies();
      this.saveCookies(cookies);

      this.credentials = credentials;
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      await page.close();
    }
  }

  /**
   * Сохранение cookies для последующего использования
   */
  private saveCookies(cookies: any[]): void {
    // В реальной реализации здесь будет сохранение в базу данных
    console.log('Cookies saved:', cookies.length);
  }

  /**
   * Бронирование слота
   */
  async bookSlot(params: BookingParams): Promise<BookingResult> {
    if (!this.browser || !this.credentials) {
      throw new Error('Not authenticated');
    }

    const page = await this.browser.newPage();
    let screenshot: string | undefined;

    try {
      // Переходим в раздел поставок
      await page.goto('https://seller.wildberries.ru/supplier/supply', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Ищем кнопку "Забронировать слот" или "Новая поставка"
      const bookButton = await page.$('button:contains("Забронировать"), button:contains("Новая поставка"), [data-testid="book-slot"]');
      if (!bookButton) {
        throw new Error('Кнопка бронирования не найдена');
      }

      await bookButton.click();
      await page.waitForTimeout(2000);

      // Выбираем склад
      const warehouseSelect = await page.$('select[name="warehouse"], [data-testid="warehouse-select"]');
      if (warehouseSelect) {
        await warehouseSelect.select(params.warehouseId.toString());
      }

      // Выбираем дату
      const dateInput = await page.$('input[type="date"], input[name="date"], [data-testid="date-input"]');
      if (dateInput) {
        await dateInput.type(params.date);
      }

      // Выбираем временной слот
      const timeSlotSelect = await page.$('select[name="timeSlot"], [data-testid="time-slot-select"]');
      if (timeSlotSelect) {
        await timeSlotSelect.select(params.timeSlot);
      }

      // Выбираем типы коробок
      for (const boxType of params.boxTypes) {
        const checkbox = await page.$(`input[type="checkbox"][value="${boxType}"], input[type="checkbox"][name*="${boxType.toLowerCase()}"]`);
        if (checkbox) {
          await checkbox.click();
        }
      }

      // Если указан ID поставки, заполняем его
      if (params.supplyId) {
        const supplyInput = await page.$('input[name="supplyId"], input[placeholder*="поставк"], [data-testid="supply-id"]');
        if (supplyInput) {
          await supplyInput.type(params.supplyId);
        }
      }

      // Подтверждаем бронирование
      const confirmButton = await page.$('button:contains("Забронировать"), button:contains("Подтвердить"), button[type="submit"]');
      if (confirmButton) {
        await confirmButton.click();
        await page.waitForTimeout(3000);
      }

      // Проверяем успешность бронирования
      const successMessage = await page.$('.success, .alert-success, [data-testid="success"]');
      const errorMessage = await page.$('.error, .alert-error, [data-testid="error"]');

      if (successMessage) {
        const bookingId = await this.extractBookingId(page);
        return {
          success: true,
          bookingId,
        };
      } else if (errorMessage) {
        const errorText = await errorMessage.textContent();
        return {
          success: false,
          error: errorText || 'Ошибка бронирования',
        };
      } else {
        // Делаем скриншот для отладки
        screenshot = await page.screenshot({ encoding: 'base64' });
        return {
          success: false,
          error: 'Не удалось определить результат бронирования',
          screenshot,
        };
      }
    } catch (error) {
      screenshot = await page.screenshot({ encoding: 'base64' }).catch(() => undefined);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        screenshot,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Извлечение ID бронирования со страницы
   */
  private async extractBookingId(page: Page): Promise<string | undefined> {
    try {
      // Ищем различные варианты отображения ID бронирования
      const idSelectors = [
        '[data-testid="booking-id"]',
        '.booking-id',
        '.order-number',
        'span:contains("ID")',
        'div:contains("Номер")',
      ];

      for (const selector of idSelectors) {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          const idMatch = text?.match(/(\d+)/);
          if (idMatch) {
            return idMatch[1];
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error extracting booking ID:', error);
      return undefined;
    }
  }

  /**
   * Закрытие браузера
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Использование сохраненной сессии
   */
  async useSavedSession(sessionData: WBSessionData): Promise<boolean> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      // Устанавливаем cookies из сохраненной сессии
      await page.setCookie(...this.parseCookies(sessionData.cookies));

      // Переходим на главную страницу WB
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Проверяем, что мы авторизованы
      const dashboardElement = await page.$('[data-testid="dashboard"], .dashboard, .main-content');
      const isAuthenticated = !!dashboardElement;

      if (isAuthenticated) {
        this.credentials = {
          email: 'saved_session',
          password: 'saved_session',
        };
      }

      return isAuthenticated;
    } catch (error) {
      console.error('Error using saved session:', error);
      return false;
    } finally {
      await page.close();
    }
  }

  /**
   * Парсинг cookies из объекта в формат для Puppeteer
   */
  private parseCookies(cookies: Record<string, string>) {
    return Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: '.wildberries.ru',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax' as const,
    }));
  }

  /**
   * Проверка статуса авторизации
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.browser || !this.credentials) return false;

    const page = await this.browser.newPage();
    try {
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'networkidle2',
        timeout: 10000,
      });

      // Проверяем наличие элементов дашборда
      const dashboardElement = await page.$('[data-testid="dashboard"], .dashboard, .main-content');
      return !!dashboardElement;
    } catch (error) {
      return false;
    } finally {
      await page.close();
    }
  }
}
