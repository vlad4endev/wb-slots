import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from './prisma';
import { WBClientFactory } from './wb-client';
import { decrypt } from './encryption';
import { LogLevel, RunStatus } from '@prisma/client';
import { slotSearchService } from './services/slot-search-service';
import { refactoredAutoBookingService } from './services/refactored/auto-booking-service';
import { telegramService } from './services/telegram-service';

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Export connection for use in workers and API
export function createConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  };
}

// Export redis instance for direct use
export { redis };

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
  slotData: {
    warehouseId: number;
    date: string;
    coefficient: number;
  };
}

export interface NotifyJobData {
  userId: string;
  type: 'slot_found' | 'slot_booked' | 'task_failed' | 'task_completed' | 'token_expired' | 'token_unauthorized' | 'api_error';
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
};

// Create queues
export const scanSlotsQueue = new Queue<ScanSlotsJobData>(QUEUE_NAMES.SCAN_SLOTS, queueOptions);
export const bookSlotQueue = new Queue<BookSlotJobData>(QUEUE_NAMES.BOOK_SLOT, queueOptions);
export const notifyQueue = new Queue<NotifyJobData>(QUEUE_NAMES.NOTIFY, queueOptions);
export const stopTaskQueue = new Queue<StopTaskJobData>(QUEUE_NAMES.STOP_TASK, queueOptions);
export const monitorQueue = new Queue<MonitorJobData>(QUEUE_NAMES.MONITOR, queueOptions);

// Add job helper function
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
      throw new Error(`Unknown queue: ${queueName}`);
  }
  
  return await queue.add(queueName, data, options);
}

// Scan slots worker
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
      await logRunMessage(runId, 'INFO', 'Starting slot scan', { taskId, userId });

      // Get task details
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { user: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Get user's supplies token
      const suppliesToken = await prisma.userToken.findFirst({
        where: {
          userId,
          category: 'SUPPLIES',
          isActive: true,
        },
      });

      if (!suppliesToken) {
        // Диагностика: проверяем, есть ли токены у пользователя вообще
        const userTokens = await prisma.userToken.findMany({
          where: { userId },
          select: { category: true, isActive: true }
        });
        
        console.error(`No active supplies token found for user ${userId}`);
        console.error(`User has ${userTokens.length} tokens:`, userTokens);
        
        throw new Error(`No active supplies token found. User has ${userTokens.length} tokens. Please add a SUPPLIES token in settings.`);
      }

      // Decrypt token
      const decryptedToken = decrypt(suppliesToken.tokenEncrypted);

      // Create WB client
      const wbClient = WBClientFactory.createSuppliesClient(decryptedToken);

      // Parse task filters
      const filters = task.filters as any;
      const { warehouseIds, boxTypeIds, dates, coefficientAllowed, allowUnload } = filters;

      // Validate coefficientAllowed
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

      await logRunMessage(runId, 'INFO', `Found ${availableSlots.length} available slots`, {
        slots: availableSlots,
      });

      // Update task with found slots
      const summary = {
        foundSlots: availableSlots.length,
        scannedAt: new Date().toISOString(),
      };

      await prisma.run.update({
        where: { id: runId },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          summary,
        },
      });

      // If auto-book is enabled and slots found, queue booking jobs
      if (task.autoBook && availableSlots.length > 0) {
        for (const slot of availableSlots) {
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

      // Send notification if slots found
      if (availableSlots.length > 0) {
        await notifyQueue.add('notify', {
          userId,
          type: 'slot_found',
          data: {
            taskId,
            taskName: task.name,
            slotsCount: availableSlots.length,
            slots: availableSlots,
          },
        });
      }

      await logRunMessage(runId, 'INFO', 'Slot scan completed successfully', summary);

    } catch (error) {
      console.error('Scan slots job error:', error);
      
      await logRunMessage(runId, 'ERROR', 'Slot scan failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

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

      // Send failure notification
      await notifyQueue.add('notify', {
        userId,
        type: 'task_failed',
        data: {
          taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  },
  workerOptions
);

// Book slot worker
export const bookSlotWorker = new Worker<BookSlotJobData>(
  QUEUE_NAMES.BOOK_SLOT,
  async (job: Job<BookSlotJobData>) => {
    const { taskId, userId, runId, slotData } = job.data;
    
    try {
      await logRunMessage(runId, 'INFO', 'Starting slot booking', { slotData });

      // For now, we can only log the slot booking attempt
      // In the future, this would integrate with WB's booking API or UI automation
      
      await logRunMessage(runId, 'WARN', 'Slot booking not implemented yet - would book slot', {
        slotData,
        note: 'This would integrate with WB booking API or UI automation',
      });

      // TODO: Implement actual slot booking when WB provides the API
      // or implement UI automation fallback

      await logRunMessage(runId, 'INFO', 'Slot booking completed (simulated)', { slotData });

    } catch (error) {
      console.error('Book slot job error:', error);
      
      await logRunMessage(runId, 'ERROR', 'Slot booking failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slotData,
      });

      throw error;
    }
  },
  workerOptions
);

// Notify worker
export const notifyWorker = new Worker<NotifyJobData>(
  QUEUE_NAMES.NOTIFY,
  async (job: Job<NotifyJobData>) => {
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
          await sendNotification(channel, type, data);
        } catch (error) {
          console.error(`Failed to send notification via ${channel.type}:`, error);
        }
      }

    } catch (error) {
      console.error('Notify job error:', error);
      throw error;
    }
  },
  workerOptions
);

