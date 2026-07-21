import { WBClientFactory } from '../../wb-client';
import { prisma } from '../../prisma';
import { decrypt } from '../../encryption';
import { AutoBookingService } from '../auto-booking-service';
import { TelegramService } from '../telegram-service';

// ===== TYPES =====
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
  runId?: string;
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

// ===== CONSTANTS =====
const SEARCH_CONSTANTS = {
  MAX_ATTEMPTS_PER_MINUTE: 6,
  MIN_REQUEST_INTERVAL: 10000, // 10 seconds
  MAX_RATE_LIMIT_ATTEMPTS: 5,
  RATE_LIMIT_DELAY: 90000, // 90 seconds
  MAX_EXECUTION_TIME: 3 * 24 * 60 * 60 * 1000, // 3 days
} as const;

// ===== ERROR CLASSES =====
export class SlotSearchError extends Error {
  constructor(message: string, public code: string, public originalError?: Error) {
    super(message);
    this.name = 'SlotSearchError';
  }
}

export class TokenError extends SlotSearchError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TOKEN_ERROR', originalError);
  }
}

export class RateLimitError extends SlotSearchError {
  constructor(message: string, originalError?: Error) {
    super(message, 'RATE_LIMIT_ERROR', originalError);
  }
}

// ===== UTILITY CLASSES =====
class RunManager {
  static async createRun(taskId: string, userId: string): Promise<string> {
    const run = await prisma.run.create({
      data: {
        taskId,
        userId,
        status: 'RUNNING' as any,
        startedAt: new Date(),
      },
    });
    
    console.log(`📝 Создана Run запись: ${run.id}`);
    return run.id;
  }

  static async logMessage(
    runId: string, 
    level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', 
    message: string, 
    meta?: any
  ): Promise<void> {
    await prisma.runLog.create({
      data: {
        runId,
        level: level as any,
        message,
        meta: meta ? safeJsonStringify(meta) : undefined,
      },
    });
  }

  static async updateRunStatus(
    runId: string, 
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED',
    summary?: any
  ): Promise<void> {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: status as any,
        finishedAt: new Date(),
        summary: summary ? safeJsonStringify(summary) : undefined,
      },
    });
  }
}

class TokenManager {
  static async getUserWBToken(userId: string): Promise<string> {
    const userToken = await prisma.userToken.findFirst({
      where: {
        userId,
        category: 'SUPPLIES',
        isActive: true,
      },
    });

    if (!userToken) {
      // Diagnostic information
      const userTokens = await prisma.userToken.findMany({
        where: { userId },
        select: { category: true, isActive: true }
      });
      
      console.error(`No active supplies token found for user ${userId}`);
      console.error(`User has ${userTokens.length} tokens:`, userTokens);
      
      throw new TokenError(`No active supplies token found. User has ${userTokens.length} tokens. Please add a SUPPLIES token in settings.`);
    }

    return decrypt(userToken.tokenEncrypted);
  }
}

class RateLimitManager {
  private lastRequestTime = 0;
  private rateLimitCount = 0;

