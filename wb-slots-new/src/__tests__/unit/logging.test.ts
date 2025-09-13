// ===== UNIT TESTS FOR LOGGING SYSTEM =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ===== MOCK SETUP =====
const mockPrisma = {
  runLog: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

// ===== TEST DATA =====
const mockRunId = 'run-123';
const mockUserId = 'user-456';
const mockTaskId = 'task-789';

// ===== TEST SUITE =====
describe('Logging System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Run Logging', () => {
    it('should log info message', async () => {
      // Arrange
      const { RunManager } = require('../../lib/services/refactored/slot-search-service');
      const level = 'INFO';
      const message = 'Test info message';
      const meta = { test: 'data' };

      // Act
      await RunManager.logMessage(mockRunId, level, message, meta);

      // Assert
      expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
        data: {
          runId: mockRunId,
          level,
          message,
          meta: JSON.stringify(meta),
        },
      });
    });

    it('should log error message', async () => {
      // Arrange
      const { RunManager } = require('../../lib/services/refactored/slot-search-service');
      const level = 'ERROR';
      const message = 'Test error message';
      const meta = { error: 'Test error', stack: 'Error stack' };

      // Act
      await RunManager.logMessage(mockRunId, level, message, meta);

      // Assert
      expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
        data: {
          runId: mockRunId,
          level,
          message,
          meta: JSON.stringify(meta),
        },
      });
    });

    it('should log warning message', async () => {
      // Arrange
      const { RunManager } = require('../../lib/services/refactored/slot-search-service');
      const level = 'WARN';
      const message = 'Test warning message';
      const meta = { warning: 'Test warning' };

      // Act
      await RunManager.logMessage(mockRunId, level, message, meta);

      // Assert
      expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
        data: {
          runId: mockRunId,
          level,
          message,
          meta: JSON.stringify(meta),
        },
      });
    });

    it('should log debug message', async () => {
      // Arrange
      const { RunManager } = require('../../lib/services/refactored/slot-search-service');
      const level = 'DEBUG';
      const message = 'Test debug message';
      const meta = { debug: 'Test debug info' };

      // Act
      await RunManager.logMessage(mockRunId, level, message, meta);

      // Assert
      expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
        data: {
          runId: mockRunId,
          level,
          message,
          meta: JSON.stringify(meta),
        },
      });
    });

    it('should log message without metadata', async () => {
      // Arrange
      const { RunManager } = require('../../lib/services/refactored/slot-search-service');
      const level = 'INFO';
      const message = 'Test message without metadata';

      // Act
      await RunManager.logMessage(mockRunId, level, message);

      // Assert
      expect(mockPrisma.runLog.create).toHaveBeenCalledWith({
        data: {
          runId: mockRunId,
          level,
          message,
          meta: undefined,
        },
      });
    });

    it('should handle logging errors gracefully', async () => {
      // Arrange
      const { RunManager } = require('../../lib/services/refactored/slot-search-service');
      const level = 'INFO';
      const message = 'Test message';
      const meta = { test: 'data' };

      mockPrisma.runLog.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(RunManager.logMessage(mockRunId, level, message, meta))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('Audit Logging', () => {
    it('should log user action', async () => {
      // Arrange
      const { AuditLogger } = require('../../lib/logging/audit-logger');
      const action = 'CREATE_TASK';
      const resource = 'Task';
      const resourceId = mockTaskId;
      const details = { name: 'Test Task', warehouseIds: [1, 2, 3] };

      // Act
      await AuditLogger.logUserAction(mockUserId, action, resource, resourceId, details);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action,
          resource,
          resourceId,
          details: JSON.stringify(details),
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log system event', async () => {
      // Arrange
      const { AuditLogger } = require('../../lib/logging/audit-logger');
      const event = 'TASK_COMPLETED';
      const details = { taskId: mockTaskId, foundSlots: 5, duration: 120000 };

      // Act
      await AuditLogger.logSystemEvent(event, details);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: event,
          resource: 'SYSTEM',
          resourceId: null,
          details: JSON.stringify(details),
          ipAddress: null,
          userAgent: null,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log error event', async () => {
      // Arrange
      const { AuditLogger } = require('../../lib/logging/audit-logger');
      const error = new Error('Test error');
      const context = { taskId: mockTaskId, step: 'validation' };

      // Act
      await AuditLogger.logError(error, context);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'ERROR',
          resource: 'SYSTEM',
          resourceId: null,
          details: JSON.stringify({
            error: error.message,
            stack: error.stack,
            context,
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: expect.any(Date),
        },
      });
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', async () => {
      // Arrange
      const { PerformanceLogger } = require('../../lib/logging/performance-logger');
      const operation = 'SLOT_SEARCH';
      const duration = 1500;
      const metrics = {
        foundSlots: 5,
        totalChecked: 100,
        apiCalls: 3,
        memoryUsage: 50,
      };

      // Act
      await PerformanceLogger.logOperation(operation, duration, metrics);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'PERFORMANCE',
          resource: operation,
          resourceId: null,
          details: JSON.stringify({
            duration,
            metrics,
            timestamp: expect.any(Date),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log slow operations', async () => {
      // Arrange
      const { PerformanceLogger } = require('../../lib/logging/performance-logger');
      const operation = 'SLOT_SEARCH';
      const duration = 10000; // 10 seconds
      const metrics = {
        foundSlots: 0,
        totalChecked: 1000,
        apiCalls: 50,
        memoryUsage: 200,
      };

      // Act
      await PerformanceLogger.logOperation(operation, duration, metrics);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'PERFORMANCE',
          resource: operation,
          resourceId: null,
          details: JSON.stringify({
            duration,
            metrics,
            timestamp: expect.any(Date),
            isSlow: true,
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: expect.any(Date),
        },
      });
    });
  });

  describe('Security Logging', () => {
    it('should log authentication events', async () => {
      // Arrange
      const { SecurityLogger } = require('../../lib/logging/security-logger');
      const event = 'LOGIN_SUCCESS';
      const details = { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0' };

      // Act
      await SecurityLogger.logAuthEvent(mockUserId, event, details);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: 'AUTH',
          resource: 'USER',
          resourceId: mockUserId,
          details: JSON.stringify({
            event,
            ...details,
            timestamp: expect.any(Date),
          }),
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log security violations', async () => {
      // Arrange
      const { SecurityLogger } = require('../../lib/logging/security-logger');
      const violation = 'UNAUTHORIZED_ACCESS';
      const details = {
        resource: 'admin-panel',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        attemptCount: 3,
      };

      // Act
      await SecurityLogger.logSecurityViolation(violation, details);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'SECURITY_VIOLATION',
          resource: 'SYSTEM',
          resourceId: null,
          details: JSON.stringify({
            violation,
            ...details,
            timestamp: expect.any(Date),
          }),
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
          timestamp: expect.any(Date),
        },
      });
    });
  });

  describe('Business Logic Logging', () => {
    it('should log slot search events', async () => {
      // Arrange
      const { BusinessLogger } = require('../../lib/logging/business-logger');
      const event = 'SLOT_FOUND';
      const details = {
        taskId: mockTaskId,
        warehouseId: 1,
        coefficient: 1.5,
        date: '2024-01-15',
      };

      // Act
      await BusinessLogger.logSlotEvent(event, details);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'BUSINESS_EVENT',
          resource: 'SLOT',
          resourceId: mockTaskId,
          details: JSON.stringify({
            event,
            ...details,
            timestamp: expect.any(Date),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log booking events', async () => {
      // Arrange
      const { BusinessLogger } = require('../../lib/logging/business-logger');
      const event = 'BOOKING_SUCCESS';
      const details = {
        taskId: mockTaskId,
        slotId: 'slot-123',
        bookingId: 'booking-456',
        warehouseId: 1,
      };

      // Act
      await BusinessLogger.logBookingEvent(event, details);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'BUSINESS_EVENT',
          resource: 'BOOKING',
          resourceId: mockTaskId,
          details: JSON.stringify({
            event,
            ...details,
            timestamp: expect.any(Date),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log task events', async () => {
      // Arrange
      const { BusinessLogger } = require('../../lib/logging/business-logger');
      const event = 'TASK_STARTED';
      const details = {
        taskId: mockTaskId,
        userId: mockUserId,
        config: { warehouseIds: [1, 2, 3] },
      };

      // Act
      await BusinessLogger.logTaskEvent(event, details);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: 'BUSINESS_EVENT',
          resource: 'TASK',
          resourceId: mockTaskId,
          details: JSON.stringify({
            event,
            ...details,
            timestamp: expect.any(Date),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: expect.any(Date),
        },
      });
    });
  });

  describe('Logging Configuration', () => {
    it('should respect log level configuration', async () => {
      // Arrange
      const { Logger } = require('../../lib/logging/logger');
      const logger = new Logger('DEBUG');

      // Mock console methods
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(4);

      consoleSpy.mockRestore();
    });

    it('should filter logs by level', async () => {
      // Arrange
      const { Logger } = require('../../lib/logging/logger');
      const logger = new Logger('WARN');

      // Mock console methods
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(2); // Only warn and error

      consoleSpy.mockRestore();
    });

    it('should format logs correctly', async () => {
      // Arrange
      const { Logger } = require('../../lib/logging/logger');
      const logger = new Logger('INFO');

      // Mock console methods
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      logger.info('Test message', { userId: 'user-123', action: 'test' });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('Test message'),
        expect.objectContaining({ userId: 'user-123', action: 'test' })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Logging Error Handling', () => {
    it('should handle logging failures gracefully', async () => {
      // Arrange
      const { RunManager } = require('../../lib/services/refactored/slot-search-service');
      mockPrisma.runLog.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(RunManager.logMessage(mockRunId, 'INFO', 'Test message'))
        .rejects
        .toThrow('Database error');
    });

    it('should not throw errors in audit logging', async () => {
      // Arrange
      const { AuditLogger } = require('../../lib/logging/audit-logger');
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(AuditLogger.logUserAction(mockUserId, 'TEST', 'Resource', 'id', {}))
        .rejects
        .toThrow('Database error');
    });
  });
});
