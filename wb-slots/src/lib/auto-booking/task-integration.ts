import { autoBookingService } from './auto-booking-service';
import { BookingParams } from './config';

export interface TaskIntegrationConfig {
  autoStart: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelay: number;
  notificationOnSuccess: boolean;
  notificationOnFailure: boolean;
}

export class TaskIntegrationService {
  private static instance: TaskIntegrationService;
  private config: TaskIntegrationConfig;

  constructor(config: Partial<TaskIntegrationConfig> = {}) {
    this.config = {
      autoStart: true,
      retryOnFailure: true,
      maxRetries: 3,
      retryDelay: 5000,
      notificationOnSuccess: true,
      notificationOnFailure: true,
      ...config,
    };
  }

  static getInstance(config?: Partial<TaskIntegrationConfig>): TaskIntegrationService {
    if (!TaskIntegrationService.instance) {
      TaskIntegrationService.instance = new TaskIntegrationService(config);
    }
    return TaskIntegrationService.instance;
  }

  /**
   * Интегрирует auto-booking с существующей задачей
   */
  async integrateWithTask(
    taskId: string,
    userId: string,
    supplyId: string,
    slotFilters: BookingParams['slotFilters'],
    credentials?: BookingParams['credentials'],
    config: Partial<TaskIntegrationConfig> = {}
  ): Promise<string> {
    const integrationConfig = { ...this.config, ...config };
    
    console.log(`🔗 Integrating auto-booking with task ${taskId}`, {
      userId,
      supplyId,
      slotFilters,
      hasCredentials: !!credentials,
      config: integrationConfig,
    });

    // Создаем задачу auto-booking
    const bookingTaskId = await autoBookingService.createBookingTask(
      userId,
      taskId,
      supplyId,
      slotFilters,
      credentials,
      {
        dryRun: false, // Реальное бронирование
        screenshots: {
          enabled: true,
          path: `./screenshots/task_${taskId}`,
          onError: true,
          onSuccess: true,
          onStep: false,
        },
        logging: {
          level: 'info',
          console: true,
          file: true,
          filePath: `./logs/task_${taskId}_auto_booking.log`,
        },
      }
    );

    // Автоматически запускаем выполнение, если включено
    if (integrationConfig.autoStart) {
      this.executeBookingWithRetry(bookingTaskId, integrationConfig).catch(error => {
        console.error(`❌ Auto-booking execution failed for task ${taskId}:`, error);
      });
    }

    return bookingTaskId;
  }

  /**
   * Выполняет бронирование с retry логикой
   */
  private async executeBookingWithRetry(
    bookingTaskId: string,
    config: TaskIntegrationConfig,
    attempt: number = 1
  ): Promise<void> {
    try {
      console.log(`🚀 Executing auto-booking attempt ${attempt}/${config.maxRetries + 1} for task ${bookingTaskId}`);
      
      const result = await autoBookingService.executeBookingTask(bookingTaskId);
      
      if (result.success) {
        console.log(`✅ Auto-booking successful for task ${bookingTaskId}`, {
          bookingId: result.bookingId,
          executionTime: result.executionTime,
        });
        
        if (config.notificationOnSuccess) {
          await this.sendSuccessNotification(bookingTaskId, result);
        }
      } else {
        console.error(`❌ Auto-booking failed for task ${bookingTaskId}:`, result.error);
        
        if (config.retryOnFailure && attempt <= config.maxRetries) {
          console.log(`🔄 Retrying auto-booking in ${config.retryDelay}ms...`);
          setTimeout(() => {
            this.executeBookingWithRetry(bookingTaskId, config, attempt + 1);
          }, config.retryDelay);
        } else {
          console.error(`💥 Auto-booking failed after ${attempt} attempts`);
          
          if (config.notificationOnFailure) {
            await this.sendFailureNotification(bookingTaskId, result);
          }
        }
      }
    } catch (error) {
      console.error(`💥 Auto-booking execution error for task ${bookingTaskId}:`, error);
      
      if (config.retryOnFailure && attempt <= config.maxRetries) {
        console.log(`🔄 Retrying auto-booking in ${config.retryDelay}ms...`);
        setTimeout(() => {
          this.executeBookingWithRetry(bookingTaskId, config, attempt + 1);
        }, config.retryDelay);
      } else {
        if (config.notificationOnFailure) {
          await this.sendFailureNotification(bookingTaskId, { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            logs: [],
            screenshots: [],
            executionTime: 0,
          });
        }
      }
    }
  }

  /**
   * Отправляет уведомление об успешном бронировании
   */
  private async sendSuccessNotification(bookingTaskId: string, result: any): Promise<void> {
    try {
      const task = await autoBookingService.getBookingTask(bookingTaskId);
      if (!task) return;

      console.log(`📧 Sending success notification for task ${task.taskId}`, {
        bookingId: result.bookingId,
        executionTime: result.executionTime,
      });

      // Здесь можно добавить отправку уведомлений через:
      // - Email
      // - Telegram
      // - Webhook
      // - Push notification
      
      // Пример отправки в лог
      console.log(`🎉 SUCCESS NOTIFICATION: Task ${task.taskId} - Slot booked successfully! Booking ID: ${result.bookingId}`);
      
    } catch (error) {
      console.error('❌ Failed to send success notification:', error);
    }
  }

  /**
   * Отправляет уведомление о неудачном бронировании
   */
  private async sendFailureNotification(bookingTaskId: string, result: any): Promise<void> {
    try {
      const task = await autoBookingService.getBookingTask(bookingTaskId);
      if (!task) return;

      console.log(`📧 Sending failure notification for task ${task.taskId}`, {
        error: result.error,
        executionTime: result.executionTime,
      });

      // Здесь можно добавить отправку уведомлений об ошибках
      
      // Пример отправки в лог
      console.log(`💥 FAILURE NOTIFICATION: Task ${task.taskId} - Auto-booking failed: ${result.error}`);
      
    } catch (error) {
      console.error('❌ Failed to send failure notification:', error);
    }
  }

  /**
   * Получает статистику интеграции
   */
  async getIntegrationStats(): Promise<{
    totalTasks: number;
    pendingTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
    successRate: number;
  }> {
    const stats = autoBookingService.getStats();
    const successRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return {
      totalTasks: stats.total,
      pendingTasks: stats.pending,
      runningTasks: stats.running,
      completedTasks: stats.completed,
      failedTasks: stats.failed,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Очищает ресурсы интеграции
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up task integration service...');
    await autoBookingService.cleanup();
    console.log('✅ Task integration service cleaned up');
  }
}

// Singleton instance
export const taskIntegrationService = TaskIntegrationService.getInstance();
