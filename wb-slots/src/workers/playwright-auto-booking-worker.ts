import { Worker, Job } from 'bullmq';
import { PlaywrightAutoBookingService, BookingSlot } from '@/lib/services/playwright-auto-booking-service';
import { Logger } from '@/lib/logging/logger';
import { prisma } from '@/lib/prisma';

const logger = new Logger('INFO', { service: 'PlaywrightAutoBookingWorker' });

interface AutoBookingJobData {
  userId: string;
  taskId: string;
  supplyId: string;
  slot: BookingSlot;
  priority?: number;
  delay?: number;
}

export class PlaywrightAutoBookingWorker {
  private worker: Worker<AutoBookingJobData>;
  private isRunning: boolean = false;

  constructor(connection: any) {
    this.worker = new Worker<AutoBookingJobData>(
      'playwright-auto-booking',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 2, // Ограничиваем количество одновременных бронирований
        removeOnComplete: 100,
        removeOnFail: 50,
        retryProcessDelay: 5000,
        maxStalledCount: 3,
        stalledInterval: 30000,
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Обработка задачи бронирования
   */
  private async processJob(job: Job<AutoBookingJobData>): Promise<any> {
    const { userId, taskId, supplyId, slot } = job.data;
    
    logger.info(`🎯 Обработка задачи бронирования: ${job.id}`);
    logger.info(`📋 Параметры: userId=${userId}, taskId=${taskId}, supplyId=${supplyId}`);

    try {
      // Обновляем статус задачи на "В процессе бронирования"
      await this.updateTaskStatus(taskId, 'BOOKING');

      // Создаем сервис автобронирования
      const bookingService = new PlaywrightAutoBookingService(userId, taskId, supplyId);

      // Выполняем бронирование
      const result = await bookingService.bookSlot(slot);

      if (result.success) {
        logger.info(`✅ Бронирование успешно завершено: ${result.bookingId}`);
        
        // Обновляем статус задачи на "Завершено"
        await this.updateTaskStatus(taskId, 'COMPLETED');
        
        // Отправляем уведомление пользователю
        await this.sendSuccessNotification(userId, result);

        return {
          success: true,
          bookingId: result.bookingId,
          details: result.details,
          executionTime: result.executionTime,
          retryCount: result.retryCount,
        };
      } else {
        logger.error(`❌ Ошибка бронирования: ${result.error}`);
        
        // Обновляем статус задачи на "Ошибка"
        await this.updateTaskStatus(taskId, 'FAILED');
        
        // Отправляем уведомление об ошибке
        await this.sendErrorNotification(userId, result);

        throw new Error(result.error);
      }

    } catch (error) {
      logger.error(`💥 Критическая ошибка в задаче ${job.id}:`, error);
      
      // Обновляем статус задачи на "Ошибка"
      await this.updateTaskStatus(taskId, 'FAILED');
      
      // Отправляем уведомление об ошибке
      await this.sendErrorNotification(userId, {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        taskId,
        userId,
        supplyId,
      });

      throw error;
    }
  }

  /**
   * Обновление статуса задачи
   */
  private async updateTaskStatus(taskId: string, status: string): Promise<void> {
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          status: status as any,
          updatedAt: new Date(),
        },
      });
      logger.info(`📊 Статус задачи ${taskId} обновлен на: ${status}`);
    } catch (error) {
      logger.error('Ошибка обновления статуса задачи:', error);
    }
  }

  /**
   * Отправка уведомления об успешном бронировании
   */
  private async sendSuccessNotification(userId: string, result: any): Promise<void> {
    try {
      // Здесь можно добавить отправку уведомлений через Telegram, email и т.д.
      logger.info(`📢 Уведомление об успешном бронировании отправлено пользователю ${userId}`);
      
      // Пример: сохранение уведомления в БД
      await prisma.notification.create({
        data: {
          userId,
          type: 'BOOKING_SUCCESS',
          title: 'Бронирование успешно',
          message: `Слот успешно забронирован. ID: ${result.bookingId}`,
          data: {
            bookingId: result.bookingId,
            details: result.details,
            executionTime: result.executionTime,
          },
        },
      });
    } catch (error) {
      logger.error('Ошибка отправки уведомления об успехе:', error);
    }
  }

  /**
   * Отправка уведомления об ошибке
   */
  private async sendErrorNotification(userId: string, result: any): Promise<void> {
    try {
      logger.error(`📢 Уведомление об ошибке отправлено пользователю ${userId}`);
      
      // Пример: сохранение уведомления об ошибке в БД
      await prisma.notification.create({
        data: {
          userId,
          type: 'BOOKING_ERROR',
          title: 'Ошибка бронирования',
          message: `Не удалось забронировать слот: ${result.error}`,
          data: {
            error: result.error,
            taskId: result.taskId,
            supplyId: result.supplyId,
            retryCount: result.retryCount,
          },
        },
      });
    } catch (error) {
      logger.error('Ошибка отправки уведомления об ошибке:', error);
    }
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    this.worker.on('ready', () => {
      logger.info('🚀 Playwright Auto Booking Worker готов к работе');
      this.isRunning = true;
    });

    this.worker.on('error', (error) => {
      logger.error('❌ Ошибка воркера:', error);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`💥 Задача ${job?.id} завершилась с ошибкой:`, err);
    });

    this.worker.on('completed', (job) => {
      logger.info(`✅ Задача ${job.id} успешно завершена`);
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn(`⏸️ Задача ${jobId} зависла`);
    });

    this.worker.on('progress', (job, progress) => {
      logger.info(`📈 Прогресс задачи ${job.id}: ${progress}%`);
    });
  }

  /**
   * Запуск воркера
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Воркер уже запущен');
      return;
    }

    try {
      await this.worker.waitUntilReady();
      logger.info('✅ Playwright Auto Booking Worker запущен');
    } catch (error) {
      logger.error('Ошибка запуска воркера:', error);
      throw error;
    }
  }

  /**
   * Остановка воркера
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Воркер уже остановлен');
      return;
    }

    try {
      await this.worker.close();
      this.isRunning = false;
      logger.info('🛑 Playwright Auto Booking Worker остановлен');
    } catch (error) {
      logger.error('Ошибка остановки воркера:', error);
      throw error;
    }
  }

  /**
   * Получение статистики воркера
   */
  async getStats(): Promise<{
    isRunning: boolean;
    concurrency: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    try {
      const waiting = await this.worker.getWaiting();
      const active = await this.worker.getActive();
      const completed = await this.worker.getCompleted();
      const failed = await this.worker.getFailed();

      return {
        isRunning: this.isRunning,
        concurrency: this.worker.opts.concurrency || 1,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch (error) {
      logger.error('Ошибка получения статистики воркера:', error);
      return {
        isRunning: this.isRunning,
        concurrency: 0,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
    }
  }

  /**
   * Очистка старых задач
   */
  async cleanup(): Promise<void> {
    try {
      await this.worker.clean(24 * 60 * 60 * 1000, 100, 'completed'); // Очищаем завершенные задачи старше 24 часов
      await this.worker.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'); // Очищаем неудачные задачи старше 7 дней
      logger.info('🧹 Очистка старых задач выполнена');
    } catch (error) {
      logger.error('Ошибка очистки задач:', error);
    }
  }
}
