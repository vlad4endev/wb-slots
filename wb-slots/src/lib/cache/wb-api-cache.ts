// ========================================
// WB API Cache Service
// ========================================

import { CacheService, CacheOptions } from './cache-service';
import { Logger } from '../logging/logger';

export interface WBApiCacheConfig {
  slotsTTL: number; // TTL for slots data
  warehousesTTL: number; // TTL for warehouses data
  suppliesTTL: number; // TTL for supplies data
  statisticsTTL: number; // TTL for statistics data
  autoRefresh: boolean; // Enable automatic refresh
  refreshThreshold: number; // Refresh when TTL < threshold (seconds)
}

export interface SlotSearchCacheKey {
  warehouseIds: number[];
  boxTypeIds: number[];
  dateFrom: string;
  dateTo: string;
  coefficientMin: number;
  coefficientMax: number;
  isSortingCenter: boolean;
}

export interface WarehouseCacheKey {
  userId: string;
  tokenCategory: string;
}

export interface SupplyCacheKey {
  userId: string;
  tokenCategory: string;
  supplyId?: string;
}

export class WBApiCacheService {
  private cache: CacheService;
  private logger: Logger;
  private config: WBApiCacheConfig;
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(cache: CacheService, config: Partial<WBApiCacheConfig> = {}) {
    this.cache = cache;
    this.logger = new Logger('INFO', { service: 'WBApiCacheService' });
    this.config = {
      slotsTTL: 60, // 1 minute for slots (frequently changing)
      warehousesTTL: 3600, // 1 hour for warehouses (rarely changing)
      suppliesTTL: 300, // 5 minutes for supplies
      statisticsTTL: 1800, // 30 minutes for statistics
      autoRefresh: true,
      refreshThreshold: 10, // Refresh when TTL < 10 seconds
      ...config
    };
  }

  /**
   * Cache slot search results
   */
  async cacheSlotSearch(
    key: SlotSearchCacheKey,
    data: any[],
    fetcher: () => Promise<any[]>
  ): Promise<any[]> {
    const cacheKey = this.buildSlotSearchKey(key);
    const options: CacheOptions = {
      ttl: this.config.slotsTTL,
      tags: ['slots', 'wb-api'],
      refresh: this.config.autoRefresh
    };

    if (this.config.autoRefresh) {
      this.setupAutoRefresh(cacheKey, fetcher, this.config.slotsTTL);
    }

    return this.cache.getOrSet(cacheKey, fetcher, options);
  }

  /**
   * Cache warehouses data
   */
  async cacheWarehouses(
    key: WarehouseCacheKey,
    data: any[],
    fetcher: () => Promise<any[]>
  ): Promise<any[]> {
    const cacheKey = this.buildWarehouseKey(key);
    const options: CacheOptions = {
      ttl: this.config.warehousesTTL,
      tags: ['warehouses', 'wb-api'],
      refresh: this.config.autoRefresh
    };

    if (this.config.autoRefresh) {
      this.setupAutoRefresh(cacheKey, fetcher, this.config.warehousesTTL);
    }

    return this.cache.getOrSet(cacheKey, fetcher, options);
  }

  /**
   * Cache supplies data
   */
  async cacheSupplies(
    key: SupplyCacheKey,
    data: any[],
    fetcher: () => Promise<any[]>
  ): Promise<any[]> {
    const cacheKey = this.buildSupplyKey(key);
    const options: CacheOptions = {
      ttl: this.config.suppliesTTL,
      tags: ['supplies', 'wb-api'],
      refresh: this.config.autoRefresh
    };

    if (this.config.autoRefresh) {
      this.setupAutoRefresh(cacheKey, fetcher, this.config.suppliesTTL);
    }

    return this.cache.getOrSet(cacheKey, fetcher, options);
  }

