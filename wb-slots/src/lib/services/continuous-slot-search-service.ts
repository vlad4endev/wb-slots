import { TaskRunRepository } from './continuous-search/task-run-repository';
import { TokenRepository } from './continuous-search/token-repository';
import { SlotSearchExecutor } from './continuous-search/slot-search-executor';
import { SearchStateManager, SearchStopReason } from './continuous-search/search-state-manager';
import { NotificationRepository } from './continuous-search/notification-repository';
import { ContinuousSlotSearchOrchestrator } from './continuous-search/continuous-slot-search-orchestrator';
import { logger } from '@/lib/logging';

// Re-export types for external use
export type { SearchStopReason } from './continuous-search/search-state-manager';
export type { SearchConditionsResult } from './continuous-search/slot-search-executor';

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
  continueUntilFound?: boolean;
  minSlotsRequired?: number;
  maxConsecutiveEmptyCycles?: number;
}

// Re-export FoundSlot from slot-search-executor for backward compatibility
export type { FoundSlot } from './continuous-search/slot-search-executor';

export interface ContinuousSearchResult {
  success: boolean;
  foundSlots: FoundSlot[];
  totalSearches: number;
  searchTime: number;
  stoppedEarly: boolean;
  error?: string;
  runId: string;
  taskId?: string;
  consecutiveEmptyCycles?: number;
  minSlotsRequired?: number;
  continueUntilFound?: boolean;
}

/**
 * Основной сервис непрерывного поиска слотов
 * Использует композицию для делегирования ответственности отдельным компонентам
 */
export class ContinuousSlotSearchService {
  private taskRunRepository: TaskRunRepository;
  private tokenRepository: TokenRepository;
  private slotSearchExecutor: SlotSearchExecutor;
  private searchStateManager: SearchStateManager;
  private notificationRepository: NotificationRepository;
  private orchestrator: ContinuousSlotSearchOrchestrator;

  constructor() {
    this.taskRunRepository = new TaskRunRepository();
    this.tokenRepository = new TokenRepository();
    this.slotSearchExecutor = new SlotSearchExecutor();
    this.searchStateManager = new SearchStateManager();
    this.notificationRepository = new NotificationRepository();
    this.orchestrator = new ContinuousSlotSearchOrchestrator(
      this.taskRunRepository,
      this.tokenRepository,
      this.slotSearchExecutor,
      this.searchStateManager,
      this.notificationRepository
    );
  }

  /**
   * Начать непрерывный поиск слотов с защитой от повторных запусков
   */
  async startContinuousSearch(
    config: ContinuousSearchConfig
  ): Promise<ContinuousSearchResult> {
    // 🔒 ЗАЩИТА ОТ ПОВТОРНЫХ ЗАПУСКОВ
    // Проверяем, не завершена ли уже эта задача
    if (this.searchStateManager.isSearchCompleted() && 
        this.searchStateManager.getCurrentSearchId() === config.taskId) {
      const stopReason = this.searchStateManager.getStopReason();
      const errorMessage = this.searchStateManager.getErrorMessage();
      
      throw new Error(
        `Cannot restart completed search for task ${config.taskId}. ` +
        `Status: ${stopReason}. ` +
        `${errorMessage ? `Error: ${errorMessage}. ` : ''}` +
        `Use restartContinuousSearch() to manually restart.`
      );
    }

    // Проверяем, не идет ли уже поиск для этой задачи
    if (
      this.searchStateManager.isSearchInProgress() &&
      this.searchStateManager.getCurrentSearchId() === config.taskId
    ) {
      throw new Error('Search is already in progress for this task');
    }

    // Если идет другой поиск, ждем его завершения
    if (
      this.searchStateManager.isSearchInProgress() &&
      this.searchStateManager.getCurrentSearchId() !== config.taskId
    ) {
      await this.searchStateManager.waitForPreviousSearchToStop();
    }

    // Проверяем статус задачи в БД
    const task = await this.taskRunRepository.getTaskWithUser(config.taskId);
    if (!task) {
      throw new Error(`Task ${config.taskId} not found`);
    }

    // Проверяем, не завершена ли задача в БД
    if (task.status === 'SUCCESS' || task.status === 'COMPLETED') {
      throw new Error(
        `Task ${config.taskId} is already completed with status ${task.status}. ` +
        `Use restartContinuousSearch() to manually restart.`
      );
    }

    // Стартуем поиск
    this.searchStateManager.startSearch(config.taskId);

    try {
      // Делегируем выполнение поиска оркестратору
      const result = await this.orchestrator.executeSearch(config);
      return result;
    } finally {
      // Завершаем поиск
      this.searchStateManager.finishSearch();
    }
  }

  /**
   * Ручной перезапуск завершенной задачи (только для администраторов)
   */
  async restartContinuousSearch(
    config: ContinuousSearchConfig
  ): Promise<ContinuousSearchResult> {
    logger.warn(
      {
        taskId: config.taskId,
        userId: config.userId,
      },
      'Manual restart of completed search requested'
    );

    // Сбрасываем состояние в SearchStateManager
    this.searchStateManager.resetSearch();

    // Обновляем статус задачи в БД на RUNNING
    await this.taskRunRepository.updateTaskStatus(config.taskId, 'RUNNING', true);

    // Запускаем поиск заново
    return this.startContinuousSearch(config);
  }

  /**
   * Остановить текущий поиск с указанием причины
   */
  async stopSearch(reason: 'manual_stop' | 'error' = 'manual_stop'): Promise<void> {
    this.searchStateManager.stopSearch(reason, 'Stopped by user request');
    const currentSearchId = this.searchStateManager.getCurrentSearchId();
    if (currentSearchId) {
      await this.taskRunRepository.createRunLog(
        currentSearchId,
        'INFO',
        'Stop requested for continuous search'
      );
    }
  }

  /**
   * Проверить, идет ли поиск
   */
  isSearchInProgress(): boolean {
    return this.searchStateManager.isSearchInProgress();
  }

  /**
   * Получить ID текущего поиска
   */
  getCurrentSearchId(): string | null {
    return this.searchStateManager.getCurrentSearchId();
  }
}

export const continuousSlotSearchService = new ContinuousSlotSearchService();