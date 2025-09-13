import { PrismaClient } from '@prisma/client';
import { decrypt } from '@/lib/encryption';
import { WBClientFactory } from '@/lib/wb-client';
import { AutoBookingService } from './auto-booking-service';
import { TelegramService } from '@/lib/telegram-service';

const prisma = new PrismaClient();

export interface ContinuousSearchConfig {
  taskId: string;
  userId: string;
  runId: string;
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  isSortingCenter?: boolean;
  maxSearchCycles?: number;
  searchDelay?: number;
  maxExecutionTime?: number;
  autoBook?: boolean;
  autoBookSupplyId?: string;
}

export interface FoundSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  available: boolean;
  boxTypes: number[];
  supplyId?: string;
}

export interface ContinuousSearchResult {
  success: boolean;
  foundSlots: FoundSlot[];
  totalSearches: number;
  searchTime: number;
  stoppedEarly: boolean;
  error?: string;
  runId: string;
  taskId?: string;
}

export class ContinuousSlotSearchService {
  private isSearching = false;
  private stopRequested = false;
  private currentSearchId: string | null = null;

  /**
   * Запустить непрерывный поиск слотов
   */
  async startContinuousSearch(config: ContinuousSearchConfig): Promise<ContinuousSearchResult> {
    if (this.isSearching) {
      throw new Error('Search is already in progress');
    }

    this.isSearching = true;
    this.stopRequested = false;
    this.currentSearchId = config.taskId;

    const startTime = Date.now();
    let totalSearches = 0;
    const foundSlots: FoundSlot[] = [];

    try {
      // Получаем информацию о задаче
      const task = await prisma.task.findUnique({
        where: { id: config.taskId },
        include: { user: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Получаем токен пользователя
      const suppliesToken = await prisma.userToken.findFirst({
        where: {
          userId: config.userId,
          category: 'SUPPLIES',
          isActive: true,
        },
      });

      if (!suppliesToken) {
        // Диагностика: проверяем, есть ли токены у пользователя вообще
        const userTokens = await prisma.userToken.findMany({
          where: { userId: config.userId },
          select: { category: true, isActive: true }
        });
        
        console.error(`No active supplies token found for user ${config.userId}`);
        console.error(`User has ${userTokens.length} tokens:`, userTokens);
        
        throw new Error(`No active supplies token found. User has ${userTokens.length} tokens. Please add a SUPPLIES token in settings.`);
      }

      // Расшифровываем токен
      const decryptedToken = decrypt(suppliesToken.tokenEncrypted);

      // Создаем WB клиент
      const wbClient = WBClientFactory.createSuppliesClient(decryptedToken);

      // Обновляем статус задачи на RUNNING (если поле существует)
      try {
        await prisma.task.update({
          where: { id: config.taskId },
          data: { status: 'RUNNING' } as any,
        });
      } catch (error) {
        console.log('Status field not available in Task model');
      }

      // Обновляем статус run на RUNNING
      await prisma.run.update({
        where: { id: config.runId },
        data: { status: 'RUNNING' },
      });

      // Логируем начало поиска
      await this.logRunMessage(config.runId, 'INFO', `Starting continuous slot search for task ${task.id}`, {
        taskId: config.taskId,
        config: {
          warehouseIds: config.warehouseIds,
          boxTypeIds: config.boxTypeIds,
          coefficientRange: `${config.coefficientMin}-${config.coefficientMax}`,
          dateRange: `${config.dateFrom} to ${config.dateTo}`,
          autoBook: config.autoBook,
        },
      });

      const maxCycles = config.maxSearchCycles || 1000; // По умолчанию 1000 циклов
      const searchDelay = config.searchDelay || 30000; // 30 секунд между поисками
      const maxExecutionTime = config.maxExecutionTime || 7 * 24 * 60 * 60 * 1000; // 7 дней

      // Основной цикл поиска
      for (let cycle = 1; cycle <= maxCycles; cycle++) {
        // Проверяем, не запрошена ли остановка
        if (this.stopRequested) {
          await this.logRunMessage(config.runId, 'INFO', 'Search stopped by user request', { cycle });
          break;
        }

        // Проверяем максимальное время выполнения
        if (Date.now() - startTime > maxExecutionTime) {
          await this.logRunMessage(config.runId, 'WARN', 'Search stopped due to max execution time', { 
            cycle, 
            executionTime: Date.now() - startTime 
          });
          break;
        }

        try {
          totalSearches++;

          await this.logRunMessage(config.runId, 'INFO', `Search cycle ${cycle}/${maxCycles}`, {
            cycle,
            maxCycles,
            searchDelay,
            foundSlotsCount: foundSlots.length,
          });

          // Выполняем поиск слотов
          const searchResult = await wbClient.searchAvailableSlots(
            config.warehouseIds,
            config.boxTypeIds,
            config.dateFrom,
            config.dateTo,
            config.coefficientMin,
            true // allowUnload
          );

          // Фильтруем найденные слоты по максимальному коэффициенту
          const validSlots = searchResult.filter((slot: any) => {
            const coefficient = slot.coefficient || 0;
            return coefficient <= config.coefficientMax;
          });

          if (validSlots.length > 0) {
            await this.logRunMessage(config.runId, 'INFO', `Found ${validSlots.length} valid slots in cycle ${cycle}`, {
              cycle,
              slots: validSlots.map(slot => ({
                warehouseId: slot.warehouseID,
                date: slot.date,
                coefficient: slot.coefficient,
                boxTypeId: slot.boxTypeID,
                warehouseName: slot.warehouseName,
              })),
            });

            // Добавляем найденные слоты
            for (const slot of validSlots) {
              const foundSlot: FoundSlot = {
                warehouseId: slot.warehouseID,
                warehouseName: slot.warehouseName || `Склад ${slot.warehouseID}`,
                date: slot.date,
                timeSlot: '09:00-18:00', // WB API не предоставляет временные слоты
                coefficient: slot.coefficient || 0,
                available: true,
                boxTypes: [slot.boxTypeID],
                supplyId: undefined, // Не предоставляется API
              };

              foundSlots.push(foundSlot);

              // Сохраняем слот в базу данных
              try {
                await prisma.foundSlot.create({
                  data: {
                    runId: config.runId,
                    userId: config.userId,
                    warehouseId: slot.warehouseID,
                    warehouseName: slot.warehouseName || `Склад ${slot.warehouseID}`,
                    date: slot.date,
                    timeSlot: '09:00-18:00',
                    coefficient: slot.coefficient || 0,
                    available: true,
                    boxTypes: [slot.boxTypeID],
                    supplyId: undefined,
                  },
                });
              } catch (dbError) {
                console.error('Error saving found slot to database:', dbError);
              }

              // Если включено автобронирование, запускаем его
              if (config.autoBook && config.autoBookSupplyId) {
                try {
                  await this.logRunMessage(config.runId, 'INFO', `Starting auto-booking for slot`, {
                    slot: foundSlot,
                    supplyId: config.autoBookSupplyId,
                  });

                  const autoBookingService = new AutoBookingService();
                  const bookingResult = await autoBookingService.startBooking({
                    taskId: config.taskId,
                    userId: config.userId,
                    runId: config.runId,
                    slotId: `${slot.warehouseID}-${slot.date}-${slot.boxTypeID}`,
                    supplyId: config.autoBookSupplyId,
                    warehouseId: slot.warehouseID,
                    boxTypeId: slot.boxTypeID,
                    date: slot.date,
                    coefficient: slot.coefficient || 1.0,
                  });

                  if (bookingResult.success) {
                    await this.logRunMessage(config.runId, 'INFO', 'Auto-booking successful', {
                      bookingId: bookingResult.bookingId,
                      slot: foundSlot,
                    });

                    // Отправляем уведомление о успешном автобронировании
                    try {
                      const telegramService = new TelegramService();
                      await telegramService.notifyBookingSuccess(
                        config.userId,
                        config.taskId,
                        task.name || 'Задача поиска слотов',
                        foundSlot,
                        bookingResult.bookingId!
                      );
                      await this.logRunMessage(config.runId, 'INFO', 'Booking success notification sent', {
                        bookingId: bookingResult.bookingId,
                      });
                    } catch (telegramError) {
                      await this.logRunMessage(config.runId, 'ERROR', 'Failed to send booking success notification', {
                        error: telegramError instanceof Error ? telegramError.message : 'Unknown error',
                      });
                    }

                    // Обновляем статус задачи на BOOKING (если поле существует)
                    try {
        await prisma.task.update({
          where: { id: config.taskId },
          data: { status: 'BOOKING' } as any,
        });
                    } catch (error) {
                      console.log('Status field not available in Task model');
                    }
                  } else {
                    await this.logRunMessage(config.runId, 'ERROR', 'Auto-booking failed', {
                      error: bookingResult.error,
                      slot: foundSlot,
                    });

                    // Отправляем уведомление об ошибке автобронирования
                    try {
                      const telegramService = new TelegramService();
                      await telegramService.notifyBookingError(
                        config.userId,
                        config.taskId,
                        task.name || 'Задача поиска слотов',
                        foundSlot,
                        bookingResult.error || 'Unknown error'
                      );
                    } catch (telegramError) {
                      await this.logRunMessage(config.runId, 'ERROR', 'Failed to send booking error notification', {
                        error: telegramError instanceof Error ? telegramError.message : 'Unknown error',
                      });
                    }
                  }
                } catch (bookingError) {
                  await this.logRunMessage(config.runId, 'ERROR', 'Auto-booking error', {
                    error: bookingError instanceof Error ? bookingError.message : 'Unknown error',
                    slot: foundSlot,
                  });
                }
              }
            }

            // Если нашли слоты и не требуется автобронирование, отправляем уведомление и останавливаем поиск
            if (!config.autoBook) {
              await this.logRunMessage(config.runId, 'INFO', 'Found slots, stopping search', {
                foundSlotsCount: foundSlots.length,
                cycle,
              });

              // Отправляем уведомление в Telegram о найденных слотах
              try {
                const telegramService = new TelegramService();
                await telegramService.notifySlotsFound(
                  config.userId,
                  config.taskId,
                  task.name || 'Задача поиска слотов',
                  foundSlots
                );
                await this.logRunMessage(config.runId, 'INFO', 'Telegram notification sent', {
                  foundSlotsCount: foundSlots.length,
                });
              } catch (telegramError) {
                await this.logRunMessage(config.runId, 'ERROR', 'Failed to send Telegram notification', {
                  error: telegramError instanceof Error ? telegramError.message : 'Unknown error',
                });
              }

              break;
            }
          } else {
            await this.logRunMessage(config.runId, 'DEBUG', `No valid slots found in cycle ${cycle}`, {
              cycle,
              totalSearches,
            });
          }

          // Ждем перед следующим циклом поиска
          if (cycle < maxCycles && !this.stopRequested) {
            await this.logRunMessage(config.runId, 'DEBUG', `Waiting ${searchDelay}ms before next search`, {
              cycle,
              nextCycle: cycle + 1,
            });
            await new Promise(resolve => setTimeout(resolve, searchDelay));
          }

        } catch (searchError) {
          await this.logRunMessage(config.runId, 'ERROR', `Search error in cycle ${cycle}`, {
            cycle,
            error: searchError instanceof Error ? searchError.message : 'Unknown error',
          });

          // Продолжаем поиск даже при ошибках
          if (cycle < maxCycles && !this.stopRequested) {
            await new Promise(resolve => setTimeout(resolve, searchDelay));
          }
        }
      }

      // Обновляем статус задачи (если поле существует)
      const finalStatus = foundSlots.length > 0 ? 'SUCCESS' : 'FAILED';
      try {
        await prisma.task.update({
          where: { id: config.taskId },
          data: { 
            status: finalStatus,
            enabled: foundSlots.length > 0 ? false : true, // Закрываем задачу если найдены слоты
          } as any,
        });
        
        if (foundSlots.length > 0) {
          await this.logRunMessage(config.runId, 'INFO', 'Task completed and closed automatically', {
            foundSlotsCount: foundSlots.length,
            taskId: config.taskId,
          });
        }
      } catch (error) {
        console.log('Status field not available in Task model');
      }

      // Обновляем статус run
      await prisma.run.update({
        where: { id: config.runId },
        data: { 
          status: finalStatus,
          finishedAt: new Date(),
          foundSlots: foundSlots.length,
          summary: {
            foundSlots: foundSlots.length,
            totalSearches,
            searchTime: Date.now() - startTime,
            stoppedEarly: this.stopRequested,
          },
        },
      });

      await this.logRunMessage(config.runId, 'INFO', 'Continuous search completed', {
        foundSlotsCount: foundSlots.length,
        totalSearches,
        searchTime: Date.now() - startTime,
        finalStatus,
        taskId: task.id,
      });

      return {
        success: true,
        foundSlots,
        totalSearches,
        searchTime: Date.now() - startTime,
        stoppedEarly: this.stopRequested,
        runId: config.runId,
        taskId: task.id,
      };

    } catch (error) {
      // Обновляем статус на FAILED при ошибке (если поле существует)
      try {
        await prisma.task.update({
          where: { id: config.taskId },
          data: { status: 'FAILED' } as any,
        });
      } catch (error) {
        console.log('Status field not available in Task model');
      }

      await prisma.run.update({
        where: { id: config.runId },
        data: { 
          status: 'FAILED',
          finishedAt: new Date(),
          summary: {
            error: error instanceof Error ? error.message : 'Unknown error',
            totalSearches,
            searchTime: Date.now() - startTime,
          },
        },
      });

      await this.logRunMessage(config.runId, 'ERROR', 'Continuous search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalSearches,
        searchTime: Date.now() - startTime,
      });

      return {
        success: false,
        foundSlots: [],
        totalSearches,
        searchTime: Date.now() - startTime,
        stoppedEarly: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        runId: config.runId,
      };

    } finally {
      this.isSearching = false;
      this.currentSearchId = null;
    }
  }

  /**
   * Остановить поиск
   */
  async stopSearch(): Promise<void> {
    if (this.isSearching) {
      this.stopRequested = true;
      await this.logRunMessage(this.currentSearchId || '', 'INFO', 'Stop requested for continuous search');
    }
  }

  /**
   * Проверить, выполняется ли поиск
   */
  isSearchInProgress(): boolean {
    return this.isSearching;
  }

  /**
   * Получить ID текущего поиска
   */
  getCurrentSearchId(): string | null {
    return this.currentSearchId;
  }

  /**
   * Логирование сообщений в run
   */
  private async logRunMessage(runId: string, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any): Promise<void> {
    try {
      await prisma.runLog.create({
        data: {
          runId,
          level,
          message,
          meta: meta || {},
        },
      });
    } catch (error) {
      console.error('Failed to log run message:', error);
    }
  }
}

// Экспортируем singleton
export const continuousSlotSearchService = new ContinuousSlotSearchService();
