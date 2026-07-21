// ========================================
// Cached WB API Client
// ========================================

import { WBSuppliesClient } from './supplies-client';
import { WBMarketplaceClient } from './marketplace-client';
import { WBApiCacheService, SlotSearchCacheKey, WarehouseCacheKey, SupplyCacheKey } from '../cache/wb-api-cache';
import { Logger } from '../logging/logger';
import { TokenCategory } from '@prisma/client';

export interface CachedWBClientConfig {
  enableCache: boolean;
  cacheConfig: {
    slotsTTL: number;
    warehousesTTL: number;
    suppliesTTL: number;
    statisticsTTL: number;
    autoRefresh: boolean;
    refreshThreshold: number;
  };
  retryConfig: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}

export class CachedWBClient {
  private suppliesClient: WBSuppliesClient;
  private marketplaceClient: WBMarketplaceClient;
  private cache: WBApiCacheService;
  private logger: Logger;
  private config: CachedWBClientConfig;

  constructor(
    token: string,
    category: TokenCategory,
    cache: WBApiCacheService,
    config: Partial<CachedWBClientConfig> = {}
  ) {
    this.cache = cache;
    this.logger = new Logger('INFO', { service: 'CachedWBClient' });
    this.config = {
      enableCache: true,
      cacheConfig: {
        slotsTTL: 60,
        warehousesTTL: 3600,
        suppliesTTL: 300,
        statisticsTTL: 1800,
        autoRefresh: true,
        refreshThreshold: 10
      },
      retryConfig: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      ...config
    };

    // Initialize appropriate client based on token category
    if (category === 'SUPPLIES') {
      this.suppliesClient = new WBSuppliesClient(token);
    } else if (category === 'MARKETPLACE') {
      this.marketplaceClient = new WBMarketplaceClient(token);
    } else {
      throw new Error(`Unsupported token category: ${category}`);
    }
  }

  /**
   * Get available slots with caching
   */
  async getAvailableSlots(
    warehouseIds: number[],
    boxTypeIds: number[],
    dateFrom: string,
    dateTo: string,
    coefficientMin: number,
    coefficientMax: number,
    isSortingCenter: boolean = false,
    userId: string
  ): Promise<any[]> {
    const cacheKey: SlotSearchCacheKey = {
      warehouseIds,
      boxTypeIds,
      dateFrom,
      dateTo,
      coefficientMin,
      coefficientMax,
      isSortingCenter
    };

    if (this.config.enableCache) {
      return this.cache.cacheSlotSearch(
        cacheKey,
        [],
        () => this.fetchSlotsWithRetry(cacheKey)
      );
    }

    return this.fetchSlotsWithRetry(cacheKey);
  }

  /**
   * Get warehouses with caching
   */
  async getWarehouses(userId: string, tokenCategory: string): Promise<any[]> {
    const cacheKey: WarehouseCacheKey = {
      userId,
      tokenCategory
    };

    if (this.config.enableCache) {
      return this.cache.cacheWarehouses(
        cacheKey,
        [],
        () => this.fetchWarehousesWithRetry()
      );
    }

    return this.fetchWarehousesWithRetry();
  }

  /**
   * Get supplies with caching
   */
  async getSupplies(
    userId: string,
    tokenCategory: string,
    supplyId?: string
  ): Promise<any[]> {
    const cacheKey: SupplyCacheKey = {
      userId,
      tokenCategory,
      supplyId
    };

    if (this.config.enableCache) {
      return this.cache.cacheSupplies(
        cacheKey,
        [],
        () => this.fetchSuppliesWithRetry(supplyId)
      );
    }

    return this.fetchSuppliesWithRetry(supplyId);
  }

  /**
   * Get statistics with caching
   */
  async getStatistics(
    dateFrom: string,
    dateTo: string,
    userId: string
  ): Promise<any> {
    const cacheKey = `stats:${userId}:${dateFrom}:${dateTo}`;

    if (this.config.enableCache) {
      return this.cache.cacheStatistics(
        cacheKey,
        null,
        () => this.fetchStatisticsWithRetry(dateFrom, dateTo)
      );
    }

    return this.fetchStatisticsWithRetry(dateFrom, dateTo);
  }

  /**
   * Invalidate cache for specific user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    this.logger.info('Invalidating cache for user', { userId });
    
    // Invalidate all caches that might contain user data
    await Promise.all([
      this.cache.invalidateSlotsCache(),
      this.cache.invalidateWarehousesCache(),
      this.cache.invalidateSuppliesCache(),
      this.cache.invalidateStatisticsCache()
    ]);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getCacheStats();
  }

  /**
   * Health check
   */
  async healthCheck() {
    return this.cache.healthCheck();
  }

  // Private methods

  private async fetchSlotsWithRetry(cacheKey: SlotSearchCacheKey): Promise<any[]> {
    return this.retryOperation(async () => {
      if (this.suppliesClient) {
        return this.suppliesClient.getAvailableSlots(
          cacheKey.warehouseIds,
          cacheKey.boxTypeIds,
          cacheKey.dateFrom,
          cacheKey.dateTo,
          cacheKey.coefficientMin,
          cacheKey.coefficientMax,
          cacheKey.isSortingCenter
        );
      } else {
        throw new Error('Supplies client not available');
      }
    }, 'fetchSlots');
  }

  private async fetchWarehousesWithRetry(): Promise<any[]> {
    return this.retryOperation(async () => {
      if (this.suppliesClient) {
        return this.suppliesClient.getWarehouses();
      } else if (this.marketplaceClient) {
        return this.marketplaceClient.getWarehouses();
      } else {
        throw new Error('No client available');
      }
    }, 'fetchWarehouses');
  }

  private async fetchSuppliesWithRetry(supplyId?: string): Promise<any[]> {
    return this.retryOperation(async () => {
      if (this.suppliesClient) {
        return supplyId 
          ? this.suppliesClient.getSupplyById(supplyId)
          : this.suppliesClient.getSupplies();
      } else {
        throw new Error('Supplies client not available');
      }
    }, 'fetchSupplies');
  }

  private async fetchStatisticsWithRetry(dateFrom: string, dateTo: string): Promise<any> {
    return this.retryOperation(async () => {
      if (this.suppliesClient) {
        return this.suppliesClient.getStatistics(dateFrom, dateTo);
      } else {
        throw new Error('Supplies client not available');
      }
    }, 'fetchStatistics');
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const { maxAttempts, initialDelay, maxDelay, backoffMultiplier } = this.config.retryConfig;
    
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(`Attempting ${operationName}`, { attempt, maxAttempts });
        const result = await operation();
        this.logger.debug(`${operationName} succeeded`, { attempt });
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${operationName} failed`, { 
          attempt, 
          maxAttempts, 
          error: error.message 
        });

        if (attempt === maxAttempts) {
          this.logger.error(`${operationName} failed after all retries`, { 
            maxAttempts, 
            error: error.message 
          });
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelay
        );

        this.logger.debug(`Retrying ${operationName} in ${delay}ms`, { attempt });
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
export function createCachedWBClient(
  token: string,
  category: TokenCategory,
  cache: WBApiCacheService,
  config?: Partial<CachedWBClientConfig>
): CachedWBClient {
  return new CachedWBClient(token, category, cache, config);
}
