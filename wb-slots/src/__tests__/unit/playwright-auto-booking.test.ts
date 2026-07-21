import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaywrightAutoBooking } from '@/lib/playwright-auto-booking';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    wBSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock Logger
vi.mock('@/lib/logging/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('PlaywrightAutoBooking', () => {
  let playwright: PlaywrightAutoBooking;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    playwright = new PlaywrightAutoBooking(mockUserId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(playwright).toBeDefined();
      // Проверяем, что userAgent установлен
      expect(playwright['userAgent']).toBeDefined();
      expect(playwright['userAgent']).toContain('Mozilla');
    });

    it('should generate random user agent', () => {
      const playwright1 = new PlaywrightAutoBooking('user1');
      const playwright2 = new PlaywrightAutoBooking('user2');
      
      // User agents могут быть одинаковыми случайно, но это маловероятно
      // Проверяем, что они валидные
      expect(playwright1['userAgent']).toContain('Mozilla');
      expect(playwright2['userAgent']).toContain('Mozilla');
    });
  });

  describe('getRandomUserAgent', () => {
    it('should return valid user agent string', () => {
      const userAgent = playwright['getRandomUserAgent']();
      
      expect(userAgent).toBeDefined();
      expect(typeof userAgent).toBe('string');
      expect(userAgent).toContain('Mozilla');
      expect(userAgent.length).toBeGreaterThan(50);
    });

    it('should return different user agents on multiple calls', () => {
      const userAgents = new Set();
      
      // Генерируем 100 user agents
      for (let i = 0; i < 100; i++) {
        userAgents.add(playwright['getRandomUserAgent']());
      }
      
      // Должно быть несколько разных user agents
      expect(userAgents.size).toBeGreaterThan(1);
    });
  });

  describe('gotoWithRetry', () => {
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        goto: vi.fn(),
      };
    });

    it('should succeed on first attempt', async () => {
      mockPage.goto.mockResolvedValue(undefined);
      
      await playwright['gotoWithRetry'](mockPage, 'https://example.com');
      
      expect(mockPage.goto).toHaveBeenCalledTimes(1);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
    });

    it('should retry on failure and eventually succeed', async () => {
      mockPage.goto
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(undefined);
      
      await playwright['gotoWithRetry'](mockPage, 'https://example.com');
      
      expect(mockPage.goto).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockPage.goto.mockRejectedValue(new Error('Persistent error'));
      
      await expect(
        playwright['gotoWithRetry'](mockPage, 'https://example.com')
      ).rejects.toThrow('Не удалось загрузить страницу https://example.com после 3 попыток');
      
      expect(mockPage.goto).toHaveBeenCalledTimes(3);
    });

    it('should use custom options', async () => {
      mockPage.goto.mockResolvedValue(undefined);
      
      const customOptions = {
        waitUntil: 'networkidle' as const,
        timeout: 30000,
      };
      
      await playwright['gotoWithRetry'](mockPage, 'https://example.com', customOptions);
      
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', customOptions);
    });
  });

  describe('loadUserSession', () => {
    it('should return null when user not found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      
      const result = await playwright['loadUserSession']();
      
      expect(result).toBeNull();
    });

    it('should return null when no active sessions', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        wbSessions: [],
      } as any);
      
      const result = await playwright['loadUserSession']();
      
      expect(result).toBeNull();
    });

    it('should return session data when found', async () => {
      const mockSession = {
        id: 'session-id',
        cookies: { test: 'cookie' },
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1',
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        wbSessions: [mockSession],
      } as any);
      
      const result = await playwright['loadUserSession']();
      
      expect(result).toEqual(mockSession);
    });
  });

  describe('humanDelay', () => {
    it('should delay for specified time range', async () => {
      const start = Date.now();
      
      await playwright['humanDelay'](100, 200);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThanOrEqual(300); // Добавляем буфер для тестов
    });

    it('should handle zero delay', async () => {
      const start = Date.now();
      
      await playwright['humanDelay'](0, 0);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50); // Должно быть очень быстро
    });
  });

  describe('simulateMouseMovement', () => {
    it('should not throw when page is provided', async () => {
      const mockPage = {
        mouse: {
          move: vi.fn().mockResolvedValue(undefined),
        },
      };
      
      await expect(playwright['simulateMouseMovement'](mockPage as any)).resolves.not.toThrow();
    });
  });

  describe('checkIfLoggedIn', () => {
    it('should return false when not logged in', async () => {
      const mockPage = {
        url: vi.fn().mockReturnValue('https://seller.wildberries.ru/login'),
        locator: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
        }),
      };
      
      const result = await playwright['checkIfLoggedIn'](mockPage as any);
      
      expect(result).toBe(false);
    });

    it('should return true when logged in', async () => {
      const mockPage = {
        url: vi.fn().mockReturnValue('https://seller.wildberries.ru/supplies-management/all-supplies'),
        locator: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(true),
        }),
      };
      
      const result = await playwright['checkIfLoggedIn'](mockPage as any);
      
      expect(result).toBe(true);
    });
  });
});