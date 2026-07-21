// ========================================
// Optimized Database Queries
// ========================================

import { PrismaClient } from '@prisma/client';
import { OptimizedPrismaClient } from './optimized-prisma';
import { Logger } from '../logging/logger';

export interface QueryOptions {
  include?: any;
  select?: any;
  where?: any;
  orderBy?: any;
  take?: number;
  skip?: number;
}

export interface UserWithRelations {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  tasks: Array<{
    id: string;
    name: string;
    status: string;
    enabled: boolean;
    runs: Array<{
      id: string;
      status: string;
      startedAt: Date;
      finishedAt: Date | null;
      foundSlots: number;
    }>;
  }>;
  tokens: Array<{
    id: string;
    category: string;
    isActive: boolean;
    lastUsedAt: Date | null;
  }>;
  warehousePrefs: Array<{
    id: string;
    warehouseId: number;
    warehouseName: string;
    enabled: boolean;
  }>;
}

export interface TaskWithRelations {
  id: string;
  name: string;
  description: string | null;
  status: string;
  enabled: boolean;
  autoBook: boolean;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  runs: Array<{
    id: string;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    foundSlots: number;
    summary: any;
  }>;
  foundSlots: Array<{
    id: string;
    warehouseId: number;
    warehouseName: string;
    date: string;
    coefficient: number;
    createdAt: Date;
  }>;
}

export class OptimizedQueries {
  private prisma: OptimizedPrismaClient;
  private logger: Logger;

  constructor(prisma: OptimizedPrismaClient) {
    this.prisma = prisma;
    this.logger = new Logger('INFO', { service: 'OptimizedQueries' });
  }

