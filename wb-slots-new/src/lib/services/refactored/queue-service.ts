// import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
// import { Redis } from 'ioredis';
// import { prisma } from '../../prisma';
// import { WBClientFactory } from '../../wb-client';
// import { decrypt } from '../../encryption';
// import { LogLevel, RunStatus } from '@prisma/client';
// import { RefactoredSlotSearchService } from './slot-search-service';
// import { RefactoredAutoBookingService } from './auto-booking-service';
// import { TelegramService } from '../telegram-service';

// Mock types for demonstration
type Queue<T> = any;
type Worker<T> = any;
type Job<T> = any;
type QueueOptions = any;
type WorkerOptions = any;
type Redis = any;
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED' | 'COMPLETED';

// Mock implementations
const prisma = {} as any;
const WBClientFactory = { createSuppliesClient: () => ({}) } as any;
const decrypt = (data: string) => data;
const TelegramService = class {} as any;

// ===== TYPES =====
export interface ScanSlotsJobData {
  taskId: string;
  userId: string;
  runId: string;
}

export interface BookSlotJobData {
  taskId: string;
  userId: string;
  runId: string;
  slotData: {
    warehouseId: number;
    date: string;
    coefficient: number;
  };
}

export interface NotifyJobData {
  userId: string;
  type: 'slot_found' | 'slot_booked' | 'task_failed' | 'task_completed';
  data: any;
}

export interface StopTaskJobData {
  taskId: string;
}

export interface MonitorJobData {
  taskId: string;
  runId: string;
  userId: string;
  checkInterval: number;
  maxAttempts: number;
}

// ===== CONSTANTS =====
export const QUEUE_NAMES = {
  SCAN_SLOTS: 'scan-slots',
  BOOK_SLOT: 'book-slot',
  NOTIFY: 'notify',
  STOP_TASK: 'stop-task',
  MONITOR: 'slot-monitor',
} as const;

const QUEUE_OPTIONS: QueueOptions = {
  connection: {} as Redis, // Mock Redis connection
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

const WORKER_OPTIONS: WorkerOptions = {
  connection: {} as Redis, // Mock Redis connection
  concurrency: 5,
};

// ===== ERROR CLASSES =====
export class QueueError extends Error {
  constructor(message: string, public code: string, public originalError?: Error) {
    super(message);
    this.name = 'QueueError';
  }
}

export class JobProcessingError extends QueueError {
  constructor(message: string, originalError?: Error) {
    super(message, 'JOB_PROCESSING_ERROR', originalError);
  }
}

// ===== UTILITY CLASSES =====
class DatabaseLogger {
  static async logRunMessage(
    runId: string,
    level: LogLevel,
    message: string,
    meta?: any
  ): Promise<void> {
    await prisma.runLog.create({
      data: {
        runId,
        level,
        message,
        meta: meta ? JSON.stringify(meta) : undefined,
      },
    });
  }

  static async updateRunStatus(
    runId: string,
    status: RunStatus,
    summary?: any
  ): Promise<void> {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: new Date(),
        summary: summary ? JSON.stringify(summary) : undefined,
      },
    });
  }
}

class TaskValidator {
  static async validateTask(taskId: string, userId: string): Promise<any> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: true },
    });

    if (!task) {
      throw new JobProcessingError(`Task ${taskId} not found`);
    }

    if (task.userId !== userId) {
      throw new JobProcessingError(`Task ${taskId} does not belong to user ${userId}`);
    }

    return task;
  }
}

class TokenManager {
  static async getUserSuppliesToken(userId: string): Promise<string> {
    const suppliesToken = await prisma.userToken.findFirst({
      where: {
        userId,
        category: 'SUPPLIES',
        isActive: true,
      },
    });

    if (!suppliesToken) {
      const userTokens = await prisma.userToken.findMany({
        where: { userId },
        select: { category: true, isActive: true }
      });
      
      throw new JobProcessingError(
        `No active supplies token found. User has ${userTokens.length} tokens. Please add a SUPPLIES token in settings.`
      );
    }

    return decrypt(suppliesToken.tokenEncrypted);
  }
}

