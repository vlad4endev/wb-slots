import { Page } from 'playwright';
import { Logger } from '../logging/logger';
import { WB_SELECTORS, getSupplyRowSelector } from '../utils/wb-auth-selectors';

/**
 * Сервис для работы с поставками WB
 */

export interface SupplyInfo {
  id: string;
  name: string;
  status: string;
  date: string;
  canPlan: boolean;
}

export interface SupplySelectionResult {
  success: boolean;
  selectedSupply?: SupplyInfo;
  message: string;
  error?: string;
}

export class WBSuppliesService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Получает список поставок
   */
  async getSuppliesList(page: Page): Promise<SupplyInfo[]> {
    try {
      this.logger.info('📦 Getting supplies list');

      // Ждем загрузки таблицы поставок
      await page.waitForSelector(WB_SELECTORS.SUPPLIES.TABLE, { timeout: 30000 });

      // Получаем данные о поставках
      const supplies = await page.evaluate(() => {
        const table = document.querySelector('.All-supplies-inner__table__nJF8PMIHkQ table tbody');
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll('tr'));
        const suppliesList: SupplyInfo[] = [];

        rows.forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const id = cells[0]?.textContent?.trim() || `supply-${index}`;
            const name = cells[1]?.textContent?.trim() || 'Неизвестная поставка';
            const status = cells[2]?.textContent?.trim() || 'Неизвестный статус';
            const date = cells[3]?.textContent?.trim() || 'Неизвестная дата';

            suppliesList.push({
              id,
              name,
              status,
              date,
              canPlan: status.toLowerCase().includes('готов') || status.toLowerCase().includes('подтвержден')
            });
          }
        });

        return suppliesList;
      });

      this.logger.info('✅ Supplies list retrieved', { count: supplies.length });
      return supplies;

    } catch (error) {
      this.logger.error('❌ Failed to get supplies list', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  /**
   * Выбирает поставку по индексу
   */
  async selectSupply(page: Page, supplyIndex: number): Promise<SupplySelectionResult> {
    try {
      this.logger.info('📦 Selecting supply', { index: supplyIndex });

      // Получаем селектор для строки поставки
      const rowSelector = getSupplyRowSelector(supplyIndex);
      
      // Ждем появления строки
      await page.waitForSelector(rowSelector, { timeout: 10000 });

      // Кликаем по строке поставки
      await page.click(rowSelector);

      // Ждем загрузки детальной страницы поставки
      await page.waitForTimeout(3000);

      // Проверяем, что мы на странице деталей поставки
      const currentUrl = page.url();
      if (currentUrl.includes('/supply/') || currentUrl.includes('/supplies/')) {
        this.logger.info('✅ Supply selected successfully');
        return {
          success: true,
          message: 'Поставка выбрана успешно'
        };
      } else {
        throw new Error('Не удалось перейти на страницу поставки');
      }

    } catch (error) {
      this.logger.error('❌ Failed to select supply', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        message: 'Ошибка выбора поставки',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Нажимает кнопку "Запланировать поставку"
   */
  async clickPlanButton(page: Page): Promise<boolean> {
    try {
      this.logger.info('📅 Clicking plan button');

      // Ждем появления кнопки
      await page.waitForSelector(WB_SELECTORS.SUPPLIES.PLAN_BUTTON, { timeout: 10000 });

      // Кликаем по кнопке
      await page.click(WB_SELECTORS.SUPPLIES.PLAN_BUTTON);

      // Ждем появления модального окна календаря
      await page.waitForSelector(WB_SELECTORS.CALENDAR.MODAL, { timeout: 10000 });

      this.logger.info('✅ Plan button clicked successfully');
      return true;

    } catch (error) {
      this.logger.error('❌ Failed to click plan button', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Проверяет, доступна ли кнопка планирования
   */
  async isPlanButtonAvailable(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector(WB_SELECTORS.SUPPLIES.PLAN_BUTTON, { timeout: 5000 });
      const isEnabled = await page.isEnabled(WB_SELECTORS.SUPPLIES.PLAN_BUTTON);
      return isEnabled;
    } catch {
      return false;
    }
  }

  /**
   * Находит первую доступную для планирования поставку
   */
  async findAvailableSupply(page: Page): Promise<SupplyInfo | null> {
    try {
      const supplies = await this.getSuppliesList(page);
      
      // Ищем первую поставку, которую можно планировать
      const availableSupply = supplies.find(supply => supply.canPlan);
      
      if (availableSupply) {
        this.logger.info('✅ Found available supply', { supplyId: availableSupply.id });
        return availableSupply;
      } else {
        this.logger.warn('⚠️ No available supplies found');
        return null;
      }

    } catch (error) {
      this.logger.error('❌ Failed to find available supply', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Выбирает первую доступную поставку и нажимает кнопку планирования
   */
  async selectAndPlanFirstAvailableSupply(page: Page): Promise<SupplySelectionResult> {
    try {
      // Находим доступную поставку
      const availableSupply = await this.findAvailableSupply(page);
      if (!availableSupply) {
        return {
          success: false,
          message: 'Нет доступных поставок для планирования'
        };
      }

      // Выбираем поставку (предполагаем, что она первая в списке)
      const selectResult = await this.selectSupply(page, 1);
      if (!selectResult.success) {
        return selectResult;
      }

      // Проверяем доступность кнопки планирования
      const isButtonAvailable = await this.isPlanButtonAvailable(page);
      if (!isButtonAvailable) {
        return {
          success: false,
          message: 'Кнопка планирования недоступна'
        };
      }

      // Нажимаем кнопку планирования
      const buttonClicked = await this.clickPlanButton(page);
      if (!buttonClicked) {
        return {
          success: false,
          message: 'Не удалось нажать кнопку планирования'
        };
      }

      return {
        success: true,
        selectedSupply: availableSupply,
        message: 'Поставка выбрана и кнопка планирования нажата'
      };

    } catch (error) {
      this.logger.error('❌ Failed to select and plan supply', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        message: 'Ошибка выбора и планирования поставки',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