  /**
   * Get user with all relations in a single query (prevents N+1)
   */
  async getUserWithRelations(userId: string): Promise<UserWithRelations | null> {
    return this.prisma.executeQuery(
      async (prisma) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            tasks: {
              include: {
                runs: {
                  select: {
                    id: true,
                    status: true,
                    startedAt: true,
                    finishedAt: true,
                    foundSlots: true
                  },
                  orderBy: { startedAt: 'desc' },
                  take: 10 // Limit recent runs
                }
              },
              orderBy: { createdAt: 'desc' }
            },
            tokens: {
              select: {
                id: true,
                category: true,
                isActive: true,
                lastUsedAt: true
              }
            },
            warehousePrefs: {
              select: {
                id: true,
                warehouseId: true,
                warehouseName: true,
                enabled: true
              }
            }
          }
        });

        return user as UserWithRelations | null;
      },
      'getUserWithRelations'
    );
  }

  /**
   * Get users with pagination and relations
   */
  async getUsersWithRelations(
    page: number = 1,
    limit: number = 20,
    filters: {
      role?: string;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{ users: UserWithRelations[]; total: number }> {
    return this.prisma.executeQuery(
      async (prisma) => {
        const skip = (page - 1) * limit;
        
        const where: any = {};
        if (filters.role) where.role = filters.role;
        if (filters.isActive !== undefined) where.isActive = filters.isActive;
        if (filters.search) {
          where.OR = [
            { email: { contains: filters.search, mode: 'insensitive' } },
            { name: { contains: filters.search, mode: 'insensitive' } }
          ];
        }

        const [users, total] = await Promise.all([
          prisma.user.findMany({
            where,
            include: {
              tasks: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  enabled: true,
                  _count: {
                    select: { runs: true }
                  }
                },
                take: 5 // Limit tasks per user
              },
              tokens: {
                select: {
                  id: true,
                  category: true,
                  isActive: true
                }
              },
              warehousePrefs: {
                select: {
                  id: true,
                  warehouseId: true,
                  warehouseName: true,
                  enabled: true
                },
                take: 10 // Limit warehouse prefs
              }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
          }),
          prisma.user.count({ where })
        ]);

        return { users: users as UserWithRelations[], total };
      },
      'getUsersWithRelations'
    );
  }

  /**
   * Get task with all relations in a single query
   */
  async getTaskWithRelations(taskId: string): Promise<TaskWithRelations | null> {
    return this.prisma.executeQuery(
      async (prisma) => {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            runs: {
              select: {
                id: true,
                status: true,
                startedAt: true,
                finishedAt: true,
                foundSlots: true,
                summary: true
              },
              orderBy: { startedAt: 'desc' },
              take: 20 // Limit recent runs
            },
            foundSlots: {
              select: {
                id: true,
                warehouseId: true,
                warehouseName: true,
                date: true,
                coefficient: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' },
              take: 50 // Limit recent found slots
            }
          }
        });

        return task as TaskWithRelations | null;
      },
      'getTaskWithRelations'
    );
  }

  /**
   * Get tasks with relations and pagination
   */
  async getTasksWithRelations(
    page: number = 1,
    limit: number = 20,
    filters: {
      userId?: string;
      status?: string;
      enabled?: boolean;
      search?: string;
    } = {}
  ): Promise<{ tasks: TaskWithRelations[]; total: number }> {
    return this.prisma.executeQuery(
      async (prisma) => {
        const skip = (page - 1) * limit;
        
        const where: any = {};
        if (filters.userId) where.userId = filters.userId;
        if (filters.status) where.status = filters.status;
        if (filters.enabled !== undefined) where.enabled = filters.enabled;
        if (filters.search) {
          where.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } }
          ];
        }

        const [tasks, total] = await Promise.all([
          prisma.task.findMany({
            where,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true
                }
              },
              runs: {
                select: {
                  id: true,
                  status: true,
                  startedAt: true,
                  finishedAt: true,
                  foundSlots: true
                },
                orderBy: { startedAt: 'desc' },
                take: 3 // Limit runs per task
              },
              foundSlots: {
                select: {
                  id: true,
                  warehouseId: true,
                  warehouseName: true,
                  date: true,
                  coefficient: true
                },
                orderBy: { createdAt: 'desc' },
                take: 5 // Limit found slots per task
              }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
          }),
          prisma.task.count({ where })
        ]);

        return { tasks: tasks as TaskWithRelations[], total };
      },
      'getTasksWithRelations'
    );
  }

  /**
   * Get dashboard statistics in a single query
   */
  async getDashboardStats(userId?: string): Promise<{
    totalUsers: number;
    totalTasks: number;
    activeTasks: number;
    totalRuns: number;
    successfulRuns: number;
    totalFoundSlots: number;
    recentActivity: Array<{
      type: 'task_created' | 'run_completed' | 'slot_found';
      id: string;
      description: string;
      createdAt: Date;
    }>;
  }> {
    return this.prisma.executeQuery(
      async (prisma) => {
        const where = userId ? { userId } : {};

        const [
          totalUsers,
          totalTasks,
          activeTasks,
          totalRuns,
          successfulRuns,
          totalFoundSlots,
          recentTasks,
          recentRuns,
          recentSlots
        ] = await Promise.all([
          userId ? 1 : prisma.user.count(),
          prisma.task.count({ where }),
          prisma.task.count({ where: { ...where, enabled: true } }),
          prisma.run.count({ where }),
          prisma.run.count({ where: { ...where, status: 'COMPLETED' } }),
          prisma.foundSlot.count({ where }),
          prisma.task.findMany({
            where,
            select: {
              id: true,
              name: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          }),
          prisma.run.findMany({
            where,
            select: {
              id: true,
              status: true,
              startedAt: true,
              task: {
                select: { name: true }
              }
            },
            orderBy: { startedAt: 'desc' },
            take: 5
          }),
          prisma.foundSlot.findMany({
            where,
            select: {
              id: true,
              warehouseName: true,
              date: true,
              createdAt: true,
              task: {
                select: { name: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          })
        ]);

        // Combine recent activity
        const recentActivity = [
          ...recentTasks.map(task => ({
            type: 'task_created' as const,
            id: task.id,
            description: `Task "${task.name}" created`,
            createdAt: task.createdAt
          })),
          ...recentRuns.map(run => ({
            type: 'run_completed' as const,
            id: run.id,
            description: `Run for "${run.task.name}" completed`,
            createdAt: run.startedAt
          })),
          ...recentSlots.map(slot => ({
            type: 'slot_found' as const,
            id: slot.id,
            description: `Slot found at ${slot.warehouseName} for "${slot.task.name}"`,
            createdAt: slot.createdAt
          }))
        ]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

        return {
          totalUsers,
          totalTasks,
          activeTasks,
          totalRuns,
          successfulRuns,
          totalFoundSlots,
          recentActivity
        };
      },
      'getDashboardStats'
    );
  }

  /**
   * Get user performance metrics
   */
  async getUserPerformanceMetrics(userId: string, days: number = 30): Promise<{
    totalTasks: number;
    activeTasks: number;
    totalRuns: number;
    successfulRuns: number;
    successRate: number;
    totalFoundSlots: number;
    averageRunTime: number;
    tasksByStatus: Array<{ status: string; count: number }>;
    runsByDay: Array<{ date: string; count: number; successful: number }>;
  }> {
    return this.prisma.executeQuery(
      async (prisma) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [
          totalTasks,
          activeTasks,
          totalRuns,
          successfulRuns,
          totalFoundSlots,
          averageRunTime,
          tasksByStatus,
          runsByDay
        ] = await Promise.all([
          prisma.task.count({ where: { userId } }),
          prisma.task.count({ where: { userId, enabled: true } }),
          prisma.run.count({ 
            where: { 
              userId,
              startedAt: { gte: startDate }
            } 
          }),
          prisma.run.count({ 
            where: { 
              userId,
              status: 'COMPLETED',
              startedAt: { gte: startDate }
            } 
          }),
          prisma.foundSlot.count({ 
            where: { 
              userId,
              createdAt: { gte: startDate }
            } 
          }),
          prisma.run.aggregate({
            where: { 
              userId,
              startedAt: { gte: startDate },
              finishedAt: { not: null }
            },
            _avg: {
              // Calculate average run time in minutes
              // This would need a computed field or custom query
            }
          }),
          prisma.task.groupBy({
            by: ['status'],
            where: { userId },
            _count: { status: true }
          }),
          prisma.$queryRaw`
            SELECT 
              DATE(started_at) as date,
              COUNT(*) as count,
              COUNT(*) FILTER (WHERE status = 'COMPLETED') as successful
            FROM runs 
            WHERE user_id = ${userId} 
              AND started_at >= ${startDate}
            GROUP BY DATE(started_at)
            ORDER BY date DESC
          ` as any[]
        ]);

        const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

        return {
          totalTasks,
          activeTasks,
          totalRuns,
          successfulRuns,
          successRate,
          totalFoundSlots,
          averageRunTime: 0, // Would need custom calculation
          tasksByStatus: tasksByStatus.map(item => ({
            status: item.status,
            count: item._count.status
          })),
          runsByDay: runsByDay.map((item: any) => ({
            date: item.date.toISOString().split('T')[0],
            count: parseInt(item.count),
            successful: parseInt(item.successful)
          }))
        };
      },
      'getUserPerformanceMetrics'
    );
  }

  /**
   * Bulk operations for better performance
   */
  async bulkUpdateTaskStatus(
    taskIds: string[],
    status: string
  ): Promise<{ count: number }> {
    return this.prisma.executeQuery(
      async (prisma) => {
        const result = await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { status }
        });
        return result;
      },
      'bulkUpdateTaskStatus'
    );
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData(daysToKeep: number = 30): Promise<{
    deletedRuns: number;
    deletedLogs: number;
    deletedSlots: number;
  }> {
    return this.prisma.executeTransaction(
      async (prisma) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const [deletedRuns, deletedLogs, deletedSlots] = await Promise.all([
          prisma.run.deleteMany({
            where: {
              startedAt: { lt: cutoffDate },
              status: { in: ['COMPLETED', 'FAILED'] }
            }
          }),
          prisma.runLog.deleteMany({
            where: {
              createdAt: { lt: cutoffDate }
            }
          }),
          prisma.foundSlot.deleteMany({
            where: {
              createdAt: { lt: cutoffDate }
            }
          })
        ]);

        return {
          deletedRuns: deletedRuns.count,
          deletedLogs: deletedLogs.count,
          deletedSlots: deletedSlots.count
        };
      },
      'cleanupOldData'
    );
  }
}

// Singleton instance
let optimizedQueriesInstance: OptimizedQueries | null = null;

export function getOptimizedQueries(prisma?: OptimizedPrismaClient): OptimizedQueries {
  if (!optimizedQueriesInstance) {
    if (!prisma) {
      throw new Error('OptimizedPrismaClient instance is required for first initialization');
    }
    optimizedQueriesInstance = new OptimizedQueries(prisma);
  }
  return optimizedQueriesInstance;
}
