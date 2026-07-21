import { apiLogger, LogContext } from './enhanced-logger';
import { PaginationInfo } from './response-processor';

export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  defaultPage: number;
  enableAutoPagination: boolean;
  maxAutoPages: number;
}

export interface PaginationRequest {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: PaginationInfo;
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface AutoPaginationOptions {
  maxPages?: number;
  maxItems?: number;
  delayBetweenPages?: number;
  onPageComplete?: (page: number, data: any[]) => void;
  onComplete?: (allData: any[], totalPages: number) => void;
  onError?: (error: Error, page: number) => void;
}

export class PaginationManager {
  private static instance: PaginationManager;
  private config: PaginationConfig;

  constructor() {
    this.config = {
      defaultLimit: 20,
      maxLimit: 100,
      defaultPage: 1,
      enableAutoPagination: true,
      maxAutoPages: 10
    };
  }

  static getInstance(): PaginationManager {
    if (!PaginationManager.instance) {
      PaginationManager.instance = new PaginationManager();
    }
    return PaginationManager.instance;
  }

  /**
   * Настраивает параметры пагинации
   */
  configure(config: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Нормализует параметры пагинации запроса
   */
  normalizePaginationRequest(request: PaginationRequest): PaginationRequest {
    const normalized: PaginationRequest = {};

    // Нормализуем page
    if (request.page !== undefined) {
      normalized.page = Math.max(1, Math.floor(request.page));
    } else {
      normalized.page = this.config.defaultPage;
    }

    // Нормализуем limit
    if (request.limit !== undefined) {
      normalized.limit = Math.min(
        this.config.maxLimit,
        Math.max(1, Math.floor(request.limit))
      );
    } else {
      normalized.limit = this.config.defaultLimit;
    }

    // Вычисляем offset если не указан
    if (request.offset === undefined && normalized.page && normalized.limit) {
      normalized.offset = (normalized.page - 1) * normalized.limit;
    } else if (request.offset !== undefined) {
      normalized.offset = Math.max(0, Math.floor(request.offset));
    }

    // Копируем остальные параметры
    if (request.cursor) normalized.cursor = request.cursor;
    if (request.sortBy) normalized.sortBy = request.sortBy;
    if (request.sortOrder) normalized.sortOrder = request.sortOrder;

    return normalized;
  }

  /**
   * Создает информацию о пагинации для ответа
   */
  createPaginationInfo(
    request: PaginationRequest,
    totalItems: number,
    currentItems: number
  ): PaginationInfo {
    const page = request.page || this.config.defaultPage;
    const limit = request.limit || this.config.defaultLimit;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      page,
      limit,
      offset: request.offset || (page - 1) * limit,
      total: totalItems,
      hasMore: page < totalPages,
      nextPage: page < totalPages ? page + 1 : undefined,
      prevPage: page > 1 ? page - 1 : undefined
    };
  }

  /**
   * Создает параметры запроса для следующей страницы
   */
  createNextPageRequest(currentRequest: PaginationRequest, paginationInfo: PaginationInfo): PaginationRequest | null {
    if (!paginationInfo.hasMore) {
      return null;
    }

    return {
      ...currentRequest,
      page: paginationInfo.nextPage,
      offset: paginationInfo.nextPage ? (paginationInfo.nextPage - 1) * (paginationInfo.limit || this.config.defaultLimit) : undefined
    };
  }

  /**
   * Создает параметры запроса для предыдущей страницы
   */
  createPrevPageRequest(currentRequest: PaginationRequest, paginationInfo: PaginationInfo): PaginationRequest | null {
    if (!paginationInfo.prevPage) {
      return null;
    }

    return {
      ...currentRequest,
      page: paginationInfo.prevPage,
      offset: (paginationInfo.prevPage - 1) * (paginationInfo.limit || this.config.defaultLimit)
    };
  }

