import { Worker, Job } from 'bullmq';
import { UnifiedAutoBookingService } from '@/lib/services/unified-auto-booking-service';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/logging/logger';

interface AutoBookingJobData {
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

export class UnifiedAutoBookingWorker {
  private worker: Worker;
  private autoBookingService: UnifiedAutoBookingService;
  private logger: Logger;

  constructor(connection: any) {
    this.autoBookingService = new UnifiedAutoBookingService();
    this.logger = new Logger('INFO', { service: 'UnifiedAutoBookingWorker' });
    
    this.worker = new Worker(
      'unified-auto-booking',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 1, // Обрабатываем по одной задаче за раз
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    this.worker.on('completed', this.onJobCompleted.bind(this));
    this.worker.on('failed', this.onJobFailed.bind(this));
    this.worker.on('error', this.onWorkerError.bind(this));

    this.logger.info('🚀 Unified Auto Booking Worker initialized');
  }

  private async processJob(job: Job<AutoBookingJobData>) {
    const { taskId, userId, runId, slotId, supplyId, warehouseId, boxTypeId, date, coefficient } = job.data;

    this.logger.info(`🚀 Processing auto-booking job ${job.id}`, {
      taskId,
      userId,
      supplyId,
      warehouseId,
      date
    });

    try {
      // Обновляем статус задачи на "выполняется"
      await this.updateTaskStatus(taskId, 'RUNNING');

      // Создаем запись о запуске
      const run = await prisma.run.create({
        data: {
          taskId,
          userId,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      // Создаем конфигурацию бронирования
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

      // Выполняем автобронирование
      const result = await this.autoBookingService.startBooking(bookingConfig);

      // Обновляем статус задачи
      const finalStatus = result.success ? 'SUCCESS' : 'FAILED';
      await this.updateTaskStatus(taskId, finalStatus);

      // Обновляем запись о запуске
      await prisma.run.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          finishedAt: new Date(),
          summary: {
            success: result.success,
            bookingId: result.bookingId,
            error: result.error,
            supplyId,
            warehouseId,
            date,
            executionTime: Date.now() - run.startedAt.getTime(),
          },
        },
      });

      // Создаем логи
      await this.createRunLogs(run.id, result, bookingConfig);

      this.logger.info(`✅ Auto-booking job ${job.id} completed`, {
        success: result.success,
        bookingId: result.bookingId,
        error: result.error
      });

      return result;

    } catch (error) {
      this.logger.error(`❌ Auto-booking job ${job.id} failed`, {
        error: error.message,
        taskId,
        userId,
        supplyId
      });
      
      // Обновляем статус на "ошибка"
      await this.updateTaskStatus(taskId, 'FAILED');
      
      // Создаем запись об ошибке
      await prisma.runLog.create({
        data: {
          runId,
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Неизвестная ошибка',
          meta: { 
            error: error,
            taskId,
            userId,
            supplyId,
            warehouseId,
            date
          },
        },
      });

      throw error;
    }
  }

  private async updateTaskStatus(taskId: string, status: 'RUNNING' | 'SUCCESS' | 'FAILED') {
    try {
      const updateData: any = {
        status: status === 'SUCCESS' ? 'COMPLETED' : status,
        updatedAt: new Date(),
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

      this.logger.info(`📊 Task ${taskId} status updated to ${status}`);
    } catch (error) {
      this.logger.error('Error updating task status', { error: error.message, taskId, status });
    }
  }

  private async createRunLogs(runId: string, result: any, config: AutoBookingJobData) {
    try {
      const logs = [
        {
          runId,
          level: 'INFO' as const,
          message: result.success ? 'Слот успешно забронирован' : 'Ошибка бронирования',
          meta: { 
            success: result.success,
            bookingId: result.bookingId,
            error: result.error,
            supplyId: config.supplyId,
            warehouseId: config.warehouseId,
            date: config.date,
            coefficient: config.coefficient,
          },
        },
      ];

      if (result.screenshot) {
        logs.push({
          runId,
          level: 'INFO' as const,
          message: 'Скриншот сохранен',
          meta: { 
            hasScreenshot: true,
            screenshotSize: result.screenshot.length
          },
        });
      }

      await prisma.runLog.createMany({
        data: logs,
      });

      this.logger.info(`📝 Created ${logs.length} run logs for run ${runId}`);
    } catch (error) {
      this.logger.error('Error creating run logs', { error: error.message, runId });
    }
  }

  private onJobCompleted(job: Job<AutoBookingJobData>) {
    this.logger.info(`✅ Auto-booking job ${job.id} completed successfully`);
  }

  private onJobFailed(job: Job<AutoBookingJobData> | undefined, error: Error) {
    this.logger.error(`❌ Auto-booking job ${job?.id} failed`, {
      error: error.message,
      stack: error.stack
    });
  }

  private onWorkerError(error: Error) {
    this.logger.error('❌ Unified Auto Booking Worker error', {
      error: error.message,
      stack: error.stack
    });
  }

  async close() {
    this.logger.info('🛑 Closing Unified Auto Booking Worker...');
    await this.autoBookingService.stop();
    await this.worker.close();
  }
}
