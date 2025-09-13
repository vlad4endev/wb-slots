import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from './prisma';
import { LogLevel, RunStatus } from '@prisma/client';
import { slotSearchService } from './services/slot-search-service';
import { autoBookingService } from './services/auto-booking-service';
import { telegramService } from './services/telegram-service';

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue names
export const QUEUE_NAMES = {
  SCAN_SLOTS: 'scan-slots',
  BOOK_SLOT: 'book-slot',
  NOTIFY: 'notify',
  STOP_TASK: 'stop-task',
  MONITOR: 'slot-monitor',
} as const;

// Job data interfaces
export interface ScanSlotsJobData {
  taskId: string;
  userId: string;
  runId: string;
}

export interface BookSlotJobData {
  taskId: string;
  userId: string;
  runId: string;
  slotId: string;
  supplyId: string;
  warehouseId: number;
  boxTypeId: number;
  date: string;
  coefficient: number;
}

export interface NotifyJobData {
  userId: string;
  type: 'SLOT_FOUND' | 'BOOKING_SUCCESS' | 'BOOKING_ERROR' | 'TASK_COMPLETED';
  data: any;
}

export interface StopTaskJobData {
  taskId: string;
  userId: string;
}

export interface MonitorJobData {
  taskId: string;
  userId: string;
  runId: string;
  maxAttempts?: number;
}

// Queue options
const queueOptions: QueueOptions = {
  connection: redis,
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

// Worker options
const workerOptions: WorkerOptions = {
  connection: redis,
  concurrency: 5,
  removeOnComplete: 100,
  removeOnFail: 50,
};

// Create queues
export const scanSlotsQueue = new Queue(QUEUE_NAMES.SCAN_SLOTS, queueOptions);
export const bookSlotQueue = new Queue(QUEUE_NAMES.BOOK_SLOT, queueOptions);
export const notifyQueue = new Queue(QUEUE_NAMES.NOTIFY, queueOptions);
export const stopTaskQueue = new Queue(QUEUE_NAMES.STOP_TASK, queueOptions);
export const monitorQueue = new Queue(QUEUE_NAMES.MONITOR, queueOptions);

// Helper function to add jobs
export async function addJob(queueName: keyof typeof QUEUE_NAMES, data: any, options?: any) {
  const queue = {
    [QUEUE_NAMES.SCAN_SLOTS]: scanSlotsQueue,
    [QUEUE_NAMES.BOOK_SLOT]: bookSlotQueue,
    [QUEUE_NAMES.NOTIFY]: notifyQueue,
    [QUEUE_NAMES.STOP_TASK]: stopTaskQueue,
    [QUEUE_NAMES.MONITOR]: monitorQueue,
  }[queueName];

  return await queue.add(queueName, data, options);
}

// Helper function to log run messages
async function logRunMessage(runId: string, level: LogLevel, message: string, meta?: any) {
  try {
    await prisma.runLog.create({
      data: {
        runId,
        level,
        message,
        meta: meta ? JSON.stringify(meta) : undefined,
        ts: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to log run message:', error);
  }
}

// Scan slots worker - использует SlotSearchService
export const scanSlotsWorker = new Worker<ScanSlotsJobData>(
  QUEUE_NAMES.SCAN_SLOTS,
  async (job: Job<ScanSlotsJobData>) => {
    const { taskId, userId, runId } = job.data;
    
    try {
      // Update run status to running
      await prisma.run.update({
        where: { id: runId },
        data: { status: 'RUNNING' },
      });

      // Log start
      await logRunMessage(runId, 'INFO', 'Starting slot scan with SlotSearchService', { taskId, userId });

      // Get task details
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { user: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Parse task filters
      const filters = task.filters as any;
      const { warehouseIds, boxTypeIds, dates, coefficientMin, coefficientMax, isSortingCenter } = filters;

      // Create search config
      const searchConfig = {
        taskId,
        userId,
        runId,
        warehouseIds: warehouseIds || [],
        boxTypeIds: boxTypeIds || [],
        coefficientMin: coefficientMin || 0,
        coefficientMax: coefficientMax || 0,
        dateFrom: dates?.from || new Date().toISOString(),
        dateTo: dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stopOnFirstFound: true,
        isSortingCenter: isSortingCenter || false,
        maxSearchCycles: 10,
        searchDelay: 10000, // 10 seconds between searches
        maxExecutionTime: 3 * 24 * 60 * 60 * 1000, // 3 days
      };

      // Use SlotSearchService
      const result = await slotSearchService.startSearch(searchConfig);

      await logRunMessage(runId, 'INFO', `Search completed: ${result.foundSlots} slots found`, {
        result,
      });

      // Update run with results
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: result.success ? 'SUCCESS' : 'FAILED',
          finishedAt: new Date(),
          foundSlots: result.foundSlots,
          summary: {
            foundSlots: result.foundSlots,
            totalChecked: result.totalChecked,
            searchTime: result.searchTime,
            errors: result.errors,
            stoppedEarly: result.stoppedEarly,
            scannedAt: new Date().toISOString(),
          } as any,
        },
      });

      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          enabled: false, // Stop the task
        },
      });

      // If slots found, trigger booking
      if (result.success && result.foundSlots > 0) {
        const bestSlot = result.slots[0]; // Take the first (best) slot
        
        await addJob('book-slot', {
          taskId,
          userId,
          runId,
          slotId: bestSlot.id || bestSlot.slotId,
          supplyId: task.supplyId || '',
          warehouseId: bestSlot.warehouseID,
          boxTypeId: bestSlot.boxTypeID,
          date: bestSlot.date,
          coefficient: bestSlot.coefficient,
        });
      }

    } catch (error) {
      console.error('Scan slots job error:', error);
      
      // Update run status to failed
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          summary: {
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date().toISOString(),
          } as any,
        },
      });

      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          enabled: false, // Stop the task on error
        },
      });
    }
  },
  workerOptions
);

