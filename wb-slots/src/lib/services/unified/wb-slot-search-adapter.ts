// ===== WB SLOT SEARCH ADAPTER =====
// Адаптер для интеграции UnifiedSlotSearchService с существующим WBSlotSearch интерфейсом

import { UnifiedSlotSearchService } from './slot-search-service';
import { UnifiedAutoBookingService } from './auto-booking-service';
import { SlotSearchConfig, SearchResult, FoundSlot } from '../core/interfaces';
import { prisma } from '../../prisma';
import { TelegramService } from '../telegram-service';

// Интерфейс для совместимости со старым WBSlotSearch
export interface LegacySlotSearchConfig {
  userId: string;
  taskId: string;
  runId?: string;
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  stopOnFirstFound: boolean;
  isSortingCenter: boolean;
  maxSearchCycles?: number;
  searchDelay?: number;
  maxExecutionTime?: number;
  autoBook?: boolean;
  autoBookSupplyId?: string;
  taskName?: string;
}

export interface LegacySearchResult {
  foundSlots: FoundSlot[];
  totalChecked: number;
  searchTime: number;
  errors: string[];
  stoppedEarly: boolean;
  runId: string;
}

// Singleton instance для TelegramService
let telegramServiceInstance: TelegramService | null = null;

function getTelegramService(): TelegramService {
  if (!telegramServiceInstance) {
    telegramServiceInstance = new TelegramService();
  }
  return telegramServiceInstance;
}

/**
 * Адаптер для интеграции UnifiedSlotSearchService с существующим кодом
 */
export class WBSlotSearchAdapter {
  private unifiedSlotSearchService: UnifiedSlotSearchService;
  private unifiedAutoBookingService: UnifiedAutoBookingService;
  private config: LegacySlotSearchConfig;
  private isSearching: boolean = false;

  constructor(config: LegacySlotSearchConfig) {
    this.config = config;
    this.unifiedSlotSearchService = new UnifiedSlotSearchService();
    this.unifiedAutoBookingService = new UnifiedAutoBookingService();
  }

  /**
   * Основной метод поиска слотов с совместимостью со старым интерфейсом
   */
  async searchSlots(): Promise<LegacySearchResult> {
    const startTime = Date.now();
    let runId: string | null = this.config.runId || null;

    try {
      // 1. Создаем Run запись для логирования (если не передан runId)
      if (!runId) {
        const run = await prisma.run.create({
          data: {
            taskId: this.config.taskId,
            userId: this.config.userId,
            status: 'RUNNING' as any,
            startedAt: new Date(),
          },
        });
        runId = run.id;
        console.log(`📝 Создана Run запись: ${runId}`);
      } else {
        console.log(`📝 Используем существующую Run запись: ${runId}`);
      }

      // 2. Инициализируем unified сервисы
      await this.unifiedSlotSearchService.initialize();
      await this.unifiedSlotSearchService.start();

      // 3. Создаем конфигурацию для UnifiedSlotSearchService
      const unifiedConfig: SlotSearchConfig = {
        taskId: this.config.taskId,
        userId: this.config.userId,
        runId: runId,
        warehouseIds: this.config.warehouseIds,
        boxTypeIds: this.config.boxTypeIds,
        coefficientMin: this.config.coefficientMin,
        coefficientMax: this.config.coefficientMax,
        dateFrom: this.config.dateFrom,
        dateTo: this.config.dateTo,
        stopOnFirstFound: this.config.stopOnFirstFound,
        isSortingCenter: this.config.isSortingCenter,
        maxSearchCycles: this.config.maxSearchCycles || 100,
        searchDelay: this.config.searchDelay || 10000,
        maxExecutionTime: this.config.maxExecutionTime || 3 * 24 * 60 * 60 * 1000,
        autoBook: this.config.autoBook || false,
        autoBookSupplyId: this.config.autoBookSupplyId
      };

      // 4. Выполняем поиск через UnifiedSlotSearchService
      console.log(`🔍 Начинаем поиск слотов для задачи ${this.config.taskId}`);
      const result = await this.unifiedSlotSearchService.searchSlots(unifiedConfig);

      // 5. Обрабатываем найденные слоты
      if (result.foundSlots.length > 0) {
        console.log(`✅ Найдено слотов: ${result.foundSlots.length}`);
        
        // Отправляем уведомления
        await this.sendSlotFoundNotifications(result.foundSlots);

        // Выполняем авто-бронирование если включено
        if (this.config.autoBook && this.config.autoBookSupplyId) {
          await this.performAutoBooking(result.foundSlots, runId);
        }
      } else {
        console.log('❌ Слоты не найдены');
      }

      // 6. Обновляем Run запись
      await this.updateRunRecord(runId, result, startTime);

      const searchTime = Date.now() - startTime;
      console.log(`⏱️ Поиск завершен за ${Math.round(searchTime / 1000)} секунд`);

      return {
        foundSlots: result.foundSlots,
        totalChecked: result.totalChecked,
        searchTime,
        errors: result.errors || [],
        stoppedEarly: result.stoppedEarly || false,
        runId
      };

    } catch (error) {
      const searchTime = Date.now() - startTime;
      console.error(`❌ Ошибка поиска слотов:`, error);

      // Обновляем Run запись с ошибкой
      if (runId) {
        await this.updateRunRecordWithError(runId, error, startTime);
      }

      return {
        foundSlots: [],
        totalChecked: 0,
        searchTime,
        errors: [error instanceof Error ? error.message : 'Неизвестная ошибка'],
        stoppedEarly: false,
        runId: runId || ''
      };
    } finally {
      // Останавливаем сервисы
      try {
        await this.unifiedSlotSearchService.stop();
      } catch (error) {
        console.warn('Ошибка при остановке UnifiedSlotSearchService:', error);
      }
    }
  }

