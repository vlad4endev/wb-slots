import { prisma } from '../prisma';
import { Logger } from '../logging/logger';

// ===== ANALYTICS TYPES =====
export interface BookingMetrics {
  totalAttempts: number;
  successfulBookings: number;
  failedBookings: number;
  successRate: number;
  averageExecutionTime: number;
  averageRetryCount: number;
  topFailureReasons: FailureReason[];
  performanceByWarehouse: WarehousePerformance[];
  performanceByTimeSlot: TimeSlotPerformance[];
  sessionMetrics: SessionMetrics;
}

export interface FailureReason {
  reason: string;
  count: number;
  percentage: number;
  lastOccurrence: Date;
}

export interface WarehousePerformance {
  warehouseId: number;
  warehouseName: string;
  attempts: number;
  successes: number;
  successRate: number;
  averageExecutionTime: number;
}

export interface TimeSlotPerformance {
  timeSlot: string;
  attempts: number;
  successes: number;
  successRate: number;
  peakHours: string[];
}

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  sessionExpiredCount: number;
  sessionRefreshCount: number;
}

export interface PerformanceTrends {
  daily: DailyPerformance[];
  hourly: HourlyPerformance[];
  weekly: WeeklyPerformance[];
}

export interface DailyPerformance {
  date: string;
  attempts: number;
  successes: number;
  successRate: number;
  averageExecutionTime: number;
}

export interface HourlyPerformance {
  hour: number;
  attempts: number;
  successes: number;
  successRate: number;
  peakHours: boolean;
}

