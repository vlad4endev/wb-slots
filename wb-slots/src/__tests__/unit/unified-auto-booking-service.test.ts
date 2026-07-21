import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedAutoBookingService, BookingError, SessionError, TimeoutError } from '@/lib/services/unified-auto-booking-service';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    wBSession: {
      findFirst: vi.fn(),
    },
    supplySnapshot: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn(),
}));

vi.mock('@/lib/logging/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('@/lib/services/telegram-service', () => ({
  TelegramService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn(),
  })),
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('UnifiedAutoBookingService', () => {
  let service: UnifiedAutoBookingService;

  beforeEach(() => {
    service = new UnifiedAutoBookingService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Classes', () => {
    it('should create BookingError with correct properties', () => {
      const error = new BookingError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('BookingError');
    });

    it('should create SessionError with correct properties', () => {
      const error = new SessionError('Session error');
      expect(error.message).toBe('Session error');
      expect(error.code).toBe('SESSION_ERROR');
      expect(error.name).toBe('BookingError');
    });

    it('should create TimeoutError with correct properties', () => {
      const error = new TimeoutError('Timeout error');
      expect(error.message).toBe('Timeout error');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.name).toBe('BookingError');
    });
  });

  describe('isBookingInProgress', () => {
    it('should return false initially', () => {
      expect(service.isBookingInProgress()).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop service without errors', async () => {
      await expect(service.stop()).resolves.not.toThrow();
    });
  });

  describe('startBooking', () => {
    const mockConfig = {
      taskId: 'test-task',
      userId: 'test-user',
      runId: 'test-run',
      slotId: 'test-slot',
      supplyId: 'test-supply',
      warehouseId: 123,
      boxTypeId: 2,
      date: '2024-01-01',
      coefficient: 1.5,
    };

    it('should throw error if booking is already in progress', async () => {
      // Mock isBooking to true
      (service as any).isBooking = true;

      await expect(service.startBooking(mockConfig)).rejects.toThrow(BookingError);
    });

    it('should throw SessionError if no WB session found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.wBSession.findFirst).mockResolvedValue(null);

      await expect(service.startBooking(mockConfig)).rejects.toThrow(SessionError);
    });
  });
});
