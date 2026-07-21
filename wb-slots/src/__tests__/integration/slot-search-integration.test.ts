// ===== INTEGRATION TESTS FOR SLOT SEARCH =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RefactoredSlotSearchService } from '../../lib/services/refactored/slot-search-service';
import { RefactoredAutoBookingService } from '../../lib/services/refactored/auto-booking-service';

// ===== MOCK SETUP =====
const mockPrisma = {
  run: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  runLog: {
    create: vi.fn(),
  },
  userToken: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  task: {
    findUnique: vi.fn(),
  },
  wBSession: {
    findFirst: vi.fn(),
  },
};

const mockWBClient = {
  searchAvailableSlots: vi.fn(),
  getCoefficients: vi.fn(),
};

const mockTelegramService = {
  sendNotification: vi.fn(),
};

const mockBrowser = {
  newPage: vi.fn(),
  close: vi.fn(),
};

const mockPage = {
  goto: vi.fn(),
  setCookie: vi.fn(),
  evaluate: vi.fn(),
  screenshot: vi.fn(),
  close: vi.fn(),
  evaluateOnNewDocument: vi.fn(),
  setViewport: vi.fn(),
  setExtraHTTPHeaders: vi.fn(),
};

// Mock all dependencies
vi.mock('../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../lib/wb-client', () => ({
  WBClientFactory: {
    createSuppliesClient: vi.fn(() => mockWBClient),
  },
}));

vi.mock('../../lib/encryption', () => ({
  decrypt: vi.fn(),
}));

