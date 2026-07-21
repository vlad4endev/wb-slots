import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from '@/app/api/auto-booking/book-slot/route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'test-user' }),
}));

vi.mock('@/lib/services/unified-auto-booking-service', () => ({
  UnifiedAutoBookingService: vi.fn().mockImplementation(() => ({
    isBookingInProgress: vi.fn().mockReturnValue(false),
    startBooking: vi.fn().mockResolvedValue({
      success: true,
      bookingId: 'test-booking-123',
    }),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      update: vi.fn(),
    },
    runLog: {
      create: vi.fn(),
    },
  },
}));

describe('Auto Booking API', () => {
  const mockBookingData = {
    taskId: 'test-task',
    runId: 'test-run',
    slotId: 'test-slot',
    supplyId: 'test-supply',
    warehouseId: 123,
    boxTypeId: 2,
    date: '2024-01-01',
    coefficient: 1.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auto-booking/book-slot', () => {
    it('should successfully book a slot', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-booking/book-slot', {
        method: 'POST',
        body: JSON.stringify(mockBookingData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.success).toBe(true);
      expect(data.data.bookingId).toBe('test-booking-123');
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        taskId: 'test-task',
        // Missing required fields
      };

      const request = new NextRequest('http://localhost:3000/api/auto-booking/book-slot', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Неверные данные запроса');
    });

    it('should return 409 if booking is already in progress', async () => {
      const { UnifiedAutoBookingService } = await import('@/lib/services/unified-auto-booking-service');
      const mockService = new UnifiedAutoBookingService();
      vi.mocked(mockService.isBookingInProgress).mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auto-booking/book-slot', {
        method: 'POST',
        body: JSON.stringify(mockBookingData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('уже запущено');
    });
  });

  describe('GET /api/auto-booking/book-slot', () => {
    it('should return booking status', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-booking/book-slot');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isBookingInProgress).toBe(false);
      expect(data.data.userId).toBe('test-user');
    });
  });

  describe('DELETE /api/auto-booking/book-slot', () => {
    it('should stop booking process', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-booking/book-slot', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Бронирование остановлено');
    });
  });
});