  async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < SEARCH_CONSTANTS.MIN_REQUEST_INTERVAL) {
      const waitTime = SEARCH_CONSTANTS.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏳ Rate limit: waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  async handleRateLimitError(error: RateLimitError): Promise<void> {
    this.rateLimitCount++;
    
    if (this.rateLimitCount >= SEARCH_CONSTANTS.MAX_RATE_LIMIT_ATTEMPTS) {
      throw new RateLimitError(
        `Rate limit exceeded after ${SEARCH_CONSTANTS.MAX_RATE_LIMIT_ATTEMPTS} attempts`,
        error
      );
    }

    console.log(`🚫 Rate limit hit, waiting ${SEARCH_CONSTANTS.RATE_LIMIT_DELAY}ms (attempt ${this.rateLimitCount})`);
    await this.sleep(SEARCH_CONSTANTS.RATE_LIMIT_DELAY);
  }

  resetRateLimitCount(): void {
    this.rateLimitCount = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class SlotProcessor {
  static processSlots(rawSlots: any[], config: SlotSearchConfig): FoundSlot[] {
    return rawSlots
      .filter(slot => this.isSlotValid(slot, config))
      .map(slot => this.convertToFoundSlot(slot))
      .sort((a, b) => a.coefficient - b.coefficient);
  }

  private static isSlotValid(slot: any, config: SlotSearchConfig): boolean {
    return slot &&
           slot.warehouseID &&
           slot.date &&
           slot.coefficient >= config.coefficientMin &&
           slot.coefficient <= config.coefficientMax &&
           config.warehouseIds.includes(slot.warehouseID) &&
           (config.boxTypeIds && Array.isArray(config.boxTypeIds) ? config.boxTypeIds.some(boxTypeId => slot.boxTypes?.includes(boxTypeId)) : false);
  }

  private static convertToFoundSlot(slot: WBCoefficient): FoundSlot {
    return {
      warehouseId: slot.warehouseID,
      warehouseName: slot.warehouseName || `Склад ${slot.warehouseID}`,
      date: slot.date,
      timeSlot: slot.timeSlot || 'Не указано',
      coefficient: slot.coefficient,
      isAvailable: true,
      boxTypes: slot.boxTypes || [],
      foundAt: new Date(),
    };
  }
}

class AutoBookingManager {
  static async handleAutoBooking(
    foundSlots: FoundSlot[], 
    config: SlotSearchConfig, 
    runId: string
  ): Promise<void> {
    if (!config.autoBook || !config.autoBookSupplyId || foundSlots.length === 0) {
      return;
    }

    console.log(`🤖 Автобронирование: найдено ${foundSlots.length} слотов`);
    
    for (const slot of foundSlots) {
      try {
        const bookingConfig = {
          taskId: config.taskId,
          userId: config.userId,
          runId,
          slotId: `${slot.warehouseId}-${slot.date}`,
          supplyId: config.autoBookSupplyId,
          warehouseId: slot.warehouseId,
          boxTypeId: slot.boxTypes[0] || 2, // Default to first box type
          date: slot.date,
          coefficient: slot.coefficient,
          prisma,
        };

        const autoBookingService = new AutoBookingService();
        const result = await autoBookingService.startBooking(bookingConfig);

        if (result.success) {
          console.log(`✅ Слот успешно забронирован: ${slot.warehouseId} - ${slot.date}`);
          await RunManager.logMessage(runId, 'INFO', 'Слот успешно забронирован', {
            slotId: bookingConfig.slotId,
            bookingId: result.bookingId,
          });
        } else {
          console.error(`❌ Ошибка бронирования: ${result.error}`);
          await RunManager.logMessage(runId, 'ERROR', 'Ошибка бронирования', {
            slotId: bookingConfig.slotId,
            error: result.error,
          });
        }
      } catch (error) {
        console.error(`❌ Ошибка автобронирования:`, error);
        await RunManager.logMessage(runId, 'ERROR', 'Ошибка автобронирования', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
}

class NotificationManager {
  static async sendSlotFoundNotification(
    foundSlots: FoundSlot[], 
    config: SlotSearchConfig, 
    runId: string
  ): Promise<void> {
    if (foundSlots.length === 0) {
      return;
    }

    try {
      const telegramService = new TelegramService(prisma);
      
      const message = this.buildNotificationMessage(foundSlots, config);
      await telegramService.sendNotification(config.userId, message);

      await RunManager.logMessage(runId, 'INFO', 'Уведомление отправлено', {
        slotsCount: foundSlots.length,
        message: message.substring(0, 100) + '...',
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
      await RunManager.logMessage(runId, 'ERROR', 'Ошибка отправки уведомления', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private static buildNotificationMessage(foundSlots: FoundSlot[], config: SlotSearchConfig): string {
    const taskName = config.taskName || `Задача ${config.taskId}`;
    const bestSlot = foundSlots[0]; // Already sorted by coefficient
    
    let message = `🎯 Найдены слоты для "${taskName}"!\n\n`;
    message += `📊 Всего найдено: ${foundSlots.length} слотов\n`;
    message += `🏆 Лучший слот:\n`;
    message += `   🏪 Склад: ${bestSlot.warehouseName}\n`;
    message += `   📅 Дата: ${bestSlot.date}\n`;
    message += `   💰 Коэффициент: ${bestSlot.coefficient}\n`;
    message += `   📦 Типы: ${bestSlot.boxTypes.join(', ')}\n\n`;

    if (foundSlots.length > 1) {
      message += `📋 Другие доступные слоты:\n`;
      foundSlots.slice(1, 4).forEach((slot, index) => {
        message += `   ${index + 2}. ${slot.warehouseName} - ${slot.date} (${slot.coefficient})\n`;
      });
      
      if (foundSlots.length > 4) {
        message += `   ... и еще ${foundSlots.length - 4} слотов\n`;
      }
    }

    return message;
  }
}

// ===== MAIN SERVICE CLASS =====
export class RefactoredSlotSearchService {
  private suppliesClient: WBSuppliesClient;
  private isSearching = false;
  private stopRequested = false;
  private rateLimitManager = new RateLimitManager();

  async searchSlots(config: SlotSearchConfig): Promise<SearchResult> {
    const startTime = Date.now();
    const foundSlots: FoundSlot[] = [];
    const errors: string[] = [];
    let totalChecked = 0;
    let stoppedEarly = false;
    let runId: string | null = config.runId || null;

    try {
      // 1. Create run record
      if (!runId) {
        runId = await RunManager.createRun(config.taskId, config.userId);
      } else {
        console.log(`📝 Используем существующую Run запись: ${runId}`);
      }

      // 2. Get WB API token
      const userToken = await TokenManager.getUserWBToken(config.userId);
      console.log(`🔑 WB API токен получен: ${userToken.substring(0, 10)}...`);

      // 3. Initialize client
      this.suppliesClient = WBClientFactory.createSuppliesClient(userToken);

      // 4. Start search
      this.isSearching = true;
      console.log(`🔍 Начинаем поиск слотов для задачи ${config.taskId}`);

      await RunManager.logMessage(runId, 'INFO', 'Поиск слотов запущен', {
        config: {
          warehouseIds: config.warehouseIds,
          boxTypeIds: config.boxTypeIds,
          coefficientMin: config.coefficientMin,
          coefficientMax: config.coefficientMax,
          dateFrom: config.dateFrom,
          dateTo: config.dateTo,
          stopOnFirstFound: config.stopOnFirstFound,
          autoBook: config.autoBook,
          autoBookSupplyId: config.autoBookSupplyId,
        }
      });

      // 5. Continuous search loop
      const maxSearchCycles = Math.ceil(SEARCH_CONSTANTS.MAX_EXECUTION_TIME / SEARCH_CONSTANTS.MIN_REQUEST_INTERVAL);
      let searchCycles = 0;

      while (this.isSearching && searchCycles < maxSearchCycles) {
        searchCycles++;
        console.log(`🔄 Цикл поиска ${searchCycles}/${maxSearchCycles}`);

        await RunManager.logMessage(runId, 'INFO', `Начало цикла поиска ${searchCycles}/${maxSearchCycles}`, {
          cycle: searchCycles,
          maxCycles: maxSearchCycles,
          isSearching: this.isSearching,
          timestamp: new Date().toISOString()
        });

        try {
          // Wait for rate limit
          await this.rateLimitManager.waitForRateLimit();

          // Search for slots
          const rawSlots = await this.searchForSlots(config);
          totalChecked += rawSlots.length;

          // Process found slots
          const processedSlots = SlotProcessor.processSlots(rawSlots, config);
          foundSlots.push(...processedSlots);

          console.log(`📊 Цикл ${searchCycles}: найдено ${processedSlots.length} слотов из ${rawSlots.length} проверенных`);

          await RunManager.logMessage(runId, 'INFO', `Цикл ${searchCycles} завершен`, {
            foundSlots: processedSlots.length,
            totalChecked: rawSlots.length,
            cycle: searchCycles,
          });

          // Check if we should stop
          if (config.stopOnFirstFound && processedSlots.length > 0) {
            console.log(`✅ Найдены слоты, останавливаем поиск (stopOnFirstFound=true)`);
            stoppedEarly = true;
            break;
          }

          // Reset rate limit counter on successful request
          this.rateLimitManager.resetRateLimitCount();

        } catch (error) {
          console.error(`❌ Ошибка в цикле ${searchCycles}:`, error);

          if (error instanceof RateLimitError) {
            await this.rateLimitManager.handleRateLimitError(error);
            continue;
          }

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Cycle ${searchCycles}: ${errorMessage}`);

          await RunManager.logMessage(runId, 'ERROR', `Ошибка в цикле ${searchCycles}`, {
            error: errorMessage,
            cycle: searchCycles,
          });

          // Wait before retry
          await this.sleep(SEARCH_CONSTANTS.MIN_REQUEST_INTERVAL);
        }
      }

      // 6. Handle found slots
      if (foundSlots.length > 0) {
        console.log(`🎉 Поиск завершен: найдено ${foundSlots.length} слотов`);

        // Auto-booking
        await AutoBookingManager.handleAutoBooking(foundSlots, config, runId);

        // Send notification
        await NotificationManager.sendSlotFoundNotification(foundSlots, config, runId);
      } else {
        console.log(`😔 Слоты не найдены`);
      }

      // 7. Update run status
      const summary = {
        foundSlots: foundSlots.length,
        totalChecked,
        searchTime: Date.now() - startTime,
        searchCycles,
        stoppedEarly,
        errors: errors.length,
      };

      await RunManager.updateRunStatus(runId, 'SUCCESS', summary);

      return {
        foundSlots,
        totalChecked,
        searchTime: Date.now() - startTime,
        errors,
        stoppedEarly,
      };

    } catch (error) {
      console.error('SlotSearchService error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      if (runId) {
        await RunManager.logMessage(runId, 'ERROR', 'Критическая ошибка поиска', {
          error: errorMessage,
        });
        await RunManager.updateRunStatus(runId, 'FAILED', { error: errorMessage });
      }

      return {
        foundSlots,
        totalChecked,
        searchTime: Date.now() - startTime,
        errors,
        stoppedEarly: true,
      };
    } finally {
      this.isSearching = false;
    }
  }

  private async searchForSlots(config: SlotSearchConfig): Promise<any[]> {
    try {
      const coefficients = await this.suppliesClient.getCoefficients(
        config.warehouseIds,
        config.dateFrom,
        config.dateTo,
        config.isSortingCenter
      );

      return coefficients || [];
    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        throw new RateLimitError('Rate limit exceeded', error);
      }
      throw error;
    }
  }

  async stopSearch(): Promise<void> {
    this.stopRequested = true;
    this.isSearching = false;
  }

  isSearchInProgress(): boolean {
    return this.isSearching;
  }

  isStopRequested(): boolean {
    return this.stopRequested;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const refactoredSlotSearchService = new RefactoredSlotSearchService();
