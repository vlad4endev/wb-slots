import { Worker, Job } from 'bullmq';
import { WBSlotSearch, SlotSearchConfig } from '@/lib/wb-slot-search';
import { TelegramNotifier } from '@/lib/telegram-notifier';
import { prisma } from '@/lib/prisma';

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

    console.log(`🔍 Запуск поиска слотов для задачи ${searchConfig.taskId}`);

    try {
      // Обновляем статус задачи на "выполняется"
      await this.updateTaskStatus(searchConfig.taskId, 'RUNNING');

      // Создаем запись о запуске
      const run = await prisma.run.create({
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

      console.log(`✅ Поиск слотов завершен для задачи ${searchConfig.taskId}. Найдено: ${result.foundSlots.length}`);
      return result;

    } catch (error) {
      console.error(`❌ Ошибка поиска слотов для задачи ${searchConfig.taskId}:`, error);
      
      // Обновляем статус на "ошибка"
      await this.updateTaskStatus(searchConfig.taskId, 'FAILED');
      
      // Создаем запись об ошибке
      await prisma.runLog.create({
        data: {
          runId: searchConfig.taskId, // Временно используем taskId
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Неизвестная ошибка',
          meta: { error: error },
        },
      });

      throw error;
    }
  }

  private async updateTaskStatus(taskId: string, status: 'RUNNING' | 'SUCCESS' | 'FAILED') {
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          enabled: status === 'SUCCESS' ? true : false,
        },
      });
    } catch (error) {
      console.error('Error updating task status:', error);
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
      console.error('Error creating run logs:', error);
    }
  }

  private onJobCompleted(job: Job<SlotSearchJobData>) {
    console.log(`✅ Задача поиска слотов ${job.id} завершена успешно`);
  }

  private onJobFailed(job: Job<SlotSearchJobData> | undefined, error: Error) {
    console.error(`❌ Задача поиска слотов ${job?.id} завершилась с ошибкой:`, error);
  }

  private onWorkerError(error: Error) {
    console.error('❌ Ошибка воркера поиска слотов:', error);
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
        console.log('📱 Настройки Telegram не найдены для пользователя', userId);
        return;
      }

      const { botToken, chatId } = telegramSettings.settings as any;
      
      if (!botToken || !chatId) {
        console.log('📱 Токен бота или Chat ID не настроены');
        return;
      }

      const notifier = new TelegramNotifier({ botToken, chatId });
      const result = await notifier.sendBookingNotification(foundSlots);

      if (result.success) {
        console.log('✅ Уведомление в Telegram отправлено успешно');
      } else {
        console.error('❌ Ошибка отправки уведомления в Telegram:', result.error);
      }

    } catch (error) {
      console.error('❌ Ошибка отправки уведомлений в Telegram:', error);
    }
  }

  async close() {
    await this.worker.close();
  }
}
