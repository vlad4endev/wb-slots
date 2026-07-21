import { vi, Mock } from 'vitest';
import { Page, Browser, BrowserContext } from 'playwright';
import { PrismaClient } from '@prisma/client';

// ===== COMPREHENSIVE MOCKS FOR ALL EDGE CASES =====

export class ComprehensiveMocks {
  // ===== BROWSER MOCKS =====
  
  static createMockPage(): Page {
    const mockPage = {
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
      context: vi.fn(),
      url: vi.fn(),
      title: vi.fn(),
      content: vi.fn(),
      reload: vi.fn(),
      goBack: vi.fn(),
      goForward: vi.fn(),
      waitForLoadState: vi.fn(),
      waitForResponse: vi.fn(),
      waitForRequest: vi.fn(),
      route: vi.fn(),
      unroute: vi.fn(),
      addInitScript: vi.fn(),
      removeInitScript: vi.fn(),
      addStyleTag: vi.fn(),
      addScriptTag: vi.fn(),
      exposeFunction: vi.fn(),
      removeExposedFunction: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      emit: vi.fn(),
      listenerCount: vi.fn(),
      listeners: vi.fn(),
      rawListeners: vi.fn(),
      setMaxListeners: vi.fn(),
      getMaxListeners: vi.fn(),
      eventNames: vi.fn(),
    } as unknown as Page;

    // Default successful responses
    mockPage.goto.mockResolvedValue({} as any);
    mockPage.setCookie.mockResolvedValue(undefined);
    mockPage.evaluate.mockResolvedValue({ success: true });
    mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));
    mockPage.close.mockResolvedValue(undefined);
    mockPage.setViewport.mockResolvedValue(undefined);
    mockPage.setExtraHTTPHeaders.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue({} as any);
    mockPage.click.mockResolvedValue(undefined);
    mockPage.fill.mockResolvedValue(undefined);
    mockPage.selectOption.mockResolvedValue([]);
    mockPage.locator.mockReturnValue({
      isVisible: vi.fn().mockResolvedValue(true),
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      selectOption: vi.fn().mockResolvedValue([]),
      textContent: vi.fn().mockResolvedValue('Mock text'),
      innerText: vi.fn().mockResolvedValue('Mock text'),
      innerHTML: vi.fn().mockResolvedValue('<div>Mock HTML</div>'),
      getAttribute: vi.fn().mockResolvedValue('mock-attribute'),
      count: vi.fn().mockResolvedValue(1),
      first: vi.fn().mockReturnThis(),
      last: vi.fn().mockReturnThis(),
      nth: vi.fn().mockReturnThis(),
    });
    mockPage.context.mockReturnValue({
      addCookies: vi.fn().mockResolvedValue(undefined),
      clearCookies: vi.fn().mockResolvedValue(undefined),
      clearPermissions: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      cookies: vi.fn().mockResolvedValue([]),
      newPage: vi.fn().mockResolvedValue(mockPage),
      pages: vi.fn().mockResolvedValue([mockPage]),
      route: vi.fn().mockResolvedValue(undefined),
      unroute: vi.fn().mockResolvedValue(undefined),
      setDefaultNavigationTimeout: vi.fn().mockResolvedValue(undefined),
      setDefaultTimeout: vi.fn().mockResolvedValue(undefined),
    });
    mockPage.url.mockReturnValue('https://seller.wildberries.ru');
    mockPage.title.mockResolvedValue('Wildberries Seller');
    mockPage.content.mockResolvedValue('<html><body>Mock content</body></html>');
    mockPage.reload.mockResolvedValue({} as any);
    mockPage.goBack.mockResolvedValue({} as any);
    mockPage.goForward.mockResolvedValue({} as any);
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.waitForResponse.mockResolvedValue({} as any);
    mockPage.waitForRequest.mockResolvedValue({} as any);
    mockPage.route.mockResolvedValue(undefined);
    mockPage.unroute.mockResolvedValue(undefined);
    mockPage.addInitScript.mockResolvedValue(undefined);
    mockPage.removeInitScript.mockResolvedValue(undefined);
    mockPage.addStyleTag.mockResolvedValue({} as any);
    mockPage.addScriptTag.mockResolvedValue({} as any);
    mockPage.exposeFunction.mockResolvedValue(undefined);
    mockPage.removeExposedFunction.mockResolvedValue(undefined);

    return mockPage;
  }

  static createMockBrowser(): Browser {
    const mockBrowser = {
      newPage: vi.fn(),
      close: vi.fn(),
      isConnected: vi.fn(),
      newContext: vi.fn(),
      contexts: vi.fn(),
      version: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      emit: vi.fn(),
      listenerCount: vi.fn(),
      listeners: vi.fn(),
      rawListeners: vi.fn(),
      setMaxListeners: vi.fn(),
      getMaxListeners: vi.fn(),
      eventNames: vi.fn(),
    } as unknown as Browser;

    const mockPage = this.createMockPage();
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockBrowser.close.mockResolvedValue(undefined);
    mockBrowser.isConnected.mockReturnValue(true);
    mockBrowser.newContext.mockResolvedValue({
      addCookies: vi.fn().mockResolvedValue(undefined),
      clearCookies: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue(mockPage),
      pages: vi.fn().mockResolvedValue([mockPage]),
    } as unknown as BrowserContext);
    mockBrowser.contexts.mockResolvedValue([]);
    mockBrowser.version.mockReturnValue('120.0.0.0');

    return mockBrowser;
  }

  // ===== PRISMA MOCKS =====

  static createMockPrisma(): PrismaClient {
    const mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      wBSession: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      task: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      run: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      runLog: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      warehouse: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $runCommandRaw: vi.fn(),
    } as unknown as PrismaClient;

    // Default successful responses
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.wBSession.findFirst.mockResolvedValue({
      id: 'test-session',
      userId: 'test-user',
      sessionId: 'session-123',
      cookiesEncrypted: 'encrypted_cookies',
      localStorageEncrypted: 'encrypted_localStorage',
      sessionStorageEncrypted: 'encrypted_sessionStorage',
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.task.create.mockResolvedValue({
      id: 'test-task',
      userId: 'test-user',
      name: 'Test Task',
      description: 'Test Description',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.run.create.mockResolvedValue({
      id: 'test-run',
      taskId: 'test-task',
      status: 'RUNNING',
      startedAt: new Date(),
      completedAt: null,
      foundSlots: [],
      errors: [],
    });

    mockPrisma.runLog.create.mockResolvedValue({
      id: 'test-log',
      runId: 'test-run',
      level: 'INFO',
      message: 'Test log message',
      timestamp: new Date(),
    });

    mockPrisma.$connect.mockResolvedValue(undefined);
    mockPrisma.$disconnect.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrisma);
    });

    return mockPrisma;
  }

  // ===== ERROR SCENARIOS =====

  static createNetworkErrorMocks() {
    return {
      timeout: new Error('Navigation timeout'),
      dnsFailure: new Error('ENOTFOUND: seller.wildberries.ru'),
      connectionRefused: new Error('ECONNREFUSED'),
      sslError: new Error('CERT_HAS_EXPIRED'),
      rateLimit: new Error('Rate limit exceeded'),
      serverError: new Error('Internal Server Error'),
      badGateway: new Error('Bad Gateway'),
      serviceUnavailable: new Error('Service Unavailable'),
      gatewayTimeout: new Error('Gateway Timeout'),
    };
  }

  static createBrowserErrorMocks() {
    return {
      browserCrashed: new Error('Target page, context or browser has been closed'),
      pageCrashed: new Error('Page crashed'),
      memoryExhaustion: new Error('Cannot allocate memory'),
      diskSpace: new Error('ENOSPC: no space left on device'),
      permissionDenied: new Error('EACCES: permission denied'),
      tooManyFiles: new Error('EMFILE: too many open files'),
      elementNotFound: new Error('Element not found'),
      elementNotClickable: new Error('Element not clickable'),
      formFieldNotFound: new Error('Form field not found'),
    };
  }

  static createDatabaseErrorMocks() {
    return {
      connectionFailed: new Error('Connection failed'),
      queryTimeout: new Error('Query timeout'),
      uniqueConstraint: new Error('Unique constraint failed'),
      foreignKeyConstraint: new Error('Foreign key constraint failed'),
      deadlock: new Error('Deadlock found'),
      transactionFailed: new Error('Transaction failed'),
      constraintViolation: new Error('Constraint violation'),
      dataTooLong: new Error('Data too long for column'),
      invalidData: new Error('Invalid data format'),
    };
  }

  // ===== API RESPONSE MOCKS =====

  static createWBAPIResponseMocks() {
    return {
      success: {
        error: false,
        errorText: '',
        data: [
          {
            id: 'slot1',
            warehouseId: 117501,
            boxTypeId: 2,
            coefficient: 1.5,
            date: '2024-01-01',
            timeSlot: '10:00-12:00',
            isAvailable: true,
          },
          {
            id: 'slot2',
            warehouseId: 117501,
            boxTypeId: 2,
            coefficient: 2.0,
            date: '2024-01-01',
            timeSlot: '14:00-16:00',
            isAvailable: true,
          },
        ],
      },
      empty: {
        error: false,
        errorText: '',
        data: [],
      },
      error: {
        error: true,
        errorText: 'API Error',
        data: null,
      },
      malformed: {
        error: false,
        errorText: '',
        data: 'invalid_json_string',
      },
      partialFailure: {
        error: true,
        errorText: 'Partial failure',
        data: [
          {
            id: 'slot1',
            warehouseId: 117501,
            boxTypeId: 2,
            coefficient: 1.5,
            date: '2024-01-01',
            timeSlot: '10:00-12:00',
            isAvailable: true,
          },
        ],
      },
      rateLimited: {
        error: true,
        errorText: 'Rate limit exceeded',
        data: null,
        retryAfter: 60,
      },
    };
  }

  // ===== SESSION MOCKS =====

  static createSessionMocks() {
    return {
      valid: {
        id: 'valid-session',
        userId: 'test-user',
        sessionId: 'session-123',
        cookiesEncrypted: 'encrypted_cookies',
        localStorageEncrypted: 'encrypted_localStorage',
        sessionStorageEncrypted: 'encrypted_sessionStorage',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
        fingerprint: 'valid-fingerprint',
        metadata: { userAgent: 'Mozilla/5.0', ipAddress: '192.168.1.1' },
      },
      expired: {
        id: 'expired-session',
        userId: 'test-user',
        sessionId: 'session-456',
        cookiesEncrypted: 'encrypted_cookies',
        isActive: false,
        expiresAt: new Date(Date.now() - 1000),
        lastUsedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      corrupted: {
        id: 'corrupted-session',
        userId: 'test-user',
        sessionId: 'session-789',
        cookiesEncrypted: 'corrupted_data',
        localStorageEncrypted: 'invalid_json',
        sessionStorageEncrypted: null,
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      empty: {
        id: 'empty-session',
        userId: 'test-user',
        sessionId: 'session-000',
        cookiesEncrypted: '',
        localStorageEncrypted: '',
        sessionStorageEncrypted: '',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    };
  }

  // ===== SLOT DATA MOCKS =====

  static createSlotDataMocks() {
    return {
      valid: [
        {
          id: 'slot1',
          warehouseId: 117501,
          boxTypeId: 2,
          coefficient: 1.5,
          date: '2024-01-01',
          timeSlot: '10:00-12:00',
          isAvailable: true,
          allowUnload: true,
        },
        {
          id: 'slot2',
          warehouseId: 130744,
          boxTypeId: 2,
          coefficient: 2.0,
          date: '2024-01-01',
          timeSlot: '14:00-16:00',
          isAvailable: true,
          allowUnload: false,
        },
      ],
      invalid: [
        { id: null, coefficient: 'invalid' },
        { id: 'slot2', coefficient: -1 },
        { id: 'slot3', coefficient: 999999 },
        { id: 'slot4' }, // Missing coefficient
        { coefficient: 1.5 }, // Missing id
      ],
      large: Array(10000).fill(null).map((_, i) => ({
        id: `slot_${i}`,
        warehouseId: 117501,
        boxTypeId: 2,
        coefficient: Math.random() * 5,
        date: '2024-01-01',
        timeSlot: '10:00-12:00',
        isAvailable: true,
        allowUnload: true,
      })),
    };
  }

  // ===== PERFORMANCE MOCKS =====

  static createPerformanceMocks() {
    return {
      fastResponse: vi.fn().mockResolvedValue({
        success: true,
        foundSlots: [
          { id: 'slot1', warehouseId: 117501, coefficient: 1.5 },
        ],
      }),
      slowResponse: vi.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            foundSlots: [
              { id: 'slot1', warehouseId: 117501, coefficient: 1.5 },
            ],
          }), 5000)
        )
      ),
      memoryIntensive: vi.fn().mockResolvedValue({
        success: true,
        foundSlots: Array(100000).fill(null).map((_, i) => ({
          id: `slot_${i}`,
          warehouseId: 117501,
          coefficient: Math.random() * 5,
          largeData: 'x'.repeat(1000),
        })),
      }),
    };
  }

  // ===== UTILITY METHODS =====

  static setupDefaultMocks() {
    const mocks = {
      prisma: this.createMockPrisma(),
      browser: this.createMockBrowser(),
      page: this.createMockPage(),
      errors: {
        network: this.createNetworkErrorMocks(),
        browser: this.createBrowserErrorMocks(),
        database: this.createDatabaseErrorMocks(),
      },
      api: this.createWBAPIResponseMocks(),
      sessions: this.createSessionMocks(),
      slots: this.createSlotDataMocks(),
      performance: this.createPerformanceMocks(),
    };

    // Setup global mocks
    vi.mock('@/lib/prisma', () => ({
      prisma: mocks.prisma,
    }));

    vi.mock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue(mocks.browser),
      },
    }));

    vi.mock('@/lib/encryption', () => ({
      encrypt: vi.fn().mockImplementation((data) => `encrypted_${data}`),
      decrypt: vi.fn().mockImplementation((data) => data.replace('encrypted_', '')),
    }));

    vi.mock('@/lib/auth', () => ({
      requireAuth: vi.fn().mockResolvedValue({ id: 'test-user' }),
    }));

    return mocks;
  }

  static createErrorScenario(scenario: string) {
    const mocks = this.setupDefaultMocks();
    
    switch (scenario) {
      case 'network-timeout':
        mocks.page.goto.mockRejectedValue(mocks.errors.network.timeout);
        break;
      case 'dns-failure':
        mocks.page.goto.mockRejectedValue(mocks.errors.network.dnsFailure);
        break;
      case 'browser-crash':
        mocks.browser.isConnected.mockReturnValue(false);
        break;
      case 'database-deadlock':
        mocks.prisma.task.create.mockRejectedValue(mocks.errors.database.deadlock);
        break;
      case 'rate-limit':
        mocks.page.evaluate.mockResolvedValue(mocks.api.rateLimited);
        break;
      case 'session-expired':
        mocks.prisma.wBSession.findFirst.mockResolvedValue(mocks.sessions.expired);
        break;
      case 'corrupted-data':
        mocks.prisma.wBSession.findFirst.mockResolvedValue(mocks.sessions.corrupted);
        break;
      default:
        break;
    }

    return mocks;
  }
}

// ===== EXPORT INDIVIDUAL MOCK CREATORS =====

export const createMockPage = ComprehensiveMocks.createMockPage;
export const createMockBrowser = ComprehensiveMocks.createMockBrowser;
export const createMockPrisma = ComprehensiveMocks.createMockPrisma;
export const createNetworkErrorMocks = ComprehensiveMocks.createNetworkErrorMocks;
export const createBrowserErrorMocks = ComprehensiveMocks.createBrowserErrorMocks;
export const createDatabaseErrorMocks = ComprehensiveMocks.createDatabaseErrorMocks;
export const createWBAPIResponseMocks = ComprehensiveMocks.createWBAPIResponseMocks;
export const createSessionMocks = ComprehensiveMocks.createSessionMocks;
export const createSlotDataMocks = ComprehensiveMocks.createSlotDataMocks;
export const createPerformanceMocks = ComprehensiveMocks.createPerformanceMocks;
export const setupDefaultMocks = ComprehensiveMocks.setupDefaultMocks;
export const createErrorScenario = ComprehensiveMocks.createErrorScenario;
