import { Page } from 'playwright';
import { Logger } from '../logging/logger';
import { WB_SELECTORS, getFreeSlotSelector } from '../utils/wb-auth-selectors';

/**
 * Сервис для работы с календарем лотов WB
 */

export interface CalendarSlot {
  date: string;
  time: string;
  isFree: boolean;
  isSelected: boolean;
  selector: string;
}

export interface CalendarSelectionResult {
  success: boolean;
  selectedSlot?: CalendarSlot;
  message: string;
  error?: string;
}

export class WBCalendarService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Получает список доступных слотов в календаре
   */
  async getAvailableSlots(page: Page): Promise<CalendarSlot[]> {
    try {
      this.logger.info('📅 Getting available calendar slots');

      // Ждем загрузки модального окна календаря
      await page.waitForSelector(WB_SELECTORS.CALENDAR.MODAL, { timeout: 30000 });

      // Получаем данные о слотах
      const slots = await page.evaluate(() => {
        const modal = document.querySelector('#Portal-CalendarPlanModal');
        if (!modal) return [];

        const slotElements = modal.querySelectorAll('.calendar-slot, .slot, [class*="slot"]');
        const slotsList: CalendarSlot[] = [];

        slotElements.forEach((element, index) => {
          const isFree = !element.classList.contains('occupied') && 
                        !element.classList.contains('disabled') &&
                        !element.classList.contains('booked');
          
          const isSelected = element.classList.contains('selected');
          
          const dateElement = element.querySelector('.date, [class*="date"]');
          const timeElement = element.querySelector('.time, [class*="time"]');
          
          const date = dateElement?.textContent?.trim() || `date-${index}`;
          const time = timeElement?.textContent?.trim() || `time-${index}`;

          slotsList.push({
            date,
            time,
            isFree,
            isSelected,
            selector: `#Portal-CalendarPlanModal .calendar-slot:nth-child(${index + 1})`
          });
        });

        return slotsList;
      });

      this.logger.info('✅ Calendar slots retrieved', { 
        total: slots.length, 
        free: slots.filter(s => s.isFree).length 
      });
      return slots;

    } catch (error) {
      this.logger.error('❌ Failed to get calendar slots', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  /**
   * Выбирает ближайший свободный слот
   */
  async selectNearestFreeSlot(page: Page): Promise<CalendarSelectionResult> {
    try {
      this.logger.info('📅 Selecting nearest free slot');

      const slots = await this.getAvailableSlots(page);
      const freeSlots = slots.filter(slot => slot.isFree);

      if (freeSlots.length === 0) {
        return {
          success: false,
          message: 'Нет свободных слотов в календаре'
        };
      }

      // Выбираем первый свободный слот
      const selectedSlot = freeSlots[0];
      
      // Кликаем по слоту
      await page.click(selectedSlot.selector);
      
      // Ждем подтверждения выбора
      await page.waitForTimeout(2000);

      this.logger.info('✅ Free slot selected', { 
        date: selectedSlot.date, 
        time: selectedSlot.time 
      });

      return {
        success: true,
        selectedSlot,
        message: `Выбран слот: ${selectedSlot.date} ${selectedSlot.time}`
      };

    } catch (error) {
      this.logger.error('❌ Failed to select free slot', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        message: 'Ошибка выбора слота',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Выбирает конкретный слот по дате и времени
   */
  async selectSpecificSlot(page: Page, date: string, time: string): Promise<CalendarSelectionResult> {
    try {
      this.logger.info('📅 Selecting specific slot', { date, time });

      const slots = await this.getAvailableSlots(page);
      const targetSlot = slots.find(slot => 
        slot.date.includes(date) && slot.time.includes(time) && slot.isFree
      );

      if (!targetSlot) {
        return {
          success: false,
          message: `Слот ${date} ${time} не найден или недоступен`
        };
      }

      // Кликаем по слоту
      await page.click(targetSlot.selector);
      
      // Ждем подтверждения выбора
      await page.waitForTimeout(2000);

      this.logger.info('✅ Specific slot selected', { 
        date: targetSlot.date, 
        time: targetSlot.time 
      });

      return {
        success: true,
        selectedSlot: targetSlot,
        message: `Выбран слот: ${targetSlot.date} ${targetSlot.time}`
      };

    } catch (error) {
      this.logger.error('❌ Failed to select specific slot', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        message: 'Ошибка выбора конкретного слота',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Подтверждает выбор слота
   */
  async confirmSlotSelection(page: Page): Promise<boolean> {
    try {
      this.logger.info('📅 Confirming slot selection');

      // Ищем кнопку подтверждения
      const confirmButton = await page.$('#Portal-CalendarPlanModal button[type="submit"], #Portal-CalendarPlanModal .confirm-button, #Portal-CalendarPlanModal .submit-button');
      
      if (confirmButton) {
        await confirmButton.click();
        await page.waitForTimeout(3000);
        
        this.logger.info('✅ Slot selection confirmed');
        return true;
      } else {
        this.logger.warn('⚠️ Confirm button not found');
        return false;
      }

    } catch (error) {
      this.logger.error('❌ Failed to confirm slot selection', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Закрывает модальное окно календаря
   */
  async closeCalendarModal(page: Page): Promise<boolean> {
    try {
      this.logger.info('📅 Closing calendar modal');

      // Ищем кнопку закрытия
      const closeButton = await page.$('#Portal-CalendarPlanModal .close-button, #Portal-CalendarPlanModal .modal-close, #Portal-CalendarPlanModal [aria-label="Close"]');
      
      if (closeButton) {
        await closeButton.click();
        await page.waitForTimeout(2000);
        
        this.logger.info('✅ Calendar modal closed');
        return true;
      } else {
        // Пробуем нажать Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(2000);
        
        this.logger.info('✅ Calendar modal closed with Escape');
        return true;
      }

    } catch (error) {
      this.logger.error('❌ Failed to close calendar modal', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Полный процесс выбора и подтверждения слота
   */
  async selectAndConfirmSlot(page: Page, preferredDate?: string, preferredTime?: string): Promise<CalendarSelectionResult> {
    try {
      let selectionResult: CalendarSelectionResult;

      if (preferredDate && preferredTime) {
        // Выбираем конкретный слот
        selectionResult = await this.selectSpecificSlot(page, preferredDate, preferredTime);
      } else {
        // Выбираем ближайший свободный слот
        selectionResult = await this.selectNearestFreeSlot(page);
      }

      if (!selectionResult.success) {
        return selectionResult;
      }

      // Подтверждаем выбор
      const confirmed = await this.confirmSlotSelection(page);
      if (!confirmed) {
        return {
          success: false,
          message: 'Не удалось подтвердить выбор слота'
        };
      }

      return {
        success: true,
        selectedSlot: selectionResult.selectedSlot,
        message: 'Слот выбран и подтвержден успешно'
      };

    } catch (error) {
      this.logger.error('❌ Failed to select and confirm slot', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        message: 'Ошибка выбора и подтверждения слота',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