class SlotSearchProcessor {
  static async processSlotSearch(job: Job<ScanSlotsJobData>): Promise<void> {
    const { taskId, userId, runId } = job.data;
    
    try {
      await DatabaseLogger.updateRunStatus(runId, 'RUNNING');
      await DatabaseLogger.logRunMessage(runId, 'INFO', 'Starting slot scan', { taskId, userId });

      const task = await TaskValidator.validateTask(taskId, userId);
      const suppliesToken = await TokenManager.getUserSuppliesToken(userId);
      const wbClient = WBClientFactory.createSuppliesClient(suppliesToken);

      // Parse task filters
      const filters = task.filters as any;
      const { warehouseIds, boxTypeIds, dates, coefficientAllowed, allowUnload } = filters;

      const coefficientThreshold = Array.isArray(coefficientAllowed) && coefficientAllowed.length > 0 
        ? Math.min(...coefficientAllowed) 
        : 0;

      // Search for available slots
      const availableSlots = await wbClient.searchAvailableSlots(
        warehouseIds,
        boxTypeIds,
        dates?.from || new Date().toISOString(),
        dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        coefficientThreshold,
        allowUnload
      );

      await DatabaseLogger.logRunMessage(runId, 'INFO', `Found ${availableSlots.length} available slots`, {
        slots: availableSlots,
      });

      const summary = {
        foundSlots: availableSlots.length,
        scannedAt: new Date().toISOString(),
      };

      await DatabaseLogger.updateRunStatus(runId, 'SUCCESS', summary);

      // Queue booking jobs if auto-book is enabled
      if (task.autoBook && availableSlots.length > 0) {
        await this.queueBookingJobs(taskId, userId, runId, availableSlots);
      }

      // Send notification if slots found
      if (availableSlots.length > 0) {
        await this.queueNotification(userId, 'slot_found', {
          taskId,
          taskName: task.name,
          slotsCount: availableSlots.length,
          slots: availableSlots,
        });
      }

      await DatabaseLogger.logRunMessage(runId, 'INFO', 'Slot scan completed successfully', summary);

    } catch (error) {
      console.error('Scan slots job error:', error);
      
      await DatabaseLogger.logRunMessage(runId, 'ERROR', 'Slot scan failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await DatabaseLogger.updateRunStatus(runId, 'FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString(),
      });

      // Send failure notification
      await this.queueNotification(userId, 'task_failed', {
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  static async queueBookingJobs(
    taskId: string, 
    userId: string, 
    runId: string, 
    slots: any[]
  ): Promise<void> {
    for (const slot of slots) {
      await bookSlotQueue.add('book-slot', {
        taskId,
        userId,
        runId,
        slotData: {
          warehouseId: slot.warehouseID,
          date: slot.date,
          coefficient: slot.coefficient,
        },
      });
    }
  }

  static async queueNotification(
    userId: string, 
    type: NotifyJobData['type'], 
    data: any
  ): Promise<void> {
    await notifyQueue.add('notify', {
      userId,
      type,
      data,
    });
  }
}

class SlotBookingProcessor {
  static async processSlotBooking(job: Job<BookSlotJobData>): Promise<void> {
    const { taskId, userId, runId, slotData } = job.data;
    
    try {
      await DatabaseLogger.logRunMessage(runId, 'INFO', 'Starting slot booking', { slotData });

      // For now, we can only log the slot booking attempt
      // In the future, this would integrate with WB's booking API or UI automation
      
      await DatabaseLogger.logRunMessage(runId, 'WARN', 'Slot booking not implemented yet - would book slot', {
        slotData,
        note: 'This would integrate with WB booking API or UI automation',
      });

      // TODO: Implement actual slot booking when WB provides the API
      // or implement UI automation fallback

      await DatabaseLogger.logRunMessage(runId, 'INFO', 'Slot booking completed (simulated)', { slotData });

    } catch (error) {
      console.error('Book slot job error:', error);
      
      await DatabaseLogger.logRunMessage(runId, 'ERROR', 'Slot booking failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slotData,
      });

      throw error;
    }
  }
}

class NotificationProcessor {
  static async processNotification(job: Job<NotifyJobData>): Promise<void> {
    const { userId, type, data } = job.data;
    
    try {
      // Get user's notification channels
      const channels = await prisma.notificationChannel.findMany({
        where: {
          userId,
          enabled: true,
        },
      });

      if (channels.length === 0) {
        console.log(`No notification channels configured for user ${userId}`);
        return;
      }

      // Send notifications through all enabled channels
      for (const channel of channels) {
        try {
          await this.sendNotification(channel, type, data);
        } catch (error) {
          console.error(`Failed to send notification via ${channel.type}:`, error);
        }
      }

    } catch (error) {
      console.error('Notify job error:', error);
      throw error;
    }
  }

  private static async sendNotification(channel: any, type: string, data: any): Promise<void> {
    const config = channel.config as any;

    switch (channel.type) {
      case 'EMAIL':
        // TODO: Implement email notification
        console.log(`Email notification to ${config.email}: ${type}`, data);
        break;
      
      case 'TELEGRAM':
        await this.sendTelegramNotification(config, type, data);
        break;
      
      case 'WEBHOOK':
        // TODO: Implement webhook notification
        console.log(`Webhook notification to ${config.url}: ${type}`, data);
        break;
      
      default:
        console.log(`Unknown notification type: ${channel.type}`);
    }
  }

  private static async sendTelegramNotification(config: any, type: string, data: any): Promise<void> {
    try {
      const telegramService = new TelegramService(prisma);
      const message = this.buildTelegramMessage(type, data);
      await telegramService.sendNotification(config.userId || config.chatId, message);
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  }

  private static buildTelegramMessage(type: string, data: any): string {
    switch (type) {
      case 'slot_found':
        return `🎯 Найдены слоты!\n\nЗадача: ${data.taskName}\nНайдено слотов: ${data.slotsCount}`;
      
      case 'slot_booked':
        return `✅ Слот забронирован!\n\nID бронирования: ${data.bookingId}`;
      
      case 'task_failed':
        return `❌ Ошибка задачи!\n\nЗадача: ${data.taskId}\nОшибка: ${data.error}`;
      
      case 'task_completed':
        return `✅ Задача завершена!\n\nЗадача: ${data.taskName}`;
      
      default:
        return `📢 Уведомление: ${type}`;
    }
  }
}

class TaskStopProcessor {
  static async processTaskStop(job: Job<StopTaskJobData>): Promise<void> {
    const { taskId } = job.data;
    
    try {
      console.log(`🛑 Останавливаем задачу ${taskId}`);
      
      // Update task status to stopped
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          enabled: false,
        },
      });

      // Stop all active runs for this task
      await prisma.run.updateMany({
        where: {
          taskId,
          status: 'RUNNING',
        },
        data: {
          status: 'CANCELLED',
          finishedAt: new Date(),
        },
      });

      console.log(`✅ Задача ${taskId} успешно остановлена`);
      
    } catch (error) {
      console.error('Stop task worker error:', error);
      throw error;
    }
  }
}

