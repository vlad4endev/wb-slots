// ===== IMPROVED LOGGING SYSTEM =====

import { prisma } from '../prisma';
import { safeJsonStringify } from '../utils';

// ===== TYPES =====
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  requestId?: string;
  operation?: string;
}

export interface PerformanceMetrics {
  duration: number;
  memoryUsage?: number;
  apiCalls?: number;
  foundSlots?: number;
  totalChecked?: number;
  errors?: number;
}

// ===== LOG LEVELS =====
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

// ===== LOGGER CLASS =====
export class Logger {
  private level: LogLevel;
  private context: Record<string, any>;

  constructor(level: LogLevel = 'INFO', context: Record<string, any> = {}) {
    this.level = level;
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0 ? ` [${safeJsonStringify(this.context)}]` : '';
    const metaStr = meta ? ` ${safeJsonStringify(meta)}` : '';
    
    return `[${timestamp}] [${level}]${contextStr} ${message}${metaStr}`;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    switch (level) {
      case 'DEBUG':
      case 'INFO':
        console.log(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'ERROR':
      case 'FATAL':
        console.error(formattedMessage);
        break;
    }
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log('DEBUG', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.log('ERROR', message, meta);
  }

  fatal(message: string, meta?: Record<string, any>): void {
    this.log('FATAL', message, meta);
  }

  child(context: Record<string, any>): Logger {
    return new Logger(this.level, { ...this.context, ...context });
  }
}

// ===== RUN LOGGER =====
export class RunLogger {
  private logger: Logger;

  constructor(runId: string, userId?: string) {
    this.logger = new Logger('INFO', { runId, userId });
  }

  async logMessage(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>
  ): Promise<void> {
    try {
      // Log to console
      this.logger[level.toLowerCase() as keyof Logger](message, meta);

      // Log to database
      await prisma.runLog.create({
        data: {
          runId: this.logger['context'].runId,
          level: level as any,
          message,
          meta: meta ? safeJsonStringify(meta) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to log run message:', error);
    }
  }

  async logSlotFound(slot: any): Promise<void> {
    await this.logMessage('INFO', 'Slot found', {
      warehouseId: slot.warehouseId,
      warehouseName: slot.warehouseName,
      date: slot.date,
      coefficient: slot.coefficient,
    });
  }

  async logSlotBooked(bookingId: string, slot: any): Promise<void> {
    await this.logMessage('INFO', 'Slot booked successfully', {
      bookingId,
      warehouseId: slot.warehouseId,
      date: slot.date,
      coefficient: slot.coefficient,
    });
  }

  async logError(error: Error, context?: Record<string, any>): Promise<void> {
    await this.logMessage('ERROR', 'Error occurred', {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  }

  async logPerformance(metrics: PerformanceMetrics): Promise<void> {
    await this.logMessage('INFO', 'Performance metrics', {
      duration: metrics.duration,
      memoryUsage: metrics.memoryUsage,
      apiCalls: metrics.apiCalls,
      foundSlots: metrics.foundSlots,
      totalChecked: metrics.totalChecked,
      errors: metrics.errors,
    });
  }
}

// ===== AUDIT LOGGER =====
export class AuditLogger {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('INFO', { service: 'INFO' });
  }

  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          details: details ? safeJsonStringify(details) : undefined,
          ipAddress: this.getClientIP(),
          userAgent: this.getUserAgent(),
          timestamp: new Date(),
        },
      });

      this.logger.info('User action logged', {
        userId,
        action,
        resource,
        resourceId,
        details,
      });
    } catch (error) {
      this.logger.error('Failed to log user action', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async logSystemEvent(
    event: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: event,
          resource: 'SYSTEM',
          resourceId: null,
          details: details ? safeJsonStringify(details) : undefined,
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
        },
      });

      this.logger.info('System event logged', { event, details });
    } catch (error) {
      this.logger.error('Failed to log system event', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async logError(
    error: Error,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'ERROR',
          resource: 'SYSTEM',
          resourceId: null,
          details: safeJsonStringify({
            error: error.message,
            stack: error.stack,
            context,
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
        },
      });

      this.logger.error('Error logged', {
        error: error.message,
        stack: error.stack,
        context,
      });
    } catch (logError) {
      this.logger.error('Failed to log error', { error: logError instanceof Error ? logError.message : 'Unknown error' });
    }
  }

  private getClientIP(): string {
    // In real implementation, this would extract IP from request
    return '127.0.0.1';
  }

  private getUserAgent(): string {
    // In real implementation, this would extract user agent from request
    return 'WB-Slots/1.0.0';
  }
}

// ===== PERFORMANCE LOGGER =====
export class PerformanceLogger {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('INFO', { service: 'INFO' });
  }

