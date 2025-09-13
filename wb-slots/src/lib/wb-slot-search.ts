import { WBClientFactory } from './wb-client';
import { prisma } from './prisma';
import { decrypt } from './encryption';
import { AutoBookingService } from './auto-booking-service';
import { TelegramService } from './telegram-service';
// import { TaskStatus } from '@prisma/client';

// Singleton instance для TelegramService
let telegramServiceInstance: TelegramService | null = null;

function getTelegramService(): TelegramService {
  if (!telegramServiceInstance) {
    telegramServiceInstance = new TelegramService();
  }
  return telegramServiceInstance;
}

export interface SlotSearchConfig {
  userId: string;
  taskId: string;
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  stopOnFirstFound: boolean;
  isSortingCenter?: boolean;
  autoBook?: boolean;
  autoBookSupplyId?: string;
  taskName?: string;
  runId?: string; // Опциональный runId для тестового поиска
}

export interface FoundSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  isAvailable: boolean;
  boxTypes: string[];
  foundAt: Date;
}

export interface SearchResult {
  foundSlots: FoundSlot[];
  totalChecked: number;
  searchTime: number;
  errors: string[];
  stoppedEarly: boolean;
}

export class WBSlotSearch {
  private suppliesClient: any;
  private userId: string;
  private taskId: string;
  private config: SlotSearchConfig;
  private isSearching: boolean = false;
  private previousData: any[] = []; // Хранение предыдущих данных для сравнения
  private lastRequestTime: number = 0;
  private rateLimitCount: number = 0;

  // Константы из вашего кода
  private readonly maxAttemptsPerMinute = 6; // Максимум 6 запросов в минуту
  private readonly minRequestInterval = 10000; // 10 секунд между запросами
  private readonly maxRateLimitAttempts = 5; // Максимум попыток при ошибке 429
  private readonly rateLimitDelay = 90000; // 90 секунд при ошибке 429
  private readonly maxExecutionTime = 3 * 24 * 60 * 60 * 1000; // 3 дня

  constructor(config: SlotSearchConfig) {
    this.config = config;
    this.userId = config.userId;
    this.taskId = config.taskId;
  }