// Helper function to log run messages
async function logRunMessage(
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
      meta: meta ? safeJsonStringify(meta) : undefined,
    },
  });
}

// Helper function to send notifications
async function sendNotification(
  channel: any,
  type: string,
  data: any
): Promise<void> {
  const config = channel.config as any;

  // Форматируем сообщение в зависимости от типа
  let message = '';
  
  switch (type) {
    case 'token_unauthorized':
    case 'token_expired':
      message = `${data.title || '🔐 Требуется обновление токена'}\n\n`;
      message += `${data.message || 'Ваш токен Wildberries истёк или недействителен.'}\n\n`;
      if (data.detail) {
        message += `Детали: ${data.detail}\n\n`;
      }
      if (data.action) {
        message += `📋 Действие: ${data.action}\n`;
      }
      if (data.link) {
        message += `🔗 Ссылка: ${data.link}`;
      }
      break;
    
    case 'api_error':
      message = `${data.title || '⚠️ Ошибка API Wildberries'}\n\n`;
      message += `${data.message || 'Произошла ошибка при работе с API.'}\n\n`;
      if (data.statusCode) {
        message += `Код ошибки: ${data.statusCode}\n`;
      }
      if (data.detail) {
        message += `Детали: ${data.detail}`;
      }
      break;
    
    case 'task_completed':
      message = `${data.title || '✅ Поиск слотов завершён'}\n\n`;
      message += `Найдено слотов: ${data.foundSlots || 0}\n`;
      message += `Выполнено поисков: ${data.totalSearches || 0}\n`;
      if (data.searchTime) {
        const minutes = Math.floor(data.searchTime / 60000);
        message += `Время поиска: ${minutes} мин.`;
      }
      break;
    
    case 'task_failed':
      message = `${data.title || '❌ Задача завершилась с ошибкой'}\n\n`;
      message += `${data.message || 'Произошла ошибка при выполнении задачи.'}\n\n`;
      if (data.reason) {
        message += `Причина: ${data.reason}`;
      }
      break;
    
    case 'slot_found':
      message = `${data.title || '🎯 Найдены подходящие слоты!'}\n\n`;
      message += `${data.message || `Обнаружено ${data.slotsCount || 0} слотов`}\n\n`;
      
      if (data.slots && Array.isArray(data.slots)) {
        // Показываем максимум 5 слотов в уведомлении
        const slotsToShow = data.slots.slice(0, 5);
        slotsToShow.forEach((slot: any, index: number) => {
          message += `📍 Слот ${index + 1}:\n`;
          message += `   🏪 Склад: ${slot.warehouseName || 'Неизвестно'}\n`;
          message += `   📅 Дата: ${slot.date || 'Неизвестно'}`;
          if (slot.timeSlot) {
            message += ` (${slot.timeSlot})`;
          }
          message += `\n   💰 Коэффициент: ${slot.coefficient || 0}\n`;
          message += `   📦 Типы коробок: ${slot.boxTypes?.join(', ') || 'Неизвестно'}\n\n`;
        });
        
        if (data.slots.length > 5) {
          message += `... и ещё ${data.slots.length - 5} слотов\n\n`;
        }
      } else if (data.warehouseName) {
        // Обратная совместимость - старый формат с одним слотом
        message += `Склад: ${data.warehouseName || 'Неизвестно'}\n`;
        message += `Дата: ${data.date || 'Неизвестно'}\n`;
        message += `Коэффициент: ${data.coefficient || 0}\n\n`;
      }
      
      message += `🔗 Перейдите в панель управления для просмотра деталей.`;
      break;
    
    case 'slot_booked':
      message = `✅ Слот забронирован!\n\n`;
      message += `Склад: ${data.warehouseName || 'Неизвестно'}\n`;
      message += `Дата: ${data.date || 'Неизвестно'}`;
      break;
    
    default:
      message = data.message || JSON.stringify(data);
  }

  switch (channel.type) {
    case 'EMAIL':
      // TODO: Implement email notification
      console.log(`Email notification to ${config.email}: ${type}`, message);
      break;
    
    case 'TELEGRAM':
      try {
        const chatId = config.chatId || config.telegram_chat_id;
        if (!chatId) {
          console.warn('Telegram chatId not found in channel config');
          break;
        }
        
        // Используем telegramService для отправки
        const userId = channel.userId;
        if (userId) {
          await telegramService.sendNotification(userId, message);
          console.log(`Telegram notification sent to user ${userId}`);
        } else {
          console.log(`Telegram notification (no userId): ${type}`, message);
        }
      } catch (error) {
        console.error('Failed to send Telegram notification:', error);
      }
      break;
    
    case 'WEBHOOK':
      try {
        const webhookUrl = config.url || config.webhook_url;
        if (!webhookUrl) {
          console.warn('Webhook URL not found in channel config');
          break;
        }
        
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            data,
            message,
            timestamp: new Date().toISOString(),
          }),
        });
        
        console.log(`Webhook notification sent to ${webhookUrl}`);
      } catch (error) {
        console.error('Failed to send webhook notification:', error);
      }
      break;
    
    default:
      console.log(`Unknown notification channel type: ${channel.type}`);
  }
}

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

