import { Logger } from './logger';
import { Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

export interface BookingLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  details?: any;
  screenshot?: string;
  step?: string;
}

export class BookingLogger {
  private logger: Logger;
  private logEntries: BookingLogEntry[] = [];
  private screenshotsDir: string;

  constructor(bookingId: string) {
    this.logger = new Logger(`BookingLogger-${bookingId}`);
    this.screenshotsDir = path.join(process.cwd(), 'logs', 'screenshots', bookingId);
    this.ensureScreenshotsDir();
  }

  private async ensureScreenshotsDir(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Ошибка создания директории для скриншотов:', error);
    }
  }

  /**
   * Логирование с автоматическим скриншотом при ошибках
   */
  async logWithScreenshot(
    level: BookingLogEntry['level'],
    message: string,
    page: Page,
    details?: any,
    step?: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    let screenshotPath: string | undefined;

    // Делаем скриншот при ошибках или важных шагах
    if (level === 'ERROR' || level === 'WARN' || step) {
      try {
        screenshotPath = await this.takeScreenshot(page, step || level);
      } catch (error) {
        this.logger.error('Ошибка создания скриншота:', error);
      }
    }

    const logEntry: BookingLogEntry = {
      timestamp,
      level,
      message,
      details,
      screenshot: screenshotPath,
      step,
    };

    this.logEntries.push(logEntry);

    // Логируем в консоль
    switch (level) {
      case 'ERROR':
        this.logger.error(message, { details, step, screenshot: screenshotPath });
        break;
      case 'WARN':
        this.logger.warn(message, { details, step, screenshot: screenshotPath });
        break;
      case 'DEBUG':
        this.logger.debug(message, { details, step, screenshot: screenshotPath });
        break;
      default:
        this.logger.info(message, { details, step, screenshot: screenshotPath });
    }
  }

  /**
   * Создание скриншота страницы
   */
  private async takeScreenshot(page: Page, step: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${step}-${timestamp}.png`;
      const filepath = path.join(this.screenshotsDir, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true,
        type: 'png',
      });

      this.logger.info(`📸 Скриншот сохранен: ${filepath}`);
      return filepath;
    } catch (error) {
      this.logger.error('Ошибка создания скриншота:', error);
      throw error;
    }
  }

  /**
   * Логирование начала бронирования
   */
  async logBookingStart(page: Page, params: any): Promise<void> {
    await this.logWithScreenshot(
      'INFO',
      '🚀 Начинаем процесс автобронирования',
      page,
      { params },
      'booking-start'
    );
  }

  /**
   * Логирование успешного бронирования
   */
  async logBookingSuccess(page: Page, bookingId: string, details: any): Promise<void> {
    await this.logWithScreenshot(
      'INFO',
      '✅ Бронирование успешно завершено',
      page,
      { bookingId, details },
      'booking-success'
    );
  }

  /**
   * Логирование ошибки бронирования
   */
  async logBookingError(page: Page, error: Error, step?: string): Promise<void> {
    await this.logWithScreenshot(
      'ERROR',
      `❌ Ошибка бронирования: ${error.message}`,
      page,
      { 
        error: error.message,
        stack: error.stack,
        step,
      },
      step || 'booking-error'
    );
  }

  /**
   * Логирование навигации
   */
  async logNavigation(page: Page, url: string, step: string): Promise<void> {
    await this.logWithScreenshot(
      'INFO',
      `🧭 Переход на страницу: ${url}`,
      page,
      { url },
      step
    );
  }

  /**
   * Логирование поиска элементов
   */
  async logElementSearch(page: Page, selector: string, found: boolean, step: string): Promise<void> {
    await this.logWithScreenshot(
      found ? 'INFO' : 'WARN',
      `🔍 Поиск элемента: ${selector} - ${found ? 'найден' : 'не найден'}`,
      page,
      { selector, found },
      step
    );
  }

  /**
   * Логирование клика по элементу
   */
  async logElementClick(page: Page, selector: string, step: string): Promise<void> {
    await this.logWithScreenshot(
      'INFO',
      `👆 Клик по элементу: ${selector}`,
      page,
      { selector },
      step
    );
  }

  /**
   * Логирование заполнения формы
   */
  async logFormFill(page: Page, field: string, value: string, step: string): Promise<void> {
    await this.logWithScreenshot(
      'INFO',
      `📝 Заполнение поля: ${field}`,
      page,
      { field, value: value.substring(0, 10) + '...' }, // Маскируем значение
      step
    );
  }

  /**
   * Логирование ожидания
   */
  async logWaiting(page: Page, reason: string, duration: number, step: string): Promise<void> {
    await this.logWithScreenshot(
      'INFO',
      `⏳ Ожидание: ${reason} (${duration}ms)`,
      page,
      { reason, duration },
      step
    );
  }

  /**
   * Получение всех логов
   */
  getLogs(): BookingLogEntry[] {
    return [...this.logEntries];
  }

  /**
   * Сохранение логов в файл
   */
  async saveLogsToFile(): Promise<string> {
    try {
      const logsDir = path.join(process.cwd(), 'logs', 'bookings');
      await fs.mkdir(logsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `booking-logs-${timestamp}.json`;
      const filepath = path.join(logsDir, filename);

      const logData = {
        timestamp: new Date().toISOString(),
        entries: this.logEntries,
        summary: {
          total: this.logEntries.length,
          errors: this.logEntries.filter(e => e.level === 'ERROR').length,
          warnings: this.logEntries.filter(e => e.level === 'WARN').length,
          screenshots: this.logEntries.filter(e => e.screenshot).length,
        },
      };

      await fs.writeFile(filepath, JSON.stringify(logData, null, 2));
      this.logger.info(`📄 Логи сохранены в файл: ${filepath}`);
      
      return filepath;
    } catch (error) {
      this.logger.error('Ошибка сохранения логов:', error);
      throw error;
    }
  }

  /**
   * Очистка старых логов и скриншотов
   */
  async cleanup(daysToKeep: number = 7): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Очистка старых скриншотов
      const screenshotsDir = path.join(process.cwd(), 'logs', 'screenshots');
      const entries = await fs.readdir(screenshotsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(screenshotsDir, entry.name);
          const stats = await fs.stat(dirPath);
          
          if (stats.mtime < cutoffDate) {
            await fs.rm(dirPath, { recursive: true, force: true });
            this.logger.info(`🗑️ Удалена старая директория скриншотов: ${entry.name}`);
          }
        }
      }

      // Очистка старых логов
      const logsDir = path.join(process.cwd(), 'logs', 'bookings');
      const logFiles = await fs.readdir(logsDir);
      
      for (const file of logFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            this.logger.info(`🗑️ Удален старый лог: ${file}`);
          }
        }
      }

    } catch (error) {
      this.logger.error('Ошибка очистки логов:', error);
    }
  }
}
