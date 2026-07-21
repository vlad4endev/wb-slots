// ===== BOOKING SERVICE - SRP: Бронирование слотов =====

import { Page } from 'playwright';
import { ILogger } from '../../core/interfaces';

export interface BookingConfig {
  supplyId: string;
  warehouseId: number;
  date: string;
  boxTypeId: number;
  timeout: number;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  duration: number;
  steps: BookingStep[];
}

export interface BookingStep {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface IBookingService {
  performBooking(page: Page, config: BookingConfig): Promise<BookingResult>;
  findAndClickPlanButton(page: Page, config: BookingConfig): Promise<BookingStep>;
  selectDate(page: Page, config: BookingConfig): Promise<BookingStep>;
  selectBoxType(page: Page, config: BookingConfig): Promise<BookingStep>;
  confirmBooking(page: Page, config: BookingConfig): Promise<BookingStep>;
  verifyBookingSuccess(page: Page, config: BookingConfig): Promise<BookingStep>;
}

export class BookingService implements IBookingService {
  private readonly selectors = {
    planButton: [
      'button:has-text("Запланировать поставку")',
      '[data-testid="plan-supply"]',
      '.plan-supply-btn',
      'button[class*="plan"]',
      'button:contains("План")'
    ],
    calendar: {
      container: [
        '[data-testid="booking-calendar"]',
        '.booking-calendar',
        '.calendar',
        '[class*="calendar"]',
        '.date-picker'
      ],
      date: [
        `[data-date="${config.date}"]`,
        `.date-${config.date}`,
        `[data-testid="date-${config.date}"]`,
        `td:has-text("${config.date}")`,
        `[title*="${config.date}"]`
      ]
    },
    boxType: [
      `[data-box-type="${config.boxTypeId}"]`,
      `[data-testid="box-type-${config.boxTypeId}"]`,
      `.box-type-${config.boxTypeId}`,
      `input[value="${config.boxTypeId}"]`
    ],
    confirmButton: [
      'button:has-text("Забронировать")',
      '[data-testid="book-slot"]',
      '.book-btn',
      'button[class*="book"]',
      'button:contains("Бронир")'
    ],
    success: {
      message: [
        '.success-message',
        '[data-testid="booking-success"]',
        '.booking-success',
        '*:has-text("успешно")',
        '*:has-text("забронирован")'
      ],
      bookingId: [
        '[data-booking-id]',
        '.booking-id',
        '[data-testid="booking-id"]'
      ]
    }
  };

  constructor(private logger: ILogger) {}

  async performBooking(page: Page, config: BookingConfig): Promise<BookingResult> {
    const startTime = Date.now();
    const steps: BookingStep[] = [];
    
    this.logger.info(`Starting booking process for supply: ${config.supplyId}`);

    try {
      // Step 1: Find and click plan button
      const planStep = await this.findAndClickPlanButton(page, config);
      steps.push(planStep);
      if (!planStep.success) {
        throw new Error(`Failed to find plan button: ${planStep.error}`);
      }

      // Step 2: Select date
      const dateStep = await this.selectDate(page, config);
      steps.push(dateStep);
      if (!dateStep.success) {
        throw new Error(`Failed to select date: ${dateStep.error}`);
      }

      // Step 3: Select box type
      const boxTypeStep = await this.selectBoxType(page, config);
      steps.push(boxTypeStep);
      if (!boxTypeStep.success) {
        throw new Error(`Failed to select box type: ${boxTypeStep.error}`);
      }

      // Step 4: Confirm booking
      const confirmStep = await this.confirmBooking(page, config);
      steps.push(confirmStep);
      if (!confirmStep.success) {
        throw new Error(`Failed to confirm booking: ${confirmStep.error}`);
      }

      // Step 5: Verify success
      const verifyStep = await this.verifyBookingSuccess(page, config);
      steps.push(verifyStep);
      if (!verifyStep.success) {
        throw new Error(`Failed to verify booking: ${verifyStep.error}`);
      }

      const duration = Date.now() - startTime;
      this.logger.info(`Booking completed successfully in ${duration}ms`);
      
      return {
        success: true,
        bookingId: verifyStep.bookingId,
        duration,
        steps
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Booking failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        steps
      };
    }
  }

