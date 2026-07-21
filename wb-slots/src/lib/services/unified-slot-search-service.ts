/**
 * 🏗️ Унифицированный сервис поиска слотов
 * Заменяет все дублирующиеся версии сервисов поиска слотов
 */

import { 
  BaseService, 
  ISlotSearchService, 
  SlotSearchConfig, 
  SlotSearchResult, 
  FoundSlot,
  ServiceError,
  ValidationError 
} from '../architecture';
import { UnifiedWBAPIClient } from './unified-wb-api-client';
import { prisma } from '../prisma';

export class UnifiedSlotSearchService extends BaseService implements ISlotSearchService {
  private activeSearches: Map<string, { config: SlotSearchConfig; startTime: Date }> = new Map();
  private searchHistory: SlotSearchResult[] = [];
  private wbClient?: UnifiedWBAPIClient;

  constructor() {
    super('UnifiedSlotSearchService', '1.0.0');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ
  // ============================================================================

  protected async doInitialize(): Promise<void> {
    this.log('info', 'Initializing slot search service...');
    
    // Инициализация будет выполнена при первом поиске
    this.log('info', 'Slot search service initialized');
  }

  protected async doStart(): Promise<void> {
    this.log('info', 'Starting slot search service...');
    this.log('info', 'Slot search service started');
  }

  protected async doStop(): Promise<void> {
    this.log('info', 'Stopping slot search service...');
    
    // Останавливаем все активные поиски
    for (const [searchId] of this.activeSearches) {
      await this.stopContinuousSearch(searchId);
    }
    
    this.log('info', 'Slot search service stopped');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА ISlotSearchService
  // ============================================================================

  async searchSlots(config: SlotSearchConfig): Promise<SlotSearchResult> {
    return this.executeWithMetrics('searchSlots', async () => {
      this.validateSearchConfig(config);
      
      const startTime = Date.now();
      const foundSlots: FoundSlot[] = [];
      const errors: string[] = [];
      
      try {
        // Получаем WB клиент
        const client = await this.getWBClient(config.userId);
        
        // Выполняем поиск для каждого склада
        for (const warehouseId of config.warehouseIds) {
          try {
            const slots = await this.searchSlotsForWarehouse(client, config, warehouseId);
            foundSlots.push(...slots);
            
            // Если нужно остановиться при первом найденном слоте
            if (config.stopOnFirstFound && foundSlots.length > 0) {
              break;
            }
          } catch (error) {
            const errorMsg = `Failed to search slots for warehouse ${warehouseId}: ${error}`;
            errors.push(errorMsg);
            this.log('error', errorMsg, error);
          }
        }
        
        const executionTime = Date.now() - startTime;
        
        const result: SlotSearchResult = {
          success: errors.length === 0,
          foundSlots,
          totalSearched: config.warehouseIds.length,
          executionTime,
          errors,
          summary: {
            warehouses: config.warehouseIds.length,
            dateRange: `${config.dateFrom} - ${config.dateTo}`,
            coefficients: `${config.coefficientMin} - ${config.coefficientMax}`
          }
        };
        
        // Сохраняем в историю
        this.searchHistory.unshift(result);
        if (this.searchHistory.length > 100) {
          this.searchHistory = this.searchHistory.slice(0, 100);
        }
        
        // Сохраняем найденные слоты в базу данных
        await this.saveFoundSlots(config, foundSlots);
        
        this.log('info', `Search completed: found ${foundSlots.length} slots in ${executionTime}ms`);
        return result;
        
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const result: SlotSearchResult = {
          success: false,
          foundSlots: [],
          totalSearched: 0,
          executionTime,
          errors: [error instanceof Error ? error.message : String(error)],
          summary: {
            warehouses: 0,
            dateRange: '',
            coefficients: ''
          }
        };
        
        this.searchHistory.unshift(result);
        throw new ServiceError(this.name, 'searchSlots', 'Search failed', undefined, error);
      }
    });
  }

  async startContinuousSearch(config: SlotSearchConfig): Promise<string> {
    return this.executeWithMetrics('startContinuousSearch', async () => {
      this.validateSearchConfig(config);
      
      const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.activeSearches.set(searchId, {
        config,
        startTime: new Date()
      });
      
      // Запускаем непрерывный поиск в фоне
      this.runContinuousSearch(searchId, config).catch(error => {
        this.log('error', `Continuous search ${searchId} failed`, error);
        this.activeSearches.delete(searchId);
      });
      
      this.log('info', `Started continuous search: ${searchId}`);
      return searchId;
    });
  }

  async stopContinuousSearch(searchId: string): Promise<void> {
    return this.executeWithMetrics('stopContinuousSearch', async () => {
      if (!this.activeSearches.has(searchId)) {
        throw new ServiceError(this.name, 'stopContinuousSearch', `Search ${searchId} not found`);
      }
      
      this.activeSearches.delete(searchId);
      this.log('info', `Stopped continuous search: ${searchId}`);
    });
  }

  isSearchInProgress(searchId?: string): boolean {
    if (searchId) {
      return this.activeSearches.has(searchId);
    }
    return this.activeSearches.size > 0;
  }

  getActiveSearches(): string[] {
    return Array.from(this.activeSearches.keys());
  }

  getSearchHistory(limit?: number): SlotSearchResult[] {
    if (limit) {
      return this.searchHistory.slice(0, limit);
    }
    return [...this.searchHistory];
  }

  async getSearchMetrics(): Promise<{
    totalSearches: number;
    successfulSearches: number;
    averageSlotsFound: number;
    averageSearchTime: number;
  }> {
    const metrics = await this.getMetrics();
    const totalSearches = this.searchHistory.length;
    const successfulSearches = this.searchHistory.filter(s => s.success).length;
    const averageSlotsFound = totalSearches > 0 
      ? this.searchHistory.reduce((sum, s) => sum + s.foundSlots.length, 0) / totalSearches 
      : 0;
    const averageSearchTime = totalSearches > 0 
      ? this.searchHistory.reduce((sum, s) => sum + s.executionTime, 0) / totalSearches 
      : 0;
    
    return {
      totalSearches,
      successfulSearches,
      averageSlotsFound,
      averageSearchTime
    };
  }

  // ============================================================================
  // ЗАЩИЩЕННЫЕ МЕТОДЫ
  // ============================================================================

  private async getWBClient(userId: string): Promise<UnifiedWBAPIClient> {
    if (!this.wbClient) {
      // Получаем токен пользователя
      const userToken = await prisma.userToken.findFirst({
        where: {
          userId,
          category: 'SUPPLIES',
          isActive: true
        }
      });
      
      if (!userToken) {
        throw new ServiceError(this.name, 'getWBClient', 'No active WB token found for user');
      }
      
      // Создаем клиент
      this.wbClient = new UnifiedWBAPIClient({
        token: userToken.token,
        category: 'SUPPLIES',
        baseURL: 'https://suppliers-api.wildberries.ru',
        timeout: 30000,
        retryAttempts: 3,
        rateLimit: {
          requests: 100,
          window: 60
        }
      });
      
      await this.wbClient.initialize();
      await this.wbClient.start();
    }
    
    return this.wbClient;
  }

  private async searchSlotsForWarehouse(
    client: UnifiedWBAPIClient,
    config: SlotSearchConfig,
    warehouseId: number
  ): Promise<FoundSlot[]> {
    const foundSlots: FoundSlot[] = [];
    
    try {
      // Получаем доступные слоты для склада
      const response = await client.getAvailableSlots({
        warehouseId,
        boxTypeId: config.boxTypeIds[0], // Пока берем первый тип тары
        dateFrom: config.dateFrom,
        dateTo: config.dateTo
      });
      
      if (response.success && response.data) {
        // Фильтруем слоты по критериям
        const filteredSlots = response.data.filter((slot: any) => {
          return (
            config.boxTypeIds.includes(slot.boxTypeId) &&
            slot.coefficient >= config.coefficientMin &&
            slot.coefficient <= config.coefficientMax &&
            slot.isSortingCenter === config.isSortingCenter
          );
        });
        
        // Преобразуем в FoundSlot
        for (const slot of filteredSlots) {
          foundSlots.push({
            id: `${warehouseId}_${slot.date}_${slot.boxTypeId}`,
            warehouseId,
            warehouseName: slot.warehouseName || `Warehouse ${warehouseId}`,
            boxTypeId: slot.boxTypeId,
            boxTypeName: slot.boxTypeName || `Box Type ${slot.boxTypeId}`,
            date: slot.date,
            coefficient: slot.coefficient,
            isSortingCenter: slot.isSortingCenter,
            foundAt: new Date()
          });
        }
      }
    } catch (error) {
      this.log('error', `Failed to search slots for warehouse ${warehouseId}`, error);
      throw error;
    }
    
    return foundSlots;
  }

  private async runContinuousSearch(searchId: string, config: SlotSearchConfig): Promise<void> {
    let searchCycles = 0;
    const maxCycles = config.maxSearchCycles || 1000;
    const searchDelay = config.searchDelay || 5000;
    const maxExecutionTime = config.maxExecutionTime || 3600000; // 1 час
    
    const startTime = Date.now();
    
    while (this.activeSearches.has(searchId) && searchCycles < maxCycles) {
      try {
        // Проверяем максимальное время выполнения
        if (Date.now() - startTime > maxExecutionTime) {
          this.log('info', `Continuous search ${searchId} reached max execution time`);
          break;
        }
        
        // Выполняем поиск
        const result = await this.searchSlots(config);
        
        // Если нашли слоты и нужно остановиться
        if (result.foundSlots.length > 0 && config.stopOnFirstFound) {
          this.log('info', `Continuous search ${searchId} found slots, stopping`);
          break;
        }
        
        searchCycles++;
        
        // Ждем перед следующим поиском
        await this.sleep(searchDelay);
        
      } catch (error) {
        this.log('error', `Continuous search ${searchId} cycle failed`, error);
        await this.sleep(searchDelay);
      }
    }
    
    // Удаляем из активных поисков
    this.activeSearches.delete(searchId);
    this.log('info', `Continuous search ${searchId} completed after ${searchCycles} cycles`);
  }

  private async saveFoundSlots(config: SlotSearchConfig, foundSlots: FoundSlot[]): Promise<void> {
    try {
      for (const slot of foundSlots) {
        await prisma.foundSlot.create({
          data: {
            id: slot.id,
            taskId: config.taskId,
            userId: config.userId,
            runId: config.runId,
            warehouseId: slot.warehouseId,
            warehouseName: slot.warehouseName,
            boxTypeId: slot.boxTypeId,
            boxTypeName: slot.boxTypeName,
            date: new Date(slot.date),
            coefficient: slot.coefficient,
            isSortingCenter: slot.isSortingCenter,
            foundAt: slot.foundAt
          }
        });
      }
    } catch (error) {
      this.log('error', 'Failed to save found slots to database', error);
    }
  }

  private validateSearchConfig(config: SlotSearchConfig): void {
    const requiredFields = ['taskId', 'userId', 'warehouseIds', 'boxTypeIds', 'dateFrom', 'dateTo'];
    
    for (const field of requiredFields) {
      if (!config[field as keyof SlotSearchConfig]) {
        throw new ValidationError(
          this.name,
          'validateSearchConfig',
          `Required field '${field}' is missing`
        );
      }
    }
    
    if (config.warehouseIds.length === 0) {
      throw new ValidationError(
        this.name,
        'validateSearchConfig',
        'At least one warehouse must be specified'
      );
    }
    
    if (config.boxTypeIds.length === 0) {
      throw new ValidationError(
        this.name,
        'validateSearchConfig',
        'At least one box type must be specified'
      );
    }
    
    if (config.coefficientMin > config.coefficientMax) {
      throw new ValidationError(
        this.name,
        'validateSearchConfig',
        'coefficientMin cannot be greater than coefficientMax'
      );
    }
  }
}
