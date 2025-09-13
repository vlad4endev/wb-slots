import { Worker, Job } from 'bullmq';
import { AutoBookingService, AutoBookingConfig } from '@/lib/auto-booking-service';
import { prisma } from '@/lib/prisma';

interface AutoBookingJobData {
  taskId: string;
  userId: string;
  wbCredentials: {
    email: string;
    password: string;
  };
  searchParams: {
    warehouseIds: number[];
    dateFrom: string;
    dateTo: string;
    coefficientMin: number;
    coefficientMax: number;
    allowUnload: boolean;
    boxTypeIds: number[];
    supplyId?: string;
  };
  maxBookingAttempts: number;
  bookingDelay: number;
}

export class AutoBookingWorker {
  private worker: Worker;
  private autoBookingService: AutoBookingService;

  constructor(connection: any) {
    this.autoBookingService = new AutoBookingService();
    
    this.worker = new Worker(
      'auto-booking',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 1, // Обрабатываем по одной задаче за раз
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    this.worker.on('completed', this.onJobCompleted.bind(this));
    this.worker.on('failed', this.onJobFailed.bind(this));
    this.worker.on('error', this.onWorkerError.bind(this));
  }

  private async processJob(job: Job<AutoBookingJobData>) {
    const { taskId, userId, wbCredentials, searchParams, maxBookingAttempts, bookingDelay } = job.data;

    console.log(`🚀 Запуск автобронирования для задачи ${taskId}`);

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

      // Выполняем автобронирование через мониторинг
      const config: AutoBookingConfig = {
        userId,
        taskId,
        wbCredentials,
        searchParams,
        maxBookingAttempts,
        bookingDelay,
        useSavedSession: true,
      };

      // Используем новый метод мониторинга вместо старого
      const result = await this.autoBookingService.monitorAndBookSlots(config);

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
            foundSlots: result.foundSlots.length,
            bookedSlots: result.bookedSlots.filter(bs => bs.bookingId).length,
            totalSearchTime: result.totalSearchTime,
            totalBookingTime: result.totalBookingTime,
            errors: result.errors,
          },
        },
      });

      // Создаем логи
      await this.createRunLogs(run.id, result);

      console.log(`✅ Автобронирование завершено для задачи ${taskId}`);
      return result;

    } catch (error) {
      console.error(`❌ Ошибка автобронирования для задачи ${taskId}:`, error);
      
      // Обновляем статус на "ошибка"
      await this.updateTaskStatus(taskId, 'FAILED');
      
      // Создаем запись об ошибке
      await prisma.runLog.create({
        data: {
          runId: taskId, // Временно используем taskId
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
          // В реальной схеме может не быть поля status, используем enabled
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
          message: `Найдено слотов: ${result.foundSlots.length}`,
          meta: { foundSlots: result.foundSlots.length },
        },
        {
          runId,
          level: 'INFO' as const,
          message: `Забронировано слотов: ${result.bookedSlots.filter((bs: any) => bs.bookingId).length}`,
          meta: { bookedSlots: result.bookedSlots.filter((bs: any) => bs.bookingId).length },
        },
      ];

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

  private onJobCompleted(job: Job<AutoBookingJobData>) {
    console.log(`✅ Задача автобронирования ${job.id} завершена успешно`);
  }

  private onJobFailed(job: Job<AutoBookingJobData> | undefined, error: Error) {
    console.error(`❌ Задача автобронирования ${job?.id} завершилась с ошибкой:`, error);
  }

  private onWorkerError(error: Error) {
    console.error('❌ Ошибка воркера автобронирования:', error);
  }

  async close() {
    await this.worker.close();
  }
}
