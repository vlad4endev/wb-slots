import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logging';

/**
 * Repository для работы с Task и Run сущностями
 * Отвечает только за операции с базой данных
 */
export class TaskRunRepository {
  /**
   * Получить задачу с пользователем
   */
  async getTaskWithUser(taskId: string) {
    return await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: true },
    });
  }

  /**
   * Обновить статус задачи
   */
  async updateTaskStatus(
    taskId: string,
    status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'COMPLETED',
    enabled?: boolean
  ): Promise<void> {
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: status as 'RUNNING' | 'SUCCESS' | 'FAILED' | 'COMPLETED',
          ...(enabled !== undefined && { enabled }),
        },
      });
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          taskId,
          status,
        },
        'Failed to update task status'
      );
    }
  }

  /**
   * Обновить статус Run
   */
  async updateRunStatus(
    runId: string,
    status: 'RUNNING' | 'SUCCESS' | 'FAILED',
    finishedAt?: Date,
    foundSlots?: number,
    summary?: Record<string, unknown>
  ): Promise<void> {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status,
        ...(finishedAt && { finishedAt }),
        ...(foundSlots !== undefined && { foundSlots }),
        ...(summary && { summary }),
      },
    });
  }

  /**
   * Проверить существование Run по ID
   */
  async runExists(runId: string): Promise<boolean> {
    try {
      const run = await prisma.run.findUnique({
        where: { id: runId },
        select: { id: true },
      });
      return run !== null;
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          runId,
        },
        'Failed to check run existence'
      );
      return false;
    }
  }

  /**
   * Создать запись найденного слота
   */
  async createFoundSlot(data: {
    runId: string;
    userId: string;
    warehouseId: number;
    warehouseName: string;
    date: string;
    timeSlot: string;
    coefficient: number;
    available: boolean;
    boxTypes: number[];
  }): Promise<void> {
    try {
      // Проверяем существование Run перед созданием записи
      const exists = await this.runExists(data.runId);
      if (!exists) {
        logger.warn(
          {
            runId: data.runId,
          },
          'Run not found, skipping found slot creation'
        );
        return;
      }

      await prisma.foundSlot.create({ data });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          runId: data.runId,
        },
        'Failed to save found slot'
      );
    }
  }

  /**
   * Создать запись в RunLog
   */
  async createRunLog(
    runId: string,
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    meta?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Проверяем существование Run перед созданием лога
      const exists = await this.runExists(runId);
      if (!exists) {
        logger.warn(
          {
            runId,
            message,
            level,
          },
          'Run not found, skipping log creation'
        );
        return;
      }

      await prisma.runLog.create({
        data: { runId, level, message, meta: meta || {} },
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          runId,
        },
        'Failed to create run log'
      );
    }
  }
}

