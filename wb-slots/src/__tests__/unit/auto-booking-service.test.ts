// ===== UNIT TESTS FOR AUTO BOOKING SERVICE =====

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { RefactoredAutoBookingService, BookingError, SessionError, BrowserError } from '../../lib/services/refactored/auto-booking-service';
import { PrismaClient } from '@prisma/client';

// ===== MOCKS =====
const mockPrisma = {
  wBSession: {
    findFirst: vi.fn(),
  },
} as unknown as PrismaClient;

const mockBrowser = {
  newPage: vi.fn(),
  close: vi.fn(),
} as any;

const mockPage = {
  goto: vi.fn(),
  setCookie: vi.fn(),
  evaluate: vi.fn(),
  screenshot: vi.fn(),
  close: vi.fn(),
  evaluateOnNewDocument: vi.fn(),
  setViewport: vi.fn(),
  setExtraHTTPHeaders: vi.fn(),
} as any;

// Mock puppeteer
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock encryption
vi.mock('../../lib/encryption', () => ({
  decrypt: vi.fn(),
}));

// Mock TelegramService
vi.mock('../../lib/services/telegram-service', () => ({
  TelegramService: vi.fn().mockImplementation(() => ({
    sendNotification: vi.fn(),
  })),
}));

// ===== TEST DATA =====
const mockBookingConfig = {
  taskId: 'task-123',
  userId: 'user-456',
  runId: 'run-789',
  slotId: 'slot-101',
  supplyId: 'supply-202',
  warehouseId: 1,
  boxTypeId: 2,
  date: '2024-01-15',
  coefficient: 1.5,
  prisma: mockPrisma,
};

const mockWBSession = {
  id: 'session-123',
  userId: 'user-456',
  sessionId: 'wb-session-789',
  cookies: {
    encrypted: 'encrypted-cookie-data',
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDecryptedSessionData = {
  cookies: {
    'session-id': 'wb-session-789',
    'csrf-token': 'csrf-token-123',
  },
  localStorage: {
    'user-id': 'user-456',
    'auth-token': 'auth-token-123',
  },
  sessionStorage: {},
};

const mockTokens = {
  csrfToken: 'csrf-token-123',
  sessionId: 'wb-session-789',
  xSuppId: 'supplier-123',
  authToken: 'auth-token-123',
  userId: 'user-456',
};

// ===== TEST SUITE =====
describe('RefactoredAutoBookingService', () => {
  let service: RefactoredAutoBookingService;
  let mockPuppeteer: any;

  beforeEach(() => {
    service = new RefactoredAutoBookingService();
    const puppeteer = await import('puppeteer');
    mockPuppeteer = puppeteer.default;
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.evaluate.mockResolvedValue(mockTokens);
    mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));
    mockPrisma.wBSession.findFirst.mockResolvedValue(mockWBSession);
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue(JSON.stringify(mockDecryptedSessionData));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startBooking', () => {
    it('should successfully book a slot', async () => {
      // Arrange
      mockPage.evaluate.mockResolvedValue({
        success: true,
        data: { bookingId: 'booking-123' },
      });

      // Act
      const result = await service.startBooking(mockBookingConfig);

      // Assert
      expect(result).toEqual({
        success: true,
        bookingId: 'booking-123',
        screenshot: 'data:image/png;base64,c2NyZWVuc2hvdC1kYXRh',
      });
      expect(mockPrisma.wBSession.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-456',
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should throw error when booking is already in progress', async () => {
      // Arrange
      await service.startBooking(mockBookingConfig);

      // Act & Assert
      await expect(service.startBooking(mockBookingConfig))
        .rejects
        .toThrow(BookingError);
    });

    it('should throw error when no WB session found', async () => {
      // Arrange
      mockPrisma.wBSession.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.startBooking(mockBookingConfig))
        .rejects
        .toThrow(SessionError);
    });

    it('should handle browser launch failure', async () => {
      // Arrange
      mockPuppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      // Act & Assert
      await expect(service.startBooking(mockBookingConfig))
        .rejects
        .toThrow(BrowserError);
    });

    it('should handle booking API failure', async () => {
      // Arrange
      mockPage.evaluate.mockResolvedValue({
        success: false,
        status: 400,
        data: { error: 'Invalid request' },
      });

      // Act
      const result = await service.startBooking(mockBookingConfig);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Booking API error: 400 - {"error":"Invalid request"}',
        screenshot: 'data:image/png;base64,c2NyZWVuc2hvdC1kYXRh',
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange
      mockPage.evaluate.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await service.startBooking(mockBookingConfig);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Network error',
        screenshot: 'data:image/png;base64,c2NyZWVuc2hvdC1kYXRh',
      });
    });

    it('should close page even when booking fails', async () => {
      // Arrange
      mockPage.evaluate.mockRejectedValue(new Error('Booking failed'));

      // Act
      await service.startBooking(mockBookingConfig);

      // Assert
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should reset isBooking flag after completion', async () => {
      // Arrange
      mockPage.evaluate.mockResolvedValue({
        success: true,
        data: { bookingId: 'booking-123' },
      });

      // Act
      await service.startBooking(mockBookingConfig);

      // Assert
      expect(service.isBookingInProgress()).toBe(false);
    });

    it('should reset isBooking flag after error', async () => {
      // Arrange
      mockPage.evaluate.mockRejectedValue(new Error('Booking failed'));

      // Act
      await service.startBooking(mockBookingConfig);

      // Assert
      expect(service.isBookingInProgress()).toBe(false);
    });
  });

  describe('isBookingInProgress', () => {
    it('should return false initially', () => {
      expect(service.isBookingInProgress()).toBe(false);
    });

    it('should return true during booking', async () => {
      // Arrange
      let isBookingDuringExecution = false;
      mockPage.evaluate.mockImplementation(async () => {
        isBookingDuringExecution = service.isBookingInProgress();
        return { success: true, data: { bookingId: 'booking-123' } };
      });

      // Act
      await service.startBooking(mockBookingConfig);

      // Assert
      expect(isBookingDuringExecution).toBe(true);
    });
  });

  describe('stop', () => {
    it('should close browser and reset state', async () => {
      // Arrange
      await service.startBooking(mockBookingConfig);

      // Act
      await service.stop();

      // Assert
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(service.isBookingInProgress()).toBe(false);
    });
  });
});

