import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { UnifiedWBSessionManager } from '@/lib/session';
import { UnifiedAutoBookingService } from '@/lib/services/unified-auto-booking-service';
import { RefactoredSlotSearchService } from '@/lib/services/refactored/slot-search-service';
import { POST as createTask } from '@/app/api/tasks/route';
import { POST as bookSlot } from '@/app/api/auto-booking/book-slot/route';
import { POST as searchSlots } from '@/app/api/slot-search/route';
import { PrismaClient } from '@prisma/client';

// ===== COMPLEX WORKFLOW INTEGRATION TESTS =====

describe('Complex Workflow Integration Tests', () => {
  let mockPrisma: any;
  let mockBrowser: any;
  let mockPage: any;
  let sessionManager: UnifiedWBSessionManager;
  let autoBookingService: UnifiedAutoBookingService;
  let slotSearchService: RefactoredSlotSearchService;

  beforeEach(() => {
    // Mock Prisma with realistic data
    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
        }),
        create: vi.fn().mockResolvedValue({
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
        }),
      },
      wBSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'test-session',
          userId: 'test-user',
          sessionId: 'session-123',
          cookiesEncrypted: 'encrypted_cookies',
          localStorageEncrypted: 'encrypted_localStorage',
          sessionStorageEncrypted: 'encrypted_sessionStorage',
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastUsedAt: new Date(),
        }),
        create: vi.fn().mockResolvedValue({
          id: 'new-session',
          userId: 'test-user',
          sessionId: 'session-456',
          isActive: true,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'test-session',
          isActive: true,
          lastUsedAt: new Date(),
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
      task: {
        create: vi.fn().mockResolvedValue({
          id: 'test-task',
          userId: 'test-user',
          name: 'Test Task',
          description: 'Test Description',
          isActive: true,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'test-task',
            userId: 'test-user',
            name: 'Test Task',
            isActive: true,
            runs: [],
          },
        ]),
        update: vi.fn().mockResolvedValue({
          id: 'test-task',
          isActive: true,
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
      run: {
        create: vi.fn().mockResolvedValue({
          id: 'test-run',
          taskId: 'test-task',
          status: 'RUNNING',
          startedAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'test-run',
            taskId: 'test-task',
            status: 'COMPLETED',
            startedAt: new Date(),
            completedAt: new Date(),
            foundSlots: [],
          },
        ]),
        update: vi.fn().mockResolvedValue({
          id: 'test-run',
          status: 'COMPLETED',
        }),
      },
      runLog: {
        create: vi.fn().mockResolvedValue({
          id: 'test-log',
          runId: 'test-run',
          level: 'INFO',
          message: 'Test log message',
          timestamp: new Date(),
        }),
      },
    };

    // Mock Browser
    mockBrowser = {
      newPage: vi.fn(),
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
    };

    // Mock Page
    mockPage = {
      goto: vi.fn().mockResolvedValue({}),
      setCookie: vi.fn().mockResolvedValue({}),
      evaluate: vi.fn().mockResolvedValue({
        success: true,
        isAuthenticated: true,
        hasRedirects: false,
      }),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot')),
      close: vi.fn().mockResolvedValue({}),
      setViewport: vi.fn().mockResolvedValue({}),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue({}),
      waitForSelector: vi.fn().mockResolvedValue({}),
      click: vi.fn().mockResolvedValue({}),
      fill: vi.fn().mockResolvedValue({}),
      selectOption: vi.fn().mockResolvedValue({}),
      locator: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(true),
        click: vi.fn().mockResolvedValue({}),
        fill: vi.fn().mockResolvedValue({}),
      }),
      context: vi.fn().mockReturnValue({
        addCookies: vi.fn().mockResolvedValue({}),
        clearCookies: vi.fn().mockResolvedValue({}),
      }),
    };

    mockBrowser.newPage.mockResolvedValue(mockPage);

    // Mock external dependencies
    vi.mock('@/lib/prisma', () => ({
      prisma: mockPrisma,
    }));

    vi.mock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      },
    }));

    vi.mock('@/lib/encryption', () => ({
      encrypt: vi.fn().mockImplementation((data) => `encrypted_${data}`),
      decrypt: vi.fn().mockImplementation((data) => data.replace('encrypted_', '')),
    }));

    vi.mock('@/lib/auth', () => ({
      requireAuth: vi.fn().mockResolvedValue({ id: 'test-user' }),
    }));

    // Initialize services
    sessionManager = new UnifiedWBSessionManager('test-encryption-key-32-bytes-long');
    autoBookingService = new UnifiedAutoBookingService();
    slotSearchService = new RefactoredSlotSearchService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Auto-Booking Workflow', () => {
    it('should complete full auto-booking workflow from task creation to slot booking', async () => {
      // 1. Create task
      const taskRequest = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Integration Test Task',
          description: 'Full workflow test',
          warehouseIds: [117501, 130744],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          scheduleCron: '*/30 * * * *',
          isActive: true,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });

      const taskResponse = await createTask(taskRequest);
      expect(taskResponse.status).toBe(201);

      const taskData = await taskResponse.json();
      expect(taskData.success).toBe(true);
      expect(taskData.task.id).toBeDefined();

      // 2. Create WB session
      const sessionResult = await sessionManager.createSession('test-user', mockPage);
      expect(sessionResult.success).toBe(true);

      // 3. Search for available slots
      const slotSearchRequest = new NextRequest('http://localhost:3000/api/slot-search', {
        method: 'POST',
        body: JSON.stringify({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });

      const slotSearchResponse = await searchSlots(slotSearchRequest);
      expect(slotSearchResponse.status).toBe(200);

      const slotSearchData = await slotSearchResponse.json();
      expect(slotSearchData.success).toBe(true);

      // 4. Book a slot if available
      if (slotSearchData.foundSlots.length > 0) {
        const slot = slotSearchData.foundSlots[0];
        
        const bookingRequest = new NextRequest('http://localhost:3000/api/auto-booking/book-slot', {
          method: 'POST',
          body: JSON.stringify({
            taskId: taskData.task.id,
            runId: 'test-run',
            slotId: slot.id,
            supplyId: 'test-supply',
            warehouseId: slot.warehouseId,
            boxTypeId: slot.boxTypeId,
            date: slot.date,
            coefficient: slot.coefficient,
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
        });

        const bookingResponse = await bookSlot(bookingRequest);
        expect(bookingResponse.status).toBe(200);

        const bookingData = await bookingResponse.json();
        expect(bookingData.success).toBe(true);
      }
    });

    it('should handle session expiration during booking workflow', async () => {
      // 1. Create task
      const taskRequest = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Session Expiry Test',
          description: 'Test session expiry handling',
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });

      const taskResponse = await createTask(taskRequest);
      const taskData = await taskResponse.json();

      // 2. Create expired session
      mockPrisma.wBSession.findFirst.mockResolvedValue({
        id: 'expired-session',
        userId: 'test-user',
        sessionId: 'expired-session-123',
        cookiesEncrypted: 'encrypted_cookies',
        isActive: false, // Expired
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      // 3. Try to book slot with expired session
      const bookingRequest = new NextRequest('http://localhost:3000/api/auto-booking/book-slot', {
        method: 'POST',
        body: JSON.stringify({
          taskId: taskData.task.id,
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });

      const bookingResponse = await bookSlot(bookingRequest);
      expect(bookingResponse.status).toBe(400);

      const bookingData = await bookingResponse.json();
      expect(bookingData.success).toBe(false);
      expect(bookingData.error).toContain('session expired');
    });
  });

  describe('Continuous Slot Search Workflow', () => {
    it('should perform continuous slot search with multiple warehouses', async () => {
      const warehouseIds = [117501, 130744, 507, 686, 120762];
      
      // Mock different responses for different warehouses
      mockPage.evaluate
        .mockResolvedValueOnce({
          success: true,
          foundSlots: [
            { id: 'slot1', warehouseId: 117501, coefficient: 1.5 },
            { id: 'slot2', warehouseId: 117501, coefficient: 2.0 },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          foundSlots: [
            { id: 'slot3', warehouseId: 130744, coefficient: 1.8 },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          foundSlots: [],
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'API Error',
          foundSlots: [],
        })
        .mockResolvedValueOnce({
          success: true,
          foundSlots: [
            { id: 'slot4', warehouseId: 120762, coefficient: 1.2 },
          ],
        });

      const results = [];
      
      for (const warehouseId of warehouseIds) {
        const result = await slotSearchService.searchSlots({
          warehouseIds: [warehouseId],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        results.push(result);
      }

      // Verify results
      expect(results).toHaveLength(5);
      expect(results[0].success).toBe(true);
      expect(results[0].foundSlots).toHaveLength(2);
      expect(results[1].success).toBe(true);
      expect(results[1].foundSlots).toHaveLength(1);
      expect(results[2].success).toBe(true);
      expect(results[2].foundSlots).toHaveLength(0);
      expect(results[3].success).toBe(false);
      expect(results[4].success).toBe(true);
      expect(results[4].foundSlots).toHaveLength(1);
    });

    it('should handle rate limiting across multiple searches', async () => {
      // Mock rate limiting after 3 requests
      let requestCount = 0;
      mockPage.evaluate.mockImplementation(() => {
        requestCount++;
        if (requestCount > 3) {
          return Promise.resolve({
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: 60,
          });
        }
        return Promise.resolve({
          success: true,
          foundSlots: [
            { id: `slot${requestCount}`, warehouseId: 117501, coefficient: 1.5 },
          ],
        });
      });

      const results = [];
      const warehouseIds = [117501, 130744, 507, 686, 120762];
      
      for (const warehouseId of warehouseIds) {
        const result = await slotSearchService.searchSlots({
          warehouseIds: [warehouseId],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        results.push(result);
      }

      // First 3 should succeed, last 2 should fail due to rate limiting
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      expect(results[3].success).toBe(false);
      expect(results[3].error).toContain('Rate limit exceeded');
      expect(results[4].success).toBe(false);
      expect(results[4].error).toContain('Rate limit exceeded');
    });
  });

  describe('Multi-User Concurrent Operations', () => {
    it('should handle multiple users performing operations simultaneously', async () => {
      const users = ['user1', 'user2', 'user3'];
      const promises = users.map(async (userId) => {
        // Create task for each user
        const taskRequest = new NextRequest('http://localhost:3000/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: `Task for ${userId}`,
            description: `Test task for ${userId}`,
            warehouseIds: [117501],
            boxTypeId: 2,
            maxCoefficient: 2.0,
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userId}-token`,
          },
        });

        const taskResponse = await createTask(taskRequest);
        const taskData = await taskResponse.json();

        // Create session for each user
        const sessionResult = await sessionManager.createSession(userId, mockPage);

        // Search slots for each user
        const slotSearchResult = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });

        return {
          userId,
          task: taskData,
          session: sessionResult,
          slotSearch: slotSearchResult,
        };
      });

      const results = await Promise.all(promises);

      // Verify all operations completed successfully
      results.forEach((result) => {
        expect(result.task.success).toBe(true);
        expect(result.session.success).toBe(true);
        expect(result.slotSearch.success).toBe(true);
      });

      // Verify database calls were made for each user
      expect(mockPrisma.task.create).toHaveBeenCalledTimes(3);
      expect(mockPrisma.wBSession.create).toHaveBeenCalledTimes(3);
    });

    it('should handle resource contention between users', async () => {
      // Mock database to simulate contention
      let createCallCount = 0;
      mockPrisma.task.create.mockImplementation(() => {
        createCallCount++;
        if (createCallCount === 2) {
          return Promise.reject(new Error('Deadlock detected'));
        }
        return Promise.resolve({
          id: `task-${createCallCount}`,
          userId: `user${createCallCount}`,
          name: `Task ${createCallCount}`,
        });
      });

      const users = ['user1', 'user2', 'user3'];
      const promises = users.map(async (userId) => {
        const taskRequest = new NextRequest('http://localhost:3000/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: `Task for ${userId}`,
            warehouseIds: [117501],
            boxTypeId: 2,
            maxCoefficient: 2.0,
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userId}-token`,
          },
        });

        try {
          const response = await createTask(taskRequest);
          return { userId, success: true, response: await response.json() };
        } catch (error) {
          return { userId, success: false, error: error.message };
        }
      });

      const results = await Promise.allSettled(promises);

      // First and third should succeed, second should fail due to deadlock
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary service failures', async () => {
      // Mock temporary failure followed by success
      let attemptCount = 0;
      mockPage.evaluate.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('Temporary network error'));
        }
        return Promise.resolve({
          success: true,
          foundSlots: [
            { id: 'slot1', warehouseId: 117501, coefficient: 1.5 },
          ],
        });
      });

      // First attempt should fail
      await expect(slotSearchService.searchSlots({
        warehouseIds: [117501],
        boxTypeId: 2,
        maxCoefficient: 2.0,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      })).rejects.toThrow('Temporary network error');

      // Second attempt should succeed
      const result = await slotSearchService.searchSlots({
        warehouseIds: [117501],
        boxTypeId: 2,
        maxCoefficient: 2.0,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.foundSlots).toHaveLength(1);
    });

    it('should handle partial system failures gracefully', async () => {
      // Mock partial failure - database works but browser fails
      mockPrisma.task.create.mockResolvedValue({
        id: 'test-task',
        userId: 'test-user',
        name: 'Test Task',
      });

      mockBrowser.newPage.mockRejectedValue(new Error('Browser launch failed'));

      // Task creation should succeed
      const taskRequest = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Partial Failure Test',
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });

      const taskResponse = await createTask(taskRequest);
      expect(taskResponse.status).toBe(201);

      // Session creation should fail
      await expect(sessionManager.createSession('test-user', mockPage)).rejects.toThrow('Browser launch failed');
    });

    it('should maintain data consistency during failures', async () => {
      // Mock database transaction failure
      mockPrisma.task.create.mockRejectedValue(new Error('Transaction failed'));
      mockPrisma.run.create.mockRejectedValue(new Error('Transaction failed'));

      const taskRequest = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Transaction Test',
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });

      const taskResponse = await createTask(taskRequest);
      expect(taskResponse.status).toBe(500);

      // Verify no partial data was created
      expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.run.create).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume slot searches efficiently', async () => {
      const startTime = Date.now();
      
      // Mock fast responses
      mockPage.evaluate.mockResolvedValue({
        success: true,
        foundSlots: [
          { id: 'slot1', warehouseId: 117501, coefficient: 1.5 },
          { id: 'slot2', warehouseId: 117501, coefficient: 2.0 },
        ],
      });

      // Perform 100 concurrent searches
      const promises = Array(100).fill(null).map((_, i) => 
        slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.foundSlots).toHaveLength(2);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should handle memory pressure during large operations', async () => {
      // Mock large dataset
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        id: `slot_${i}`,
        warehouseId: 117501,
        coefficient: Math.random() * 5,
        date: '2024-01-01',
      }));

      mockPage.evaluate.mockResolvedValue({
        success: true,
        foundSlots: largeDataset,
      });

      const result = await slotSearchService.searchSlots({
        warehouseIds: [117501],
        boxTypeId: 2,
        maxCoefficient: 2.0,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.foundSlots).toHaveLength(1000);
      expect(result.warnings).toContain('Large dataset processed');
    });
  });
});