// Book slot worker - использует AutoBookingService
export const bookSlotWorker = new Worker<BookSlotJobData>(
  QUEUE_NAMES.BOOK_SLOT,
  async (job: Job<BookSlotJobData>) => {
    const { taskId, userId, runId, slotId, supplyId, warehouseId, boxTypeId, date, coefficient } = job.data;
    
    try {
      await logRunMessage(runId, 'INFO', 'Starting slot booking with AutoBookingService', {
        taskId, userId, slotId, supplyId, warehouseId, boxTypeId, date, coefficient
      });

      // Create booking config
      const bookingConfig = {
        taskId,
        userId,
        runId,
        slotId,
        supplyId,
        warehouseId,
        boxTypeId,
        date,
        coefficient,
      };

      // Use AutoBookingService
      const result = await autoBookingService.startBooking(bookingConfig);

      await logRunMessage(runId, 'INFO', `Booking completed: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
        result,
      });

      // Update run with booking results
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: result.success ? 'SUCCESS' : 'FAILED',
          finishedAt: new Date(),
          summary: {
            bookingSuccess: result.success,
            bookingId: result.bookingId,
            bookingError: result.error,
            bookedAt: new Date().toISOString(),
          } as any,
        },
      });

      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          enabled: false, // Stop the task
        },
      });

      // Send notification
      await addJob('notify', {
        userId,
        type: result.success ? 'BOOKING_SUCCESS' : 'BOOKING_ERROR',
        data: {
          taskId,
          result,
        },
      });

    } catch (error) {
      console.error('Book slot job error:', error);
      
      // Update run status to failed
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          summary: {
            error: error instanceof Error ? error.message : 'Unknown booking error',
            failedAt: new Date().toISOString(),
          } as any,
        },
      });

      // Send error notification
      await addJob('notify', {
        userId,
        type: 'BOOKING_ERROR',
        data: {
          taskId,
          error: error instanceof Error ? error.message : 'Unknown booking error',
        },
      });
    }
  },
  workerOptions
);

// Notify worker - использует TelegramService
export const notifyWorker = new Worker<NotifyJobData>(
  QUEUE_NAMES.NOTIFY,
  async (job: Job<NotifyJobData>) => {
    const { userId, type, data } = job.data;
    
    try {
      let message = '';
      
      switch (type) {
        case 'SLOT_FOUND':
          message = `🎯 Найден подходящий слот!\n\n` +
            `📦 ID поставки: ${data.supplyId}\n` +
            `🏪 Склад: ${data.warehouseId}\n` +
            `📅 Дата: ${data.date}\n` +
            `💰 Коэффициент: ${data.coefficient}\n\n` +
            `🔄 Начинаю процесс бронирования...`;
          break;
          
        case 'BOOKING_SUCCESS':
          message = `✅ Слот успешно забронирован!\n\n` +
            `📦 ID поставки: ${data.supplyId}\n` +
            `🏪 Склад: ${data.warehouseId}\n` +
            `📅 Дата: ${data.date}\n` +
            `💰 Коэффициент: ${data.coefficient}\n` +
            `🆔 ID бронирования: ${data.bookingId}`;
          break;
          
        case 'BOOKING_ERROR':
          message = `❌ Ошибка при бронировании слота!\n\n` +
            `📦 ID поставки: ${data.supplyId}\n` +
            `🏪 Склад: ${data.warehouseId}\n` +
            `❌ Ошибка: ${data.error}\n\n` +
            `🔄 Попробую найти другой слот...`;
          break;
          
        case 'TASK_COMPLETED':
          message = `✅ Задача завершена!\n\n` +
            `📊 Найдено слотов: ${data.foundSlots}\n` +
            `⏱️ Время поиска: ${data.searchTime}ms\n` +
            `🔄 Статус: ${data.status}`;
          break;
      }

      if (message) {
        await telegramService.sendNotification(userId, message);
      }

    } catch (error) {
      console.error('Notify job error:', error);
    }
  },
  workerOptions
);

// Stop task worker
export const stopTaskWorker = new Worker<StopTaskJobData>(
  QUEUE_NAMES.STOP_TASK,
  async (job: Job<StopTaskJobData>) => {
    const { taskId, userId } = job.data;
    
    try {
      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          enabled: false,
        },
      });

      // Stop search service if running
      if (slotSearchService.isSearchInProgress()) {
        await slotSearchService.stopSearch();
      }

      // Stop booking service if running
      if (autoBookingService.isBookingInProgress()) {
        await autoBookingService.stop();
      }

      console.log(`Task ${taskId} stopped by user ${userId}`);

    } catch (error) {
      console.error('Stop task job error:', error);
    }
  },
  workerOptions
);

// Monitor worker - для непрерывного мониторинга
export const monitorWorker = new Worker<MonitorJobData>(
  QUEUE_NAMES.MONITOR,
  async (job: Job<MonitorJobData>) => {
    const { taskId, userId, runId, maxAttempts = 10 } = job.data;
    
    try {
      // Get task details
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { user: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Parse task filters
      const filters = task.filters as any;
      const { warehouseIds, boxTypeIds, dates, coefficientMin, coefficientMax, isSortingCenter } = filters;

      // Create search config for monitoring
      const searchConfig = {
        taskId,
        userId,
        runId,
        warehouseIds: warehouseIds || [],
        boxTypeIds: boxTypeIds || [],
        coefficientMin: coefficientMin || 0,
        coefficientMax: coefficientMax || 0,
        dateFrom: dates?.from || new Date().toISOString(),
        dateTo: dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stopOnFirstFound: true,
        isSortingCenter: isSortingCenter || false,
        maxSearchCycles: maxAttempts,
        searchDelay: 60000, // 1 minute between searches
        maxExecutionTime: 3 * 24 * 60 * 60 * 1000, // 3 days
      };

      // Use SlotSearchService for monitoring
      const result = await slotSearchService.startSearch(searchConfig);

      if (result.success && result.foundSlots > 0) {
        // Found slots, trigger booking
        const bestSlot = result.slots[0];
        
        await addJob('book-slot', {
          taskId,
          userId,
          runId,
          slotId: bestSlot.id || bestSlot.slotId,
          supplyId: task.supplyId || '',
          warehouseId: bestSlot.warehouseID,
          boxTypeId: bestSlot.boxTypeID,
          date: bestSlot.date,
          coefficient: bestSlot.coefficient,
        });
      } else {
        // No slots found, schedule next monitoring attempt
        await addJob('monitor', {
          taskId,
          userId,
          runId,
          maxAttempts: maxAttempts - 1,
        }, { delay: 60000 }); // 1 minute delay
      }

    } catch (error) {
      console.error('Monitor job error:', error);
    }
  },
  workerOptions
);

// Error handlers
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await scanSlotsWorker.close();
  await bookSlotWorker.close();
  await notifyWorker.close();
  await stopTaskWorker.close();
  await monitorWorker.close();
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await scanSlotsWorker.close();
  await bookSlotWorker.close();
  await notifyWorker.close();
  await stopTaskWorker.close();
  await monitorWorker.close();
  await redis.quit();
  process.exit(0);
});
