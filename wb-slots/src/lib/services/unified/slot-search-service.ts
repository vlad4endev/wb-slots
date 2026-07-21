// ===== UNIFIED SLOT SEARCH SERVICE =====

import { BaseServiceWithAllFeatures } from '../core/base-service-with-all-features';
import { 
  ISlotSearchService,
  SlotSearchConfig,
  SlotSearchResult,
  SearchHistory,
  FoundSlot,
  RetryConfig
} from '../core/interfaces';
import { LogLevel as AppLogLevel } from '../../logging/logger';
import { LogLevel } from '@prisma/client';
import { prisma } from '../../prisma';
import { decrypt } from '../../encryption';
import { WBClientFactory } from '../../wb-client';
import { UnifiedNotificationService } from './notification-service';
import { AutoBookingService } from '../auto-booking-service';

// ===== CONFIGURATION INTERFACE =====

export interface UnifiedSlotSearchConfig {
  enableAutoBooking: boolean;
  enableNotifications: boolean;
  maxSearchCycles: number;
  searchDelay: number;
  maxExecutionTime: number;
  stopOnFirstFound: boolean;
  enableRateLimit: boolean;
  rateLimitDelay: number;
}

// ===== UNIFIED SLOT SEARCH SERVICE =====

export class UnifiedSlotSearchService 
  extends BaseServiceWithAllFeatures<UnifiedSlotSearchConfig>
  implements ISlotSearchService {
  
  private isSearching = false;
  private stopRequested = false;
  private searchHistory: SearchHistory[] = [];
  private notificationService: UnifiedNotificationService;
  private autoBookingService: AutoBookingService;

  constructor() {
    const defaultConfig: UnifiedSlotSearchConfig = {
      enableAutoBooking: false,
      enableNotifications: true,
      maxSearchCycles: 100,
      searchDelay: 10000,
      maxExecutionTime: 3 * 24 * 60 * 60 * 1000, // 3 days
      stopOnFirstFound: false,
      enableRateLimit: true,
      rateLimitDelay: 1000
    };

    const defaultRetryConfig: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        'RATE_LIMIT_ERROR',
        'NETWORK_ERROR',
        'TIMEOUT_ERROR'
      ]
    };

    super('UnifiedSlotSearchService', defaultConfig, defaultRetryConfig);
    this.notificationService = new UnifiedNotificationService();
    this.autoBookingService = new AutoBookingService();
  }

  // ===== ABSTRACT METHODS IMPLEMENTATION =====

  async initialize(): Promise<void> {
      this.logger.info('Initializing Unified Slot Search Service');
      
    // Initialize notification service
    await this.notificationService.initialize();
      
    this._addHealthCheck('initialization', 'pass', 'Service initialized successfully');
  }

  async start(): Promise<void> {
      this.logger.info('Starting Unified Slot Search Service');
    this._startService();
    this._addHealthCheck('service_status', 'pass', 'Service started successfully');
  }

  async stop(): Promise<void> {
      this.logger.info('Stopping Unified Slot Search Service');
    this.isSearching = false;
    this.stopRequested = true;
    this._stopService();
    this._addHealthCheck('service_status', 'pass', 'Service stopped successfully');
  }

  validateConfig(config: Partial<UnifiedSlotSearchConfig>): boolean {
    const requiredFields: (keyof UnifiedSlotSearchConfig)[] = [
      'maxSearchCycles',
      'searchDelay',
      'maxExecutionTime'
    ];

    return this._validateRequiredConfig(config, requiredFields);
  }

  // ===== ISlotSearchService IMPLEMENTATION =====

  async searchSlots(config: SlotSearchConfig): Promise<SlotSearchResult> {
    if (this.isSearching) {
      throw new Error('Search is already in progress');
    }

    const startTime = Date.now();
    this.isSearching = true;
    this.stopRequested = false;
    
    try {
        this.logger.info('Starting slot search', { config });

      const result = await this.retry(async () => {
        return await this._performSlotSearch(config);
      }, 'slot_search');

      const duration = Date.now() - startTime;
      this._logOperation('searchSlots', true, duration, { 
        config, 
        foundSlots: result.foundSlots.length,
        totalChecked: result.totalChecked
      });

      // Save to history
      this._addToHistory({
        id: `search-${Date.now()}`,
        userId: config.userId,
            taskId: config.taskId,
        foundSlots: result.foundSlots.length,
        totalChecked: result.totalChecked,
        searchTime: duration,
        status: 'SUCCESS',
        createdAt: new Date()
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this._logOperation('searchSlots', false, duration, { config, error: (error as Error).message });

      // Save to history
      this._addToHistory({
        id: `search-${Date.now()}`,
        userId: config.userId,
        taskId: config.taskId,
        foundSlots: 0,
        totalChecked: 0,
        searchTime: duration,
        status: 'FAILED',
        error: (error as Error).message,
        createdAt: new Date()
      });

      throw error;
        } finally {
      this.isSearching = false;
    }
        }

  isSearchInProgress(): boolean {
    return this.isSearching;
  }

  async stopSearch(): Promise<void> {
    this.logger.info('Stopping slot search');
    this.stopRequested = true;
    this.isSearching = false;
  }

  getSearchHistory(): SearchHistory[] {
    return [...this.searchHistory];
  }

  // ===== PRIVATE METHODS =====

  private async _performSlotSearch(config: SlotSearchConfig): Promise<SlotSearchResult> {
    const foundSlots: FoundSlot[] = [];
    const errors: string[] = [];
    let totalChecked = 0;
    let stoppedEarly = false;
    let runId: string | null = config.runId || null;

    try {
      // 1. Create run record
      if (!runId) {
        runId = await this._createRunRecord(config);
      } else {
        this.logger.info(`Using existing Run record: ${runId}`);
      }

      // 2. Get WB API token
      const userToken = await this._getUserWBToken(config.userId);
      this.logger.info(`WB API token obtained: ${userToken.substring(0, 10)}...`);

      // 3. Initialize client
      const suppliesClient = WBClientFactory.createSuppliesClient(userToken);

      // 4. Start search
      this.logger.info(`Starting slot search for task ${config.taskId}`);

      await this._logRunMessage(runId, 'INFO', 'Slot search started', {
        config: {
          warehouseIds: config.warehouseIds,
          boxTypeIds: config.boxTypeIds,
          coefficientMin: config.coefficientMin,
          coefficientMax: config.coefficientMax,
          dateFrom: config.dateFrom,
          dateTo: config.dateTo,
          stopOnFirstFound: config.stopOnFirstFound,
          autoBook: (config as any).autoBook,
          autoBookSupplyId: (config as any).autoBookSupplyId,
        }
      });

      // 5. Continuous search loop
      const maxSearchCycles = Math.ceil(this._typedConfig.maxExecutionTime / this._typedConfig.searchDelay);
      let searchCycles = 0;

      while (this.isSearching && searchCycles < maxSearchCycles && !this.stopRequested) {
        searchCycles++;

        try {
          this.logger.info(`Search cycle ${searchCycles}/${maxSearchCycles}`);

          // Search for available slots
          const availableSlots = await suppliesClient.searchAvailableSlots(
            config.warehouseIds,
            config.boxTypeIds,
            config.dateFrom,
            config.dateTo,
            config.coefficientMin,
            config.isSortingCenter
          );

          totalChecked += availableSlots.length;

          // Process and filter slots
          const processedSlots = this._processSlots(availableSlots, config);
          foundSlots.push(...processedSlots);

          await this._logRunMessage(runId, 'INFO', `Found ${processedSlots.length} suitable slots in cycle ${searchCycles}`, {
            cycle: searchCycles,
            totalSlots: availableSlots.length,
            suitableSlots: processedSlots.length,
            totalFound: foundSlots.length
          });

          // Check if we should stop early
          if (this._typedConfig.stopOnFirstFound && foundSlots.length > 0) {
            this.logger.info('Stopping search early - slots found');
            stoppedEarly = true;
            break;
          }

          // Check if we have enough slots
          if (foundSlots.length >= 10) { // Reasonable limit
            this.logger.info('Stopping search - enough slots found');
            stoppedEarly = true;
          break;
        }

          // Wait before next cycle
          if (this.isSearching && !this.stopRequested) {
            await this._delay(this._typedConfig.searchDelay);
        }

      } catch (error) {
          const errorMessage = (error as Error).message;
          errors.push(errorMessage);
          
          this.logger.error(`Search cycle ${searchCycles} failed`, { error: errorMessage });
          
          await this._logRunMessage(runId, 'ERROR', `Search cycle ${searchCycles} failed`, {
            error: errorMessage,
            cycle: searchCycles
          });

          // Check if error is retryable
          if (this._isRetryableSearchError(error as Error)) {
            await this._delay(this._typedConfig.rateLimitDelay);
            continue;
          } else {
            break;
          }
        }
      }

      // 6. Finalize search
      const searchTime = Date.now() - Date.now(); // This should be calculated properly
      
      await this._logRunMessage(runId!, 'INFO', `Search completed: ${foundSlots.length} slots found`, {
      totalFound: foundSlots.length,
        totalChecked,
        searchCycles,
        stoppedEarly,
        errors: errors.length
      });

      // 7. Update run status
      await this._updateRunStatus(runId!, 'SUCCESS', {
        foundSlots: foundSlots.length,
        totalChecked,
        searchCycles,
        stoppedEarly,
        errors: errors.length
      });

      // 8. Send notifications if enabled
      if (this._typedConfig.enableNotifications && foundSlots.length > 0) {
        await this._sendSlotFoundNotification(config, foundSlots);
      }

      // 9. Handle auto-booking if enabled
      if (this._typedConfig.enableAutoBooking && foundSlots.length > 0) {
        await this._handleAutoBooking(config, foundSlots, runId);
      }

      return {
        foundSlots,
        totalChecked,
        searchTime,
        errors,
        stoppedEarly,
        runId
      };

    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error('Slot search failed', { error: errorMessage });
      
      await this._logRunMessage(runId!, 'ERROR', 'Slot search failed', {
        error: errorMessage
      });

      await this._updateRunStatus(runId!, 'FAILED', {
        error: errorMessage,
        foundSlots: foundSlots.length,
        totalChecked
      });

      throw error;
    }
  }

  private _processSlots(rawSlots: any[], config: SlotSearchConfig): FoundSlot[] {
    return rawSlots
      .filter(slot => this._isSlotSuitable(slot, config))
      .map(slot => this._convertToFoundSlot(slot))
      .sort((a, b) => a.coefficient - b.coefficient); // Sort by coefficient
  }

  private _isSlotSuitable(slot: any, config: SlotSearchConfig): boolean {
    // Check warehouse
    if (!config.warehouseIds.includes(slot.warehouseID)) {
      return false;
    }

    // Check box types - handle both boxTypes array and boxTypeID number
    let hasMatchingBoxType = false;
    
    if (slot.boxTypes && Array.isArray(slot.boxTypes)) {
      // If boxTypes is an array, check if any type matches
      hasMatchingBoxType = slot.boxTypes.some((type: number) => config.boxTypeIds.includes(type));
    } else if (slot.boxTypeID && typeof slot.boxTypeID === 'number') {
      // If boxTypeID is a number, check if it matches
      hasMatchingBoxType = config.boxTypeIds.includes(slot.boxTypeID);
    }
    
    if (!hasMatchingBoxType) {
      return false;
    }

    // Check coefficient
    if (slot.coefficient < config.coefficientMin || slot.coefficient > config.coefficientMax) {
      return false;
    }

    // Check date range
    const slotDate = new Date(slot.date);
    const fromDate = new Date(config.dateFrom);
    const toDate = new Date(config.dateTo);
    
    if (slotDate < fromDate || slotDate > toDate) {
      return false;
    }

    return true;
  }

  private _convertToFoundSlot(slot: any): FoundSlot {
    return {
      warehouseId: slot.warehouseID,
      warehouseName: slot.warehouseName,
      date: slot.date,
      timeSlot: slot.timeSlot,
      coefficient: slot.coefficient,
      isAvailable: true,
      boxTypes: slot.boxTypes || (slot.boxTypeID ? [slot.boxTypeID] : []),
      foundAt: new Date()
    };
  }

  private async _createRunRecord(config: SlotSearchConfig): Promise<string> {
    const run = await prisma.run.create({
      data: {
        taskId: config.taskId,
        userId: config.userId,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    return run.id;
  }

  private async _getUserWBToken(userId: string): Promise<string> {
    const userToken = await prisma.userToken.findFirst({
      where: {
        userId,
        category: 'SUPPLIES',
        isActive: true,
      },
    });

    if (!userToken) {
      // Check if user has any tokens
      const userTokens = await prisma.userToken.findMany({
        where: { userId },
        select: { category: true, isActive: true },
      });

      if (userTokens.length === 0) {
        throw new Error(`No tokens found for user ${userId}. Please add WB API token.`);
      } else {
        throw new Error(`No active SUPPLIES token found for user ${userId}. Please add or activate WB API token.`);
      }
    }

    return decrypt(userToken.tokenEncrypted);
  }

  private async _logRunMessage(runId: string, level: LogLevel, message: string, meta?: any): Promise<void> {
    try {
      await prisma.runLog.create({
        data: {
          runId,
          level,
          message,
          meta: meta ? JSON.stringify(meta) : undefined,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log run message', { error, runId, level, message });
    }
  }

  private async _updateRunStatus(runId: string, status: 'SUCCESS' | 'FAILED' | 'RUNNING', summary: any): Promise<void> {
    try {
      await prisma.run.update({
        where: { id: runId },
        data: {
          status,
          finishedAt: new Date(),
          summary: JSON.stringify(summary),
        },
      });
    } catch (error) {
      this.logger.error('Failed to update run status', { error, runId, status });
    }
  }

  private async _sendSlotFoundNotification(config: SlotSearchConfig, foundSlots: FoundSlot[]): Promise<void> {
    try {
      const message = this._formatSlotsFoundMessage(config, foundSlots);
      await this.notificationService.sendNotification(config.userId, message);
    } catch (error) {
      this.logger.error('Failed to send slot found notification', { error, userId: config.userId });
    }
  }

  private _formatSlotsFoundMessage(config: SlotSearchConfig, foundSlots: FoundSlot[]): string {
    let message = `🎯 Найдены доступные слоты!\n\n`;
    message += `📋 Задача: ${config.taskId}\n`;
    message += `📊 Найдено слотов: ${foundSlots.length}\n\n`;

    // Show first 5 slots
    const slotsToShow = foundSlots.slice(0, 5);
    
    slotsToShow.forEach((slot, index) => {
      message += `📍 Слот ${index + 1}:\n`;
      message += `   🏪 Склад: ${slot.warehouseName}\n`;
      message += `   📅 Дата: ${new Date(slot.date).toLocaleDateString('ru-RU')}\n`;
      message += `   💰 Коэффициент: ${slot.coefficient}\n`;
      message += `   📦 Типы коробок: ${slot.boxTypes.join(', ')}\n\n`;
    });

    if (foundSlots.length > 5) {
      message += `... и еще ${foundSlots.length - 5} слотов\n\n`;
    }

    message += `🔗 Перейдите в панель управления для просмотра всех слотов и начала бронирования.`;
    
    return message;
  }

  private async _handleAutoBooking(config: SlotSearchConfig, foundSlots: FoundSlot[], runId: string): Promise<void> {
    const autoBookEnabled = (config as any).autoBook;
    const supplyId = (config as any).autoBookSupplyId;

    if (!autoBookEnabled || !supplyId) {
      this.logger.debug('Auto-booking skipped: disabled or supply not specified', {
        autoBookEnabled,
        supplyId,
        runId,
      });
      return;
    }

    if (!foundSlots.length) {
      this.logger.debug('Auto-booking skipped: no slots available', { runId });
      return;
    }

    this.logger.info('Auto-booking triggered for found slots', {
      slotsCount: foundSlots.length,
      supplyId,
      runId,
      taskId: config.taskId,
      userId: config.userId,
    });

    for (const slot of foundSlots) {
      const bookingConfig = {
        taskId: config.taskId,
        userId: config.userId,
        runId,
        slotId: `${slot.warehouseId}-${slot.date}`,
        supplyId,
        warehouseId: slot.warehouseId,
        boxTypeId: (slot as any).boxTypeId || (slot as any).boxTypeID || 2,
        date: slot.date,
        coefficient: slot.coefficient,
      };

      try {
        this.logger.info('Starting auto-booking for slot', bookingConfig);
        const result = await this.autoBookingService.startBooking(bookingConfig);

        if (result.success) {
          this.logger.info('Auto-booking succeeded for slot', {
            ...bookingConfig,
            bookingId: result.bookingId,
          });

          await this._logRunMessage(runId, 'INFO', 'Слот успешно забронирован', {
            slotId: bookingConfig.slotId,
            bookingId: result.bookingId,
            supplyId,
            warehouseId: slot.warehouseId,
            date: slot.date,
            coefficient: slot.coefficient,
          });
          break;
        } else {
          this.logger.warn('Auto-booking failed for slot', {
            ...bookingConfig,
            error: result.error,
          });

          await this._logRunMessage(runId, 'ERROR', 'Ошибка бронирования', {
            slotId: bookingConfig.slotId,
            error: result.error,
            supplyId,
            warehouseId: slot.warehouseId,
            date: slot.date,
            coefficient: slot.coefficient,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        this.logger.error('Auto-booking threw exception', {
          ...bookingConfig,
          error: message,
        });

        await this._logRunMessage(runId, 'ERROR', 'Ошибка автобронирования', {
          slotId: bookingConfig.slotId,
          error: message,
        });
      }
    }
  }

  private _isRetryableSearchError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('timeout') || 
           errorMessage.includes('network') ||
           errorMessage.includes('429');
  }

  private _addToHistory(search: SearchHistory): void {
    this.searchHistory.push(search);
    
    // Keep only last 100 searches
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(-100);
    }
  }
}