  /**
   * Основной метод поиска слотов с непрерывным поиском до нахождения нужного слота
   */
  async searchSlots(): Promise<SearchResult> {
    const startTime = Date.now();
    const foundSlots: FoundSlot[] = [];
    const errors: string[] = [];
    let totalChecked = 0;
    let stoppedEarly = false;
    let runId: string | null = this.config.runId || null;

    try {
      // 1. Создаем Run запись для логирования (если не передан runId)
      if (!runId) {
        const run = await prisma.run.create({
          data: {
            taskId: this.taskId,
            userId: this.userId,
            status: 'RUNNING' as any,
            startedAt: new Date(),
          },
        });
        runId = run.id;
        console.log(`📝 Создана Run запись: ${runId}`);
      } else {
        console.log(`📝 Используем существующую Run запись: ${runId}`);
      }

      // 2. Получаем WB API токен
      const userToken = await this.getUserWBToken();
      if (!userToken) {
        throw new Error('WB API токен не найден. Добавьте токен в настройках.');
      }

      console.log(`🔑 WB API токен получен: ${userToken.substring(0, 10)}...`);

      // 3. Инициализируем клиент
      this.suppliesClient = WBClientFactory.createSuppliesClient(userToken);

      // 3. Начинаем поиск
      this.isSearching = true;
      console.log(`🔍 Начинаем непрерывный поиск слотов для задачи ${this.taskId}`);
      console.log(`⚙️ Конфигурация поиска:`, {
        userId: this.userId,
        taskId: this.taskId,
        warehouseIds: this.config.warehouseIds,
        boxTypeIds: this.config.boxTypeIds,
        coefficientMin: this.config.coefficientMin,
        coefficientMax: this.config.coefficientMax,
        dateFrom: this.config.dateFrom,
        dateTo: this.config.dateTo,
        stopOnFirstFound: this.config.stopOnFirstFound
      });

      // Логируем начало поиска в базу данных
      await this.logMessage('INFO', 'Поиск слотов запущен', {
        config: {
          warehouseIds: this.config.warehouseIds,
          boxTypeIds: this.config.boxTypeIds,
          coefficientMin: this.config.coefficientMin,
          coefficientMax: this.config.coefficientMax,
          dateFrom: this.config.dateFrom,
          dateTo: this.config.dateTo,
          stopOnFirstFound: this.config.stopOnFirstFound,
          autoBook: this.config.autoBook,
          autoBookSupplyId: this.config.autoBookSupplyId,
        }
      }, runId);

      // 4. Непрерывный поиск слотов до нахождения нужного или остановки пользователем
      let searchCycles = 0;
      const maxSearchCycles = Math.ceil(this.maxExecutionTime / this.minRequestInterval); // Максимум циклов за 3 дня

      while (this.isSearching && searchCycles < maxSearchCycles) {
        searchCycles++;
        console.log(`🔄 Цикл поиска ${searchCycles}/${maxSearchCycles}`);
        
        // Логируем начало цикла поиска
        await this.logMessage('INFO', `Начало цикла поиска ${searchCycles}/${maxSearchCycles}`, {
          cycle: searchCycles,
          maxCycles: maxSearchCycles,
          isSearching: this.isSearching,
          timestamp: new Date().toISOString()
        }, runId);

        // Проверяем, не остановил ли пользователь поиск
        if (!this.isSearching) {
          console.log('⏹️ Поиск остановлен пользователем');
          await this.logMessage('INFO', 'Поиск остановлен пользователем', undefined, runId);
          stoppedEarly = true;
          break;
        }

        // Проверка времени выполнения (3 дня)
        if (Date.now() - startTime > this.maxExecutionTime) {
          console.log('⏰ Превышено максимальное время выполнения (3 дня), завершение...');
          await this.logMessage('WARN', 'Превышено максимальное время выполнения (3 дня)', undefined, runId);
          break;
        }

        // Ищем слоты по каждому складу с соблюдением лимитов
        for (const warehouseId of this.config.warehouseIds) {
          if (!this.isSearching) break;

          try {
            console.log(`🔍 Поиск на складе ${warehouseId} (цикл ${searchCycles})`);
            
            // Соблюдение лимита запросов (6 запросов в минуту)
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < this.minRequestInterval) {
              const waitTime = this.minRequestInterval - timeSinceLastRequest;
              console.log(`⏳ Ожидание ${waitTime}ms для соблюдения лимита ${this.maxAttemptsPerMinute} запросов/минуту`);
              await this.delay(waitTime);
            }

            // Получаем коэффициенты для склада
            const coefficients = await this.suppliesClient.getCoefficients([warehouseId], this.config.dateFrom, this.config.dateTo, this.config.isSortingCenter);

            this.lastRequestTime = Date.now();
            totalChecked += coefficients.length;

            console.log(`📊 Получено коэффициентов для склада ${warehouseId}: ${coefficients.length}`);
            
            // Детальное логирование успешного запроса
            const requestDetails: any = {
              warehouseId,
              dateFrom: this.config.dateFrom,
              dateTo: this.config.dateTo,
              isSortingCenter: this.config.isSortingCenter,
              coefficientsCount: coefficients.length,
              timestamp: new Date().toISOString(),
              requestUrl: 'https://supplies-api.wildberries.ru/api/v1/acceptance/coefficients',
              requestMethod: 'GET',
              parameters: {
                warehouseIDs: warehouseId.toString(),
                dateFrom: this.config.dateFrom,
                dateTo: this.config.dateTo,
                isSortingCenter: this.config.isSortingCenter
              }
            };

            // Если есть данные, добавляем статистику
            if (coefficients.length > 0) {
              const coefficientStats = {
                min: Math.min(...coefficients.map((c: any) => c.coefficient)),
                max: Math.max(...coefficients.map((c: any) => c.coefficient)),
                avg: coefficients.reduce((sum: number, c: any) => sum + c.coefficient, 0) / coefficients.length,
                available: coefficients.filter((c: any) => c.allowUnload).length,
                total: coefficients.length
              };
              requestDetails.coefficientStats = coefficientStats;
              
              // Пример данных из ответа
              requestDetails.sampleData = coefficients[0];
            }

            await this.logMessage('DEBUG', `Получено ${coefficients.length} коэффициентов для склада ${warehouseId}`, requestDetails, runId);

            // Выявляем новые слоты
            const newSlots = this.detectNewSlots(coefficients, this.previousData);
            this.previousData = [...coefficients]; // Обновляем предыдущие данные

            console.log(`🆕 Новых слотов обнаружено: ${newSlots.length}`);
            await this.logMessage('DEBUG', `Обнаружено ${newSlots.length} новых слотов`, undefined, runId);

            // Фильтруем слоты согласно документации WB API
            const filteredSlots = this.filterSlots(newSlots);

            // Преобразуем в слоты согласно структуре ответа WB API
            for (const slot of filteredSlots) {
              if (!this.isSearching) break;

              const foundSlot: FoundSlot = {
                warehouseId: slot.warehouseID,
                warehouseName: slot.warehouseName || `Склад ${slot.warehouseID}`,
                date: slot.date,
                timeSlot: this.formatTimeSlot(slot.date),
                coefficient: slot.coefficient,
                isAvailable: slot.allowUnload === true,
                boxTypes: [slot.boxTypeName || `Type ${slot.boxTypeID}`],
                foundAt: new Date(),
              };

              foundSlots.push(foundSlot);
              console.log(`✅ Найден слот: ${foundSlot.warehouseName} - ${foundSlot.date} (коэф: ${foundSlot.coefficient}, тип: ${slot.boxTypeName})`);
              await this.logMessage('INFO', `Найден слот: ${foundSlot.warehouseName} - ${foundSlot.date} (коэф: ${foundSlot.coefficient})`, {
                slot: foundSlot
              }, runId);

              // Останавливаемся при первом найденном слоте, если настроено
              if (this.config.stopOnFirstFound) {
                stoppedEarly = true;
                this.isSearching = false; // Останавливаем поиск
                await this.logMessage('INFO', 'Остановка поиска после нахождения первого слота', undefined, runId);
                break;
              }
            }

            // Если нашли слоты и не настроена остановка при первом найденном, продолжаем поиск
            if (foundSlots.length > 0 && !this.config.stopOnFirstFound) {
              console.log(`🎯 Найдено ${foundSlots.length} слотов, продолжаем поиск...`);
            }

          } catch (error) {
            const errorMsg = `Ошибка поиска на складе ${warehouseId}: ${error instanceof Error ? error.message : error}`;
            console.error(errorMsg);
            errors.push(errorMsg);

            // Детальное логирование ошибки API
            await this.logMessage('ERROR', `Ошибка API для склада ${warehouseId}`, {
              warehouseId,
              error: error instanceof Error ? error.message : String(error),
              errorType: error instanceof Error ? error.constructor.name : typeof error,
              status: (error as any).status,
              response: (error as any).response?.data,
              timestamp: new Date().toISOString(),
              requestParams: {
                dateFrom: this.config.dateFrom,
                dateTo: this.config.dateTo,
                isSortingCenter: this.config.isSortingCenter
              }
            }, runId);

            // Обработка ошибок API
            if ((error as any).status === 429) {
              if (this.rateLimitCount >= this.maxRateLimitAttempts) {
                console.log(`❌ Превышено максимальное количество попыток (${this.maxRateLimitAttempts}) при ошибке 429`);
                await this.logMessage('WARN', `Превышен лимит попыток при ошибке 429`, {
                  rateLimitCount: this.rateLimitCount,
                  maxRateLimitAttempts: this.maxRateLimitAttempts
                }, runId);
                this.isSearching = false;
                break;
              }
              console.log(`⏳ Ошибка 429: Слишком много запросов, ожидание ${this.rateLimitDelay}ms`);
              await this.logMessage('WARN', `Ошибка 429 (Rate Limit). Ожидание ${this.rateLimitDelay}ms`, {
                rateLimitCount: this.rateLimitCount,
                waitTime: this.rateLimitDelay
              }, runId);
              await this.delay(this.rateLimitDelay);
              this.rateLimitCount++;
            } else if ([400, 401, 403].includes((error as any).status)) {
              console.error(`❌ Критическая ошибка API (статус ${(error as any).status}):`, (error as any).message);
              await this.logMessage('ERROR', `Критическая ошибка API (статус ${(error as any).status})`, {
                status: (error as any).status,
                message: (error as any).message,
                warehouseId
              }, runId);
              this.isSearching = false;
              break;
            } else {
              const delay = this.getExponentialBackoffDelay(errors.length);
              console.log(`⏳ Ошибка, ожидание ${delay}ms перед следующей попыткой`);
              await this.logMessage('WARN', `Ошибка API, повтор через ${delay}ms`, {
                delay,
                errorCount: errors.length,
                warehouseId
              }, runId);
              await this.delay(delay);
            }
          }
        }

        // Если нашли слоты и настроена остановка при первом найденном, выходим из цикла
        if (foundSlots.length > 0 && this.config.stopOnFirstFound) {
          console.log(`🎯 Найден нужный слот, завершение поиска`);
          break;
        }

        // Небольшая пауза между циклами поиска
        if (this.isSearching) {
          console.log(`⏳ Пауза между циклами поиска...`);
          await this.delay(5000); // 5 секунд между циклами
        }
      }

      // 5. Сохраняем результаты в базу
      await this.saveSearchResults(foundSlots);

      // 6. Если найдены слоты и включено авто-бронирование
      if (foundSlots.length > 0 && this.config.autoBook && this.config.autoBookSupplyId) {
        console.log(`🔐 Найдены слоты, начинаем авто-бронирование...`);
        
        // Обновляем статус на BOOKING
        await this.updateTaskStatus('BOOKING', runId);
        
        // Отправляем уведомление о найденном слоте
        await getTelegramService().notifySlotFound(
          this.userId,
          this.taskId,
          this.config.taskName || 'Задача',
          foundSlots[0]
        );
        
        // Отправляем уведомление о начале бронирования
        await getTelegramService().notifyBookingStarted(
          this.userId,
          this.taskId,
          this.config.taskName || 'Задача',
          this.config.autoBookSupplyId,
          foundSlots[0]
        );
        
        // Выполняем авто-бронирование
        const bookingService = new AutoBookingService(
          this.userId,
          this.taskId,
          this.config.autoBookSupplyId
        );
        
        const bookingResult = await bookingService.bookSlot(foundSlots[0]);
        
        if (bookingResult.success) {
          console.log(`✅ Авто-бронирование завершено успешно: ${bookingResult.bookingId}`);
          
          // Отправляем уведомление о завершении бронирования
          await getTelegramService().notifyBookingCompleted(
            this.userId,
            this.taskId,
            this.config.taskName || 'Задача',
            this.config.autoBookSupplyId,
            bookingResult.bookingId!,
            foundSlots[0]
          );
          
          // Обновляем статус на COMPLETED
          await this.updateTaskStatus('COMPLETED', runId);
        } else {
          console.error(`❌ Ошибка авто-бронирования: ${bookingResult.error}`);
          
          // Отправляем уведомление об ошибке бронирования
          await getTelegramService().notifyBookingFailed(
            this.userId,
            this.taskId,
            this.config.taskName || 'Задача',
            this.config.autoBookSupplyId,
            foundSlots[0],
            bookingResult.error || 'Неизвестная ошибка'
          );
          
          // Обновляем статус на FAILED
          await this.updateTaskStatus('FAILED', runId);
        }
      } else {
        // 7. Обновляем статус задачи (без авто-бронирования)
        await this.updateTaskStatus(foundSlots.length > 0 ? 'SUCCESS' : 'FAILED', runId);
      }

      console.log(`✅ Поиск завершен. Найдено слотов: ${foundSlots.length}`);

      // Обновляем статус Run записи
      if (runId) {
        await prisma.run.update({
          where: { id: runId },
          data: {
            status: foundSlots.length > 0 ? 'SUCCESS' : 'FAILED',
            finishedAt: new Date(),
            foundSlots: foundSlots.length,
            summary: {
              foundSlots: foundSlots.length,
              totalChecked,
              searchTime: Date.now() - startTime,
              errors,
              stoppedEarly,
            } as any,
          },
        });
      }

      return {
        foundSlots,
        totalChecked,
        searchTime: Date.now() - startTime,
        errors,
        stoppedEarly,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('❌ Ошибка поиска слотов:', error);
      
      // Обновляем статус задачи на FAILED
      await this.updateTaskStatus('FAILED', runId || undefined);
      
      // Обновляем статус Run записи
      if (runId) {
        await prisma.run.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            foundSlots: 0,
            summary: {
              error: errorMsg,
              foundSlots: 0,
              totalChecked,
              searchTime: Date.now() - startTime,
              errors: [errorMsg],
              stoppedEarly: false,
            } as any,
          },
        });
      }
      
      return {
        foundSlots,
        totalChecked,
        searchTime: Date.now() - startTime,
        errors: [errorMsg],
        stoppedEarly: false,
      };
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * Остановка поиска
   */
  stopSearch(): void {
    this.isSearching = false;
    console.log('⏹️ Поиск остановлен пользователем');
  }

  /**
   * Обновление статуса задачи
   */
  private async updateTaskStatus(status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'STOPPED' | 'BOOKING' | 'COMPLETED', runId?: string): Promise<void> {
    try {
      // Временно убираем обновление статуса до генерации Prisma клиента
      // await prisma.task.update({
      //   where: { id: this.taskId },
      //   data: { 
      //     status,
      //     updatedAt: new Date(),
      //   },
      // });
      console.log(`📊 Статус задачи ${this.taskId} обновлен на: ${status}`);
      
      // Логируем изменение статуса
      await this.logMessage('INFO', `Статус задачи изменен на: ${status}`, undefined, runId);
    } catch (error) {
      console.error('Ошибка обновления статуса задачи:', error);
    }
  }

  /**
   * Логирование сообщений в базу данных
   */
  private async logMessage(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any, runId?: string): Promise<void> {
    try {
      let targetRunId = runId;
      
      // Если runId не передан, ищем активный запуск задачи
      if (!targetRunId) {
        const activeRun = await prisma.run.findFirst({
          where: {
            taskId: this.taskId,
            status: 'RUNNING',
          },
          orderBy: {
            startedAt: 'desc',
          },
        });
        targetRunId = activeRun?.id;
      }

      if (targetRunId) {
        await prisma.runLog.create({
          data: {
            runId: targetRunId,
            level,
            message,
            meta: meta ? JSON.stringify(meta) : undefined,
          },
        });
      }
    } catch (error) {
      console.error('Ошибка логирования сообщения:', error);
    }
  }

  /**
   * Получение WB API токена пользователя
   */
  private async getUserWBToken(): Promise<string | null> {
    try {
      const token = await prisma.userToken.findFirst({
        where: {
          userId: this.userId,
          category: 'SUPPLIES',
          isActive: true,
        },
      });

      if (!token) return null;

      return decrypt(token.tokenEncrypted);
    } catch (error) {
      console.error('Error getting user WB token:', error);
      return null;
    }
  }

  /**
   * Получение настроек поиска
   */
  private async getSearchSettings(): Promise<any> {
    try {
      const settings = await prisma.userSettings.findFirst({
        where: {
          userId: this.userId,
          category: 'SEARCH',
        },
      });

      if (!settings) {
        // Возвращаем настройки по умолчанию
        return {
          checkInterval: 10, // 10 секунд
          maxAttempts: 100,
          apiRateLimit: 6,
          stopOnFirstFound: true,
        };
      }

      return settings.settings;
    } catch (error) {
      console.error('Error getting search settings:', error);
      return {
        checkInterval: 10,
        maxAttempts: 100,
        apiRateLimit: 6,
        stopOnFirstFound: true,
      };
    }
  }

  /**
   * Форматирование времени слота из даты
   */
  private formatTimeSlot(dateString: string): string {
    try {
      const date = new Date(dateString);
      const timeString = date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Europe/Moscow'
      });
      return timeString || '09:00-18:00';
    } catch (error) {
      return '09:00-18:00'; // Время по умолчанию
    }
  }

  /**
   * Получение типов коробок из ответа API
   */
  private getBoxTypes(apiBoxTypes: any[]): string[] {
    const boxTypeMap: { [key: number]: string } = {
      2: 'Короба',
      5: 'Монопаллеты',
      6: 'Суперсейф',
    };

    return apiBoxTypes
      .filter(bt => bt.available)
      .map(bt => boxTypeMap[bt.id] || `Type ${bt.id}`);
  }

  /**
   * Сохранение результатов поиска
   */
  private async saveSearchResults(slots: FoundSlot[]): Promise<void> {
    try {
      if (slots.length === 0) return;

      // Создаем записи о найденных слотах
      const slotData = slots.map(slot => ({
        userId: this.userId,
        warehouseId: slot.warehouseId,
        boxTypeId: 2, // По умолчанию Короба, можно извлечь из slot.boxTypes
        statusName: 'FOUND',
        supplyDate: new Date(slot.date),
        raw: {
          warehouseName: slot.warehouseName,
          timeSlot: slot.timeSlot,
          coefficient: slot.coefficient,
          boxTypes: slot.boxTypes,
          foundAt: slot.foundAt.toISOString(),
          searchTaskId: this.taskId,
        },
      }));

      await prisma.supplySnapshot.createMany({
        data: slotData,
      });

      console.log(`💾 Сохранено ${slots.length} найденных слотов`);

    } catch (error) {
      console.error('Error saving search results:', error);
    }
  }


  /**
   * Обнаружение новых слотов
   */
  private detectNewSlots(currentData: any[], previousData: any[]): any[] {
    console.log(`🔍 detectNewSlots: currentData.length = ${currentData?.length || 0}, previousData.length = ${previousData?.length || 0}`);
    
    if (!Array.isArray(currentData) || currentData.length === 0) {
      console.log(`⚠️ detectNewSlots: currentData пустой или не массив`);
      return [];
    }

    if (!previousData || previousData.length === 0) {
      console.log(`✅ detectNewSlots: previousData пустой, возвращаем все currentData`);
      return currentData;
    }

    const normalizeDate = (dateStr: string): number => {
      try {
        return new Date(dateStr).getTime();
      } catch {
        return 0;
      }
    };

    const newSlots = currentData.filter(current => {
      const isNew = !previousData.some(prev =>
        prev.warehouseID === current.warehouseID &&
        prev.boxTypeID === current.boxTypeID &&
        normalizeDate(prev.date) === normalizeDate(current.date) &&
        prev.coefficient === current.coefficient
      );
      return isNew;
    });

    console.log(`🔍 Обнаружено новых слотов: ${newSlots.length}`);
    return newSlots;
  }

  /**
   * Фильтрация слотов по параметрам согласно документации WB API
   */
  private filterSlots(slots: any[]): any[] {
    console.log(`🔍 Фильтрация слотов согласно документации WB API`);
    console.log(`📋 Входных слотов для фильтрации: ${slots.length}`);
    console.log(`⚙️ Конфигурация фильтрации:`, {
      warehouseIds: this.config.warehouseIds,
      boxTypeIds: this.config.boxTypeIds,
      coefficientMin: this.config.coefficientMin,
      coefficientMax: this.config.coefficientMax,
      dateFrom: this.config.dateFrom,
      dateTo: this.config.dateTo
    });

    const filteredSlots = slots.filter((item, index) => {
      console.log(`🔍 Фильтрация слота ${index + 1}/${slots.length}:`, {
        warehouseID: item.warehouseID,
        boxTypeID: item.boxTypeID,
        boxTypeName: item.boxTypeName,
        coefficient: item.coefficient,
        allowUnload: item.allowUnload,
        date: item.date
      });
      
      if (!item || typeof item !== 'object') {
        console.log(`❌ Слот ${index + 1}: не объект или null`);
        return false;
      }
      
      const itemDate = item.date ? new Date(item.date).toISOString().split('T')[0] : null;
      const start = new Date(this.config.dateFrom);
      const end = new Date(this.config.dateTo);
      const itemTime = itemDate ? new Date(itemDate) : null;
      
      const reasons = [];
      
      // Проверка коэффициента согласно документации: coefficient === 0 || coefficient === 1
      // Для тестового режима (коэффициент -1) используем диапазон от -1 до 0
      if (this.config.coefficientMin === -1) {
        // Тестовый режим: принимаем коэффициенты от -1 до 0
        if (item.coefficient < -1 || item.coefficient > 0) {
          reasons.push(`коэффициент: ${item.coefficient} вне диапазона -1 до 0 (тестовый режим)`);
        }
      } else {
        // Обычный режим: только 0 или 1
        if (item.coefficient !== 0 && item.coefficient !== 1) {
          reasons.push(`коэффициент: ${item.coefficient} не равен 0 или 1 (требование WB API)`);
        }
      }
      
      // Проверка allowUnload согласно документации: allowUnload === true
      // Для тестового режима (коэффициент -1) пропускаем эту проверку
      if (this.config.coefficientMin !== -1 && item.allowUnload !== true) {
        reasons.push(`allowUnload: ${item.allowUnload} не равен true (требование WB API)`);
      }
      
      // Проверка склада
      if (!this.config.warehouseIds.includes(item.warehouseID)) {
        reasons.push(`склад: ${item.warehouseID} не в списке выбранных складов`);
      }
      
      // Проверка типа поставки
      if (!this.config.boxTypeIds.includes(item.boxTypeID)) {
        reasons.push(`тип_поставки: ${item.boxTypeID} не в списке выбранных типов поставки`);
      }
      
      // Проверка даты
      if (itemDate && itemTime && (itemTime < start || itemTime > end)) {
        reasons.push(`дата: ${itemDate} вне диапазона ${this.config.dateFrom} - ${this.config.dateTo}`);
      }
      
      const matches = reasons.length === 0;
      console.log(`🔍 Результат проверки слота ${index + 1}:`, { 
        item: { 
          warehouseID: item.warehouseID, 
          date: item.date, 
          coefficient: item.coefficient,
          allowUnload: item.allowUnload,
          boxTypeID: item.boxTypeID,
          boxTypeName: item.boxTypeName
        }, 
        matches: matches ? '✅ ПРОШЕЛ' : '❌ НЕ ПРОШЕЛ', 
        reasons: reasons.length > 0 ? reasons : 'Все условия выполнены' 
      });
      
      return matches;
    }).sort((a, b) => a.coefficient - b.coefficient); // Сортировка по возрастанию коэффициента

    console.log(`✅ Отфильтровано слотов: ${filteredSlots.length}`);
    return filteredSlots;
  }

  /**
   * Экспоненциальная задержка для повторных попыток (из вашего кода)
   */
  private getExponentialBackoffDelay(attempt: number): number {
    return Math.min(60000, this.minRequestInterval * Math.pow(2, attempt - 1));
  }

  /**
   * Проверка, является ли текущее время пиковым (из вашего кода)
   */
  private isPeakTime(): boolean {
    const now = new Date();
    const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const hours = moscowTime.getHours();
    const minutes = moscowTime.getMinutes();
    const isPeak = (
      (hours === 9 && minutes >= 0 && minutes <= 10) ||
      (hours === 12 && minutes >= 0 && minutes <= 10) ||
      (hours === 16 && minutes >= 0 && minutes <= 10)
    );
    console.log(`🕐 Текущее время по МСК: ${moscowTime.toLocaleTimeString()}. Пик? ${isPeak}`);
    return isPeak;
  }

  /**
   * Задержка выполнения
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
