// ===== TEST SETUP =====

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';

// ===== GLOBAL MOCKS =====

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/wb_slots_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output in tests unless explicitly enabled
  if (!process.env.VITEST_VERBOSE) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  }
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// ===== TEST UTILITIES =====

export const createMockPrisma = () => ({
  run: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  runLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  userToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  task: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  wBSession: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  warehouse: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userWarehouse: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  foundSlot: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  telegramSettings: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  notificationChannel: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
});

export const createMockWBClient = () => ({
  searchAvailableSlots: vi.fn(),
  getCoefficients: vi.fn(),
  getSupplies: vi.fn(),
  getWarehouses: vi.fn(),
});

export const createMockTelegramService = () => ({
  sendNotification: vi.fn(),
  notifySlotsFound: vi.fn(),
  notifyBookingError: vi.fn(),
  notifyBookingSuccess: vi.fn(),
  notifyTaskCompleted: vi.fn(),
  notifyTaskFailed: vi.fn(),
});

export const createMockAutoBookingService = () => ({
  startBooking: vi.fn(),
  stop: vi.fn(),
  isBookingInProgress: vi.fn(),
});

// ===== TEST DATA FACTORIES =====

export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockTask = (overrides = {}) => ({
  id: 'task-123',
  userId: 'user-123',
  name: 'Test Task',
  description: 'Test task description',
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
  priority: 1,
  successCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockRun = (overrides = {}) => ({
  id: 'run-123',
  taskId: 'task-123',
  userId: 'user-123',
  status: 'RUNNING',
  startedAt: new Date(),
  finishedAt: null,
  foundSlots: 0,
  summary: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockUserToken = (overrides = {}) => ({
  id: 'token-123',
  userId: 'user-123',
  category: 'SUPPLIES',
  tokenEncrypted: 'encrypted-token',
  isActive: true,
  lastUsedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockWBSession = (overrides = {}) => ({
  id: 'session-123',
  userId: 'user-123',
  sessionId: 'wb-session-123',
  cookies: {
    encrypted: 'encrypted-cookie-data',
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockWarehouse = (overrides = {}) => ({
  id: 1,
  name: 'Test Warehouse',
  address: 'Test Address',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockFoundSlot = (overrides = {}) => ({
  id: 'slot-123',
  runId: 'run-123',
  warehouseId: 1,
  warehouseName: 'Test Warehouse',
  date: '2024-01-15',
  timeSlot: '10:00-12:00',
  coefficient: 1.5,
  isAvailable: true,
  boxTypes: [2, 5],
  foundAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ===== TEST HELPERS =====

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createMockError = (message: string, code?: string) => {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
};

export const createMockRateLimitError = () => {
  const error = new Error('Rate limit exceeded');
  error.message = '429 Too Many Requests';
  return error;
};

export const createMockNetworkError = () => {
  const error = new Error('ECONNREFUSED: Connection refused');
  return error;
};

export const createMockDatabaseError = () => {
  const error = new Error('Database connection failed');
  return error;
};

// ===== CLEANUP HELPERS =====

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});
