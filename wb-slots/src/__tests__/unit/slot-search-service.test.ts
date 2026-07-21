// ===== UNIT TESTS FOR SLOT SEARCH SERVICE =====

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// ===== MOCKS =====
const mockPrisma = {
  run: {
    create: vi.fn(),
    update: vi.fn(),
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
};

const mockWBClient = {
  searchAvailableSlots: vi.fn(),
  getCoefficients: vi.fn(),
};

const mockTelegramService = {
  sendNotification: vi.fn(),
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

vi.mock('./auto-booking-service', () => ({
  AutoBookingService: vi.fn(() => ({
    startBooking: vi.fn(),
  })),
}));

import { RefactoredSlotSearchService, SlotSearchError, TokenError, RateLimitError } from '../../lib/services/refactored/slot-search-service';

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
  },
  {
    warehouseID: 2,
    warehouseName: 'Склад 2',
    date: '2024-01-16',
    timeSlot: '14:00-16:00',
    coefficient: 2.0,
    boxTypes: [2],
  },
];

const mockFoundSlots = [
  {
    warehouseId: 1,
    warehouseName: 'Склад 1',
    date: '2024-01-15',
    timeSlot: '10:00-12:00',
    coefficient: 1.5,
    isAvailable: true,
    boxTypes: [2, 5],
    foundAt: expect.any(Date),
  },
  {
    warehouseId: 2,
    warehouseName: 'Склад 2',
    date: '2024-01-16',
    timeSlot: '14:00-16:00',
    coefficient: 2.0,
    isAvailable: true,
    boxTypes: [2],
    foundAt: expect.any(Date),
  },
];

// ===== TEST SUITE =====
describe('RefactoredSlotSearchService', () => {
  let service: RefactoredSlotSearchService;

  beforeEach(() => {
    service = new RefactoredSlotSearchService();
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

  describe('searchSlots', () => {
    it('should successfully search for slots', async () => {
      // Act
      const result = await service.searchSlots(mockSlotSearchConfig);

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
    });

    it('should create run record when runId not provided', async () => {
      // Arrange
      const configWithoutRunId = { ...mockSlotSearchConfig, runId: undefined };

      // Act
      await service.searchSlots(configWithoutRunId);

      // Assert
      expect(mockPrisma.run.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-456',
          userId: 'user-123',
          status: 'RUNNING',
          startedAt: expect.any(Date),
        },
      });
    });

    it('should use existing runId when provided', async () => {
      // Act
      await service.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(mockPrisma.run.create).not.toHaveBeenCalled();
    });

    it('should throw error when no supplies token found', async () => {
      // Arrange
      mockPrisma.userToken.findFirst.mockResolvedValue(null);
      mockPrisma.userToken.findMany.mockResolvedValue([
        { category: 'STATISTICS', isActive: true },
        { category: 'MARKETPLACE', isActive: false },
      ]);

      // Act & Assert
      await expect(service.searchSlots(mockSlotSearchConfig))
        .rejects
        .toThrow(TokenError);
    });

    it('should handle rate limit errors', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.message = '429 Too Many Requests';
      mockWBClient.searchAvailableSlots.mockRejectedValue(rateLimitError);

      // Act
      const result = await service.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(result.errors).toContain('Rate limit exceeded');
      expect(result.stoppedEarly).toBe(true);
    });

    it('should stop early when stopOnFirstFound is true', async () => {
      // Arrange
      const configWithStopEarly = { ...mockSlotSearchConfig, stopOnFirstFound: true };

      // Act
      const result = await service.searchSlots(configWithStopEarly);

      // Assert
      expect(result.stoppedEarly).toBe(true);
    });

    it('should handle auto-booking when enabled', async () => {
      // Arrange
      const configWithAutoBook = {
        ...mockSlotSearchConfig,
        autoBook: true,
        autoBookSupplyId: 'supply-123',
      };

      // Act
      await service.searchSlots(configWithAutoBook);

      // Assert
      // Auto-booking should be triggered (mocked)
      expect(mockTelegramService.sendNotification).toHaveBeenCalled();
    });

    it('should send notification when slots found', async () => {
      // Act
      await service.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(mockTelegramService.sendNotification).toHaveBeenCalledWith(
        'user-123',
        expect.stringContaining('Найдены слоты')
      );
    });

    it('should handle search errors gracefully', async () => {
      // Arrange
      mockWBClient.searchAvailableSlots.mockRejectedValue(new Error('Search failed'));

      // Act
      const result = await service.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(result.errors).toContain('Search failed');
      expect(result.stoppedEarly).toBe(true);
      expect(result.foundSlots).toHaveLength(0);
    });

    it('should update run status on success', async () => {
      // Act
      await service.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(mockPrisma.run.update).toHaveBeenCalledWith({
        where: { id: 'run-789' },
        data: {
          status: 'SUCCESS',
          finishedAt: expect.any(Date),
          summary: expect.any(String),
        },
      });
    });

    it('should update run status on failure', async () => {
      // Arrange
      mockWBClient.searchAvailableSlots.mockRejectedValue(new Error('Search failed'));

      // Act
      await service.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(mockPrisma.run.update).toHaveBeenCalledWith({
        where: { id: 'run-789' },
        data: {
          status: 'FAILED',
          finishedAt: expect.any(Date),
          summary: expect.any(String),
        },
      });
    });
  });

  describe('stopSearch', () => {
    it('should stop search and reset flags', async () => {
      // Arrange
      const searchPromise = service.searchSlots(mockSlotSearchConfig);
      
      // Act
      await service.stopSearch();
      await searchPromise;

      // Assert
      expect(service.isSearchInProgress()).toBe(false);
      expect(service.isStopRequested()).toBe(true);
    });
  });

  describe('isSearchInProgress', () => {
    it('should return false initially', () => {
      expect(service.isSearchInProgress()).toBe(false);
    });

    it('should return true during search', async () => {
      // Arrange
      let isSearchingDuringExecution = false;
      mockWBClient.searchAvailableSlots.mockImplementation(async () => {
        isSearchingDuringExecution = service.isSearchInProgress();
        return mockRawSlots;
      });

      // Act
      await service.searchSlots(mockSlotSearchConfig);

      // Assert
      expect(isSearchingDuringExecution).toBe(true);
    });
  });

  describe('isStopRequested', () => {
    it('should return false initially', () => {
      expect(service.isStopRequested()).toBe(false);
    });

    it('should return true after stop request', () => {
      // Act
      service.stopSearch();

      // Assert
      expect(service.isStopRequested()).toBe(true);
    });
  });
});

