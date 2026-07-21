import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { UnifiedWBSessionManager } from '@/lib/session';
import { UnifiedAutoBookingService } from '@/lib/services/unified-auto-booking-service';
import { RefactoredSlotSearchService } from '@/lib/services/refactored/slot-search-service';
import { PrismaClient } from '@prisma/client';

// ===== EDGE CASES AND ERROR SCENARIOS TESTING =====

describe('Edge Cases and Error Scenarios', () => {
  let mockPrisma: any;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    // Mock Prisma
    mockPrisma = {
      wBSession: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      task: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      run: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      runLog: {
        create: vi.fn(),
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
      goto: vi.fn(),
      setCookie: vi.fn(),
      evaluate: vi.fn(),
      screenshot: vi.fn(),
      close: vi.fn(),
      setViewport: vi.fn(),
      setExtraHTTPHeaders: vi.fn(),
      waitForSelector: vi.fn(),
      click: vi.fn(),
      fill: vi.fn(),
      selectOption: vi.fn(),
      locator: vi.fn(),
      context: vi.fn().mockReturnValue({
        addCookies: vi.fn(),
        clearCookies: vi.fn(),
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Manager Edge Cases', () => {
    let sessionManager: UnifiedWBSessionManager;

    beforeEach(() => {
      sessionManager = new UnifiedWBSessionManager('test-encryption-key-32-bytes-long');
    });

    describe('Network and Connection Issues', () => {
      it('should handle network timeouts gracefully', async () => {
        mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));
        
        const result = await sessionManager.validateSession(mockPage);
        
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('timeout');
      });

      it('should handle DNS resolution failures', async () => {
        mockPage.goto.mockRejectedValue(new Error('ENOTFOUND: seller.wildberries.ru'));
        
        const result = await sessionManager.validateSession(mockPage);
        
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('DNS');
      });

      it('should handle SSL certificate errors', async () => {
        mockPage.goto.mockRejectedValue(new Error('CERT_HAS_EXPIRED'));
        
        const result = await sessionManager.validateSession(mockPage);
        
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('SSL');
      });

      it('should handle connection refused errors', async () => {
        mockPage.goto.mockRejectedValue(new Error('ECONNREFUSED'));
        
        const result = await sessionManager.validateSession(mockPage);
        
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('connection refused');
      });
    });

    describe('Browser and Page Issues', () => {
      it('should handle browser crashes', async () => {
        mockBrowser.isConnected.mockReturnValue(false);
        
        const result = await sessionManager.validateSession(mockPage);
        
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('browser disconnected');
      });

      it('should handle page crashes', async () => {
        mockPage.goto.mockRejectedValue(new Error('Target page, context or browser has been closed'));
        
        const result = await sessionManager.validateSession(mockPage);
        
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('page closed');
      });

      it('should handle memory exhaustion', async () => {
        mockPage.goto.mockRejectedValue(new Error('Cannot allocate memory'));
        
        const result = await sessionManager.validateSession(mockPage);
        
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('memory');
      });
    });

    describe('Data Corruption and Invalid States', () => {
      it('should handle corrupted session data', async () => {
        const corruptedSession = {
          id: 'test-session',
          cookiesEncrypted: 'corrupted_data',
          localStorageEncrypted: 'invalid_json',
          sessionStorageEncrypted: null,
        };

        mockPrisma.wBSession.findFirst.mockResolvedValue(corruptedSession);
        
        await expect(sessionManager.restoreSession('test-user')).rejects.toThrow();
      });

      it('should handle invalid encryption keys', async () => {
        const invalidKeyManager = new UnifiedWBSessionManager('invalid-key');
        
        await expect(invalidKeyManager.createSession('test-user', mockPage)).rejects.toThrow();
      });

      it('should handle empty session data', async () => {
        const emptySession = {
          id: 'test-session',
          cookiesEncrypted: '',
          localStorageEncrypted: '',
          sessionStorageEncrypted: '',
        };

        mockPrisma.wBSession.findFirst.mockResolvedValue(emptySession);
        
        const result = await sessionManager.restoreSession('test-user');
        expect(result).toBeNull();
      });
    });

    describe('Concurrent Access Issues', () => {
      it('should handle concurrent session creation', async () => {
        const promises = Array(5).fill(null).map(() => 
          sessionManager.createSession('test-user', mockPage)
        );

        const results = await Promise.allSettled(promises);
        
        // Only one should succeed
        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBe(1);
      });

      it('should handle race conditions in session updates', async () => {
        mockPrisma.wBSession.update.mockRejectedValue(new Error('Concurrent modification'));
        
        await expect(sessionManager.refreshSession('test-user')).rejects.toThrow();
      });
    });
  });

  describe('Auto-Booking Service Edge Cases', () => {
    let autoBookingService: UnifiedAutoBookingService;

    beforeEach(() => {
      autoBookingService = new UnifiedAutoBookingService();
    });

    describe('WB API Edge Cases', () => {
      it('should handle API rate limiting', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.name = 'RateLimitError';
        
        mockPage.evaluate.mockRejectedValue(rateLimitError);
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('rate limit');
      });

      it('should handle API maintenance mode', async () => {
        mockPage.goto.mockResolvedValue({
          url: () => 'https://seller.wildberries.ru/maintenance',
        });
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('maintenance');
      });

      it('should handle unexpected API responses', async () => {
        mockPage.evaluate.mockResolvedValue({
          success: false,
          error: 'Unexpected response format',
          data: null,
        });
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('unexpected');
      });
    });

    describe('Slot Availability Edge Cases', () => {
      it('should handle slots disappearing during booking', async () => {
        // First call returns slot available
        mockPage.evaluate
          .mockResolvedValueOnce({
            success: true,
            slotAvailable: true,
            slotData: { id: 'test-slot', coefficient: 1.5 },
          })
          // Second call returns slot unavailable
          .mockResolvedValueOnce({
            success: true,
            slotAvailable: false,
            error: 'Slot no longer available',
          });
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('no longer available');
      });

      it('should handle coefficient changes during booking', async () => {
        mockPage.evaluate.mockResolvedValue({
          success: true,
          slotAvailable: true,
          slotData: { id: 'test-slot', coefficient: 2.5 }, // Higher than expected
        });
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5, // Lower than actual
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('coefficient changed');
      });
    });

    describe('Browser Automation Edge Cases', () => {
      it('should handle element not found errors', async () => {
        mockPage.waitForSelector.mockRejectedValue(new Error('Element not found'));
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('element not found');
      });

      it('should handle click failures', async () => {
        mockPage.click.mockRejectedValue(new Error('Element not clickable'));
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('not clickable');
      });

      it('should handle form submission failures', async () => {
        mockPage.fill.mockRejectedValue(new Error('Form field not found'));
        
        const result = await autoBookingService.startBooking({
          taskId: 'test-task',
          runId: 'test-run',
          slotId: 'test-slot',
          supplyId: 'test-supply',
          warehouseId: 117501,
          boxTypeId: 2,
          date: '2024-01-01',
          coefficient: 1.5,
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('form field');
      });
    });
  });

  describe('Slot Search Service Edge Cases', () => {
    let slotSearchService: RefactoredSlotSearchService;

    beforeEach(() => {
      slotSearchService = new RefactoredSlotSearchService();
    });

    describe('API Response Edge Cases', () => {
      it('should handle malformed API responses', async () => {
        const malformedResponse = {
          error: false,
          errorText: '',
          data: 'invalid_json_string',
        };

        // Mock WB API client
        vi.spyOn(slotSearchService as any, 'searchAvailableSlots')
          .mockResolvedValue(malformedResponse);
        
        const result = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toContain('malformed response');
      });

      it('should handle empty API responses', async () => {
        const emptyResponse = {
          error: false,
          errorText: '',
          data: null,
        };

        vi.spyOn(slotSearchService as any, 'searchAvailableSlots')
          .mockResolvedValue(emptyResponse);
        
        const result = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        expect(result.success).toBe(true);
        expect(result.foundSlots).toHaveLength(0);
      });

      it('should handle partial API failures', async () => {
        const partialResponse = {
          error: true,
          errorText: 'Partial failure',
          data: [
            { id: 'slot1', coefficient: 1.5 },
            { id: 'slot2', coefficient: 2.0 },
          ],
        };

        vi.spyOn(slotSearchService as any, 'searchAvailableSlots')
          .mockResolvedValue(partialResponse);
        
        const result = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toContain('Partial failure');
        expect(result.foundSlots).toHaveLength(2);
      });
    });

    describe('Data Validation Edge Cases', () => {
      it('should handle invalid slot data', async () => {
        const invalidSlotData = {
          error: false,
          errorText: '',
          data: [
            { id: null, coefficient: 'invalid' },
            { id: 'slot2', coefficient: -1 },
            { id: 'slot3', coefficient: 999999 },
          ],
        };

        vi.spyOn(slotSearchService as any, 'searchAvailableSlots')
          .mockResolvedValue(invalidSlotData);
        
        const result = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        expect(result.success).toBe(true);
        expect(result.foundSlots).toHaveLength(0); // All invalid slots filtered out
        expect(result.warnings).toContain('Invalid slot data filtered out');
      });

      it('should handle missing required fields', async () => {
        const incompleteSlotData = {
          error: false,
          errorText: '',
          data: [
            { id: 'slot1' }, // Missing coefficient
            { coefficient: 1.5 }, // Missing id
            { id: 'slot3', coefficient: 1.5, warehouseId: 117501 },
          ],
        };

        vi.spyOn(slotSearchService as any, 'searchAvailableSlots')
          .mockResolvedValue(incompleteSlotData);
        
        const result = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        expect(result.success).toBe(true);
        expect(result.foundSlots).toHaveLength(1); // Only valid slot
        expect(result.warnings).toContain('Incomplete slot data filtered out');
      });
    });

    describe('Performance Edge Cases', () => {
      it('should handle very large datasets', async () => {
        const largeDataset = {
          error: false,
          errorText: '',
          data: Array(10000).fill(null).map((_, i) => ({
            id: `slot_${i}`,
            coefficient: Math.random() * 5,
            warehouseId: 117501,
            date: '2024-01-01',
          })),
        };

        vi.spyOn(slotSearchService as any, 'searchAvailableSlots')
          .mockResolvedValue(largeDataset);
        
        const startTime = Date.now();
        const result = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        const endTime = Date.now();
        
        expect(result.success).toBe(true);
        expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        expect(result.foundSlots.length).toBeGreaterThan(0);
      });

      it('should handle memory constraints', async () => {
        // Simulate memory pressure
        const memoryIntensiveData = {
          error: false,
          errorText: '',
          data: Array(100000).fill(null).map((_, i) => ({
            id: `slot_${i}`,
            coefficient: Math.random() * 5,
            warehouseId: 117501,
            date: '2024-01-01',
            largeData: 'x'.repeat(1000), // Large string to consume memory
          })),
        };

        vi.spyOn(slotSearchService as any, 'searchAvailableSlots')
          .mockResolvedValue(memoryIntensiveData);
        
        const result = await slotSearchService.searchSlots({
          warehouseIds: [117501],
          boxTypeId: 2,
          maxCoefficient: 2.0,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });
        
        expect(result.success).toBe(true);
        expect(result.warnings).toContain('Large dataset processed');
      });
    });
  });

  describe('Database Edge Cases', () => {
    it('should handle database connection failures', async () => {
      mockPrisma.wBSession.findFirst.mockRejectedValue(new Error('Connection failed'));
      
      const sessionManager = new UnifiedWBSessionManager('test-key');
      
      await expect(sessionManager.restoreSession('test-user')).rejects.toThrow('Connection failed');
    });

    it('should handle database timeout errors', async () => {
      mockPrisma.wBSession.findFirst.mockRejectedValue(new Error('Query timeout'));
      
      const sessionManager = new UnifiedWBSessionManager('test-key');
      
      await expect(sessionManager.restoreSession('test-user')).rejects.toThrow('Query timeout');
    });

    it('should handle database constraint violations', async () => {
      mockPrisma.wBSession.create.mockRejectedValue(new Error('Unique constraint failed'));
      
      const sessionManager = new UnifiedWBSessionManager('test-key');
      
      await expect(sessionManager.createSession('test-user', mockPage)).rejects.toThrow('Unique constraint failed');
    });

    it('should handle database deadlocks', async () => {
      mockPrisma.wBSession.update.mockRejectedValue(new Error('Deadlock found'));
      
      const sessionManager = new UnifiedWBSessionManager('test-key');
      
      await expect(sessionManager.refreshSession('test-user')).rejects.toThrow('Deadlock found');
    });
  });

  describe('System Resource Edge Cases', () => {
    it('should handle disk space exhaustion', async () => {
      const diskError = new Error('ENOSPC: no space left on device');
      mockPage.screenshot.mockRejectedValue(diskError);
      
      const sessionManager = new UnifiedWBSessionManager('test-key');
      
      const result = await sessionManager.validateSession(mockPage);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('disk space');
    });

    it('should handle file permission errors', async () => {
      const permissionError = new Error('EACCES: permission denied');
      mockPage.screenshot.mockRejectedValue(permissionError);
      
      const sessionManager = new UnifiedWBSessionManager('test-key');
      
      const result = await sessionManager.validateSession(mockPage);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('permission denied');
    });

    it('should handle process resource limits', async () => {
      const resourceError = new Error('EMFILE: too many open files');
      mockBrowser.newPage.mockRejectedValue(resourceError);
      
      const sessionManager = new UnifiedWBSessionManager('test-key');
      
      await expect(sessionManager.createSession('test-user', mockPage)).rejects.toThrow('too many open files');
    });
  });
});