  async findAndClickPlanButton(page: Page, config: BookingConfig): Promise<BookingStep> {
    const startTime = Date.now();
    this.logger.info('Looking for plan button...');

    try {
      for (const selector of this.selectors.planButton) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            await element.click();
            await page.waitForTimeout(1000);
            
            const duration = Date.now() - startTime;
            this.logger.info(`Plan button clicked successfully in ${duration}ms`);
            return {
              name: 'findAndClickPlanButton',
              success: true,
              duration
            };
          }
        } catch (error) {
          this.logger.debug(`Plan button selector failed: ${selector}`, error);
        }
      }

      throw new Error('Plan button not found');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to find plan button:', error);
      return {
        name: 'findAndClickPlanButton',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async selectDate(page: Page, config: BookingConfig): Promise<BookingStep> {
    const startTime = Date.now();
    this.logger.info(`Selecting date: ${config.date}`);

    try {
      // Wait for calendar to appear
      await page.waitForTimeout(2000);

      const dateSelectors = this.selectors.calendar.date.map(s => s.replace('{config.date}', config.date));
      
      for (const selector of dateSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            await element.click();
            await page.waitForTimeout(1000);
            
            const duration = Date.now() - startTime;
            this.logger.info(`Date selected successfully in ${duration}ms`);
            return {
              name: 'selectDate',
              success: true,
              duration
            };
          }
        } catch (error) {
          this.logger.debug(`Date selector failed: ${selector}`, error);
        }
      }

      throw new Error(`Date ${config.date} not found`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to select date:', error);
      return {
        name: 'selectDate',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async selectBoxType(page: Page, config: BookingConfig): Promise<BookingStep> {
    const startTime = Date.now();
    this.logger.info(`Selecting box type: ${config.boxTypeId}`);

    try {
      await page.waitForTimeout(1000);

      const boxTypeSelectors = this.selectors.boxType.map(s => s.replace('{config.boxTypeId}', config.boxTypeId.toString()));
      
      for (const selector of boxTypeSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            await element.click();
            await page.waitForTimeout(1000);
            
            const duration = Date.now() - startTime;
            this.logger.info(`Box type selected successfully in ${duration}ms`);
            return {
              name: 'selectBoxType',
              success: true,
              duration
            };
          }
        } catch (error) {
          this.logger.debug(`Box type selector failed: ${selector}`, error);
        }
      }

      throw new Error(`Box type ${config.boxTypeId} not found`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to select box type:', error);
      return {
        name: 'selectBoxType',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async confirmBooking(page: Page, config: BookingConfig): Promise<BookingStep> {
    const startTime = Date.now();
    this.logger.info('Confirming booking...');

    try {
      await page.waitForTimeout(1000);

      for (const selector of this.selectors.confirmButton) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            await element.click();
            await page.waitForTimeout(2000);
            
            const duration = Date.now() - startTime;
            this.logger.info(`Booking confirmed successfully in ${duration}ms`);
            return {
              name: 'confirmBooking',
              success: true,
              duration
            };
          }
        } catch (error) {
          this.logger.debug(`Confirm button selector failed: ${selector}`, error);
        }
      }

      throw new Error('Confirm button not found');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to confirm booking:', error);
      return {
        name: 'confirmBooking',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async verifyBookingSuccess(page: Page, config: BookingConfig): Promise<BookingStep> {
    const startTime = Date.now();
    this.logger.info('Verifying booking success...');

    try {
      await page.waitForTimeout(3000);

      // Check for success message
      let successFound = false;
      for (const selector of this.selectors.success.message) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            successFound = true;
            break;
          }
        } catch (error) {
          this.logger.debug(`Success message selector failed: ${selector}`, error);
        }
      }

      if (!successFound) {
        throw new Error('Success message not found');
      }

      // Try to extract booking ID
      let bookingId: string | undefined;
      for (const selector of this.selectors.success.bookingId) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            bookingId = await element.getAttribute('data-booking-id') || 
                       await element.textContent() || 
                       undefined;
            if (bookingId) break;
          }
        } catch (error) {
          this.logger.debug(`Booking ID selector failed: ${selector}`, error);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(`Booking verification successful in ${duration}ms`);
      
      return {
        name: 'verifyBookingSuccess',
        success: true,
        duration,
        bookingId
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to verify booking success:', error);
      return {
        name: 'verifyBookingSuccess',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
