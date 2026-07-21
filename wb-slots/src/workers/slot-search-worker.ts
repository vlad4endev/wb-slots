import { Worker, Job } from 'bullmq';
import { WBSlotSearch, SlotSearchConfig } from '@/lib/wb-slot-search';
import { TelegramNotifier } from '@/lib/telegram-notifier';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logging';

interface SlotSearchJobData {
  searchConfig: SlotSearchConfig;
  priority: number;
}

export class SlotSearchWorker {
  private worker: Worker;

  constructor(connection: any) {
    this.worker = new Worker(
      'slot-search',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 2, // Обрабатываем до 2 задач поиска одновременно
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    this.worker.on('completed', this.onJobCompleted.bind(this));
    this.worker.on('failed', this.onJobFailed.bind(this));
    this.worker.on('error', this.onWorkerError.bind(this));
  }

  private async processJob(job: Job<SlotSearchJobData>) {
    const { searchConfig, priority } = job.data;

    logger.info({ taskId: searchConfig.taskId, priority }, 'Starting slot search job');

    // Объявляем run вне блока try-catch для доступа в catch
    let run: { id: string } | null = null;

    try {
      // Обновляем статус задачи на "выполняется"
      await this.updateTaskStatus(searchConfig.taskId, 'RUNNING');

      // Создаем запись о запуске
      run = await prisma.run.create({
        data: {
          taskId: searchConfig.taskId,
          userId: searchConfig.userId,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      // Выполняем поиск слотов
      const slotSearch = new WBSlotSearch(searchConfig);
      const result = await slotSearch.searchSlots();

      // Отправляем уведомления в Telegram, если найдены слоты
      if (result.foundSlots.length > 0) {
        await this.sendTelegramNotifications(searchConfig.userId, result.foundSlots);
      }

      // Обновляем статус задачи
      const finalStatus = result.foundSlots.length > 0 ? 'SUCCESS' : 'FAILED';
      await this.updateTaskStatus(searchConfig.taskId, finalStatus);

      // Обновляем запись о запуске
      await prisma.run.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          finishedAt: new Date(),
          foundSlots: result.foundSlots.length,
          summary: {
            foundSlots: result.foundSlots.length,
            totalChecked: result.totalChecked,
            searchTime: result.searchTime,
            stoppedEarly: result.stoppedEarly,
            errors: result.errors,
          },
        },
      });

      // Создаем логи
      await this.createRunLogs(run.id, result);

      logger.info({ 
        taskId: searchConfig.taskId, 
        foundSlots: result.foundSlots.length,
        runId: run.id
      }, 'Slot search job completed');
      
      return result;

    } catch (error) {
      logger.error({ 
        taskId: searchConfig.taskId,
        runId: run?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Slot search job failed');
      
      // Обновляем статус на "ошибка"
      await this.updateTaskStatus(searchConfig.taskId, 'FAILED');
      
      // Создаем запись об ошибке только если run был создан
      if (run) {
        try {
          await prisma.runLog.create({
            data: {
              runId: run.id, // Исправлено: используем run.id вместо taskId
              level: 'ERROR',
              message: error instanceof Error ? error.message : 'Неизвестная ошибка',
              meta: { error: error },
            },
          });
        } catch (logError) {
          logger.error({ 
            error: logError instanceof Error ? logError.message : 'Unknown error',
            runId: run.id
          }, 'Failed to create error log entry');
        }
      } else {
        logger.warn({ taskId: searchConfig.taskId }, 'Cannot create error log: run was not created');
      }

      throw error;
    }
  }

  private async updateTaskStatus(taskId: string, status: 'RUNNING' | 'SUCCESS' | 'FAILED') {
    try {
      const updateData: any = {
        status: status === 'SUCCESS' ? 'COMPLETED' : status,
        enabled: status === 'SUCCESS' ? false : (status === 'RUNNING' ? true : false),
      };

      // Увеличиваем счетчик успешных поисков при успешном завершении
      if (status === 'SUCCESS') {
        updateData.successCount = {
          increment: 1
        };
      }

      await prisma.task.update({
        where: { id: taskId },
        data: updateData,
      });
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        taskId
      }, 'Error updating task status');
    }
  }

  private async createRunLogs(runId: string, result: any) {
    try {
      const logs = [
        {
          runId,
          level: 'INFO' as const,
          message: `Проверено складов: ${result.totalChecked}`,
          meta: { totalChecked: result.totalChecked },
        },
        {
          runId,
          level: 'INFO' as const,
          message: `Найдено слотов: ${result.foundSlots.length}`,
          meta: { foundSlots: result.foundSlots.length },
        },
        {
          runId,
          level: 'INFO' as const,
          message: `Время поиска: ${Math.round(result.searchTime / 1000)} секунд`,
          meta: { searchTime: result.searchTime },
        },
      ];

      if (result.stoppedEarly) {
        logs.push({
          runId,
          level: 'INFO' as const,
          message: 'Поиск остановлен при первом найденном слоте',
          meta: { stoppedEarly: true },
        });
      }

      if (result.errors.length > 0) {
        logs.push({
          runId,
          level: 'ERROR' as const,
          message: `Ошибки: ${result.errors.join(', ')}`,
          meta: { errors: result.errors },
        });
      }

      await prisma.runLog.createMany({
        data: logs,
      });
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        runId
      }, 'Error creating run logs');
    }
  }

  private onJobCompleted(job: Job<SlotSearchJobData>) {
    logger.info({ jobId: job.id }, 'Slot search job completed successfully');
  }

  private onJobFailed(job: Job<SlotSearchJobData> | undefined, error: Error) {
    logger.error({ 
      jobId: job?.id,
      error: error.message,
      stack: error.stack
    }, 'Slot search job failed');
  }

  private onWorkerError(error: Error) {
    logger.error({ 
      error: error.message,
      stack: error.stack
    }, 'Slot search worker error');
  }

  /**
   * Отправка уведомлений в Telegram
   */
  private async sendTelegramNotifications(userId: string, foundSlots: any[]): Promise<void> {
    try {
      // Получаем настройки Telegram для пользователя
      const telegramSettings = await prisma.userSettings.findFirst({
        where: {
          userId,
          category: 'TELEGRAM',
        },
      });

      if (!telegramSettings) {
        logger.debug({ userId }, 'Telegram settings not found for user');
        return;
      }

      const { botToken, chatId } = telegramSettings.settings as any;
      
      if (!botToken || !chatId) {
        logger.warn({ userId }, 'Bot token or Chat ID not configured');
        return;
      }

      const notifier = new TelegramNotifier({ botToken, chatId });
      const result = await notifier.sendBookingNotification(foundSlots);

      if (result.success) {
        logger.info({ userId, slotsCount: foundSlots.length }, 'Telegram notification sent successfully');
      } else {
        logger.error({ 
          userId, 
          error: result.error 
        }, 'Failed to send Telegram notification');
      }

    } catch (error) {
      logger.error({ 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Error sending Telegram notifications');
    }
  }

  async close() {
    await this.worker.close();
  }
}