export interface WeeklyPerformance {
  week: string;
  attempts: number;
  successes: number;
  successRate: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface UserPerformance {
  userId: string;
  userName?: string;
  totalAttempts: number;
  successfulBookings: number;
  successRate: number;
  averageExecutionTime: number;
  lastBookingAt?: Date;
  preferredWarehouses: number[];
  performanceGrade: 'excellent' | 'good' | 'average' | 'poor';
}

// ===== BOOKING ANALYTICS SERVICE =====
export class BookingAnalyticsService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('INFO', { context: 'BookingAnalyticsService' });
  }

  /**
   * Получение общих метрик бронирования
   */
  async getBookingMetrics(
    timeRange: 'day' | 'week' | 'month' | 'year' = 'month',
    userId?: string
  ): Promise<BookingMetrics> {
    try {
      this.logger.info('📊 Calculating booking metrics', { timeRange, userId });

      const dateFrom = this.getDateFromTimeRange(timeRange);
      const whereClause = this.buildWhereClause(dateFrom, userId);

      // Основные метрики
      const basicMetrics = await this.calculateBasicMetrics(whereClause);
      
      // Причины неудач
      const failureReasons = await this.getTopFailureReasons(whereClause);
      
      // Производительность по складам
      const warehousePerformance = await this.getWarehousePerformance(whereClause);
      
      // Производительность по временным слотам
      const timeSlotPerformance = await this.getTimeSlotPerformance(whereClause);
      
      // Метрики сессий
      const sessionMetrics = await this.getSessionMetrics(whereClause, userId);

      const metrics: BookingMetrics = {
        ...basicMetrics,
        topFailureReasons: failureReasons,
        performanceByWarehouse: warehousePerformance,
        performanceByTimeSlot: timeSlotPerformance,
        sessionMetrics
      };

      this.logger.info('✅ Booking metrics calculated', { 
        successRate: metrics.successRate,
        totalAttempts: metrics.totalAttempts 
      });

      return metrics;

    } catch (error) {
      this.logger.error('❌ Failed to calculate booking metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получение трендов производительности
   */
  async getPerformanceTrends(
    timeRange: 'day' | 'week' | 'month' = 'month',
    userId?: string
  ): Promise<PerformanceTrends> {
    try {
      this.logger.info('📈 Calculating performance trends', { timeRange, userId });

      const dateFrom = this.getDateFromTimeRange(timeRange);
      const whereClause = this.buildWhereClause(dateFrom, userId);

      // Дневные тренды
      const daily = await this.getDailyPerformance(whereClause, dateFrom);
      
      // Почасовые тренды
      const hourly = await this.getHourlyPerformance(whereClause);
      
      // Недельные тренды
      const weekly = await this.getWeeklyPerformance(whereClause);

      return { daily, hourly, weekly };

    } catch (error) {
      this.logger.error('❌ Failed to calculate performance trends', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Получение производительности пользователей
   */
  async getUsersPerformance(limit: number = 10): Promise<UserPerformance[]> {
    try {
      this.logger.info('👥 Calculating users performance', { limit });

      const usersData = await prisma.bookingResult.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Последние 30 дней
        },
        orderBy: {
          _count: { id: 'desc' }
        },
        take: limit
      });

      const userPerformances: UserPerformance[] = [];

      for (const userData of usersData) {
        const successCount = await prisma.bookingResult.count({
          where: {
            userId: userData.userId,
            status: 'SUCCESS',
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        });

        const user = await prisma.user.findUnique({
          where: { id: userData.userId },
          select: { name: true, email: true }
        });

        const lastBooking = await prisma.bookingResult.findFirst({
          where: { userId: userData.userId },
          orderBy: { createdAt: 'desc' }
        });

        const totalAttempts = userData._count?.id || 0;
        const successRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;
        
        userPerformances.push({
          userId: userData.userId,
          userName: user?.name || user?.email || 'Unknown',
          totalAttempts,
          successfulBookings: successCount,
          successRate,
          averageExecutionTime: 0, // Можно добавить расчет из details
          lastBookingAt: lastBooking?.createdAt,
          preferredWarehouses: [], // Можно добавить анализ
          performanceGrade: this.calculatePerformanceGrade(successRate, totalAttempts)
        });
      }

      return userPerformances;

    } catch (error) {
      this.logger.error('❌ Failed to calculate users performance', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Создание отчета по бронированию
   */
  async generateBookingReport(
    timeRange: 'day' | 'week' | 'month' | 'year' = 'month',
    userId?: string
  ): Promise<{
    summary: BookingMetrics;
    trends: PerformanceTrends;
    recommendations: string[];
    issues: string[];
  }> {
    try {
      this.logger.info('📋 Generating booking report', { timeRange, userId });

      const summary = await this.getBookingMetrics(timeRange, userId);
      const trends = await this.getPerformanceTrends(timeRange === 'year' ? 'month' : timeRange, userId);
      
      const recommendations = this.generateRecommendations(summary, trends);
      const issues = this.identifyIssues(summary, trends);

      this.logger.info('✅ Booking report generated', {
        successRate: summary.successRate,
        recommendationsCount: recommendations.length,
        issuesCount: issues.length
      });

      return {
        summary,
        trends,
        recommendations,
        issues
      };

    } catch (error) {
      this.logger.error('❌ Failed to generate booking report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Отслеживание события бронирования для аналитики
   */
  async trackBookingEvent(
    eventType: 'attempt' | 'success' | 'failure' | 'retry',
    data: {
      userId: string;
      taskId: string;
      supplyId: string;
      warehouseId: number;
      executionTime?: number;
      errorReason?: string;
      retryCount?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Сохраняем событие в audit log для последующего анализа
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: `BOOKING_${eventType.toUpperCase()}`,
          target: `TASK_${data.taskId}`,
          meta: {
            eventType,
            taskId: data.taskId,
            supplyId: data.supplyId,
            warehouseId: data.warehouseId,
            executionTime: data.executionTime,
            errorReason: data.errorReason,
            retryCount: data.retryCount,
            metadata: data.metadata,
            timestamp: new Date().toISOString()
          }
        }
      });

      this.logger.info(`📝 Booking event tracked: ${eventType}`, {
        userId: data.userId,
        taskId: data.taskId,
        warehouseId: data.warehouseId
      });

    } catch (error) {
      this.logger.error('❌ Failed to track booking event', {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== PRIVATE METHODS =====

  private getDateFromTimeRange(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private buildWhereClause(dateFrom: Date, userId?: string) {
    const where: any = {
      createdAt: { gte: dateFrom }
    };
    
    if (userId) {
      where.userId = userId;
    }
    
    return where;
  }

  private async calculateBasicMetrics(whereClause: any) {
    const totalAttempts = await prisma.bookingResult.count({ where: whereClause });
    
    const successfulBookings = await prisma.bookingResult.count({
      where: { ...whereClause, status: 'SUCCESS' }
    });
    
    const failedBookings = totalAttempts - successfulBookings;
    const successRate = totalAttempts > 0 ? (successfulBookings / totalAttempts) * 100 : 0;

    // Среднее время выполнения (если доступно в details)
    const avgExecutionTime = 0; // TODO: Реализовать на основе details

    // Средний счетчик повторов
    const avgRetryCount = 0; // TODO: Реализовать на основе details

    return {
      totalAttempts,
      successfulBookings,
      failedBookings,
      successRate,
      averageExecutionTime: avgExecutionTime,
      averageRetryCount: avgRetryCount
    };
  }

  private async getTopFailureReasons(whereClause: any): Promise<FailureReason[]> {
    const failedBookings = await prisma.bookingResult.findMany({
      where: { ...whereClause, status: 'FAILED' },
      select: { errorMessage: true, createdAt: true }
    });

    const reasonMap = new Map<string, { count: number; lastOccurrence: Date }>();
    
    failedBookings.forEach(booking => {
      const reason = booking.errorMessage || 'Unknown error';
      const existing = reasonMap.get(reason);
      
      if (existing) {
        existing.count++;
        if (booking.createdAt > existing.lastOccurrence) {
          existing.lastOccurrence = booking.createdAt;
        }
      } else {
        reasonMap.set(reason, {
          count: 1,
          lastOccurrence: booking.createdAt
        });
      }
    });

    const totalFailed = failedBookings.length;
    
    return Array.from(reasonMap.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: totalFailed > 0 ? (data.count / totalFailed) * 100 : 0,
        lastOccurrence: data.lastOccurrence
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private async getWarehousePerformance(whereClause: any): Promise<WarehousePerformance[]> {
    const warehouseStats = await prisma.bookingResult.groupBy({
      by: ['warehouseId', 'warehouseName'],
      _count: { id: true },
      where: whereClause
    });

    const performances: WarehousePerformance[] = [];

    for (const stat of warehouseStats) {
      const successes = await prisma.bookingResult.count({
        where: {
          ...whereClause,
          warehouseId: stat.warehouseId,
          status: 'SUCCESS'
        }
      });

      performances.push({
        warehouseId: stat.warehouseId,
        warehouseName: stat.warehouseName,
        attempts: stat._count.id,
        successes,
        successRate: stat._count.id > 0 ? (successes / stat._count.id) * 100 : 0,
        averageExecutionTime: 0 // TODO: Реализовать
      });
    }

    return performances.sort((a, b) => b.successRate - a.successRate);
  }

  private async getTimeSlotPerformance(whereClause: any): Promise<TimeSlotPerformance[]> {
    const timeSlotStats = await prisma.bookingResult.groupBy({
      by: ['timeSlot'],
      _count: { id: true },
      where: whereClause
    });

    const performances: TimeSlotPerformance[] = [];

    for (const stat of timeSlotStats) {
      const successes = await prisma.bookingResult.count({
        where: {
          ...whereClause,
          timeSlot: stat.timeSlot,
          status: 'SUCCESS'
        }
      });

      performances.push({
        timeSlot: stat.timeSlot,
        attempts: stat._count.id,
        successes,
        successRate: stat._count.id > 0 ? (successes / stat._count.id) * 100 : 0,
        peakHours: [] // TODO: Анализ пиковых часов
      });
    }

    return performances.sort((a, b) => b.successRate - a.successRate);
  }

  private async getSessionMetrics(whereClause: any, userId?: string): Promise<SessionMetrics> {
    const sessionWhere = userId ? { userId } : {};
    
    const totalSessions = await prisma.wBSession.count({ where: sessionWhere });
    const activeSessions = await prisma.wBSession.count({
      where: { ...sessionWhere, isActive: true }
    });

    return {
      totalSessions,
      activeSessions,
      averageSessionDuration: 0, // TODO: Расчет на основе lastUsedAt - createdAt
      sessionExpiredCount: 0, // TODO: Счетчик истекших сессий
      sessionRefreshCount: 0 // TODO: Счетчик обновлений сессий
    };
  }

  private async getDailyPerformance(whereClause: any, dateFrom: Date): Promise<DailyPerformance[]> {
    // TODO: Реализовать группировку по дням
    return [];
  }

  private async getHourlyPerformance(whereClause: any): Promise<HourlyPerformance[]> {
    // TODO: Реализовать группировку по часам
    return [];
  }

  private async getWeeklyPerformance(whereClause: any): Promise<WeeklyPerformance[]> {
    // TODO: Реализовать группировку по неделям
    return [];
  }

  private calculatePerformanceGrade(successRate: number, totalAttempts: number): 'excellent' | 'good' | 'average' | 'poor' {
    if (totalAttempts < 5) return 'average'; // Недостаточно данных
    
    if (successRate >= 90) return 'excellent';
    if (successRate >= 70) return 'good';
    if (successRate >= 50) return 'average';
    return 'poor';
  }

  private generateRecommendations(summary: BookingMetrics, trends: PerformanceTrends): string[] {
    const recommendations: string[] = [];

    if (summary.successRate < 70) {
      recommendations.push('Низкий процент успешных бронирований. Рекомендуется проверить настройки токенов и сессий.');
    }

    if (summary.averageRetryCount > 2) {
      recommendations.push('Высокое количество повторных попыток. Рекомендуется оптимизировать селекторы элементов.');
    }

    if (summary.sessionMetrics.sessionExpiredCount > summary.sessionMetrics.totalSessions * 0.3) {
      recommendations.push('Частое истечение сессий. Рекомендуется увеличить время жизни сессий или улучшить их обновление.');
    }

    return recommendations;
  }

  private identifyIssues(summary: BookingMetrics, trends: PerformanceTrends): string[] {
    const issues: string[] = [];

    if (summary.successRate < 50) {
      issues.push('Критически низкий процент успешных бронирований');
    }

    if (summary.topFailureReasons.length > 0 && summary.topFailureReasons[0].percentage > 50) {
      issues.push(`Основная причина неудач: ${summary.topFailureReasons[0].reason}`);
    }

    if (summary.sessionMetrics.activeSessions === 0) {
      issues.push('Отсутствуют активные сессии');
    }

    return issues;
  }
}

export default BookingAnalyticsService;