// ===== UNIT TESTS FOR LOGGING =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ===== MOCKS =====
const mockPrisma = {
  runLog: {
    create: vi.fn(),
  },
};

vi.mock('../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { Logger } from '../../lib/logging/logger';

// ===== TEST SUITE =====
describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('INFO', { service: 'TestLogger' });
    vi.clearAllMocks();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with correct context', () => {
      expect(logger).toBeInstanceOf(Logger);
      expect(logger['context']).toBe('TestLogger');
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      logger.debug('Debug message');
      
      expect(console.debug).toHaveBeenCalledWith(
        '[TestLogger] DEBUG: Debug message'
      );
    });

    it('should log debug message with metadata', () => {
      const metadata = { userId: 'user-123', action: 'login' };
      logger.debug('Debug message', metadata);
      
      expect(console.debug).toHaveBeenCalledWith(
        '[TestLogger] DEBUG: Debug message',
        metadata
      );
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      logger.info('Info message');
      
      expect(console.info).toHaveBeenCalledWith(
        '[TestLogger] INFO: Info message'
      );
    });

    it('should log info message with metadata', () => {
      const metadata = { userId: 'user-123', action: 'login' };
      logger.info('Info message', metadata);
      
      expect(console.info).toHaveBeenCalledWith(
        '[TestLogger] INFO: Info message',
        metadata
      );
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('Warning message');
      
      expect(console.warn).toHaveBeenCalledWith(
        '[TestLogger] WARN: Warning message'
      );
    });

    it('should log warning message with metadata', () => {
      const metadata = { userId: 'user-123', action: 'login' };
      logger.warn('Warning message', metadata);
      
      expect(console.warn).toHaveBeenCalledWith(
        '[TestLogger] WARN: Warning message',
        metadata
      );
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      logger.error('Error message');
      
      expect(console.error).toHaveBeenCalledWith(
        '[TestLogger] ERROR: Error message'
      );
    });

    it('should log error message with metadata', () => {
      const metadata = { userId: 'user-123', action: 'login' };
      logger.error('Error message', metadata);
      
      expect(console.error).toHaveBeenCalledWith(
        '[TestLogger] ERROR: Error message',
        metadata
      );
    });

    it('should log error with Error object', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[TestLogger] ERROR: Error occurred',
        error
      );
    });
  });

  describe('logToDatabase', () => {
    it('should log to database successfully', async () => {
      mockPrisma.runLog.create.mockResolvedValue({ id: 'log-123' });
      
      await logger.logToDatabase('run-123', 'INFO', 'Test message', { test: 'data' });
      
      expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
        data: {
          runId: 'run-123',
          level: 'INFO',
          message: 'Test message',
          meta: JSON.stringify({ test: 'data' }),
        },
      });
    });

    it('should log to database without metadata', async () => {
      mockPrisma.runLog.create.mockResolvedValue({ id: 'log-123' });
      
      await logger.logToDatabase('run-123', 'ERROR', 'Test message');
      
      expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
        data: {
          runId: 'run-123',
          level: 'ERROR',
          message: 'Test message',
          meta: undefined,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.runLog.create.mockRejectedValue(new Error('Database error'));
      
      // Should not throw
      await expect(logger.logToDatabase('run-123', 'INFO', 'Test message'))
        .resolves.toBeUndefined();
    });
  });

  describe('logWithLevel', () => {
    it('should log with DEBUG level', () => {
      logger.logWithLevel('DEBUG', 'Debug message');
      
      expect(console.debug).toHaveBeenCalledWith(
        '[TestLogger] DEBUG: Debug message'
      );
    });

    it('should log with INFO level', () => {
      logger.logWithLevel('INFO', 'Info message');
      
      expect(console.info).toHaveBeenCalledWith(
        '[TestLogger] INFO: Info message'
      );
    });

    it('should log with WARN level', () => {
      logger.logWithLevel('WARN', 'Warning message');
      
      expect(console.warn).toHaveBeenCalledWith(
        '[TestLogger] WARN: Warning message'
      );
    });

    it('should log with ERROR level', () => {
      logger.logWithLevel('ERROR', 'Error message');
      
      expect(console.error).toHaveBeenCalledWith(
        '[TestLogger] ERROR: Error message'
      );
    });

    it('should log with metadata', () => {
      const metadata = { userId: 'user-123' };
      logger.logWithLevel('INFO', 'Info message', metadata);
      
      expect(console.info).toHaveBeenCalledWith(
        '[TestLogger] INFO: Info message',
        metadata
      );
    });
  });

  describe('createChild', () => {
    it('should create child logger with extended context', () => {
      const childLogger = logger.createChild('ChildLogger');
      
      expect(childLogger).toBeInstanceOf(Logger);
      expect(childLogger['context']).toBe('TestLogger.ChildLogger');
    });

    it('should log with child context', () => {
      const childLogger = logger.createChild('ChildLogger');
      childLogger.info('Child message');
      
      expect(console.info).toHaveBeenCalledWith(
        '[TestLogger.ChildLogger] INFO: Child message'
      );
    });
  });

  describe('performance', () => {
    it('should measure performance', () => {
      const startTime = logger.startTimer('test-operation');
      
      // Simulate some work
      const endTime = logger.endTimer('test-operation', startTime);
      
      expect(endTime).toBeGreaterThan(startTime);
    });

    it('should log performance metrics', () => {
      const startTime = logger.startTimer('test-operation');
      
      // Simulate some work
      logger.endTimer('test-operation', startTime);
      
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger] INFO: Performance: test-operation took')
      );
    });
  });

  describe('structured logging', () => {
    it('should log structured data', () => {
      const structuredData = {
        userId: 'user-123',
        action: 'login',
        timestamp: new Date().toISOString(),
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      };
      
      logger.info('User login', structuredData);
      
      expect(console.info).toHaveBeenCalledWith(
        '[TestLogger] INFO: User login',
        structuredData
      );
    });
  });

  describe('error handling', () => {
    it('should handle circular references in metadata', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData;
      
      // Should not throw
      expect(() => {
        logger.info('Circular data', circularData);
      }).not.toThrow();
    });

    it('should handle undefined metadata', () => {
      // Should not throw
      expect(() => {
        logger.info('Message', undefined);
      }).not.toThrow();
    });

    it('should handle null metadata', () => {
      // Should not throw
      expect(() => {
        logger.info('Message', null);
      }).not.toThrow();
    });
  });
});