// ===== UTILITY CLASS TESTS =====
describe('RunManager', () => {
  let RunManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import the module
    const importedModule = await import('../../lib/services/refactored/slot-search-service');
    RunManager = importedModule.RunManager;
  });

  it('should create run record', async () => {
    // Arrange
    const mockRun = { id: 'run-123' };
    mockPrisma.run.create.mockResolvedValue(mockRun);

    // Act
    const result = await RunManager.createRun('task-123', 'user-456');

    // Assert
    expect(result).toBe('run-123');
    expect(mockPrisma.run.create).toHaveBeenCalledWith({
      data: {
        taskId: 'task-123',
        userId: 'user-456',
        status: 'RUNNING',
        startedAt: expect.any(Date),
      },
    });
  });

  it('should log message with metadata', async () => {
    // Arrange
    const runId = 'run-123';
    const level = 'INFO';
    const message = 'Test message';
    const meta = { test: 'data' };

    // Act
    await RunManager.logMessage(runId, level, message, meta);

    // Assert
    expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
      data: {
        runId,
        level,
        message,
        meta: JSON.stringify(meta),
      },
    });
  });

  it('should log message without metadata', async () => {
    // Arrange
    const runId = 'run-123';
    const level = 'ERROR';
    const message = 'Error message';

    // Act
    await RunManager.logMessage(runId, level, message);

    // Assert
    expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
      data: {
        runId,
        level,
        message,
        meta: undefined,
      },
    });
  });

  it('should update run status', async () => {
    // Arrange
    const runId = 'run-123';
    const status = 'SUCCESS';
    const summary = { foundSlots: 5 };

    // Act
    await RunManager.updateRunStatus(runId, status, summary);

    // Assert
    expect(mockPrisma.run.update).toHaveBeenCalledWith({
      where: { id: runId },
      data: {
        status,
        finishedAt: expect.any(Date),
        summary: JSON.stringify(summary),
      },
    });
  });
});

