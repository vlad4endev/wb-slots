import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { WBSessionData } from './wb-session-manager';

export interface SlotMonitoringParams {
  supplyId: string;
  warehouseIds: number[];
  checkInterval: number; // Интервал проверки в миллисекундах
  maxAttempts: number; // Максимальное количество попыток
}

export interface AvailableSlot {
  supplyId: string;
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  isAvailable: boolean;
  bookingButton?: {
    selector: string;
    isEnabled: boolean;
  };
}

export interface MonitoringResult {
  foundSlots: AvailableSlot[];
  totalChecks: number;
  monitoringTime: number;
  errors: string[];
}

export class WBSlotMonitor {
  private browser: Browser | null = null;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Инициализация браузера
   */
  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
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
    });
  }

  /**
   * Начало мониторинга слотов
   */
  async startMonitoring(
    sessionData: WBSessionData,
    params: SlotMonitoringParams,
    onSlotFound: (slot: AvailableSlot) => Promise<void>
  ): Promise<MonitoringResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Atomic check and set to prevent race conditions
    if (this.isMonitoring) {
      throw new Error('Monitoring is already in progress');
    }

    this.isMonitoring = true;
    const startTime = Date.now();
    const foundSlots: AvailableSlot[] = [];
    const errors: string[] = [];
    let totalChecks = 0;

    const page = await this.browser.newPage();
    
    try {
      // Устанавливаем cookies из сессии
      await this.setCookiesFromSession(page, sessionData);

      // Переходим на страницу приёмки
      await this.navigateToSupplyPage(page, params.supplyId);

      // Начинаем мониторинг
      console.log(`🔍 Начинаем мониторинг слотов для приёмки ${params.supplyId}`);
      
      return new Promise((resolve) => {
        this.monitoringInterval = setInterval(async () => {
          if (!this.isMonitoring || totalChecks >= params.maxAttempts) {
            this.stopMonitoring();
            resolve({
              foundSlots,
              totalChecks,
              monitoringTime: Date.now() - startTime,
              errors,
            });
            return;
          }

          try {
            totalChecks++;
            console.log(`🔍 Проверка ${totalChecks}/${params.maxAttempts}`);

            // Проверяем доступные слоты
            const slots = await this.checkAvailableSlots(page, params);
            
            for (const slot of slots) {
              if (slot?.isAvailable && slot?.bookingButton?.isEnabled) {
                console.log(`✅ Найден доступный слот: ${slot?.warehouseName} - ${slot?.date} ${slot?.timeSlot}`);
                foundSlots.push(slot);
                
                // Вызываем callback для обработки найденного слота
                try {
                  await onSlotFound(slot);
                } catch (error) {
                  errors.push(`Ошибка обработки слота: ${error}`);
                }
              }
            }

          } catch (error) {
            const errorMsg = `Ошибка проверки ${totalChecks}: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }, params.checkInterval);
      });

    } catch (error) {
      this.stopMonitoring();
      throw error;
    } finally {
      await page.close();
      this.isBooking = false;
    }
  }

  /**
   * Остановка мониторинга
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Установка cookies из сессии
   */
  private async setCookiesFromSession(page: Page, sessionData: WBSessionData): Promise<void> {
    const cookies = Object.entries(sessionData.cookies).map(([name, value]) => ({
      name,
      value,
      domain: '.wildberries.ru',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax' as const,
    }));

    await page.setCookie(...cookies);
  }

  /**
   * Навигация к странице приёмки
   */
  private async navigateToSupplyPage(page: Page, supplyId: string): Promise<void> {
    // Переходим на страницу приёмки
    const supplyUrl = `https://seller.wildberries.ru/supplier/supply/${supplyId}`;
    
    await page.goto(supplyUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Ждем загрузки страницы со слотами
    await page.waitForSelector('[data-testid="slots"], .slots-container, .supply-slots', {
      timeout: 10000,
    });
  }

  /**
   * Проверка доступных слотов
   */
  private async checkAvailableSlots(page: Page, params: SlotMonitoringParams): Promise<AvailableSlot[]> {
    const slots: AvailableSlot[] = [];

    try {
      // Ищем все слоты на странице
      const slotElements = await page.$$('[data-testid="slot"], .slot-item, .supply-slot');
      
      for (const element of slotElements) {
        try {
          const slot = await this.extractSlotInfo(element, params.supplyId);
          if (slot) {
            slots.push(slot);
          }
        } catch (error) {
          console.error('Error extracting slot info:', error);
        }
      }

    } catch (error) {
      console.error('Error checking slots:', error);
    }

    return slots;
  }

  /**
   * Извлечение информации о слоте
   */
  private async extractSlotInfo(element: any, supplyId: string): Promise<AvailableSlot | null> {
    try {
      // Извлекаем данные о слоте
      const warehouseId = await element.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        return htmlEl.dataset.warehouseId || htmlEl.getAttribute('data-warehouse-id');
      });

      const warehouseName = await element.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        const nameEl = htmlEl.querySelector('.warehouse-name, [data-testid="warehouse-name"]');
        return nameEl?.textContent?.trim() || 'Неизвестный склад';
      });

      const date = await element.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        const dateEl = htmlEl.querySelector('.slot-date, [data-testid="slot-date"]');
        return dateEl?.textContent?.trim() || '';
      });

      const timeSlot = await element.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        const timeEl = htmlEl.querySelector('.slot-time, [data-testid="slot-time"]');
        return timeEl?.textContent?.trim() || '';
      });

      const coefficient = await element.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        const coefEl = htmlEl.querySelector('.coefficient, [data-testid="coefficient"]');
        const coefText = coefEl?.textContent?.trim();
        return coefText ? parseFloat(coefText) : 0;
      });

      // Проверяем доступность слота
      const isAvailable = await element.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        return !htmlEl.classList.contains('disabled') && 
               !htmlEl.classList.contains('unavailable') &&
               !htmlEl.hasAttribute('disabled');
      });

      // Ищем кнопку бронирования
      const bookingButton = await element.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        const button = htmlEl.querySelector('button[data-testid="book-slot"], button:contains("Забронировать"), .book-button') as HTMLButtonElement;
        return button ? {
          selector: 'button[data-testid="book-slot"], button:contains("Забронировать"), .book-button',
          isEnabled: !button.disabled && !button.classList.contains('disabled')
        } : null;
      });

      return {
        supplyId,
        warehouseId: (() => {
          const parsed = parseInt(warehouseId || '0');
          return isNaN(parsed) ? 0 : parsed;
        })(),
        warehouseName: warehouseName || 'Неизвестный склад',
        date: date || '',
        timeSlot: timeSlot || '',
        coefficient: coefficient || 0,
        isAvailable: isAvailable || false,
        bookingButton,
      };

    } catch (error) {
      console.error('Error extracting slot info:', error);
      return null;
    }
  }

  /**
   * Бронирование конкретного слота
   */
  async bookSlot(sessionData: WBSessionData, slot: AvailableSlot): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Atomic check and set to prevent race conditions
    if (this.isBooking) {
      throw new Error('Booking is already in progress');
    }

    this.isBooking = true;

    const page = await this.browser.newPage();
    
    try {
      // Устанавливаем cookies
      await this.setCookiesFromSession(page, sessionData);

      // Переходим к странице бронирования
      await this.navigateToSupplyPage(page, slot.supplyId);

      // Ищем и нажимаем кнопку бронирования для конкретного слота
      const slotElement = await page.$(`[data-warehouse-id="${slot.warehouseId}"]`);
      if (!slotElement) {
        throw new Error('Слот не найден на странице');
      }

      const bookingButton = await slotElement.$('button[data-testid="book-slot"], button:contains("Забронировать"), .book-button');
      if (!bookingButton) {
        throw new Error('Кнопка бронирования не найдена');
      }

      // Нажимаем кнопку бронирования
      await bookingButton.click();
      await page.waitForTimeout(1000);

      // Обрабатываем диалог подтверждения, если есть
      const confirmDialog = await page.$('[data-testid="confirm-dialog"], .confirm-dialog, .modal');
      if (confirmDialog) {
        const confirmButton = await confirmDialog.$('button:contains("Подтвердить"), button:contains("Да"), button[type="submit"]');
        if (confirmButton) {
          await confirmButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Проверяем успешность бронирования
      const successMessage = await page.$('.success-message, .alert-success, [data-testid="success"]');
      if (successMessage) {
        const bookingId = await this.extractBookingId(page);
        return { success: true, bookingId };
      }

      const errorMessage = await page.$('.error-message, .alert-error, [data-testid="error"]');
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        return { success: false, error: errorText || 'Ошибка бронирования' };
      }

      return { success: false, error: 'Не удалось определить результат бронирования' };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    } finally {
      await page.close();
      this.isBooking = false;
    }
  }

  /**
   * Извлечение ID бронирования
   */
  private async extractBookingId(page: Page): Promise<string | undefined> {
    try {
      const idElement = await page.$('[data-testid="booking-id"], .booking-id, .order-number');
      if (idElement) {
        const idText = await idElement.textContent();
        const idMatch = idText?.match(/(\d+)/);
        return idMatch ? idMatch[1] : undefined;
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
    this.stopMonitoring();
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