// ===== INTEGRATION TESTS =====
describe('Logger Integration', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('INFO', { service: 'IntegrationTest' });
    vi.clearAllMocks();
  });

  it('should handle complete logging flow', async () => {
    // Arrange
    mockPrisma.runLog.create.mockResolvedValue({ id: 'log-123' });
    
    // Act
    logger.info('Starting operation');
    const startTime = logger.startTimer('operation');
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    logger.endTimer('operation', startTime);
    await logger.logToDatabase('run-123', 'INFO', 'Operation completed', { 
      duration: 10 
    });
    
    // Assert
    expect(console.info).toHaveBeenCalledWith(
      '[IntegrationTest] INFO: Starting operation'
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[IntegrationTest] INFO: Performance: operation took')
    );
    expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
      data: {
        runId: 'run-123',
        level: 'INFO',
        message: 'Operation completed',
        meta: JSON.stringify({ duration: 10 }),
      },
    });
  });

  it('should handle error logging flow', async () => {
    // Arrange
    const error = new Error('Test error');
    mockPrisma.runLog.create.mockResolvedValue({ id: 'log-123' });
    
    // Act
    logger.error('Operation failed', error);
    await logger.logToDatabase('run-123', 'ERROR', 'Operation failed', { 
      error: error.message 
    });
    
    // Assert
    expect(console.error).toHaveBeenCalledWith(
      '[IntegrationTest] ERROR: Operation failed',
      error
    );
    expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
      data: {
        runId: 'run-123',
        level: 'ERROR',
        message: 'Operation failed',
        meta: JSON.stringify({ error: 'Test error' }),
      },
    });
  });
});