class SlotMonitorProcessor {
  static async processSlotMonitoring(job: Job<MonitorJobData>): Promise<void> {
    const { taskId, runId, userId, checkInterval, maxAttempts } = job.data;
    
    try {
      await DatabaseLogger.updateRunStatus(runId, 'RUNNING');
      await DatabaseLogger.logRunMessage(runId, 'INFO', 'Starting slot monitoring', { 
        taskId, 
        checkInterval, 
        maxAttempts 
      });

      const task = await TaskValidator.validateTask(taskId, userId);
      const suppliesToken = await TokenManager.getUserSuppliesToken(userId);
      const wbClient = WBClientFactory.createSuppliesClient(suppliesToken);

      const filters = task.filters as any;
      const { warehouseIds, boxTypeIds, dates, coefficientAllowed, allowUnload } = filters;

      const coefficientThreshold = Array.isArray(coefficientAllowed) && coefficientAllowed.length > 0 
        ? Math.min(...coefficientAllowed) 
        : 0;

      let attempts = 0;
      let foundSlots = 0;

      while (attempts < maxAttempts) {
        // Check if task is still enabled
        const currentTask = await prisma.task.findUnique({
          where: { id: taskId },
        });

        if (!currentTask?.enabled) {
          await DatabaseLogger.logRunMessage(runId, 'INFO', 'Task disabled, stopping monitoring');
          break;
        }

        attempts++;

        try {
          // Search for available slots
          const availableSlots = await wbClient.searchAvailableSlots(
            warehouseIds,
            boxTypeIds,
            dates?.from || new Date().toISOString(),
            dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            coefficientThreshold,
            allowUnload
          );

          await DatabaseLogger.logRunMessage(runId, 'INFO', `Check ${attempts}/${maxAttempts}: Found ${availableSlots.length} slots`, {
            attempt: attempts,
            slots: availableSlots,
          });

          if (availableSlots.length > 0) {
            foundSlots = availableSlots.length;
            
            // If auto-book is enabled, queue booking jobs
            if (task.autoBook) {
              await SlotSearchProcessor.queueBookingJobs(taskId, userId, runId, availableSlots);
            }

            // Send notification
            await SlotSearchProcessor.queueNotification(userId, 'slot_found', {
              taskId,
              taskName: task.name,
              slotsCount: availableSlots.length,
              slots: availableSlots,
            });

            // Stop monitoring after first successful find
            break;
          }

          // Wait before next check
          await new Promise(resolve => setTimeout(resolve, checkInterval));

        } catch (error) {
          await DatabaseLogger.logRunMessage(runId, 'WARN', `Check ${attempts} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
      }

      // Update run with results
      const summary = {
        foundSlots,
        totalAttempts: attempts,
        checkInterval,
        maxAttempts,
        completedAt: new Date().toISOString(),
      };

      await DatabaseLogger.updateRunStatus(runId, foundSlots > 0 ? 'SUCCESS' : 'FAILED', summary);
      await DatabaseLogger.logRunMessage(runId, 'INFO', 'Slot monitoring completed', summary);

    } catch (error) {
      console.error('Monitor job error:', error);
      
      await DatabaseLogger.logRunMessage(runId, 'ERROR', 'Slot monitoring failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await DatabaseLogger.updateRunStatus(runId, 'FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString(),
      });

      // Send failure notification
      await SlotSearchProcessor.queueNotification(userId, 'task_failed', {
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }
}

// ===== QUEUE CREATION =====
export const scanSlotsQueue = new Queue<ScanSlotsJobData>(QUEUE_NAMES.SCAN_SLOTS, QUEUE_OPTIONS);
export const bookSlotQueue = new Queue<BookSlotJobData>(QUEUE_NAMES.BOOK_SLOT, QUEUE_OPTIONS);
export const notifyQueue = new Queue<NotifyJobData>(QUEUE_NAMES.NOTIFY, QUEUE_OPTIONS);
export const stopTaskQueue = new Queue<StopTaskJobData>(QUEUE_NAMES.STOP_TASK, QUEUE_OPTIONS);
export const monitorQueue = new Queue<MonitorJobData>(QUEUE_NAMES.MONITOR, QUEUE_OPTIONS);

// ===== WORKER CREATION =====
export const scanSlotsWorker = new Worker<ScanSlotsJobData>(
  QUEUE_NAMES.SCAN_SLOTS,
  SlotSearchProcessor.processSlotSearch,
  WORKER_OPTIONS
);

export const bookSlotWorker = new Worker<BookSlotJobData>(
  QUEUE_NAMES.BOOK_SLOT,
  SlotBookingProcessor.processSlotBooking,
  WORKER_OPTIONS
);

export const notifyWorker = new Worker<NotifyJobData>(
  QUEUE_NAMES.NOTIFY,
  NotificationProcessor.processNotification,
  WORKER_OPTIONS
);

export const stopTaskWorker = new Worker<StopTaskJobData>(
  QUEUE_NAMES.STOP_TASK,
  TaskStopProcessor.processTaskStop,
  WORKER_OPTIONS
);

export const monitorWorker = new Worker<MonitorJobData>(
  QUEUE_NAMES.MONITOR,
  SlotMonitorProcessor.processSlotMonitoring,
  WORKER_OPTIONS
);

// ===== ERROR HANDLERS =====
scanSlotsWorker.on('error', (error) => {
  console.error('Scan slots worker error:', error);
});

bookSlotWorker.on('error', (error) => {
  console.error('Book slot worker error:', error);
});

notifyWorker.on('error', (error) => {
  console.error('Notify worker error:', error);
});

stopTaskWorker.on('error', (error) => {
  console.error('Stop task worker error:', error);
});

monitorWorker.on('error', (error) => {
  console.error('Monitor worker error:', error);
});

// ===== GRACEFUL SHUTDOWN =====
// Note: In real implementation, these would be uncommented
/*
process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await Promise.all([
    scanSlotsWorker.close(),
    bookSlotWorker.close(),
    notifyWorker.close(),
    stopTaskWorker.close(),
    monitorWorker.close(),
  ]);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await Promise.all([
    scanSlotsWorker.close(),
    bookSlotWorker.close(),
    notifyWorker.close(),
    stopTaskWorker.close(),
    monitorWorker.close(),
  ]);
  process.exit(0);
});
*/

// ===== HELPER FUNCTIONS =====
export async function addJob(queueName: string, data: any, options?: any) {
  let queue;
  switch (queueName) {
    case 'slot-search':
      queue = scanSlotsQueue;
      break;
    case 'book-slot':
      queue = bookSlotQueue;
      break;
    case 'notify':
      queue = notifyQueue;
      break;
    case 'stop-task':
      queue = stopTaskQueue;
      break;
    case 'slot-monitor':
      queue = monitorQueue;
      break;
    default:
      throw new QueueError(`Unknown queue: ${queueName}`, 'UNKNOWN_QUEUE');
  }
  
  return await queue.add(queueName, data, options);
}