  /**
   * Отправка уведомлений о найденных слотах
   */
  private async sendSlotFoundNotifications(foundSlots: FoundSlot[]): Promise<void> {
    try {
      for (const slot of foundSlots) {
        await getTelegramService().notifySlotFound(
          this.config.userId,
          this.config.taskId,
          this.config.taskName || 'Задача',
          slot
        );
      }
    } catch (error) {
      console.error('Ошибка отправки уведомлений:', error);
    }
  }

  /**
   * Выполнение авто-бронирования
   */
  private async performAutoBooking(foundSlots: FoundSlot[], runId: string): Promise<void> {
    try {
      console.log(`🎯 Начинаем авто-бронирование для ${foundSlots.length} слотов`);
      
      // Инициализируем сервис автобронирования
      await this.unifiedAutoBookingService.initialize();
      await this.unifiedAutoBookingService.start();

      for (const slot of foundSlots) {
        try {
          // Обновляем статус на BOOKING
          await this.updateTaskStatus('BOOKING', runId);
          
          // Отправляем уведомление о начале бронирования
          await getTelegramService().notifyBookingStarted(
            this.config.userId,
            this.config.taskId,
            this.config.taskName || 'Задача',
            this.config.autoBookSupplyId!,
            slot
          );

          // Создаем конфигурацию для бронирования
          const bookingConfig = {
            taskId: this.config.taskId,
            userId: this.config.userId,
            runId: runId,
            slotId: slot.id,
            supplyId: this.config.autoBookSupplyId!,
            warehouseId: slot.warehouseId,
            boxTypeId: slot.boxTypeId,
            date: slot.date,
            coefficient: slot.coefficient
          };

          // Выполняем бронирование
          const bookingResult = await this.unifiedAutoBookingService.bookSlot(bookingConfig);
          
          if (bookingResult.success) {
            console.log(`✅ Авто-бронирование завершено успешно: ${bookingResult.bookingId}`);
            
            // Отправляем уведомление о завершении бронирования
            await getTelegramService().notifyBookingCompleted(
              this.config.userId,
              this.config.taskId,
              this.config.taskName || 'Задача',
              this.config.autoBookSupplyId!,
              bookingResult.bookingId!,
              slot
            );

            // Обновляем статус на SUCCESS
            await this.updateTaskStatus('SUCCESS', runId);
            
            // Останавливаем поиск после успешного бронирования
            break;
          } else {
            console.error(`❌ Ошибка авто-бронирования: ${bookingResult.error}`);
            
            // Отправляем уведомление об ошибке бронирования
            await getTelegramService().notifyBookingFailed(
              this.config.userId,
              this.config.taskId,
              this.config.taskName || 'Задача',
              this.config.autoBookSupplyId!,
              bookingResult.error || 'Неизвестная ошибка',
              slot
            );
          }
        } catch (bookingError) {
          console.error(`❌ Исключение при авто-бронировании:`, bookingError);
          
          // Отправляем уведомление об ошибке бронирования
          await getTelegramService().notifyBookingFailed(
            this.config.userId,
            this.config.taskId,
            this.config.taskName || 'Задача',
            this.config.autoBookSupplyId!,
            bookingError instanceof Error ? bookingError.message : 'Неизвестная ошибка',
            slot
          );
        }
      }
    } catch (error) {
      console.error('Ошибка в процессе авто-бронирования:', error);
    } finally {
      // Останавливаем сервис автобронирования
      try {
        await this.unifiedAutoBookingService.stop();
      } catch (error) {
        console.warn('Ошибка при остановке UnifiedAutoBookingService:', error);
      }
    }
  }

  /**
   * Обновление статуса задачи
   */
  private async updateTaskStatus(status: string, runId: string): Promise<void> {
    try {
      await prisma.task.update({
        where: { id: this.config.taskId },
        data: { status: status as any }
      });
    } catch (error) {
      console.error('Ошибка обновления статуса задачи:', error);
    }
  }

  /**
   * Обновление Run записи с результатами
   */
  private async updateRunRecord(runId: string, result: any, startTime: number): Promise<void> {
    try {
      const searchTime = Date.now() - startTime;
      
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: result.foundSlots.length > 0 ? 'SUCCESS' : 'FAILED',
          finishedAt: new Date(),
          foundSlots: result.foundSlots.length,
          summary: {
            foundSlots: result.foundSlots.length,
            totalChecked: result.totalChecked,
            searchTime,
            stoppedEarly: result.stoppedEarly,
            errors: result.errors || []
          }
        }
      });
    } catch (error) {
      console.error('Ошибка обновления Run записи:', error);
    }
  }

  /**
   * Обновление Run записи с ошибкой
   */
  private async updateRunRecordWithError(runId: string, error: any, startTime: number): Promise<void> {
    try {
      const searchTime = Date.now() - startTime;
      
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          foundSlots: 0,
          summary: {
            foundSlots: 0,
            totalChecked: 0,
            searchTime,
            stoppedEarly: false,
            errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
          }
        }
      });
    } catch (updateError) {
      console.error('Ошибка обновления Run записи с ошибкой:', updateError);
    }
  }
}
