// ===== INTEGRATION TESTS FOR SLOT SEARCH =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ===== MOCKS =====
const mockPrisma = {
  run: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
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
  notifySlotsFound: vi.fn(),
  notifyBookingError: vi.fn(),
};

const mockAutoBookingService = {
  startBooking: vi.fn(),
};

// Mock dependencies
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

vi.mock('../../lib/services/auto-booking-service', () => ({
  AutoBookingService: vi.fn(() => mockAutoBookingService),
}));

import { RefactoredSlotSearchService } from '../../lib/services/refactored/slot-search-service';
import { ContinuousSlotSearchService } from '../../lib/services/continuous-slot-search-service';

// ===== TEST DATA =====
const mockSlotSearchConfig = {
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
  taskName: 'Test Task',
  runId: 'run-789',
};

const mockContinuousSearchConfig = {
  taskId: 'task-456',
  userId: 'user-123',
  runId: 'run-789',
  warehouseIds: [1, 2, 3],
  boxTypeIds: [2, 5],
  coefficientMin: 0,
  coefficientMax: 10,
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  isSortingCenter: false,
  maxSearchCycles: 10,
  searchDelay: 1000,
  maxExecutionTime: 30000,
  autoBook: false,
  autoBookSupplyId: undefined,
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

const mockTask = {
  id: 'task-456',
  userId: 'user-123',
  name: 'Test Task',
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

const mockRawSlots = [
  {
    warehouseID: 1,
    warehouseName: 'Склад 1',
    date: '2024-01-15',
    timeSlot: '10:00-12:00',
    coefficient: 1.5,
    boxTypes: [2, 5],
    allowUnload: true,
  },
  {
    warehouseID: 2,
    warehouseName: 'Склад 2',
    date: '2024-01-16',
    timeSlot: '14:00-16:00',
    coefficient: 2.0,
    boxTypes: [2],
    allowUnload: true,
  },
];

// ===== TEST SUITE =====
describe('Slot Search Integration', () => {
  let slotSearchService: RefactoredSlotSearchService;
  let continuousSearchService: ContinuousSlotSearchService;

  beforeEach(() => {
    slotSearchService = new RefactoredSlotSearchService();
    continuousSearchService = new ContinuousSlotSearchService();
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockPrisma.run.create.mockResolvedValue({ id: 'run-789' });
    mockPrisma.run.update.mockResolvedValue({});
    mockPrisma.runLog.create.mockResolvedValue({});
    mockPrisma.userToken.findFirst.mockResolvedValue(mockUserToken);
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue('decrypted-token');
    mockWBClient.searchAvailableSlots.mockResolvedValue(mockRawSlots);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RefactoredSlotSearchService Integration', () => {
    it('should handle complete search flow', async () => {
      // Act
      const result = await slotSearchService.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(result).toEqual({
        foundSlots: expect.arrayContaining([
          expect.objectContaining({
            warehouseId: 1,
            warehouseName: 'Склад 1',
            coefficient: 1.5,
          }),
          expect.objectContaining({
            warehouseId: 2,
            warehouseName: 'Склад 2',
            coefficient: 2.0,
          }),
        ]),
        totalChecked: 2,
        searchTime: expect.any(Number),
        errors: [],
        stoppedEarly: false,
      });
      expect(mockPrisma.run.create).toHaveBeenCalled();
      expect(mockPrisma.userToken.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          category: 'SUPPLIES',
          isActive: true,
        },
      });
      expect(mockWBClient.searchAvailableSlots).toHaveBeenCalled();
    });

    it('should handle search with no slots found', async () => {
      // Arrange
      mockWBClient.searchAvailableSlots.mockResolvedValue([]);

      // Act
      const result = await slotSearchService.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(result.foundSlots).toHaveLength(0);
      expect(result.totalChecked).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.stoppedEarly).toBe(false);
    });

    it('should handle search errors gracefully', async () => {
      // Arrange
      mockWBClient.searchAvailableSlots.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await slotSearchService.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(result.foundSlots).toHaveLength(0);
      expect(result.errors).toContain('API Error');
      expect(result.stoppedEarly).toBe(true);
    });

    it('should handle auto-booking when enabled', async () => {
      // Arrange
      const configWithAutoBook = {
        ...mockSlotSearchConfig,
        autoBook: true,
        autoBookSupplyId: 'supply-123',
      };
      mockAutoBookingService.startBooking.mockResolvedValue({
        success: true,
        bookingId: 'booking-123',
      });

      // Act
      const result = await slotSearchService.searchSlots(configWithAutoBook);

      // Assert
      expect(result.foundSlots).toHaveLength(2);
      expect(mockAutoBookingService.startBooking).toHaveBeenCalled();
    });

    it('should handle auto-booking failure', async () => {
      // Arrange
      const configWithAutoBook = {
        ...mockSlotSearchConfig,
        autoBook: true,
        autoBookSupplyId: 'supply-123',
      };
      mockAutoBookingService.startBooking.mockResolvedValue({
        success: false,
        error: 'Booking failed',
      });

      // Act
      const result = await slotSearchService.searchSlots(configWithAutoBook);

      // Assert
      expect(result.foundSlots).toHaveLength(2);
      expect(mockAutoBookingService.startBooking).toHaveBeenCalled();
      expect(mockTelegramService.notifyBookingError).toHaveBeenCalled();
    });

    it('should stop search when stopOnFirstFound is true', async () => {
      // Arrange
      const configWithStopEarly = {
        ...mockSlotSearchConfig,
        stopOnFirstFound: true,
      };

      // Act
      const result = await slotSearchService.searchSlots(configWithStopEarly);

      // Assert
      expect(result.stoppedEarly).toBe(true);
      expect(result.foundSlots).toHaveLength(2);
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.message = '429 Too Many Requests';
      mockWBClient.searchAvailableSlots.mockRejectedValue(rateLimitError);

      // Act
      const result = await slotSearchService.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(result.errors).toContain('Rate limit exceeded');
      expect(result.stoppedEarly).toBe(true);
    });

    it('should handle token errors', async () => {
      // Arrange
      mockPrisma.userToken.findFirst.mockResolvedValue(null);
      mockPrisma.userToken.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(slotSearchService.searchSlots(mockSlotSearchConfig))
        .rejects
        .toThrow('No supplies token found');
    });
  });

  describe('ContinuousSlotSearchService Integration', () => {
    it('should handle continuous search flow', async () => {
      // Act
      const result = await continuousSearchService.startContinuousSearch(mockContinuousSearchConfig);

      // Assert
      expect(result).toEqual({
        success: true,
        foundSlots: expect.arrayContaining([
          expect.objectContaining({
            warehouseId: 1,
            warehouseName: 'Склад 1',
            coefficient: 1.5,
          }),
          expect.objectContaining({
            warehouseId: 2,
            warehouseName: 'Склад 2',
            coefficient: 2.0,
          }),
        ]),
        totalSearches: expect.any(Number),
        searchTime: expect.any(Number),
        stoppedEarly: false,
        runId: 'run-789',
        taskId: 'task-456',
      });
      expect(mockPrisma.run.create).toHaveBeenCalled();
      expect(mockPrisma.userToken.findFirst).toHaveBeenCalled();
      expect(mockWBClient.searchAvailableSlots).toHaveBeenCalled();
    });

    it('should handle continuous search with no slots found', async () => {
      // Arrange
      mockWBClient.searchAvailableSlots.mockResolvedValue([]);

      // Act
      const result = await continuousSearchService.startContinuousSearch(mockContinuousSearchConfig);

      // Assert
      expect(result.success).toBe(true);
      expect(result.foundSlots).toHaveLength(0);
      expect(result.totalSearches).toBeGreaterThan(0);
    });

    it('should handle continuous search errors', async () => {
      // Arrange
      mockWBClient.searchAvailableSlots.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await continuousSearchService.startContinuousSearch(mockContinuousSearchConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.foundSlots).toHaveLength(0);
      expect(result.error).toBe('API Error');
    });

    it('should handle continuous search with auto-booking', async () => {
      // Arrange
      const configWithAutoBook = {
        ...mockContinuousSearchConfig,
        autoBook: true,
        autoBookSupplyId: 'supply-123',
      };
      mockAutoBookingService.startBooking.mockResolvedValue({
        success: true,
        bookingId: 'booking-123',
      });

      // Act
      const result = await continuousSearchService.startContinuousSearch(configWithAutoBook);

      // Assert
      expect(result.success).toBe(true);
      expect(result.foundSlots).toHaveLength(2);
      expect(mockAutoBookingService.startBooking).toHaveBeenCalled();
    });

    it('should stop continuous search when requested', async () => {
      // Arrange
      const searchPromise = continuousSearchService.startContinuousSearch(mockContinuousSearchConfig);
      
      // Act
      await continuousSearchService.stopSearch();
      const result = await searchPromise;

      // Assert
      expect(result.stoppedEarly).toBe(true);
    });

    it('should handle continuous search timeout', async () => {
      // Arrange
      const configWithShortTimeout = {
        ...mockContinuousSearchConfig,
        maxExecutionTime: 1000, // 1 second
        searchDelay: 500, // 500ms delay
      };
      mockWBClient.searchAvailableSlots.mockResolvedValue([]);

      // Act
      const result = await continuousSearchService.startContinuousSearch(configWithShortTimeout);

      // Assert
      expect(result.success).toBe(true);
      expect(result.foundSlots).toHaveLength(0);
      expect(result.totalSearches).toBeGreaterThan(0);
    });
  });

  describe('Cross-Service Integration', () => {
    it('should handle slot search with continuous search', async () => {
      // Arrange
      const slotSearchResult = await slotSearchService.searchSlots(mockSlotSearchConfig);
      const continuousSearchResult = await continuousSearchService.startContinuousSearch(mockContinuousSearchConfig);

      // Assert
      expect(slotSearchResult.foundSlots).toHaveLength(2);
      expect(continuousSearchResult.foundSlots).toHaveLength(2);
      expect(slotSearchResult.foundSlots[0]).toEqual(
        expect.objectContaining({
          warehouseId: continuousSearchResult.foundSlots[0].warehouseId,
          coefficient: continuousSearchResult.foundSlots[0].coefficient,
        })
      );
    });

    it('should handle error propagation between services', async () => {
      // Arrange
      mockWBClient.searchAvailableSlots.mockRejectedValue(new Error('API Error'));

      // Act
      const slotSearchResult = await slotSearchService.searchSlots(mockSlotSearchConfig);
      const continuousSearchResult = await continuousSearchService.startContinuousSearch(mockContinuousSearchConfig);

      // Assert
      expect(slotSearchResult.errors).toContain('API Error');
      expect(continuousSearchResult.success).toBe(false);
      expect(continuousSearchResult.error).toBe('API Error');
    });

    it('should handle database errors consistently', async () => {
      // Arrange
      mockPrisma.run.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(slotSearchService.searchSlots(mockSlotSearchConfig))
        .rejects
        .toThrow('Database error');
      
      await expect(continuousSearchService.startContinuousSearch(mockContinuousSearchConfig))
        .rejects
        .toThrow('Database error');
    });
  });
});