describe('TokenManager', () => {
  let TokenManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import the module
    const importedModule = await import('../../lib/services/refactored/slot-search-service');
    TokenManager = importedModule.TokenManager;
  });

  it('should get user WB token', async () => {
    // Arrange
    mockPrisma.userToken.findFirst.mockResolvedValue(mockUserToken);
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue('decrypted-token');

    // Act
    const result = await TokenManager.getUserWBToken('user-123');

    // Assert
    expect(result).toBe('decrypted-token');
    expect(mockPrisma.userToken.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-123',
        category: 'SUPPLIES',
        isActive: true,
      },
    });
  });

  it('should throw error when no token found', async () => {
    // Arrange
    mockPrisma.userToken.findFirst.mockResolvedValue(null);
    mockPrisma.userToken.findMany.mockResolvedValue([]);

    // Act & Assert
    await expect(TokenManager.getUserWBToken('user-123'))
      .rejects
      .toThrow(TokenError);
  });
});

describe('SlotProcessor', () => {
  let SlotProcessor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import the module
    const importedModule = await import('../../lib/services/refactored/slot-search-service');
    SlotProcessor = importedModule.SlotProcessor;
  });

  it('should process valid slots', () => {
    // Arrange
    const config = {
      warehouseIds: [1, 2],
      boxTypeIds: [2, 5],
      coefficientMin: 0,
      coefficientMax: 10,
    };

    // Act
    const result = SlotProcessor.processSlots(mockRawSlots, config);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      warehouseId: 1,
      warehouseName: 'Склад 1',
      coefficient: 1.5,
      isAvailable: true,
    }));
  });

  it('should filter out invalid slots', () => {
    // Arrange
    const config = {
      warehouseIds: [1], // Only warehouse 1
      boxTypeIds: [2, 5],
      coefficientMin: 0,
      coefficientMax: 1.0, // Only coefficients <= 1.0
    };

    // Act
    const result = SlotProcessor.processSlots(mockRawSlots, config);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].warehouseId).toBe(1);
  });

  it('should sort slots by coefficient', () => {
    // Arrange
    const config = {
      warehouseIds: [1, 2],
      boxTypeIds: [2, 5],
      coefficientMin: 0,
      coefficientMax: 10,
    };

    // Act
    const result = SlotProcessor.processSlots(mockRawSlots, config);

    // Assert
    expect(result[0].coefficient).toBeLessThanOrEqual(result[1].coefficient);
  });
});

// ===== INTEGRATION TESTS =====
describe('SlotSearchService Integration', () => {
  let service: RefactoredSlotSearchService;

  beforeEach(() => {
    service = new RefactoredSlotSearchService();
    vi.clearAllMocks();
  });

  it('should handle complete search flow', async () => {
    // Arrange
    mockPrisma.run.create.mockResolvedValue({ id: 'run-123' });
    mockPrisma.userToken.findFirst.mockResolvedValue(mockUserToken);
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue('decrypted-token');
    mockWBClient.searchAvailableSlots.mockResolvedValue(mockRawSlots);

    // Act
    const result = await service.searchSlots(mockSlotSearchConfig);

    // Assert
    expect(result.foundSlots).toHaveLength(2);
    expect(result.totalChecked).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.stoppedEarly).toBe(false);
    expect(mockTelegramService.sendNotification).toHaveBeenCalled();
  });

  it('should handle search with no slots found', async () => {
    // Arrange
    mockPrisma.run.create.mockResolvedValue({ id: 'run-123' });
    mockPrisma.userToken.findFirst.mockResolvedValue(mockUserToken);
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue('decrypted-token');
    mockWBClient.searchAvailableSlots.mockResolvedValue([]);

    // Act
    const result = await service.searchSlots(mockSlotSearchConfig);

    // Assert
    expect(result.foundSlots).toHaveLength(0);
    expect(result.totalChecked).toBe(0);
    expect(mockTelegramService.sendNotification).not.toHaveBeenCalled();
  });
});