vi.mock('../../lib/services/telegram-service', () => ({
  TelegramService: vi.fn(() => mockTelegramService),
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// ===== TEST DATA =====
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTask = {
  id: 'task-456',
  userId: 'user-123',
  name: 'Integration Test Task',
  enabled: true,
  filters: {
    warehouseIds: [1, 2, 3],
    boxTypeIds: [2, 5],
    coefficientMin: 0,
    coefficientMax: 10,
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31',
    isSortingCenter: false,
    allowUnload: true,
  },
  autoBook: false,
  autoBookSupplyId: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserToken = {
  id: 'token-123',
  userId: 'user-123',
  category: 'SUPPLIES',
  tokenEncrypted: 'encrypted-token',
  isActive: true,
  lastUsedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockWBSession = {
  id: 'session-123',
  userId: 'user-123',
  sessionId: 'wb-session-789',
  cookies: {
    encrypted: 'encrypted-cookie-data',
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRawSlots = [
  {
    warehouseID: 1,
    warehouseName: 'Склад 1',
    date: '2024-01-15',
    timeSlot: '10:00-12:00',
    coefficient: 1.5,
    boxTypes: [2, 5],
  },
  {
    warehouseID: 2,
    warehouseName: 'Склад 2',
    date: '2024-01-16',
    timeSlot: '14:00-16:00',
    coefficient: 2.0,
    boxTypes: [2],
  },
  {
    warehouseID: 3,
    warehouseName: 'Склад 3',
    date: '2024-01-17',
    timeSlot: '09:00-11:00',
    coefficient: 0.8,
    boxTypes: [5],
  },
];

// ===== TEST SUITE =====
describe('Slot Search Integration Tests', () => {
  let slotSearchService: RefactoredSlotSearchService;
  let autoBookingService: RefactoredAutoBookingService;

  beforeEach(() => {
    slotSearchService = new RefactoredSlotSearchService();
    autoBookingService = new RefactoredAutoBookingService();
    
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockPrisma.run.create.mockResolvedValue({ id: 'run-123' });
    mockPrisma.run.update.mockResolvedValue({});
    mockPrisma.runLog.create.mockResolvedValue({});
    mockPrisma.userToken.findFirst.mockResolvedValue(mockUserToken);
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    mockPrisma.wBSession.findFirst.mockResolvedValue(mockWBSession);
    
    require('../../lib/encryption').decrypt.mockReturnValue('decrypted-token');
    mockWBClient.searchAvailableSlots.mockResolvedValue(mockRawSlots);
    
    // Mock puppeteer
    const mockPuppeteer = require('puppeteer').default;
    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.evaluate.mockResolvedValue({
      csrfToken: 'csrf-123',
      sessionId: 'session-123',
      xSuppId: 'supplier-123',
      authToken: 'auth-123',
      userId: 'user-123',
    });
    mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Slot Search Flow', () => {
    it('should successfully search for slots and send notification', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'Integration Test Task',
      };

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.foundSlots).toHaveLength(3);
      expect(result.totalChecked).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.stoppedEarly).toBe(false);
      expect(result.searchTime).toBeGreaterThan(0);

      // Verify database interactions
      expect(mockPrisma.run.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-456',
          userId: 'user-123',
          status: 'RUNNING',
          startedAt: expect.any(Date),
        },
      });

      expect(mockPrisma.run.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          status: 'SUCCESS',
          finishedAt: expect.any(Date),
          summary: expect.any(String),
        },
      });

      // Verify notification was sent
      expect(mockTelegramService.sendNotification).toHaveBeenCalledWith(
        'user-123',
        expect.stringContaining('Найдены слоты')
      );
    });

    it('should handle auto-booking when enabled', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: true,
        autoBookSupplyId: 'supply-123',
        taskName: 'Auto-booking Test Task',
      };

      // Mock auto-booking service
      const mockAutoBookingService = {
        startBooking: vi.fn().mockResolvedValue({
          success: true,
          bookingId: 'booking-123',
        }),
      };

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.foundSlots).toHaveLength(3);
      expect(mockTelegramService.sendNotification).toHaveBeenCalled();
    });

    it('should stop early when stopOnFirstFound is true', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: true,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'Stop Early Test Task',
      };

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.stoppedEarly).toBe(true);
      expect(result.foundSlots).toHaveLength(3);
    });

    it('should handle no slots found scenario', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'No Slots Test Task',
      };

      mockWBClient.searchAvailableSlots.mockResolvedValue([]);

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.foundSlots).toHaveLength(0);
      expect(result.totalChecked).toBe(0);
      expect(mockTelegramService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle WB API rate limit errors', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'Rate Limit Test Task',
      };

      const rateLimitError = new Error('429 Too Many Requests');
      mockWBClient.searchAvailableSlots.mockRejectedValue(rateLimitError);

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.errors).toContain('429 Too Many Requests');
      expect(result.stoppedEarly).toBe(true);
      expect(result.foundSlots).toHaveLength(0);
    });

    it('should handle token decryption errors', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'Token Error Test Task',
      };

      require('../../lib/encryption').decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.errors).toContain('Decryption failed');
      expect(result.stoppedEarly).toBe(true);
    });

    it('should handle database connection errors', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'Database Error Test Task',
      };

      mockPrisma.run.create.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.errors).toContain('Database connection failed');
      expect(result.stoppedEarly).toBe(true);
    });
  });

  describe('Auto-booking Integration', () => {
    it('should successfully book slots when auto-booking is enabled', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: true,
        autoBookSupplyId: 'supply-123',
        taskName: 'Auto-booking Integration Test',
      };

      // Mock successful booking
      mockPage.evaluate.mockResolvedValue({
        success: true,
        data: { bookingId: 'booking-123' },
      });

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.foundSlots).toHaveLength(3);
      expect(mockTelegramService.sendNotification).toHaveBeenCalled();
    });

    it('should handle auto-booking failures gracefully', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: true,
        autoBookSupplyId: 'supply-123',
        taskName: 'Auto-booking Failure Test',
      };

      // Mock booking failure
      mockPage.evaluate.mockResolvedValue({
        success: false,
        status: 400,
        data: { error: 'Booking failed' },
      });

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.foundSlots).toHaveLength(3);
      expect(mockTelegramService.sendNotification).toHaveBeenCalled();
    });
  });

  describe('Performance Integration', () => {
    it('should complete search within reasonable time', async () => {
      // Arrange
      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: [1, 2, 3],
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'Performance Test Task',
      };

      const startTime = Date.now();

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.searchTime).toBeLessThan(1000); // Should complete within 1 second
      expect(executionTime).toBeLessThan(2000); // Actual execution should be under 2 seconds
    });

    it('should handle large number of slots efficiently', async () => {
      // Arrange
      const largeSlotSet = Array.from({ length: 100 }, (_, i) => ({
        warehouseID: (i % 10) + 1,
        warehouseName: `Склад ${(i % 10) + 1}`,
        date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
        timeSlot: `${i % 12 + 8}:00-${i % 12 + 10}:00`,
        coefficient: Math.random() * 10,
        boxTypes: [2, 5],
      }));

      mockWBClient.searchAvailableSlots.mockResolvedValue(largeSlotSet);

      const config = {
        userId: 'user-123',
        taskId: 'task-456',
        warehouseIds: Array.from({ length: 10 }, (_, i) => i + 1),
        boxTypeIds: [2, 5],
        coefficientMin: 0,
        coefficientMax: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        stopOnFirstFound: false,
        isSortingCenter: false,
        autoBook: false,
        autoBookSupplyId: undefined,
        taskName: 'Large Dataset Test',
      };

      // Act
      const result = await slotSearchService.searchSlots(config);

      // Assert
      expect(result.foundSlots).toHaveLength(100);
      expect(result.totalChecked).toBe(100);
      expect(result.searchTime).toBeLessThan(5000); // Should handle 100 slots efficiently
    });
  });

  describe('Concurrent Search Integration', () => {
    it('should handle multiple concurrent searches', async () => {
      // Arrange
      const configs = [
        {
          userId: 'user-123',
          taskId: 'task-456',
          warehouseIds: [1, 2],
          boxTypeIds: [2, 5],
          coefficientMin: 0,
          coefficientMax: 5,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-15',
          stopOnFirstFound: false,
          isSortingCenter: false,
          autoBook: false,
          autoBookSupplyId: undefined,
          taskName: 'Concurrent Test 1',
        },
        {
          userId: 'user-123',
          taskId: 'task-789',
          warehouseIds: [3, 4],
          boxTypeIds: [2, 5],
          coefficientMin: 0,
          coefficientMax: 5,
          dateFrom: '2024-01-16',
          dateTo: '2024-01-31',
          stopOnFirstFound: false,
          isSortingCenter: false,
          autoBook: false,
          autoBookSupplyId: undefined,
          taskName: 'Concurrent Test 2',
        },
      ];

      // Act
      const results = await Promise.all(
        configs.map(config => slotSearchService.searchSlots(config))
      );

      // Assert
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.foundSlots).toHaveLength(3);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});
