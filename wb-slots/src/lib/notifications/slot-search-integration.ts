import { getTelegramService } from './telegram-service';
import { NotificationType } from './telegram-config';

export interface SlotFoundData {
  userId: string;
  taskName: string;
  supplyName: string;
  supplyId: string;
  warehouseName: string;
  slotDate: string;
  slotTime: string;
  coefficient: number;
  warehouseId: number;
  boxTypeName: string;
}

export interface TaskStatusData {
  userId: string;
  taskName: string;
  supplyName: string;
  supplyId: string;
  warehouseNames: string;
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  foundSlots?: number;
  successfulBookings?: number;
  errors?: number;
  executionTime?: number;
  errorMessage?: string;
}

export class SlotSearchNotificationService {
  /**
   * Отправляет уведомление о найденном слоте
   */
  static async notifySlotFound(data: SlotFoundData): Promise<boolean> {
    try {
      if (!getTelegramService().isInitialized()) {
        console.warn('⚠️ Telegram service not initialized. Skipping slot found notification.');
        return false;
      }

      const user = getTelegramService().getUser(data.userId);
      if (!user || !user.isActive) {
        console.warn(`⚠️ User ${data.userId} not registered or inactive. Skipping slot found notification.`);
        return false;
      }

      const success = await getTelegramService().sendNotification(data.userId, NotificationType.SLOT_FOUND, {
        supplyName: data.supplyName,
        supplyId: data.supplyId,
        warehouseName: data.warehouseName,
        slotDate: data.slotDate,
        slotTime: data.slotTime,
        coefficient: data.coefficient.toString(),
        taskName: data.taskName,
      });

      if (success) {
        console.log(`✅ Slot found notification sent to user ${data.userId}`);
      } else {
        console.error(`❌ Failed to send slot found notification to user ${data.userId}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error sending slot found notification:', error);
      return false;
    }
  }

  /**
   * Отправляет уведомление о начале задачи
   */
  static async notifyTaskStarted(data: TaskStatusData): Promise<boolean> {
    try {
      if (!getTelegramService().isInitialized()) {
        console.warn('⚠️ Telegram service not initialized. Skipping task started notification.');
        return false;
      }

      const user = getTelegramService().getUser(data.userId);
      if (!user || !user.isActive) {
        console.warn(`⚠️ User ${data.userId} not registered or inactive. Skipping task started notification.`);
        return false;
      }

      const success = await getTelegramService().sendNotification(data.userId, NotificationType.TASK_STARTED, {
        taskName: data.taskName,
        supplyName: data.supplyName,
        supplyId: data.supplyId,
        warehouseNames: data.warehouseNames,
        coefficientMin: data.coefficientMin.toString(),
        coefficientMax: data.coefficientMax.toString(),
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
      });

      if (success) {
        console.log(`✅ Task started notification sent to user ${data.userId}`);
      } else {
        console.error(`❌ Failed to send task started notification to user ${data.userId}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error sending task started notification:', error);
      return false;
    }
  }

  /**
   * Отправляет уведомление о завершении задачи
   */
  static async notifyTaskCompleted(data: TaskStatusData): Promise<boolean> {
    try {
      if (!getTelegramService().isInitialized()) {
        console.warn('⚠️ Telegram service not initialized. Skipping task completed notification.');
        return false;
      }

      const user = getTelegramService().getUser(data.userId);
      if (!user || !user.isActive) {
        console.warn(`⚠️ User ${data.userId} not registered or inactive. Skipping task completed notification.`);
        return false;
      }

      const success = await getTelegramService().sendNotification(data.userId, NotificationType.TASK_COMPLETED, {
        taskName: data.taskName,
        supplyName: data.supplyName,
        supplyId: data.supplyId,
        warehouseNames: data.warehouseNames,
        foundSlots: data.foundSlots?.toString() || '0',
        successfulBookings: data.successfulBookings?.toString() || '0',
        errors: data.errors?.toString() || '0',
        executionTime: data.executionTime?.toString() || '0',
      });

      if (success) {
        console.log(`✅ Task completed notification sent to user ${data.userId}`);
      } else {
        console.error(`❌ Failed to send task completed notification to user ${data.userId}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error sending task completed notification:', error);
      return false;
    }
  }

  /**
   * Отправляет уведомление об ошибке задачи
   */
  static async notifyTaskFailed(data: TaskStatusData): Promise<boolean> {
    try {
      if (!getTelegramService().isInitialized()) {
        console.warn('⚠️ Telegram service not initialized. Skipping task failed notification.');
        return false;
      }

      const user = getTelegramService().getUser(data.userId);
      if (!user || !user.isActive) {
        console.warn(`⚠️ User ${data.userId} not registered or inactive. Skipping task failed notification.`);
        return false;
      }

      const success = await getTelegramService().sendNotification(data.userId, NotificationType.TASK_FAILED, {
        taskName: data.taskName,
        supplyName: data.supplyName,
        supplyId: data.supplyId,
        warehouseNames: data.warehouseNames,
        errorMessage: data.errorMessage || 'Unknown error',
        foundSlots: data.foundSlots?.toString() || '0',
        successfulBookings: data.successfulBookings?.toString() || '0',
        errors: data.errors?.toString() || '0',
        executionTime: data.executionTime?.toString() || '0',
      });

      if (success) {
        console.log(`✅ Task failed notification sent to user ${data.userId}`);
      } else {
        console.error(`❌ Failed to send task failed notification to user ${data.userId}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error sending task failed notification:', error);
      return false;
    }
  }

  /**
   * Отправляет системное уведомление об ошибке
   */
  static async notifySystemError(
    userId: string,
    component: string,
    errorMessage: string,
    errorDetails?: string
  ): Promise<boolean> {
    try {
      if (!getTelegramService().isInitialized()) {
        console.warn('⚠️ Telegram service not initialized. Skipping system error notification.');
        return false;
      }

      const user = getTelegramService().getUser(userId);
      if (!user || !user.isActive) {
        console.warn(`⚠️ User ${userId} not registered or inactive. Skipping system error notification.`);
        return false;
      }

      const success = await getTelegramService().sendNotification(userId, NotificationType.SYSTEM_ERROR, {
        component,
        errorMessage,
        timestamp: new Date().toLocaleString('ru-RU'),
        errorDetails: errorDetails || 'No additional details available',
      });

      if (success) {
        console.log(`✅ System error notification sent to user ${userId}`);
      } else {
        console.error(`❌ Failed to send system error notification to user ${userId}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Error sending system error notification:', error);
      return false;
    }
  }

  /**
   * Проверяет, активны ли уведомления для пользователя
   */
  static isUserActive(userId: string): boolean {
    const user = getTelegramService().getUser(userId);
    return user ? user.isActive : false;
  }

  /**
   * Получает статистику уведомлений
   */
  static getNotificationStats() {
    return getTelegramService().getStats();
  }
}