// Stop task worker
export const stopTaskWorker = new Worker<StopTaskJobData>(
  QUEUE_NAMES.STOP_TASK,
  async (job: Job<StopTaskJobData>) => {
    const { taskId } = job.data;
    
    try {
      console.log(`🛑 Останавливаем задачу ${taskId}`);
      
      // Обновляем статус задачи на STOPPED
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          // status: 'STOPPED', // Временно убираем до генерации Prisma клиента
          enabled: false,
        },
      });

      // Останавливаем все активные запуски этой задачи
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
  },
  workerOptions
);

stopTaskWorker.on('error', (error) => {
  console.error('Stop task worker error:', error);
});

// Monitor worker
export const monitorWorker = new Worker<MonitorJobData>(
  QUEUE_NAMES.MONITOR,
  async (job: Job<MonitorJobData>) => {
    const { taskId, runId, userId, checkInterval, maxAttempts } = job.data;
    
    try {
      // Update run status to running
      await prisma.run.update({
        where: { id: runId },
        data: { status: 'RUNNING' },
      });

      await logRunMessage(runId, 'INFO', 'Starting slot monitoring', { 
        taskId, 
        checkInterval, 
        maxAttempts 
      });

      // Get task details
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { user: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Get user's supplies token
      const suppliesToken = await prisma.userToken.findFirst({
        where: {
          userId,
          category: 'SUPPLIES',
          isActive: true,
        },
      });

      if (!suppliesToken) {
        // Диагностика: проверяем, есть ли токены у пользователя вообще
        const userTokens = await prisma.userToken.findMany({
          where: { userId },
          select: { category: true, isActive: true }
        });
        
        console.error(`No active supplies token found for user ${userId}`);
        console.error(`User has ${userTokens.length} tokens:`, userTokens);
        
        throw new Error(`No active supplies token found. User has ${userTokens.length} tokens. Please add a SUPPLIES token in settings.`);
      }

      // Decrypt token
      const decryptedToken = decrypt(suppliesToken.tokenEncrypted);

      // Create WB client
      const wbClient = WBClientFactory.createSuppliesClient(decryptedToken);

      // Parse task filters
      const filters = task.filters as any;
      const { warehouseIds, boxTypeIds, dates, coefficientAllowed, allowUnload } = filters;

      // Validate coefficientAllowed
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
          await logRunMessage(runId, 'INFO', 'Task disabled, stopping monitoring');
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

          await logRunMessage(runId, 'INFO', `Check ${attempts}/${maxAttempts}: Found ${availableSlots.length} slots`, {
            attempt: attempts,
            slots: availableSlots,
          });

          if (availableSlots.length > 0) {
            foundSlots = availableSlots.length;
            
            // If auto-book is enabled, queue booking jobs
            if (task.autoBook) {
              for (const slot of availableSlots) {
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

            // Send notification
            await notifyQueue.add('notify', {
              userId,
              type: 'slot_found',
              data: {
                taskId,
                taskName: task.name,
                slotsCount: availableSlots.length,
                slots: availableSlots,
              },
            });

            // Stop monitoring after first successful find
            break;
          }

          // Wait before next check
          await new Promise(resolve => setTimeout(resolve, checkInterval));

        } catch (error) {
          await logRunMessage(runId, 'WARN', `Check ${attempts} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
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

      await prisma.run.update({
        where: { id: runId },
        data: {
          status: foundSlots > 0 ? 'SUCCESS' : 'FAILED',
          finishedAt: new Date(),
          summary,
        },
      });

      await logRunMessage(runId, 'INFO', 'Slot monitoring completed', summary);

    } catch (error) {
      console.error('Monitor job error:', error);
      
      await logRunMessage(runId, 'ERROR', 'Slot monitoring failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

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

      // Send failure notification
      await notifyQueue.add('notify', {
        userId,
        type: 'task_failed',
        data: {
          taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  },
  workerOptions
);

monitorWorker.on('error', (error) => {
  console.error('Monitor worker error:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await scanSlotsWorker.close();
  await bookSlotWorker.close();
  await notifyWorker.close();
  await monitorWorker.close();
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await scanSlotsWorker.close();
  await bookSlotWorker.close();
  await notifyWorker.close();
  await monitorWorker.close();
  await redis.quit();
  process.exit(0);
});
