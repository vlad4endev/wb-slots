/**
 * Причина остановки поиска
 */
export type SearchStopReason =
  | 'completed' // Успешно найдены нужные слоты
  | 'error' // Произошла критическая ошибка
  | 'unauthorized' // Ошибка авторизации (401)
  | 'forbidden' // Доступ запрещен (403)
  | 'server_error' // Серверная ошибка (500+)
  | 'timeout' // Превышено время выполнения
  | 'manual_stop' // Ручная остановка
  | 'max_cycles'; // Достигнуто максимальное количество циклов

/**
 * Менеджер состояния поиска
 * Отвечает только за управление состоянием (isSearching, stopRequested, currentSearchId)
 */
export class SearchStateManager {
  private isSearching = false;
  private stopRequested = false;
  private currentSearchId: string | null = null;
  private isCompleted = false;
  private isError = false;
  private stopReason: SearchStopReason | null = null;
  private errorMessage: string | null = null;

  /**
   * Начать новый поиск
   */
  startSearch(taskId: string): void {
    if (this.isSearching && this.currentSearchId === taskId) {
      throw new Error('Search is already in progress for this task');
    }

    if (this.isCompleted && this.currentSearchId === taskId) {
      throw new Error(
        `Search for task ${taskId} is already completed. Reason: ${this.stopReason}`
      );
    }

    // Если идет другой поиск, останавливаем его
    if (this.isSearching && this.currentSearchId !== taskId) {
      this.stopSearch('manual_stop', 'Starting new search');
    }

    this.isSearching = true;
    this.stopRequested = false;
    this.isCompleted = false;
    this.isError = false;
    this.stopReason = null;
    this.errorMessage = null;
    this.currentSearchId = taskId;
  }

  /**
   * Остановить текущий поиск с указанием причины
   */
  stopSearch(reason: SearchStopReason, errorMessage?: string): void {
    if (!this.isSearching && !this.isCompleted) {
      return;
    }

    this.stopRequested = true;
    this.stopReason = reason;
    this.errorMessage = errorMessage || null;

    // Помечаем флаги в зависимости от причины остановки
    if (reason === 'completed') {
      this.isCompleted = true;
      this.isError = false;
    } else if (
      reason === 'error' ||
      reason === 'unauthorized' ||
      reason === 'forbidden' ||
      reason === 'server_error'
    ) {
      this.isError = true;
      this.isCompleted = false;
    } else {
      this.isCompleted = true;
      this.isError = false;
    }
  }

  /**
   * Завершить поиск (только для успешного завершения)
   */
  finishSearch(): void {
    this.isSearching = false;
    // НЕ сбрасываем currentSearchId, isCompleted, isError - они нужны для проверки повторных запусков
  }

  /**
   * Полный сброс состояния (для возможности повторного запуска)
   */
  resetSearch(): void {
    this.isSearching = false;
    this.currentSearchId = null;
    this.stopRequested = false;
    this.isCompleted = false;
    this.isError = false;
    this.stopReason = null;
    this.errorMessage = null;
  }

  /**
   * Проверить, идет ли поиск
   */
  isSearchInProgress(): boolean {
    return this.isSearching;
  }

  /**
   * Проверить, завершен ли поиск
   */
  isSearchCompleted(): boolean {
    return this.isCompleted;
  }

  /**
   * Проверить, произошла ли ошибка
   */
  hasError(): boolean {
    return this.isError;
  }

  /**
   * Проверить, запрошена ли остановка
   */
  isStopRequested(): boolean {
    return this.stopRequested;
  }

  /**
   * Получить причину остановки
   */
  getStopReason(): SearchStopReason | null {
    return this.stopReason;
  }

  /**
   * Получить сообщение об ошибке
   */
  getErrorMessage(): string | null {
    return this.errorMessage;
  }

  /**
   * Получить ID текущего поиска
   */
  getCurrentSearchId(): string | null {
    return this.currentSearchId;
  }

  /**
   * Ожидать завершения предыдущего поиска (если есть)
   */
  async waitForPreviousSearchToStop(timeout: number = 1000): Promise<void> {
    if (this.isSearching) {
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
  }
}