  /**
   * Cache statistics data
   */
  async cacheStatistics(
    key: string,
    data: any,
    fetcher: () => Promise<any>
  ): Promise<any> {
    const cacheKey = this.buildStatisticsKey(key);
    const options: CacheOptions = {
      ttl: this.config.statisticsTTL,
      tags: ['statistics', 'wb-api'],
      refresh: this.config.autoRefresh
    };

    if (this.config.autoRefresh) {
      this.setupAutoRefresh(cacheKey, fetcher, this.config.statisticsTTL);
    }

    return this.cache.getOrSet(cacheKey, fetcher, options);
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    this.logger.info('Invalidating cache by tags', { tags });
    return this.cache.deleteByTags(tags);
  }

  /**
   * Invalidate slots cache
   */
  async invalidateSlotsCache(): Promise<number> {
    return this.invalidateByTags(['slots']);
  }

  /**
   * Invalidate warehouses cache
   */
  async invalidateWarehousesCache(): Promise<number> {
    return this.invalidateByTags(['warehouses']);
  }

  /**
   * Invalidate supplies cache
   */
  async invalidateSuppliesCache(): Promise<number> {
    return this.invalidateByTags(['supplies']);
  }

  /**
   * Invalidate statistics cache
   */
  async invalidateStatisticsCache(): Promise<number> {
    return this.invalidateByTags(['statistics']);
  }

  /**
   * Invalidate all WB API cache
   */
  async invalidateAllWBCache(): Promise<number> {
    return this.invalidateByTags(['wb-api']);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear all refresh timers
   */
  clearRefreshTimers(): void {
    for (const [key, timer] of this.refreshTimers) {
      clearTimeout(timer);
      this.refreshTimers.delete(key);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    return this.cache.healthCheck();
  }

  // Private methods

  private buildSlotSearchKey(key: SlotSearchCacheKey): string {
    const { warehouseIds, boxTypeIds, dateFrom, dateTo, coefficientMin, coefficientMax, isSortingCenter } = key;
    return `slots:${warehouseIds.join(',')}:${boxTypeIds.join(',')}:${dateFrom}:${dateTo}:${coefficientMin}:${coefficientMax}:${isSortingCenter}`;
  }

  private buildWarehouseKey(key: WarehouseCacheKey): string {
    const { userId, tokenCategory } = key;
    return `warehouses:${userId}:${tokenCategory}`;
  }

  private buildSupplyKey(key: SupplyCacheKey): string {
    const { userId, tokenCategory, supplyId } = key;
    return `supplies:${userId}:${tokenCategory}:${supplyId || 'all'}`;
  }

  private buildStatisticsKey(key: string): string {
    return `statistics:${key}`;
  }

  private setupAutoRefresh(
    cacheKey: string,
    fetcher: () => Promise<any>,
    ttl: number
  ): void {
    // Clear existing timer if any
    const existingTimer = this.refreshTimers.get(cacheKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate refresh time (when TTL is close to expiration)
    const refreshTime = (ttl - this.config.refreshThreshold) * 1000;
    
    if (refreshTime > 0) {
      const timer = setTimeout(async () => {
        try {
          this.logger.info('Auto-refreshing cache', { cacheKey });
          await fetcher();
          this.logger.info('Cache auto-refresh completed', { cacheKey });
        } catch (error) {
          this.logger.error('Cache auto-refresh failed', { 
            cacheKey, 
            error: error.message 
          });
        } finally {
          this.refreshTimers.delete(cacheKey);
        }
      }, refreshTime);

      this.refreshTimers.set(cacheKey, timer);
    }
  }
}

// Singleton instance
let wbApiCacheInstance: WBApiCacheService | null = null;

export function getWBApiCacheService(
  cache?: CacheService, 
  config?: Partial<WBApiCacheConfig>
): WBApiCacheService {
  if (!wbApiCacheInstance) {
    if (!cache) {
      throw new Error('CacheService instance is required for first initialization');
    }
    wbApiCacheInstance = new WBApiCacheService(cache, config);
  }
  return wbApiCacheInstance;
}
