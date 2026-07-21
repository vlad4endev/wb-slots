// ===== UNIT TESTS FOR UNIFIED SERVICES =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  UnifiedAutoBookingService,
  UnifiedNotificationService,
  UnifiedSlotSearchService
} from '../../lib/services/unified';
import { serviceRegistry, serviceFactory } from '../../lib/services/core';

// ===== MOCKS =====

const mockPrisma = {
  wBSession: {
    findFirst: vi.fn(),
  },
  userSettings: {
    findFirst: vi.fn(),
  },
  run: {
    create: vi.fn(),
    update: vi.fn(),
  },
  runLog: {
    create: vi.fn(),
  },
  userToken: {
    findFirst: vi.fn(),
  },
  notificationTemplate: {
    findFirst: vi.fn(),
  },
};

const mockWBClient = {
  searchAvailableSlots: vi.fn(),
};

const mockTelegramService = {
  sendNotification: vi.fn(),
};

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../lib/encryption', () => ({
  decrypt: vi.fn(),
}));

vi.mock('../../lib/wb-client', () => ({
  WBClientFactory: {
    createSuppliesClient: vi.fn(() => mockWBClient),
  },
}));

vi.mock('../../lib/services/telegram-service', () => ({
  TelegramService: vi.fn(() => mockTelegramService),
}));

vi.mock('../../lib/services/bot-settings.service', () => ({
  botSettingsService: {
    getTelegramBotToken: vi.fn(),
    setTelegramBotToken: vi.fn(),
  },
}));

// ===== TEST SUITE =====

