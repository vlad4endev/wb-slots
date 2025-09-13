import { WBSlotSearch } from '../wb-slot-search';
import { prisma } from '../prisma';
import { decrypt } from '../encryption';

export interface SlotSearchConfig {
  taskId: string;
  userId: string;
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
}

export interface SlotSearchResult {
  success: boolean;
  foundSlots: number;
  totalChecked: number;
  searchTime: number;
  errors: string[];
  stoppedEarly: boolean;
  slots: any[];
  runId: string;
}

export class SlotSearchService {
  private isSearching = false;
  private stopRequested = false;

  /**
   * Запустить поиск слотов
   */
  async startSearch(config: SlotSearchConfig): Promise<SlotSearchResult> {
    if (this.isSearching) {
      throw new Error('Search is already in progress');
    }

    this.isSearching = true;
    this.stopRequested = false;

    let tempTaskId = config.taskId;
    let tempRunId = config.runId;

    try {
      // Проверяем, существует ли задача
      const existingTask = await prisma.task.findUnique({
        where: { id: config.taskId },
      });

      // Если задача не существует, создаем временную
      if (!existingTask) {
        tempTaskId = `temp-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await prisma.task.create({
          data: {
            id: tempTaskId,
            userId: config.userId,
            name: 'Временная задача для поиска слотов',
            enabled: false,
            filters: {
              warehouseIds: config.warehouseIds,
              boxTypeIds: config.boxTypeIds,
              coefficientMin: config.coefficientMin,
              coefficientMax: config.coefficientMax,
              dates: {
                from: config.dateFrom,
                to: config.dateTo,
              },
              isSortingCenter: config.isSortingCenter,
            },
            priority: 1,
            retryPolicy: {
              maxRetries: 3,
              retryDelay: 5000,
            },
          },
        });
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

      // Создаем конфигурацию для WBSlotSearch
      const searchConfig = {
        userId: config.userId,
        taskId: tempTaskId,
        warehouseIds: config.warehouseIds,
        boxTypeIds: config.boxTypeIds,
        coefficientMin: config.coefficientMin,
        coefficientMax: config.coefficientMax,
        dateFrom: config.dateFrom,
        dateTo: config.dateTo,
        stopOnFirstFound: config.stopOnFirstFound,
        isSortingCenter: config.isSortingCenter,
        runId: tempRunId,
      };

      // Создаем экземпляр поиска
      const slotSearch = new WBSlotSearch(searchConfig);

      // Устанавливаем обработчик остановки
      slotSearch.onStop = () => {
        this.stopRequested = true;
      };

      // Запускаем поиск
      const result = await slotSearch.searchSlots();

      // Очищаем временную задачу, если она была создана
      if (!existingTask && tempTaskId.startsWith('temp-search-')) {
        try {
          await prisma.task.delete({ where: { id: tempTaskId } });
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp task:', cleanupError);
        }
      }

      return {
        success: true,
        foundSlots: result.foundSlots.length,
        totalChecked: result.totalChecked,
        searchTime: result.searchTime,
        errors: result.errors,
        stoppedEarly: result.stoppedEarly,
        slots: result.foundSlots,
        runId: tempRunId || '',
      };

    } catch (error) {
      console.error('SlotSearchService error:', error);
      
      // Очищаем временную задачу в случае ошибки
      if (tempTaskId.startsWith('temp-search-')) {
        try {
          await prisma.task.delete({ where: { id: tempTaskId } });
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp task after error:', cleanupError);
        }
      }

      return {
        success: false,
        foundSlots: 0,
        totalChecked: 0,
        searchTime: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        stoppedEarly: true,
        slots: [],
        runId: tempRunId || '',
      };
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * Остановить поиск
   */
  async stopSearch(): Promise<void> {
    this.stopRequested = true;
    // WBSlotSearch будет проверять this.isSearching в цикле
  }

  /**
   * Проверить статус поиска
   */
  isSearchInProgress(): boolean {
    return this.isSearching;
  }

  /**
   * Проверить, запрошена ли остановка
   */
  isStopRequested(): boolean {
    return this.stopRequested;
  }
}

// Экспортируем singleton instance
export const slotSearchService = new SlotSearchService();
