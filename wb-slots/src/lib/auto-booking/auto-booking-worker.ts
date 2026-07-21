import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { AutoBookingConfig, BookingParams, DEFAULT_CONFIG } from './config';
import { TelegramService } from '../services/telegram-service';
import { captchaService } from '../security/captcha-service';
import { retryService, RetryContext } from '../security/retry-service';

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  screenshots?: string[];
  logs: BookingLog[];
  executionTime: number;
}

export interface BookingLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  step: string;
  message: string;
  data?: any;
  screenshot?: string;
}

export class AutoBookingWorker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: AutoBookingConfig;
  private logs: BookingLog[] = [];
  private screenshots: string[] = [];
  private userId: string = '';
  private taskName: string = '';
  private supplyName: string = '';

  constructor(config: Partial<AutoBookingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (this.config.screenshots.enabled) {
      fs.mkdirSync(this.config.screenshots.path, { recursive: true });
    }
    if (this.config.logging.file) {
      const logDir = path.dirname(this.config.logging.filePath);
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', step: string, message: string, data?: any): void {
    const logEntry: BookingLog = {
      timestamp: new Date().toISOString(),
      level,
      step,
      message,
      data,
    };

    this.logs.push(logEntry);

    if (this.config.logging.console) {
      const prefix = `[${logEntry.timestamp}] [${level.toUpperCase()}] [${step}]`;
      console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }

    if (this.config.logging.file) {
      const logLine = `${logEntry.timestamp} [${level.toUpperCase()}] [${step}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
      fs.appendFileSync(this.config.logging.filePath, logLine);
    }
  }

  private async takeScreenshot(name: string): Promise<string | null> {
    if (!this.config.screenshots.enabled || !this.page) {
      return null;
    }

    try {
      const filename = `${name}_${Date.now()}.png`;
      const filepath = path.join(this.config.screenshots.path, filename);
      
      await this.page.screenshot({ 
        path: filepath, 
        fullPage: true 
      });
      
      this.screenshots.push(filepath);
      this.log('debug', 'screenshot', `Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      this.log('error', 'screenshot', `Failed to take screenshot: ${error}`);
      return null;
    }
  }

  private async waitForElement(selector: string, timeout: number = this.config.timeouts.elementWait): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      this.log('warn', 'waitForElement', `Element not found: ${selector}`, { timeout, error });
      return false;
    }
  }

  private async safeClick(selector: string, description: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.waitForElement(selector);
      await this.page.click(selector);
      this.log('info', 'click', `Clicked: ${description}`, { selector });
      
      if (this.config.screenshots.onStep) {
        await this.takeScreenshot(`click_${description.replace(/\s+/g, '_')}`);
      }
      
      await this.page.waitForTimeout(this.config.timeouts.actionDelay);
      return true;
    } catch (error) {
      this.log('error', 'click', `Failed to click: ${description}`, { selector, error });
      await this.takeScreenshot(`error_click_${description.replace(/\s+/g, '_')}`);
      return false;
    }
  }

  private async safeType(selector: string, text: string, description: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.waitForElement(selector);
      await this.page.type(selector, text, { delay: 100 });
      this.log('info', 'type', `Typed in: ${description}`, { selector, textLength: text.length });
      
      if (this.config.screenshots.onStep) {
        await this.takeScreenshot(`type_${description.replace(/\s+/g, '_')}`);
      }
      
      return true;
    } catch (error) {
      this.log('error', 'type', `Failed to type in: ${description}`, { selector, error });
      await this.takeScreenshot(`error_type_${description.replace(/\s+/g, '_')}`);
      return false;
    }
  }

  private async safeGetText(selector: string, description: string): Promise<string | null> {
    if (!this.page) return null;

    try {
      await this.waitForElement(selector);
      const text = await this.page.$eval(selector, el => el.textContent);
      this.log('debug', 'getText', `Got text from: ${description}`, { selector, text });
      return text;
    } catch (error) {
      this.log('warn', 'getText', `Failed to get text from: ${description}`, { selector, error });
      return null;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      this.log('info', 'initialize', 'Initializing browser...');
      
      const launchOptions: PuppeteerLaunchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      };

      if (this.config.proxy) {
        launchOptions.args?.push(`--proxy-server=${this.config.proxy.server}`);
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      if (this.config.userAgent) {
        await this.page.setUserAgent(this.config.userAgent);
      }

      if (this.config.viewport) {
        await this.page.setViewport(this.config.viewport);
      }

      if (this.config.proxy && this.config.proxy.username && this.config.proxy.password) {
        await this.page.authenticate({
          username: this.config.proxy.username,
          password: this.config.proxy.password,
        });
      }

      this.log('info', 'initialize', 'Browser initialized successfully');
      return true;
    } catch (error) {
      this.log('error', 'initialize', 'Failed to initialize browser', { error });
      return false;
    }
  }

  async login(credentials: { email: string; password: string }): Promise<boolean> {
    if (!this.page) return false;

    try {
      this.log('info', 'login', 'Starting login process...');
      
      // Navigate to login page
      await this.page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'networkidle2',
        timeout: this.config.timeouts.pageLoad,
      });

      await this.takeScreenshot('login_page');

      // Fill email
      if (!await this.safeType(this.config.selectors.login.emailInput, credentials.email, 'email input')) {
        return false;
      }

      // Fill password
      if (!await this.safeType(this.config.selectors.login.passwordInput, credentials.password, 'password input')) {
        return false;
      }

      await this.takeScreenshot('login_filled');

      // Click login button
      if (!await this.safeClick(this.config.selectors.login.loginButton, 'login button')) {
        return false;
      }

      // Wait for navigation or success indicator
      await this.page.waitForTimeout(3000);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('seller.wildberries.ru') && !currentUrl.includes('login')) {
        this.log('info', 'login', 'Login successful');
        await this.takeScreenshot('login_success');
        return true;
      } else {
        this.log('error', 'login', 'Login failed - still on login page');
        await this.takeScreenshot('login_failed');
        return false;
      }
    } catch (error) {
      this.log('error', 'login', 'Login process failed', { error });
      await this.takeScreenshot('login_error');
      return false;
    }
  }

  async navigateToSupplies(): Promise<boolean> {
    if (!this.page) return false;

    try {
      this.log('info', 'navigateToSupplies', 'Navigating to supplies section...');
      
      // Look for supplies menu or link
      const suppliesLink = await this.page.$eval(
        this.config.selectors.navigation.suppliesLink,
        el => el.getAttribute('href')
      ).catch(() => null);

      if (suppliesLink) {
        await this.page.goto(suppliesLink, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeouts.pageLoad,
        });
      } else {
        // Try clicking on menu item
        if (!await this.safeClick(this.config.selectors.navigation.suppliesMenu, 'supplies menu')) {
          return false;
        }
      }

      await this.takeScreenshot('supplies_page');
      this.log('info', 'navigateToSupplies', 'Successfully navigated to supplies');
      return true;
    } catch (error) {
      this.log('error', 'navigateToSupplies', 'Failed to navigate to supplies', { error });
      await this.takeScreenshot('supplies_navigation_error');
      return false;
    }
  }

  async selectSupply(supplyId: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      this.log('info', 'selectSupply', `Looking for supply: ${supplyId}`);
      
      // Wait for supplies to load
      await this.waitForElement(this.config.selectors.supplies.supplyRow);

      // Find the supply by ID
      const supplyElement = await this.page.$eval(
        `${this.config.selectors.supplies.supplyRow}:has(${this.config.selectors.supplies.supplyId})`,
        (row, targetId) => {
          const idElement = row.querySelector('[data-testid="supply-id"], .supply-id, .supply-number');
          return idElement?.textContent?.includes(targetId) ? row : null;
        },
        supplyId
      ).catch(() => null);

      if (!supplyElement) {
        this.log('error', 'selectSupply', `Supply not found: ${supplyId}`);
        await this.takeScreenshot('supply_not_found');
        return false;
      }

      // Click select button for this supply
      const selectButton = await supplyElement.$(this.config.selectors.supplies.selectButton);
      if (!selectButton) {
        this.log('error', 'selectSupply', `Select button not found for supply: ${supplyId}`);
        return false;
      }

      await selectButton.click();
      this.log('info', 'selectSupply', `Successfully selected supply: ${supplyId}`);
      await this.takeScreenshot('supply_selected');
      
      return true;
    } catch (error) {
      this.log('error', 'selectSupply', `Failed to select supply: ${supplyId}`, { error });
      await this.takeScreenshot('supply_selection_error');
      return false;
    }
  }

  async selectSlot(filters: BookingParams['slotFilters']): Promise<boolean> {
    if (!this.page) return false;

    try {
      this.log('info', 'selectSlot', 'Looking for available slots...', { filters });
      
      // Проверяем на наличие капчи перед поиском слотов
      const captchaDetection = captchaService.detectCaptcha(this.page, this.page.url());
      if (captchaDetection.isCaptcha) {
        this.log('warn', 'selectSlot', 'Captcha detected during slot selection', {
          captchaType: captchaDetection.captchaType,
          captchaUrl: captchaDetection.captchaUrl,
        });

        // Обрабатываем капчу
        await captchaService.handleCaptcha(captchaDetection, {
          userId: this.userId,
          taskName: this.taskName,
          supplyName: this.supplyName,
          supplyId: 'unknown',
          warehouseName: 'unknown',
          slotDate: 'unknown',
          slotTime: 'unknown',
          coefficient: 0,
        });

        // Ждем решения капчи пользователем
        const waitTime = captchaService.getCaptchaWaitTime(this.userId, this.taskName);
        if (waitTime > 0) {
          this.log('info', 'selectSlot', `Waiting for captcha resolution: ${Math.ceil(waitTime / 1000)}s`);
          await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 30000))); // Максимум 30 секунд
        }

        return false; // Не удалось выбрать слот из-за капчи
      }
      
      // Wait for slots to load
      await this.waitForElement(this.config.selectors.slots.slotRow);

      // Get all available slots
      const slots = await this.page.$$eval(this.config.selectors.slots.slotRow, (rows, selectors) => {
        return rows.map(row => {
          const date = row.querySelector(selectors.slotDate)?.textContent?.trim();
          const time = row.querySelector(selectors.slotTime)?.textContent?.trim();
          const coefficient = row.querySelector(selectors.slotCoefficient)?.textContent?.trim();
          const button = row.querySelector(selectors.slotButton);
          
          return {
            element: row,
            date,
            time,
            coefficient: coefficient ? parseFloat(coefficient) : 0,
            hasButton: !!button,
          };
        });
      }, this.config.selectors.slots);

      this.log('debug', 'selectSlot', `Found ${slots.length} slots`);

      // Filter slots based on criteria
      const filteredSlots = slots.filter(slot => {
        if (!slot.hasButton) return false;
        
        const slotDate = new Date(slot.date || '');
        const fromDate = new Date(filters.dateFrom);
        const toDate = new Date(filters.dateTo);
        
        return slot.coefficient >= filters.coefficientMin &&
               slot.coefficient <= filters.coefficientMax &&
               slotDate >= fromDate &&
               slotDate <= toDate;
      });

      this.log('info', 'selectSlot', `Found ${filteredSlots.length} matching slots`);

      if (filteredSlots.length === 0) {
        this.log('warn', 'selectSlot', 'No matching slots found');
        await this.takeScreenshot('no_slots_found');
        return false;
      }

      // Select the first matching slot
      const selectedSlot = filteredSlots[0];
      await selectedSlot.element.click();
      
      this.log('info', 'selectSlot', 'Successfully selected slot', {
        date: selectedSlot.date,
        time: selectedSlot.time,
        coefficient: selectedSlot.coefficient,
      });
      
      await this.takeScreenshot('slot_selected');
      return true;
    } catch (error) {
      this.log('error', 'selectSlot', 'Failed to select slot', { error });
      await this.takeScreenshot('slot_selection_error');
      return false;
    }
  }

  async confirmBooking(): Promise<{ success: boolean; bookingId?: string }> {
    if (!this.page) return { success: false };

    try {
      this.log('info', 'confirmBooking', 'Confirming booking...');
      
      if (this.config.dryRun) {
        this.log('info', 'confirmBooking', 'DRY RUN: Would confirm booking (no actual booking)');
        return { success: true, bookingId: 'DRY_RUN_' + Date.now() };
      }

      // Click confirm button
      if (!await this.safeClick(this.config.selectors.booking.confirmButton, 'confirm booking button')) {
        return { success: false };
      }

      // Wait for confirmation
      await this.page.waitForTimeout(3000);

      // Check for success message
      const successMessage = await this.safeGetText(
        this.config.selectors.booking.successMessage,
        'success message'
      );

      if (successMessage) {
        this.log('info', 'confirmBooking', 'Booking confirmed successfully', { message: successMessage });
        await this.takeScreenshot('booking_success');
        return { success: true, bookingId: 'BOOKING_' + Date.now() };
      }

      // Check for error message
      const errorMessage = await this.safeGetText(
        this.config.selectors.booking.errorMessage,
        'error message'
      );

      if (errorMessage) {
        this.log('error', 'confirmBooking', 'Booking failed', { error: errorMessage });
        await this.takeScreenshot('booking_error');
        return { success: false };
      }

      this.log('warn', 'confirmBooking', 'Booking status unclear');
      await this.takeScreenshot('booking_unclear');
      return { success: false };
    } catch (error) {
      this.log('error', 'confirmBooking', 'Booking confirmation failed', { error });
      await this.takeScreenshot('booking_confirmation_error');
      return { success: false };
    }
  }

  async executeBooking(params: BookingParams, userId: string = '', taskName: string = '', supplyName: string = ''): Promise<BookingResult> {
    const startTime = Date.now();
    this.logs = [];
    this.screenshots = [];
    this.userId = userId;
    this.taskName = taskName;
    this.supplyName = supplyName;

    // Создаем контекст для retry service
    const retryContext: RetryContext = {
      userId: this.userId,
      taskName: this.taskName,
      supplyName: this.supplyName,
      supplyId: params.supplyId,
      warehouseName: 'Unknown',
      slotDate: 'Unknown',
      slotTime: 'Unknown',
      coefficient: 0,
      operation: 'booking',
    };

    try {
      this.log('info', 'executeBooking', 'Starting auto-booking process...', { params });

      // Отправляем уведомление о начале бронирования
      if (this.userId) {
        const telegramService = new TelegramService();
        await telegramService.sendNotification(this.userId, `🚀 Начато бронирование слота\n\n📦 Поставка: ${params.supplyId}\n🏢 Склад: ${params.slotFilters.warehouseId}\n📅 Дата: ${params.slotFilters.date}`);
      }

      // Выполняем бронирование с retry логикой
      const retryResult = await retryService.executeWithRetry(
        async () => {
          // Initialize browser
          if (!await this.initialize()) {
            throw new Error('Failed to initialize browser');
          }

          // Login if credentials provided
          if (params.credentials) {
            if (!await this.login(params.credentials)) {
              throw new Error('Login failed');
            }
          }

          // Navigate to supplies
          if (!await this.navigateToSupplies()) {
            throw new Error('Failed to navigate to supplies');
          }

          // Select supply
          if (!await this.selectSupply(params.supplyId)) {
            throw new Error('Failed to select supply');
          }

          // Select slot
          if (!await this.selectSlot(params.slotFilters)) {
            throw new Error('Failed to select slot');
          }

          // Confirm booking
          const bookingResult = await this.confirmBooking();
          if (!bookingResult.success) {
            throw new Error(bookingResult.error || 'Booking confirmation failed');
          }

          return bookingResult;
        },
        'booking',
        retryContext
      );

      if (!retryResult.success) {
        // Отправляем уведомление об ошибке
        if (this.userId) {
          const telegramService = new TelegramService();
          await telegramService.sendNotification(this.userId, `❌ Ошибка бронирования слота\n\n📦 Поставка: ${params.supplyId}\n🏢 Склад: ${params.slotFilters.warehouseId}\n📅 Дата: ${params.slotFilters.date}\n🚫 Ошибка: ${retryResult.error}`);
        }

        return {
          success: false,
          error: retryResult.error || 'Booking failed after all retries',
          logs: this.logs,
          screenshots: this.screenshots,
          executionTime: Date.now() - startTime,
        };
      }

      // Отправляем уведомление об успешном бронировании
      if (this.userId) {
        const telegramService = new TelegramService();
        await telegramService.sendNotification(this.userId, `🎉 Слот успешно забронирован!\n\n📦 Поставка: ${params.supplyId}\n🏢 Склад: ${params.slotFilters.warehouseId}\n📅 Дата: ${params.slotFilters.date}`);
      }

      this.log('info', 'executeBooking', 'Auto-booking completed successfully');
      
      return {
        success: true,
        bookingId: retryResult.result?.bookingId,
        logs: this.logs,
        screenshots: this.screenshots,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      this.log('error', 'executeBooking', 'Auto-booking process failed', { error });
      await this.takeScreenshot('booking_process_error');
      
      // Отправляем уведомление об ошибке процесса
      if (this.userId) {
        const telegramService = new TelegramService();
        await telegramService.sendNotification(this.userId, `❌ Критическая ошибка бронирования\n\n📦 Поставка: ${params.supplyId}\n🏢 Склад: ${params.slotFilters.warehouseId}\n📅 Дата: ${params.slotFilters.date}\n🚫 Ошибка: ${error.message}`);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: this.logs,
        screenshots: this.screenshots,
        executionTime: Date.now() - startTime,
      };
    } finally {
      await this.cleanup();
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.log('info', 'cleanup', 'Browser resources cleaned up');
    } catch (error) {
      this.log('error', 'cleanup', 'Error during cleanup', { error });
    }
  }
}