describe('Unified Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockPrisma.wBSession.findFirst.mockResolvedValue({
      id: 'session-123',
      userId: 'user-456',
      cookies: { encrypted: 'encrypted-data' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    mockPrisma.userSettings.findFirst.mockResolvedValue({
      userId: 'user-456',
      category: 'NOTIFICATION',
      settings: {
        telegram: {
          enabled: true,
          chatId: 'chat-123'
        }
      }
    });
    
    mockPrisma.userToken.findFirst.mockResolvedValue({
      id: 'token-123',
      userId: 'user-456',
      category: 'SUPPLIES',
      tokenEncrypted: 'encrypted-token',
      isActive: true,
    });
    
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue('decrypted-token');
    
    mockWBClient.searchAvailableSlots.mockResolvedValue([
      {
        warehouseID: 1,
        warehouseName: 'Склад 1',
        date: '2024-01-15',
        timeSlot: '10:00-12:00',
        coefficient: 1.5,
        boxTypes: [2, 5],
      }
    ]);
    
    mockTelegramService.sendNotification.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('UnifiedAutoBookingService', () => {
    let service: UnifiedAutoBookingService;

    beforeEach(async () => {
      service = new UnifiedAutoBookingService();
      await service.initialize();
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should create and initialize service', () => {
      expect(service).toBeDefined();
      expect(service.name).toBe('UnifiedAutoBookingService');
      expect(service.isRunning()).toBe(true);
    });

    it('should have correct default configuration', () => {
      const config = service.getConfig();
      expect(config.enableAntibot).toBe(true);
      expect(config.enableHumanBehavior).toBe(true);
      expect(config.enableScreenshots).toBe(true);
    });

    it('should provide metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('uptime');
    });

    it('should provide health status', () => {
      const health = service.getHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('lastCheck');
      expect(health).toHaveProperty('uptime');
    });

    it('should have retry configuration', () => {
      const retryConfig = service.getRetryConfig();
      expect(retryConfig).toHaveProperty('maxAttempts');
      expect(retryConfig).toHaveProperty('initialDelay');
      expect(retryConfig).toHaveProperty('maxDelay');
      expect(retryConfig).toHaveProperty('backoffMultiplier');
      expect(retryConfig).toHaveProperty('retryableErrors');
    });

    it('should track booking history', () => {
      const history = service.getBookingHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should not be booking initially', () => {
      expect(service.isBookingInProgress()).toBe(false);
    });

    it('should validate configuration', () => {
      const validConfig = {
        enableAntibot: true,
        enableHumanBehavior: true,
        enableScreenshots: true,
        screenshotDir: '/tmp/screenshots'
      };
      
      expect(service.validateConfig(validConfig)).toBe(true);
      
      const invalidConfig = {
        enableAntibot: true,
        // Missing required fields
      };
      
      expect(service.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('UnifiedNotificationService', () => {
    let service: UnifiedNotificationService;

    beforeEach(async () => {
      service = new UnifiedNotificationService();
      await service.initialize();
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should create and initialize service', () => {
      expect(service).toBeDefined();
      expect(service.name).toBe('UnifiedNotificationService');
      expect(service.isRunning()).toBe(true);
    });

    it('should have correct default configuration', () => {
      const config = service.getConfig();
      expect(config.enableTelegram).toBe(true);
      expect(config.enableEmail).toBe(false);
      expect(config.enableWebhook).toBe(false);
      expect(config.defaultRetryAttempts).toBe(3);
      expect(config.maxMessageLength).toBe(4096);
    });

    it('should provide metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('uptime');
    });

    it('should provide health status', () => {
      const health = service.getHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('lastCheck');
      expect(health).toHaveProperty('uptime');
    });

    it('should track notification history', () => {
      const history = service.getNotificationHistory('user-456');
      expect(Array.isArray(history)).toBe(true);
    });

    it('should validate configuration', () => {
      const validConfig = {
        enableTelegram: true,
        defaultRetryAttempts: 3,
        retryDelay: 1000,
        maxMessageLength: 4096
      };
      
      expect(service.validateConfig(validConfig)).toBe(true);
      
      const invalidConfig = {
        enableTelegram: true,
        // Missing required fields
      };
      
      expect(service.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('UnifiedSlotSearchService', () => {
    let service: UnifiedSlotSearchService;

    beforeEach(async () => {
      service = new UnifiedSlotSearchService();
      await service.initialize();
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should create and initialize service', () => {
      expect(service).toBeDefined();
      expect(service.name).toBe('UnifiedSlotSearchService');
      expect(service.isRunning()).toBe(true);
    });

    it('should have correct default configuration', () => {
      const config = service.getConfig();
      expect(config.enableAutoBooking).toBe(false);
      expect(config.enableNotifications).toBe(true);
      expect(config.maxSearchCycles).toBe(100);
      expect(config.searchDelay).toBe(10000);
      expect(config.maxExecutionTime).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it('should provide metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('uptime');
    });

    it('should provide health status', () => {
      const health = service.getHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('lastCheck');
      expect(health).toHaveProperty('uptime');
    });

    it('should track search history', () => {
      const history = service.getSearchHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should not be searching initially', () => {
      expect(service.isSearchInProgress()).toBe(false);
    });

    it('should validate configuration', () => {
      const validConfig = {
        maxSearchCycles: 100,
        searchDelay: 10000,
        maxExecutionTime: 86400000
      };
      
      expect(service.validateConfig(validConfig)).toBe(true);
      
      const invalidConfig = {
        maxSearchCycles: 100,
        // Missing required fields
      };
      
      expect(service.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('Service Registry', () => {
    beforeEach(() => {
      serviceRegistry.clear();
    });

    it('should register and retrieve services', async () => {
      const service = new UnifiedAutoBookingService();
      serviceRegistry.register(service);
      
      const retrieved = serviceRegistry.get('UnifiedAutoBookingService');
      expect(retrieved).toBe(service);
    });

    it('should provide registry status', async () => {
      const service1 = new UnifiedAutoBookingService();
      const service2 = new UnifiedNotificationService();
      
      serviceRegistry.register(service1);
      serviceRegistry.register(service2);
      
      const status = serviceRegistry.getRegistryStatus();
      expect(status.totalServices).toBe(2);
      expect(status.runningServices).toBe(0); // Services not started
      expect(status.healthyServices).toBe(0);
    });

    it('should support bulk operations', async () => {
      const services = await serviceRegistry.createAndStartMultipleServices([
        { type: 'UnifiedAutoBookingService' },
        { type: 'UnifiedNotificationService' }
      ]);
      
      expect(services).toHaveLength(2);
      
      const status = serviceRegistry.getRegistryStatus();
      expect(status.totalServices).toBe(2);
    });
  });

  describe('Service Factory', () => {
    it('should create services by type', async () => {
      const service = await serviceFactory.createService<UnifiedAutoBookingService>('UnifiedAutoBookingService');
      expect(service).toBeInstanceOf(UnifiedAutoBookingService);
    });

    it('should create and start services', async () => {
      const service = await serviceFactory.createAndStartService<UnifiedAutoBookingService>('UnifiedAutoBookingService');
      expect(service).toBeInstanceOf(UnifiedAutoBookingService);
      expect(service.isRunning()).toBe(true);
    });

    it('should provide supported types', () => {
      const types = serviceFactory.getSupportedTypes();
      expect(types).toContain('UnifiedAutoBookingService');
      expect(types).toContain('UnifiedNotificationService');
      expect(types).toContain('UnifiedSlotSearchService');
    });

    it('should handle creation errors', async () => {
      await expect(serviceFactory.createService('NonExistentService'))
        .rejects.toThrow('No factory registered for service type: NonExistentService');
    });
  });

  describe('Error Handling', () => {
    let service: UnifiedAutoBookingService;

    beforeEach(async () => {
      service = new UnifiedAutoBookingService();
      await service.initialize();
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should handle retry operations', async () => {
      let attemptCount = 0;
      
      const result = await service.retry(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('NETWORK_ERROR');
        }
        return 'Success!';
      }, 'test_operation');
      
      expect(result).toBe('Success!');
      expect(attemptCount).toBe(3);
    });

    it('should respect max retry attempts', async () => {
      let attemptCount = 0;
      
      await expect(service.retry(async () => {
        attemptCount++;
        throw new Error('NETWORK_ERROR');
      }, 'test_operation')).rejects.toThrow('NETWORK_ERROR');
      
      expect(attemptCount).toBe(3); // Default max attempts
    });

    it('should not retry non-retryable errors', async () => {
      let attemptCount = 0;
      
      await expect(service.retry(async () => {
        attemptCount++;
        throw new Error('CRITICAL_ERROR');
      }, 'test_operation')).rejects.toThrow('CRITICAL_ERROR');
      
      expect(attemptCount).toBe(1); // Should not retry
    });
  });

  describe('Configuration Management', () => {
    let service: UnifiedAutoBookingService;

    beforeEach(async () => {
      service = new UnifiedAutoBookingService();
      await service.initialize();
      await service.start();
    });

    afterEach(async () => {
      await service.stop();
    });

    it('should update configuration', async () => {
      const newConfig = {
        enableAntibot: false,
        enableHumanBehavior: false
      };
      
      await service.updateConfig(newConfig);
      
      const config = service.getConfig();
      expect(config.enableAntibot).toBe(false);
      expect(config.enableHumanBehavior).toBe(false);
    });

    it('should validate configuration updates', async () => {
      const invalidConfig = {
        enableAntibot: 'invalid' // Should be boolean
      };
      
      await expect(service.updateConfig(invalidConfig))
        .rejects.toThrow('Invalid configuration provided');
    });

    it('should update retry configuration', () => {
      const newRetryConfig = {
        maxAttempts: 5,
        initialDelay: 3000
      };
      
      service.updateRetryConfig(newRetryConfig);
      
      const retryConfig = service.getRetryConfig();
      expect(retryConfig.maxAttempts).toBe(5);
      expect(retryConfig.initialDelay).toBe(3000);
    });
  });
});
