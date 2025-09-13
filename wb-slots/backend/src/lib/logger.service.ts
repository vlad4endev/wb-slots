import { Injectable, LoggerService, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context?: string;
  userId?: string;
  taskId?: string;
  runId?: string;
  meta?: any;
  timestamp?: Date;
}

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger = new Logger(AppLoggerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Write a 'log' level log.
   */
  log(message: any, context?: string) {
    this.logger.log(message, context);
    this.saveToDatabase('INFO', message, context);
  }

  /**
   * Write an 'error' level log.
   */
  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
    this.saveToDatabase('ERROR', message, context, { trace });
  }

  /**
   * Write a 'warn' level log.
   */
  warn(message: any, context?: string) {
    this.logger.warn(message, context);
    this.saveToDatabase('WARN', message, context);
  }

  /**
   * Write a 'debug' level log.
   */
  debug(message: any, context?: string) {
    this.logger.debug(message, context);
    this.saveToDatabase('DEBUG', message, context);
  }

  /**
   * Write a 'verbose' level log.
   */
  verbose(message: any, context?: string) {
    this.logger.verbose(message, context);
    this.saveToDatabase('DEBUG', message, context);
  }

  /**
   * Log slot search results
   */
  async logSlotSearch(
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    data: {
      userId: string;
      taskId?: string;
      runId?: string;
      foundSlotsCount: number;
      searchTime: number;
      filters: any;
      error?: string;
    }
  ) {
    const logMessage = `${message} | Found: ${data.foundSlotsCount} | Time: ${data.searchTime}ms`;
    
    if (level === 'ERROR') {
      this.error(logMessage, data.error, 'SlotSearch');
    } else if (level === 'WARN') {
      this.warn(logMessage, 'SlotSearch');
    } else {
      this.log(logMessage, 'SlotSearch');
    }

    // Save detailed log to database
    await this.saveToDatabase(level, logMessage, 'SlotSearch', {
      userId: data.userId,
      taskId: data.taskId,
      runId: data.runId,
      foundSlotsCount: data.foundSlotsCount,
      searchTime: data.searchTime,
      filters: data.filters,
      error: data.error,
    });
  }

  /**
   * Log empty search results
   */
  async logEmptyResults(
    userId: string,
    filters: any,
    searchTime: number,
    taskId?: string,
    runId?: string
  ) {
    await this.logSlotSearch('WARN', 'No slots found for search criteria', {
      userId,
      taskId,
      runId,
      foundSlotsCount: 0,
      searchTime,
      filters,
    });
  }

  /**
   * Log search errors
   */
  async logSearchError(
    userId: string,
    error: string,
    filters: any,
    searchTime: number,
    taskId?: string,
    runId?: string
  ) {
    await this.logSlotSearch('ERROR', 'Slot search failed', {
      userId,
      taskId,
      runId,
      foundSlotsCount: 0,
      searchTime,
      filters,
      error,
    });
  }

  /**
   * Log successful search
   */
  async logSearchSuccess(
    userId: string,
    foundSlotsCount: number,
    searchTime: number,
    filters: any,
    taskId?: string,
    runId?: string
  ) {
    await this.logSlotSearch('INFO', 'Slot search completed successfully', {
      userId,
      taskId,
      runId,
      foundSlotsCount,
      searchTime,
      filters,
    });
  }

  /**
   * Save log entry to database
   */
  private async saveToDatabase(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    context?: string,
    meta?: any
  ) {
    try {
      // Create a simple log entry in the database
      await this.prisma.$executeRaw`
        INSERT INTO slot_search_logs (level, message, context, meta, created_at)
        VALUES (${level}, ${message}, ${context || 'App'}, ${JSON.stringify(meta || {})}::jsonb, ${new Date()})
      `;
    } catch (error) {
      // Don't throw error if logging fails
      console.error('Failed to save log to database:', error);
    }
  }

  /**
   * Get search logs for a user
   */
  async getUserSearchLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    try {
      const logs = await this.prisma.$queryRaw`
        SELECT * FROM slot_search_logs 
        WHERE meta->>'userId' = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return logs;
    } catch (error) {
      console.error('Failed to get user search logs:', error);
      return [];
    }
  }

  /**
   * Get error logs
   */
  async getErrorLogs(limit: number = 100, offset: number = 0) {
    try {
      const logs = await this.prisma.$queryRaw`
        SELECT * FROM slot_search_logs 
        WHERE level = 'ERROR'
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return logs;
    } catch (error) {
      console.error('Failed to get error logs:', error);
      return [];
    }
  }
}