  async logOperation(
    operation: string,
    duration: number,
    metrics?: PerformanceMetrics
  ): Promise<void> {
    try {
      const isSlow = duration > 5000; // 5 seconds threshold

      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'PERFORMANCE',
          resource: operation,
          resourceId: null,
          details: safeJsonStringify({
            duration,
            metrics,
            isSlow,
            timestamp: new Date(),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
        },
      });

      const level = isSlow ? 'WARN' : 'INFO';
      this.logger[level]('Performance logged', {
        operation,
        duration,
        metrics,
        isSlow,
      });
    } catch (error) {
      this.logger.error('Failed to log performance', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async logSlowOperation(
    operation: string,
    duration: number,
    metrics?: PerformanceMetrics
  ): Promise<void> {
    await this.logOperation(operation, duration, { ...metrics, isSlow: true });
  }
}

// ===== SECURITY LOGGER =====
export class SecurityLogger {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('INFO', { service: 'WARN' });
  }

  async logAuthEvent(
    userId: string,
    event: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'AUTH',
          resource: 'USER',
          resourceId: userId,
          details: safeJsonStringify({
            event,
            ...details,
            timestamp: new Date(),
          }),
          ipAddress: this.getClientIP(),
          userAgent: this.getUserAgent(),
          timestamp: new Date(),
        },
      });

      this.logger.info('Auth event logged', { userId, event, details });
    } catch (error) {
      this.logger.error('Failed to log auth event', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async logSecurityViolation(
    violation: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'SECURITY_VIOLATION',
          resource: 'SYSTEM',
          resourceId: null,
          details: safeJsonStringify({
            violation,
            ...details,
            timestamp: new Date(),
          }),
          ipAddress: this.getClientIP(),
          userAgent: this.getUserAgent(),
          timestamp: new Date(),
        },
      });

      this.logger.warn('Security violation logged', { violation, details });
    } catch (error) {
      this.logger.error('Failed to log security violation', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private getClientIP(): string {
    return '127.0.0.1';
  }

  private getUserAgent(): string {
    return 'WB-Slots/1.0.0';
  }
}

// ===== BUSINESS LOGGER =====
export class BusinessLogger {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('INFO', { service: 'INFO' });
  }

  async logSlotEvent(
    event: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'BUSINESS_EVENT',
          resource: 'SLOT',
          resourceId: details?.taskId || null,
          details: safeJsonStringify({
            event,
            ...details,
            timestamp: new Date(),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
        },
      });

      this.logger.info('Slot event logged', { event, details });
    } catch (error) {
      this.logger.error('Failed to log slot event', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async logBookingEvent(
    event: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'BUSINESS_EVENT',
          resource: 'BOOKING',
          resourceId: details?.taskId || null,
          details: safeJsonStringify({
            event,
            ...details,
            timestamp: new Date(),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
        },
      });

      this.logger.info('Booking event logged', { event, details });
    } catch (error) {
      this.logger.error('Failed to log booking event', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async logTaskEvent(
    event: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: details?.userId || null,
          action: 'BUSINESS_EVENT',
          resource: 'TASK',
          resourceId: details?.taskId || null,
          details: safeJsonStringify({
            event,
            ...details,
            timestamp: new Date(),
          }),
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
        },
      });

      this.logger.info('Task event logged', { event, details });
    } catch (error) {
      this.logger.error('Failed to log task event', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

// ===== EXPORTS =====
export const logger = new Logger();
export const runLogger = (runId: string, userId?: string) => new RunLogger(runId, userId);
export const auditLogger = new AuditLogger();
export const performanceLogger = new PerformanceLogger();
export const securityLogger = new SecurityLogger();
export const businessLogger = new BusinessLogger();