  /**
   * Автоматически получает все страницы данных
   */
  async autoPaginate<T>(
    fetchFunction: (request: PaginationRequest) => Promise<PaginationResult<T>>,
    initialRequest: PaginationRequest = {},
    options: AutoPaginationOptions = {},
    context: LogContext
  ): Promise<T[]> {
    if (!this.config.enableAutoPagination) {
      throw new Error('Auto pagination is disabled');
    }

    const {
      maxPages = this.config.maxAutoPages,
      maxItems = 1000,
      delayBetweenPages = 100,
      onPageComplete,
      onComplete,
      onError
    } = options;

    const allData: T[] = [];
    let currentRequest = this.normalizePaginationRequest(initialRequest);
    let currentPage = 1;
    let totalPages = 0;

    apiLogger.logPagination(context, {
      action: 'auto_pagination_start',
      maxPages,
      maxItems,
      initialRequest: currentRequest
    });

    try {
      while (currentPage <= maxPages && allData.length < maxItems) {
        apiLogger.logPagination(context, {
          action: 'fetching_page',
          page: currentPage,
          request: currentRequest
        });

        const result = await fetchFunction(currentRequest);
        
        if (!result.data || result.data.length === 0) {
          apiLogger.logPagination(context, {
            action: 'no_more_data',
            page: currentPage
          });
          break;
        }

        allData.push(...result.data);
        totalPages = currentPage;

        // Вызываем callback для завершенной страницы
        if (onPageComplete) {
          onPageComplete(currentPage, result.data);
        }

        apiLogger.logPagination(context, {
          action: 'page_completed',
          page: currentPage,
          itemsOnPage: result.data.length,
          totalItems: allData.length,
          hasMore: result.hasMore
        });

        // Проверяем, есть ли еще страницы
        if (!result.hasMore || !result.pagination?.hasMore) {
          apiLogger.logPagination(context, {
            action: 'no_more_pages',
            page: currentPage
          });
          break;
        }

        // Создаем запрос для следующей страницы
        const nextRequest = this.createNextPageRequest(currentRequest, result.pagination);
        if (!nextRequest) {
          break;
        }

        currentRequest = nextRequest;
        currentPage++;

        // Задержка между запросами
        if (delayBetweenPages > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenPages));
        }
      }

      apiLogger.logPagination(context, {
        action: 'auto_pagination_complete',
        totalPages,
        totalItems: allData.length,
        maxPagesReached: currentPage > maxPages,
        maxItemsReached: allData.length >= maxItems
      });

      // Вызываем callback для завершения
      if (onComplete) {
        onComplete(allData, totalPages);
      }

      return allData;

    } catch (error) {
      apiLogger.logError(context, {
        message: 'Auto pagination failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        page: currentPage,
        totalItems: allData.length
      });

      // Вызываем callback для ошибки
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'), currentPage);
      }

      throw error;
    }
  }

  /**
   * Создает URL с параметрами пагинации
   */
  createPaginationURL(baseURL: string, request: PaginationRequest): string {
    const url = new URL(baseURL);
    const params = url.searchParams;

    if (request.page) params.set('page', request.page.toString());
    if (request.limit) params.set('limit', request.limit.toString());
    if (request.offset) params.set('offset', request.offset.toString());
    if (request.cursor) params.set('cursor', request.cursor);
    if (request.sortBy) params.set('sortBy', request.sortBy);
    if (request.sortOrder) params.set('sortOrder', request.sortOrder);

    return url.toString();
  }

  /**
   * Парсит параметры пагинации из URL
   */
  parsePaginationFromURL(url: string): PaginationRequest {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const request: PaginationRequest = {};

    if (params.has('page')) {
      request.page = parseInt(params.get('page')!, 10);
    }
    if (params.has('limit')) {
      request.limit = parseInt(params.get('limit')!, 10);
    }
    if (params.has('offset')) {
      request.offset = parseInt(params.get('offset')!, 10);
    }
    if (params.has('cursor')) {
      request.cursor = params.get('cursor')!;
    }
    if (params.has('sortBy')) {
      request.sortBy = params.get('sortBy')!;
    }
    if (params.has('sortOrder')) {
      request.sortOrder = params.get('sortOrder') as 'asc' | 'desc';
    }

    return request;
  }

  /**
   * Валидирует параметры пагинации
   */
  validatePaginationRequest(request: PaginationRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (request.page !== undefined && (request.page < 1 || !Number.isInteger(request.page))) {
      errors.push('Page must be a positive integer');
    }

    if (request.limit !== undefined && (request.limit < 1 || request.limit > this.config.maxLimit || !Number.isInteger(request.limit))) {
      errors.push(`Limit must be an integer between 1 and ${this.config.maxLimit}`);
    }

    if (request.offset !== undefined && (request.offset < 0 || !Number.isInteger(request.offset))) {
      errors.push('Offset must be a non-negative integer');
    }

    if (request.sortOrder && !['asc', 'desc'].includes(request.sortOrder)) {
      errors.push('Sort order must be either "asc" or "desc"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Создает метаданные для пагинации
   */
  createPaginationMetadata(paginationInfo: PaginationInfo): Record<string, any> {
    return {
      pagination: {
        currentPage: paginationInfo.page,
        totalPages: paginationInfo.total ? Math.ceil(paginationInfo.total / (paginationInfo.limit || this.config.defaultLimit)) : undefined,
        totalItems: paginationInfo.total,
        itemsPerPage: paginationInfo.limit,
        hasNextPage: paginationInfo.hasMore,
        hasPrevPage: paginationInfo.page ? paginationInfo.page > 1 : false,
        nextPage: paginationInfo.nextPage,
        prevPage: paginationInfo.prevPage
      }
    };
  }
}

// Экспортируем singleton instance
export const paginationManager = PaginationManager.getInstance();
