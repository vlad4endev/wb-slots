import { TaskRunRepository } from './task-run-repository';
import { TokenRepository } from './token-repository';
import { SlotSearchExecutor } from './slot-search-executor';
import { SearchStateManager } from './search-state-manager';
import { NotificationRepository } from './notification-repository';
import type { ContinuousSearchConfig, ContinuousSearchResult } from '../continuous-slot-search-service';
import type { FoundSlot } from './slot-search-executor';
import { logger } from '@/lib/logging';
import { WBClientError } from '@/lib/wb-client/types';
import { AutoBookingService } from '@/lib/services/auto-booking-service';

/**
 * Оркестратор непрерывного поиска слотов
 * Координирует работу всех компонентов для выполнения непрерывного поиска
 */
export class ContinuousSlotSearchOrchestrator {
  constructor(
    private taskRunRepository: TaskRunRepository,
    private tokenRepository: TokenRepository,
    private slotSearchExecutor: SlotSearchExecutor,
    private searchStateManager: SearchStateManager,
    private notificationRepository: NotificationRepository,
    private autoBookingService: AutoBookingService = new AutoBookingService()
  ) {}

  /**
   * Выполнить непрерывный поиск слотов с новой логикой остановки
   */
  async executeSearch(
    config: ContinuousSearchConfig
  ): Promise<ContinuousSearchResult> {
    const startTime = Date.now();
    let totalSearches = 0;
    const foundSlots: FoundSlot[] = [];

    try {
      // 1. Проверка задачи и получение данных
      const task = await this.taskRunRepository.getTaskWithUser(config.taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // 2. Получение токена и создание клиента
      const wbClient = await this.tokenRepository.getSuppliesClient(
        config.userId
      );

      // 3. Обновление статусов
      await this.taskRunRepository.updateTaskStatus(config.taskId, 'RUNNING');
      await this.taskRunRepository.updateRunStatus(config.runId, 'RUNNING');

      await this.taskRunRepository.createRunLog(
        config.runId,
        'INFO',
        `Starting continuous slot search for task ${task.id}`,
        { taskId: config.taskId }
      );

      // 4. Параметры поиска
      const maxCycles = config.maxSearchCycles ?? 1000;
      const searchDelay = config.searchDelay ?? 30000;
      const maxExecutionTime = config.maxExecutionTime ?? 7 * 24 * 60 * 60 * 1000;
      const minSlotsRequired = config.minSlotsRequired ?? 1;

      // 5. Основной цикл поиска
      for (let cycle = 1; cycle <= maxCycles; cycle++) {
        // Проверка остановки
        if (this.searchStateManager.isStopRequested()) {
          await this.taskRunRepository.createRunLog(
            config.runId,
            'INFO',
            `Search stopped by request at cycle ${cycle}`
          );
          break;
        }

        // Проверка таймаута
        if (Date.now() - startTime > maxExecutionTime) {
          this.searchStateManager.stopSearch('timeout', 'Max execution time exceeded');
          await this.taskRunRepository.createRunLog(
            config.runId,
            'WARN',
            `Search stopped: max execution time (${maxExecutionTime}ms) exceeded`
          );
          break;
        }

        try {
          totalSearches++;

          // Выполнение поиска с проверкой условий
          const searchResult = await this.slotSearchExecutor.searchSlotsWithConditions(
            wbClient,
            {
              warehouseIds: config.warehouseIds,
              boxTypeIds: config.boxTypeIds,
              dateFrom: config.dateFrom,
              dateTo: config.dateTo,
              coefficientMin: config.coefficientMin,
              coefficientMax: config.coefficientMax,
            }
          );

          // Логируем результаты поиска
          await this.taskRunRepository.createRunLog(
            config.runId,
            'DEBUG',
            `Cycle ${cycle}: Found ${searchResult.allSlots.length} total slots, ${searchResult.matchingSlots.length} matching`,
            {
              hasSuitableCoefficients: searchResult.hasSuitableCoefficients,
              hasSuitableWarehouses: searchResult.hasSuitableWarehouses,
              shouldContinue: searchResult.shouldContinueSearch,
            }
          );

          // Сохраняем ВСЕ найденные подходящие слоты
          if (searchResult.matchingSlots.length > 0) {
            for (const slot of searchResult.matchingSlots) {
              foundSlots.push(slot);

              await this.taskRunRepository.createFoundSlot({
                runId: config.runId,
                userId: config.userId,
                warehouseId: slot.warehouseId,
                warehouseName: slot.warehouseName,
                date: slot.date,
                timeSlot: slot.timeSlot,
                coefficient: slot.coefficient,
                available: slot.available,
                boxTypes: slot.boxTypes,
              });
            }

            await this.taskRunRepository.createRunLog(
              config.runId,
              'INFO',
              `Found ${searchResult.matchingSlots.length} matching slots in cycle ${cycle}. Total: ${foundSlots.length}`
            );

            // 📧 ОТПРАВКА УВЕДОМЛЕНИЯ О НАЙДЕННЫХ СЛОТАХ
            await this.notificationRepository.sendSlotsFoundNotification(
              config.userId,
              config.taskId,
              searchResult.matchingSlots.map(slot => ({
                warehouseName: slot.warehouseName,
                date: slot.date,
                timeSlot: slot.timeSlot,
                coefficient: slot.coefficient,
                boxTypes: slot.boxTypes,
              }))
            );

            if (config.autoBook && config.autoBookSupplyId) {
              await this.handleAutoBooking(config, searchResult.matchingSlots, config.runId);
            }
          }


          // 🔁 НОВАЯ ЛОГИКА ОСТАНОВКИ:
          // Останавливаем, если найдены слоты, соответствующие ОБОИМ критериям
          if (!searchResult.shouldContinueSearch) {
            // Найдены либо подходящие коэффициенты, либо подходящие склады (или оба)
            if (foundSlots.length >= minSlotsRequired) {
              this.searchStateManager.stopSearch('completed', 'Found enough matching slots');
              await this.taskRunRepository.createRunLog(
                config.runId,
                'INFO',
                `✅ Search completed successfully: found ${foundSlots.length} slots meeting all criteria`
              );
              break;
            }
          }

          // Продолжаем поиск, если НЕТ подходящих коэффициентов И НЕТ подходящих складов
          if (searchResult.shouldContinueSearch) {
            await this.taskRunRepository.createRunLog(
              config.runId,
              'DEBUG',
              `Continuing search: no suitable coefficients AND no suitable warehouses found`
            );
          }

          // Задержка между циклами (если не последний цикл)
          if (
            cycle < maxCycles &&
            !this.searchStateManager.isStopRequested()
          ) {
            await new Promise((resolve) => setTimeout(resolve, searchDelay));
          }
        } catch (searchError) {
          // 🚫 ОБРАБОТКА ОШИБОК WB API
          if (searchError instanceof WBClientError) {
            const statusCode = searchError.statusCode;

            // Критические ошибки - останавливаем поиск
            if (statusCode === 401) {
              const errorMessage = '🔐 Токен Wildberries истёк или недействителен';
              const errorDetail = 'Пожалуйста, обновите токен SUPPLIES в настройках API';
              const tokenUrl = 'https://seller.wildberries.ru/supplier-settings/access-to-api';
              
              this.searchStateManager.stopSearch(
                'unauthorized',
                `${errorMessage}. ${errorDetail}`
              );
              
              // Обновляем статус задачи в БД
              await this.taskRunRepository.updateTaskStatus(
                config.taskId,
                'FAILED',
                false // Отключаем задачу
              );
              
              // Детальное сообщение в логах
              const detailedLog = 
                `❌ Поиск остановлен: ${errorMessage}\n\n` +
                `📋 Что делать:\n` +
                `1. Перейдите в настройки → Токены API\n` +
                `2. Обновите или добавьте новый токен категории SUPPLIES\n` +
                `3. Получить токен: ${tokenUrl}\n\n` +
                `⚠️ Детали ошибки:\n` +
                `   • HTTP статус: ${searchError.statusCode}\n` +
                `   • Код ошибки WB: ${searchError.code || 'N/A'}\n` +
                `   • Сообщение: ${searchError.message}\n\n` +
                `💡 После обновления токена создайте новую задачу или перезапустите текущую.`;
              
              await this.taskRunRepository.createRunLog(
                config.runId,
                'ERROR',
                detailedLog
              );
              
              // 📧 ОТПРАВКА УВЕДОМЛЕНИЯ ПОЛЬЗОВАТЕЛЮ
              try {
                await this.notificationRepository.sendTokenExpiredNotification(
                  config.userId,
                  config.taskId,
                  {
                    statusCode: searchError.statusCode,
                    message: errorMessage,
                    detail: `${errorDetail}. Получить новый токен: ${tokenUrl}`,
                  }
                );
              } catch (notificationError) {
                // Если не удалось отправить уведомление (нет настроенных каналов)
                logger.warn(
                  {
                    userId: config.userId,
                    taskId: config.taskId,
                    error: notificationError instanceof Error ? notificationError.message : 'Unknown',
                  },
                  'Не удалось отправить уведомление о истекшем токене'
                );
                
                // Добавляем запись в лог что пользователю нужно самому проверить
                await this.taskRunRepository.createRunLog(
                  config.runId,
                  'INFO',
                  `ℹ️ Система попыталась отправить уведомление, но каналы не настроены. Проверьте эту задачу вручную.`
                );
              }
              
              // Логируем для отладки
              logger.error('Token unauthorized error during slot search', {
                error: searchError.message,
                statusCode: searchError.statusCode,
                errorCode: searchError.code,
                userId: config.userId,
                taskId: config.taskId,
                runId: config.runId,
              });
              
              break;
            } else if (statusCode === 403) {
              this.searchStateManager.stopSearch(
                'forbidden',
                'WB API: Forbidden - access denied'
              );
              await this.taskRunRepository.createRunLog(
                config.runId,
                'ERROR',
                `❌ Search stopped: Forbidden (403) - access denied`
              );
              
              // 📧 ОТПРАВКА УВЕДОМЛЕНИЯ ПОЛЬЗОВАТЕЛЮ
              await this.notificationRepository.sendApiErrorNotification(
                config.userId,
                config.taskId,
                'forbidden',
                {
                  statusCode: searchError.statusCode,
                  message: searchError.message,
                  detail: searchError.details?.detail,
                }
              );
              
              break;
            } else if (statusCode >= 500) {
              this.searchStateManager.stopSearch(
                'server_error',
                `WB API: Server error (${statusCode})`
              );
              await this.taskRunRepository.createRunLog(
                config.runId,
                'ERROR',
                `❌ Search stopped: WB API server error (${statusCode})`
              );
              
              // 📧 ОТПРАВКА УВЕДОМЛЕНИЯ ПОЛЬЗОВАТЕЛЮ
              await this.notificationRepository.sendApiErrorNotification(
                config.userId,
                config.taskId,
                'server_error',
                {
                  statusCode: searchError.statusCode,
                  message: searchError.message,
                  detail: searchError.details?.detail,
                }
              );
              
              break;
            } else if (statusCode === 429) {
              // Rate limit - логируем и продолжаем после задержки
              await this.taskRunRepository.createRunLog(
                config.runId,
                'WARN',
                `Rate limit exceeded in cycle ${cycle}, waiting before retry...`
              );
              await new Promise((resolve) => setTimeout(resolve, 60000)); // Ждем 1 минуту
              continue;
            } else {
              // Остальные ошибки - логируем и продолжаем
              await this.taskRunRepository.createRunLog(
                config.runId,
                'WARN',
                `WB API error in cycle ${cycle} (${statusCode}): ${searchError.message}`
              );
            }
          } else {
            // Неизвестная ошибка - логируем и продолжаем
            await this.taskRunRepository.createRunLog(
              config.runId,
              'ERROR',
              `Unknown error in cycle ${cycle}: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`
            );
          }
        }
      }

      // 6. Обновление финальных статусов
      const stopReason = this.searchStateManager.getStopReason();
      const hasError = this.searchStateManager.hasError();
      
      let finalStatus: 'SUCCESS' | 'FAILED' | 'COMPLETED' = 'COMPLETED';
      if (hasError) {
        finalStatus = 'FAILED';
      } else if (foundSlots.length > 0) {
        finalStatus = 'SUCCESS';
      }

      await this.taskRunRepository.updateTaskStatus(
        config.taskId,
        finalStatus,
        hasError // enabled = false если ошибка
      );

      await this.taskRunRepository.updateRunStatus(
        config.runId,
        finalStatus,
        new Date(),
        foundSlots.length,
        {
          foundSlots: foundSlots.length,
          totalSearches,
          searchTime: Date.now() - startTime,
          stoppedEarly: this.searchStateManager.isStopRequested(),
          stopReason,
          errorMessage: this.searchStateManager.getErrorMessage(),
        }
      );

      await this.taskRunRepository.createRunLog(
        config.runId,
        hasError ? 'ERROR' : 'INFO',
        `Search finished with status ${finalStatus}. Found ${foundSlots.length} slots. Reason: ${stopReason || 'completed all cycles'}`
      );

      // 📧 ОТПРАВКА УВЕДОМЛЕНИЯ О ЗАВЕРШЕНИИ
      if (hasError) {
        // Отправляем уведомление о провале (если это не ошибки авторизации, для них уже отправлено)
        if (stopReason !== 'unauthorized' && stopReason !== 'forbidden') {
          await this.notificationRepository.sendTaskFailedNotification(
            config.userId,
            config.taskId,
            stopReason || 'unknown',
            this.searchStateManager.getErrorMessage() || undefined
          );
        }
      } else if (foundSlots.length > 0) {
        // Отправляем уведомление об успешном завершении
        await this.notificationRepository.sendSearchCompletedNotification(
          config.userId,
          config.taskId,
          {
            foundSlots: foundSlots.length,
            totalSearches,
            searchTime: Date.now() - startTime,
          }
        );
      }

      return {
        success: !hasError,
        foundSlots,
        totalSearches,
        searchTime: Date.now() - startTime,
        stoppedEarly: this.searchStateManager.isStopRequested(),
        runId: config.runId,
        taskId: config.taskId,
        error: hasError ? this.searchStateManager.getErrorMessage() || 'Unknown error' : undefined,
      };
    } catch (error) {
      // Обработка критических ошибок
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.searchStateManager.stopSearch('error', errorMessage);

      await this.taskRunRepository.createRunLog(
        config.runId,
        'ERROR',
        `❌ Critical error: ${errorMessage}`
      );

      await this.taskRunRepository.updateRunStatus(
        config.runId,
        'FAILED',
        new Date(),
        foundSlots.length,
        {
          error: errorMessage,
          foundSlots: foundSlots.length,
          totalSearches,
        }
      );

      await this.taskRunRepository.updateTaskStatus(
        config.taskId,
        'FAILED',
        false // enabled = false при критической ошибке
      );

      return {
        success: false,
        foundSlots,
        totalSearches,
        searchTime: Date.now() - startTime,
        stoppedEarly: true,
        error: errorMessage,
        runId: config.runId,
        taskId: config.taskId,
      };
    }
  }

  private async handleAutoBooking(
    config: ContinuousSearchConfig,
    slots: FoundSlot[],
    runId: string
  ): Promise<void> {
    const supplyId = config.autoBookSupplyId;

    if (!supplyId) {
      await this.taskRunRepository.createRunLog(
        runId,
        'WARN',
        'Auto-booking skipped: supplyId is empty'
      );
      return;
    }

    await this.taskRunRepository.createRunLog(
      runId,
      'INFO',
      `Auto-booking triggered for ${slots.length} slots`,
      {
        supplyId,
        autoBook: config.autoBook,
      }
    );

    for (const slot of slots) {
      const bookingConfig = {
        taskId: config.taskId,
        userId: config.userId,
        runId,
        slotId: `${slot.warehouseId}-${slot.date}`,
        supplyId,
        warehouseId: slot.warehouseId,
        boxTypeId: slot.boxTypes?.[0] ?? 2,
        date: slot.date,
        coefficient: slot.coefficient,
      };

      try {
        await this.taskRunRepository.createRunLog(
          runId,
          'INFO',
          'Starting auto-booking for slot',
          bookingConfig
        );

        const result = await this.autoBookingService.startBooking(bookingConfig);

        if (result.success) {
          await this.taskRunRepository.createRunLog(
            runId,
            'INFO',
            'Auto-booking succeeded',
            {
              ...bookingConfig,
              bookingId: result.bookingId,
            }
          );

          this.searchStateManager.stopSearch('auto_booking_success', 'Slot booked successfully');
          break;
        }

        await this.taskRunRepository.createRunLog(
          runId,
          'ERROR',
          'Auto-booking failed',
          {
            ...bookingConfig,
            error: result.error,
          }
        );
      } catch (error) {
        await this.taskRunRepository.createRunLog(
          runId,
          'ERROR',
          'Auto-booking threw exception',
          {
            ...bookingConfig,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
      }
    }

  }

}

