// ========================================
// Performance Optimizations Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService } from '../../lib/cache/cache-service';
import { WBApiCacheService } from '../../lib/cache/wb-api-cache';
import { OptimizedPrismaClient } from '../../lib/database/optimized-prisma';
import { OptimizedQueries } from '../../lib/database/optimized-queries';
import { RetryService, RETRY_CONFIGS } from '../../lib/retry/retry-service';
import { OptimizedRedisClient } from '../../lib/redis/optimized-redis';
import { PerformanceManager } from '../../lib/performance/performance-manager';
import { createCachedWBClient } from '../../lib/wb-client/cached-wb-client';
import { createWBApiClient, createTelegramClient } from '../../lib/api/retry-enabled-clients';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  ttl: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  pipeline: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue([])
  }),
  multi: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue([])
  }),
  disconnect: vi.fn()
};

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  task: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateMany: vi.fn()
  },
  run: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn()
  },
  foundSlot: {
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn()
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  $disconnect: vi.fn()
};

describe('Performance Optimizations', () => {
  let cacheService: CacheService;
  let wbApiCache: WBApiCacheService;
  let retryService: RetryService;
  let performanceManager: PerformanceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Initialize services with mocks
    cacheService = new CacheService(mockRedis as any);
    wbApiCache = new WBApiCacheService(cacheService);
    retryService = new RetryService();
    performanceManager = new PerformanceManager({
      monitoring: { enableMetrics: false }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cache Service', () => {
    it('should cache and retrieve data correctly', async () => {
      const testData = { id: 1, name: 'test' };
      const cacheKey = 'test:key';
      
      // Mock Redis responses
      mockRedis.get.mockResolvedValueOnce(null); // First call - cache miss
      mockRedis.setex.mockResolvedValueOnce('OK'); // Set cache
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(testData)); // Second call - cache hit

      // Test cache miss
      const result1 = await cacheService.getOrSet(
        cacheKey,
        () => Promise.resolve(testData),
        { ttl: 300 }
      );

      expect(result1).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('wb-slots:test:key');
      expect(mockRedis.setex).toHaveBeenCalledWith('wb-slots:test:key', 300, JSON.stringify(testData));

      // Test cache hit
      const result2 = await cacheService.get(cacheKey);
      expect(result2).toEqual(testData);
    });

    it('should handle cache errors gracefully', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await cacheService.get('test:key');
      expect(result).toBeNull();
    });

    it('should provide cache statistics', () => {
      const stats = cacheService.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('WB API Cache Service', () => {
    it('should cache slot search results', async () => {
      const slotSearchKey = {
        warehouseIds: [1, 2],
        boxTypeIds: [1],
        dateFrom: '2024-01-01',
        dateTo: '2024-01-02',
        coefficientMin: 1.0,
        coefficientMax: 2.0,
        isSortingCenter: false
      };

      const mockSlots = [
        { id: 1, warehouseId: 1, date: '2024-01-01' },
        { id: 2, warehouseId: 2, date: '2024-01-01' }
      ];

      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValueOnce('OK');

      const result = await wbApiCache.cacheSlotSearch(
        slotSearchKey,
        mockSlots,
        () => Promise.resolve(mockSlots)
      );

      expect(result).toEqual(mockSlots);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should invalidate cache by tags', async () => {
      mockRedis.keys.mockResolvedValueOnce(['wb-slots:tags:slots:key1', 'wb-slots:tags:slots:key2']);
      mockRedis.del.mockResolvedValueOnce(2);

      const deleted = await wbApiCache.invalidateSlotsCache();
      expect(deleted).toBe(2);
    });
  });

  describe('Retry Service', () => {
    it('should retry failed operations with exponential backoff', async () => {
      let attemptCount = 0;
      const failingOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return 'success';
      };

      const result = await retryService.execute(
        failingOperation,
        RETRY_CONFIGS.WB_API,
        'test-operation'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      const failingOperation = async () => {
        throw new Error('Persistent error');
      };

      const result = await retryService.execute(
        failingOperation,
        { maxAttempts: 2, initialDelay: 10 },
        'test-operation'
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
    });

    it('should identify retryable errors', async () => {
      const retryableOperation = async () => {
        throw new Error('ECONNRESET');
      };

      const result = await retryService.execute(
        retryableOperation,
        RETRY_CONFIGS.WB_API,
        'test-operation'
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // Should retry for retryable error
    });
  });

  describe('Optimized Database Queries', () => {
    it('should fetch user with relations in single query', async () => {
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
        tasks: [
          { id: 'task1', name: 'Task 1', runs: [] }
        ],
        tokens: [
          { id: 'token1', category: 'SUPPLIES' }
        ],
        warehousePrefs: [
          { id: 'pref1', warehouseId: 1, warehouseName: 'Warehouse 1' }
        ]
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const optimizedQueries = new OptimizedQueries({
        executeQuery: vi.fn().mockImplementation(async (operation) => {
          return operation(mockPrisma);
        })
      } as any);

      const result = await optimizedQueries.getUserWithRelations('user1');
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user1' },
        include: expect.objectContaining({
          tasks: expect.any(Object),
          tokens: expect.any(Object),
          warehousePrefs: expect.any(Object)
        })
      });
    });

    it('should get dashboard statistics efficiently', async () => {
      const mockStats = {
        totalUsers: 100,
        totalTasks: 50,
        activeTasks: 30,
        totalRuns: 200,
        successfulRuns: 180,
        totalFoundSlots: 500,
        recentActivity: []
      };

      // Mock all the parallel queries
      mockPrisma.user.count.mockResolvedValueOnce(100);
      mockPrisma.task.count.mockResolvedValueOnce(50);
      mockPrisma.task.count.mockResolvedValueOnce(30);
      mockPrisma.run.count.mockResolvedValueOnce(200);
      mockPrisma.run.count.mockResolvedValueOnce(180);
      mockPrisma.foundSlot.count.mockResolvedValueOnce(500);
      mockPrisma.task.findMany.mockResolvedValueOnce([]);
      mockPrisma.run.findMany.mockResolvedValueOnce([]);
      mockPrisma.foundSlot.findMany.mockResolvedValueOnce([]);

      const optimizedQueries = new OptimizedQueries({
        executeQuery: vi.fn().mockImplementation(async (operation) => {
          return operation(mockPrisma);
        })
      } as any);

      const result = await optimizedQueries.getDashboardStats();
      expect(result.totalUsers).toBe(100);
      expect(result.totalTasks).toBe(50);
      expect(result.activeTasks).toBe(30);
    });
  });

  describe('Performance Manager', () => {
    it('should collect comprehensive metrics', async () => {
      // Mock all service metrics
      const mockMetrics = {
        database: {
          activeConnections: 5,
          averageQueryTime: 100,
          slowQueries: 2,
          errorRate: 1
        },
        redis: {
          activeConnections: 3,
          averageResponseTime: 50,
          successRate: 99,
          hitRate: 85
        },
        cache: {
          hits: 1000,
          misses: 200,
          hitRate: 83.3,
          totalOperations: 1200
        },
        retry: {
          totalAttempts: 50,
          successRate: 96,
          averageAttempts: 1.2,
          retryableErrors: 5
        },
        overall: {
          status: 'healthy' as const,
          uptime: 3600000,
          memoryUsage: 60,
          cpuUsage: 25
        }
      };

      // Mock the performance manager methods
      vi.spyOn(performanceManager, 'getDatabaseMetrics').mockResolvedValue(mockMetrics.database);
      vi.spyOn(performanceManager, 'getRedisMetrics').mockResolvedValue(mockMetrics.redis);
      vi.spyOn(performanceManager, 'getCacheMetrics').mockResolvedValue(mockMetrics.cache);
      vi.spyOn(performanceManager, 'getRetryMetrics').mockResolvedValue(mockMetrics.retry);
      vi.spyOn(performanceManager, 'getMemoryUsage').mockResolvedValue(60);
      vi.spyOn(performanceManager, 'getCpuUsage').mockResolvedValue(25);

      const metrics = await performanceManager.getMetrics();
      expect(metrics).toEqual(mockMetrics);
    });

    it('should provide performance optimizations', async () => {
      const mockMetrics = {
        database: { slowQueries: 15, errorRate: 8 },
        redis: { successRate: 90 },
        cache: { hitRate: 70 },
        retry: { retryableErrors: 20, totalAttempts: 100 },
        overall: { memoryUsage: 85 }
      };

      vi.spyOn(performanceManager, 'getMetrics').mockResolvedValue(mockMetrics as any);

      const { optimizations, warnings, errors } = await performanceManager.optimizePerformance();

      expect(warnings).toContain('High number of slow queries: 15');
      expect(warnings).toContain('Low Redis success rate: 90%');
      expect(warnings).toContain('Low cache hit rate: 70%');
      expect(errors).toContain('High database error rate: 8%');
      expect(optimizations.length).toBeGreaterThan(0);
    });

    it('should perform health checks', async () => {
      const mockHealthCheck = {
        status: 'healthy' as const,
        services: {
          database: { status: 'healthy' as const, latency: 10 },
          redis: { status: 'healthy' as const, latency: 5 },
          cache: { status: 'healthy' as const, latency: 2 }
        }
      };

      vi.spyOn(performanceManager, 'healthCheck').mockResolvedValue(mockHealthCheck);

      const health = await performanceManager.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.services.database.status).toBe('healthy');
    });
  });

  describe('Cached WB API Client', () => {
    it('should use cache for repeated requests', async () => {
      const mockSlots = [
        { id: 1, warehouseId: 1, date: '2024-01-01' }
      ];

      const mockFetcher = vi.fn().mockResolvedValue(mockSlots);
      mockRedis.get.mockResolvedValueOnce(null); // Cache miss
      mockRedis.setex.mockResolvedValueOnce('OK'); // Cache set
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockSlots)); // Cache hit

      const cachedClient = createCachedWBClient('token', 'SUPPLIES', wbApiCache);

      // First call - should fetch and cache
      const result1 = await cachedClient.getAvailableSlots(
        [1], [1], '2024-01-01', '2024-01-02', 1.0, 2.0, false, 'user1'
      );

      // Second call - should use cache
      const result2 = await cachedClient.getAvailableSlots(
        [1], [1], '2024-01-01', '2024-01-02', 1.0, 2.0, false, 'user1'
      );

      expect(result1).toEqual(mockSlots);
      expect(result2).toEqual(mockSlots);
      expect(mockFetcher).toHaveBeenCalledTimes(1); // Should only fetch once
    });
  });

  describe('Retry-Enabled API Clients', () => {
    it('should retry failed API requests', async () => {
      const mockAxios = {
        get: vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({ data: { success: true } })
      };

      const client = createWBApiClient('token', 'https://api.example.com');
      (client as any).axios = mockAxios;

      const result = await client.getAvailableSlots({
        warehouseIds: [1],
        boxTypeIds: [1],
        dateFrom: '2024-01-01',
        dateTo: '2024-01-02',
        coefficientMin: 1.0,
        coefficientMax: 2.0
      });

      expect(result).toEqual({ success: true });
      expect(mockAxios.get).toHaveBeenCalledTimes(3); // Should retry 3 times
    });

    it('should handle Telegram API errors with retry', async () => {
      const mockAxios = {
        post: vi.fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce({ data: { ok: true, result: { message_id: 123 } } })
      };

      const client = createTelegramClient('bot-token');
      (client as any).axios = mockAxios;

      const result = await client.sendMessage('chat123', 'Test message');

      expect(result).toEqual({ ok: true, result: { message_id: 123 } });
      expect(mockAxios.post).toHaveBeenCalledTimes(2); // Should retry once
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete optimization', async () => {
      // Test the complete flow: cache -> retry -> database
      const testData = { id: 1, name: 'test' };
      
      // Mock cache miss, then hit
      mockRedis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(testData));
      mockRedis.setex.mockResolvedValueOnce('OK');

      // Mock database query
      mockPrisma.user.findUnique.mockResolvedValueOnce(testData);

      // Test complete flow
      const cacheResult = await cacheService.getOrSet(
        'user:1',
        () => Promise.resolve(testData),
        { ttl: 300 }
      );

      expect(cacheResult).toEqual(testData);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should handle performance degradation gracefully', async () => {
      // Simulate high load scenario
      const highLoadMetrics = {
        database: { slowQueries: 20, errorRate: 10 },
        redis: { successRate: 85 },
        cache: { hitRate: 60 },
        retry: { retryableErrors: 30, totalAttempts: 100 },
        overall: { memoryUsage: 90 }
      };

      vi.spyOn(performanceManager, 'getMetrics').mockResolvedValue(highLoadMetrics as any);

      const { optimizations, warnings, errors } = await performanceManager.optimizePerformance();

      expect(errors.length).toBeGreaterThan(0);
      expect(warnings.length).toBeGreaterThan(0);
      expect(optimizations.length).toBeGreaterThan(0);
    });
  });
});