// ===== UTILITY CLASS TESTS =====
describe('ChromePathFinder', () => {
  // Import the utility class
  let ChromePathFinder: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import the module
    const importedModule = await import('../../lib/services/refactored/auto-booking-service');
    ChromePathFinder = importedModule.ChromePathFinder;
  });

  it('should find Chrome in standard paths', () => {
    // Arrange
    const mockExistsSync = vi.fn();
    mockExistsSync.mockReturnValue(true);
    const fs = await import('fs');
    (fs.existsSync as any) = mockExistsSync;

    // Act
    const result = ChromePathFinder.findChromePath();

    // Assert
    expect(result).toBeDefined();
    expect(mockExistsSync).toHaveBeenCalled();
  });

  it('should return undefined when Chrome not found', () => {
    // Arrange
    const mockExistsSync = vi.fn();
    mockExistsSync.mockReturnValue(false);
    const fs = await import('fs');
    (fs.existsSync as any) = mockExistsSync;

    const mockExecSync = vi.fn();
    mockExecSync.mockImplementation(() => {
      throw new Error('Command not found');
    });
    const childProcess = await import('child_process');
    (childProcess.execSync as any) = mockExecSync;

    // Act
    const result = ChromePathFinder.findChromePath();

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('SessionDataDecryptor', () => {
  // Import the utility class
  let SessionDataDecryptor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import the module
    const importedModule = await import('../../lib/services/refactored/auto-booking-service');
    SessionDataDecryptor = importedModule.SessionDataDecryptor;
  });

  it('should decrypt extended format session data', () => {
    // Arrange
    const encryptedData = 'encrypted-data';
    const decryptedData = {
      cookies: { 'session-id': '123' },
      localStorage: { 'user-id': '456' },
      sessionStorage: {},
    };
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue(JSON.stringify(decryptedData));

    // Act
    const result = SessionDataDecryptor.decryptSessionData(encryptedData);

    // Assert
    expect(result).toEqual(decryptedData);
  });

  it('should convert simple format to extended format', () => {
    // Arrange
    const encryptedData = 'encrypted-data';
    const simpleData = { 'session-id': '123' };
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue(JSON.stringify(simpleData));

    // Act
    const result = SessionDataDecryptor.decryptSessionData(encryptedData);

    // Assert
    expect(result).toEqual({
      cookies: simpleData,
      localStorage: {},
      sessionStorage: {},
    });
  });

  it('should throw SessionError on decryption failure', () => {
    // Arrange
    const encryptedData = 'invalid-data';
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockImplementation(() => {
      throw new Error('Decryption failed');
    });

    // Act & Assert
    expect(() => SessionDataDecryptor.decryptSessionData(encryptedData))
      .toThrow(SessionError);
  });
});

// ===== INTEGRATION TESTS =====
describe('AutoBookingService Integration', () => {
  let service: RefactoredAutoBookingService;

  beforeEach(() => {
    service = new RefactoredAutoBookingService();
    vi.clearAllMocks();
  });

  it('should handle complete booking flow', async () => {
    // Arrange
    const mockWBSession = {
      id: 'session-123',
      userId: 'user-456',
      cookies: { encrypted: 'encrypted-data' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockDecryptedData = {
      cookies: { 'session-id': '123' },
      localStorage: { 'user-id': '456' },
      sessionStorage: {},
    };

    const mockTokens = {
      csrfToken: 'csrf-123',
      sessionId: 'session-123',
      xSuppId: 'supplier-123',
      authToken: 'auth-123',
      userId: 'user-456',
    };

    mockPrisma.wBSession.findFirst.mockResolvedValue(mockWBSession);
    const { decrypt } = await import('../../lib/encryption');
    (decrypt as any).mockReturnValue(JSON.stringify(mockDecryptedData));
    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.evaluate.mockResolvedValue(mockTokens);
    mockPage.evaluate.mockResolvedValueOnce({
      success: true,
      data: { bookingId: 'booking-123' },
    });
    mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));

    // Act
    const result = await service.startBooking(mockBookingConfig);

    // Assert
    expect(result.success).toBe(true);
    expect(result.bookingId).toBe('booking-123');
    expect(mockPage.close).toHaveBeenCalled();
  });
});
