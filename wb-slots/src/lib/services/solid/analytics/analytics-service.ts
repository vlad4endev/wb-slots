// ===== ANALYTICS SERVICE - SRP: Аналитика и сохранение результатов =====

import { prisma } from '../../../prisma';
import { ILogger } from '../../core/interfaces';

export interface BookingAnalytics {
  userId: string;
  taskId: string;
  supplyId: string;
  warehouseId: number;
  date: string;
  success: boolean;
  bookingId?: string;
  error?: string;
  executionTime: number;
  steps: BookingStep[];
  screenshots: string[];
  sessionInfo?: SessionInfo;
  browserInfo?: BrowserInfo;
}

export interface BookingStep {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface SessionInfo {
  isValid: boolean;
  cookies: number;
  localStorage: number;
  sessionStorage: number;
  userAgent: string;
}

export interface BrowserInfo {
  version: string;
  platform: string;
  viewport: { width: number; height: number };
}

export interface IAnalyticsService {
  saveBookingResult(analytics: BookingAnalytics): Promise<void>;
  getBookingHistory(userId: string, limit?: number): Promise<BookingAnalytics[]>;
  getBookingStats(userId: string): Promise<BookingStats>;
  getSuccessRate(userId: string, days?: number): Promise<number>;
}

export interface BookingStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  averageExecutionTime: number;
  mostCommonErrors: Array<{ error: string; count: number }>;
  recentBookings: BookingAnalytics[];
}

export class AnalyticsService implements IAnalyticsService {
  constructor(private logger: ILogger) {}

  async saveBookingResult(analytics: BookingAnalytics): Promise<void> {
    this.logger.info('Saving booking analytics:', {
      userId: analytics.userId,
      supplyId: analytics.supplyId,
      success: analytics.success
    });

    try {
      await prisma.bookingResult.create({
        data: {
          userId: analytics.userId,
          taskId: analytics.taskId,
          supplyId: analytics.supplyId,
          warehouseId: analytics.warehouseId,
          date: analytics.date,
          success: analytics.success,
          bookingId: analytics.bookingId,
          error: analytics.error,
          executionTime: analytics.executionTime,
          steps: JSON.stringify(analytics.steps),
          screenshots: JSON.stringify(analytics.screenshots),
          sessionInfo: analytics.sessionInfo ? JSON.stringify(analytics.sessionInfo) : null,
          browserInfo: analytics.browserInfo ? JSON.stringify(analytics.browserInfo) : null,
          createdAt: new Date()
        }
      });

      this.logger.info('Booking analytics saved successfully');
    } catch (error) {
      this.logger.error('Failed to save booking analytics:', error);
      throw error;
    }
  }

  async getBookingHistory(userId: string, limit: number = 50): Promise<BookingAnalytics[]> {
    this.logger.info(`Getting booking history for user: ${userId}, limit: ${limit}`);

    try {
      const results = await prisma.bookingResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return results.map(result => ({
        userId: result.userId,
        taskId: result.taskId,
        supplyId: result.supplyId,
        warehouseId: result.warehouseId,
        date: result.date,
        success: result.success,
        bookingId: result.bookingId,
        error: result.error,
        executionTime: result.executionTime,
        steps: result.steps ? JSON.parse(result.steps) : [],
        screenshots: result.screenshots ? JSON.parse(result.screenshots) : [],
        sessionInfo: result.sessionInfo ? JSON.parse(result.sessionInfo) : undefined,
        browserInfo: result.browserInfo ? JSON.parse(result.browserInfo) : undefined
      }));
    } catch (error) {
      this.logger.error('Failed to get booking history:', error);
      throw error;
    }
  }

  async getBookingStats(userId: string): Promise<BookingStats> {
    this.logger.info(`Getting booking stats for user: ${userId}`);

    try {
      const results = await prisma.bookingResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      const total = results.length;
      const successful = results.filter(r => r.success).length;
      const failed = total - successful;
      const successRate = total > 0 ? (successful / total) * 100 : 0;
      const averageExecutionTime = total > 0 
        ? results.reduce((sum, r) => sum + r.executionTime, 0) / total 
        : 0;

      // Count error frequencies
      const errorCounts = new Map<string, number>();
      results
        .filter(r => !r.success && r.error)
        .forEach(r => {
          const error = r.error!;
          errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
        });

      const mostCommonErrors = Array.from(errorCounts.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const recentBookings = results.slice(0, 10).map(result => ({
        userId: result.userId,
        taskId: result.taskId,
        supplyId: result.supplyId,
        warehouseId: result.warehouseId,
        date: result.date,
        success: result.success,
        bookingId: result.bookingId,
        error: result.error,
        executionTime: result.executionTime,
        steps: result.steps ? JSON.parse(result.steps) : [],
        screenshots: result.screenshots ? JSON.parse(result.screenshots) : [],
        sessionInfo: result.sessionInfo ? JSON.parse(result.sessionInfo) : undefined,
        browserInfo: result.browserInfo ? JSON.parse(result.browserInfo) : undefined
      }));

      return {
        total,
        successful,
        failed,
        successRate,
        averageExecutionTime,
        mostCommonErrors,
        recentBookings
      };
    } catch (error) {
      this.logger.error('Failed to get booking stats:', error);
      throw error;
    }
  }

  async getSuccessRate(userId: string, days: number = 30): Promise<number> {
    this.logger.info(`Getting success rate for user: ${userId}, days: ${days}`);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = await prisma.bookingResult.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        }
      });

      const total = results.length;
      if (total === 0) return 0;

      const successful = results.filter(r => r.success).length;
      return (successful / total) * 100;
    } catch (error) {
      this.logger.error('Failed to get success rate:', error);
      throw error;
    }
  }
}
