import { prisma } from './prisma';
import { botSettingsService } from './services/bot-settings.service';

export interface TelegramNotification {
  userId: string;
  type: 'slot_found' | 'booking_started' | 'booking_completed' | 'booking_failed';
  data: {
    taskId: string;
    taskName: string;
    slot?: {
      warehouseId: number;
      warehouseName: string;
      date: string;
      coefficient: number;
      boxTypes: string[];
    };
    bookingId?: string;
    supplyId?: string;
    error?: string;
  };
}

export class TelegramService {
  private botToken: string | null = null;
  private baseUrl: string;

  constructor() {
    // Try to load token from environment first
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.baseUrl = process.env.TELEGRAM_WEBHOOK_URL || '';
  }

  /**
   * Ensure bot token is loaded (from DB if not available)
   */
  private async ensureBotToken(): Promise<string | null> {
    if (this.botToken) {
      return this.botToken;
    }

    try {
      const dbToken = await botSettingsService.getTelegramBotToken();
      if (dbToken) {
        this.botToken = dbToken;
        console.log('✅ TelegramService loaded bot token from database');
        return this.botToken;
      }
    } catch (error) {
      console.warn('Failed to load bot token from database:', error);
    }

    console.warn('⚠️ Telegram bot token not available');
    return null;
  }

  /**
   * Отправка уведомления в Telegram
   */
  async sendNotification(notification: TelegramNotification): Promise<boolean> {
    try {
      // Ensure bot token is available
      const token = await this.ensureBotToken();
      if (!token) {
        console.warn('⚠️ Telegram bot token not available. Cannot send notification.');
        return false;
      }

      // Получаем настройки Telegram пользователя
      const userSettings = await this.getUserTelegramSettings(notification.userId);
      if (!userSettings || !userSettings.chatId) {
        console.log(`⚠️ Telegram настройки не найдены для пользователя ${notification.userId}`);
        return false;
      }

      // Формируем сообщение
      const message = this.formatMessage(notification);
      
      // Отправляем сообщение
      const success = await this.sendMessage(userSettings.chatId, message);
      
      if (success) {
        console.log(`✅ Telegram уведомление отправлено пользователю ${notification.userId}`);
      } else {
        console.error(`❌ Ошибка отправки Telegram уведомления пользователю ${notification.userId}`);
      }

      return success;

    } catch (error) {
      console.error('Ошибка отправки Telegram уведомления:', error);
      return false;
    }
  }

  /**
   * Получение настроек Telegram пользователя
   */
  private async getUserTelegramSettings(userId: string): Promise<{ chatId: string } | null> {
    try {
      const settings = await prisma.userSettings.findFirst({
        where: {
          userId,
          category: 'NOTIFICATION',
        },
      });

      if (!settings) {
        return null;
      }

      const notificationSettings = settings.settings as any;
      const chatId = notificationSettings?.telegram?.chatId;

      if (!chatId) {
        return null;
      }

      return {
        chatId: chatId as string,
      };
    } catch (error) {
      console.error('Ошибка получения настроек Telegram:', error);
      return null;
    }
  }

  /**
   * Форматирование сообщения для Telegram
   */
  private formatMessage(notification: TelegramNotification): string {
    const { type, data } = notification;
    
    let message = `🤖 *WB Авто Лоты*\n\n`;
    
    switch (type) {
      case 'slot_found':
        message += `🎯 *Слот найден!*\n\n`;
        message += `📋 *Задача:* ${data.taskName}\n`;
        message += `🏢 *Склад:* ${data.slot?.warehouseName}\n`;
        message += `📅 *Дата:* ${data.slot?.date}\n`;
        message += `📊 *Коэффициент:* ${data.slot?.coefficient}\n`;
        message += `📦 *Типы поставки:* ${data.slot?.boxTypes?.join(', ')}\n\n`;
        message += `⏳ *Переходим к бронированию...*`;
        break;

      case 'booking_started':
        message += `🔐 *Начато бронирование*\n\n`;
        message += `📋 *Задача:* ${data.taskName}\n`;
        message += `📦 *Номер поставки:* ${data.supplyId}\n`;
        message += `🏢 *Склад:* ${data.slot?.warehouseName}\n`;
        message += `📅 *Дата:* ${data.slot?.date}\n\n`;
        message += `⏳ *Ожидайте результата...*`;
        break;

      case 'booking_completed':
        message += `✅ *Бронирование завершено!*\n\n`;
        message += `📋 *Задача:* ${data.taskName}\n`;
        message += `📦 *Номер поставки:* ${data.supplyId}\n`;
        message += `🔐 *ID бронирования:* ${data.bookingId}\n`;
        message += `🏢 *Склад:* ${data.slot?.warehouseName}\n`;
        message += `📅 *Дата:* ${data.slot?.date}\n\n`;
        message += `🎉 *Задача выполнена успешно!*`;
        break;

      case 'booking_failed':
        message += `❌ *Ошибка бронирования*\n\n`;
        message += `📋 *Задача:* ${data.taskName}\n`;
        message += `📦 *Номер поставки:* ${data.supplyId}\n`;
        message += `🏢 *Склад:* ${data.slot?.warehouseName}\n`;
        message += `📅 *Дата:* ${data.slot?.date}\n\n`;
        message += `⚠️ *Ошибка:* ${data.error}`;
        break;

      default:
        message += `📢 *Уведомление*\n\n`;
        message += `📋 *Задача:* ${data.taskName}\n`;
        break;
    }

    return message;
  }

  /**
   * Отправка сообщения в Telegram
   */
  private async sendMessage(chatId: string, message: string): Promise<boolean> {
    try {
      const token = await this.ensureBotToken();
      if (!token) {
        console.log('⚠️ Telegram Bot Token не настроен');
        return false;
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Ошибка Telegram API:', errorData);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Ошибка отправки сообщения в Telegram:', error);
      return false;
    }
  }

  /**
   * Отправка уведомления о найденном слоте
   */
  async notifySlotFound(userId: string, taskId: string, taskName: string, slot: any): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'slot_found',
      data: {
        taskId,
        taskName,
        slot: {
          warehouseId: slot.warehouseId,
          warehouseName: slot.warehouseName,
          date: slot.date,
          coefficient: slot.coefficient,
          boxTypes: slot.boxTypes,
        },
      },
    });
  }

  /**
   * Отправка уведомления о начале бронирования
   */
  async notifyBookingStarted(userId: string, taskId: string, taskName: string, supplyId: string, slot: any): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'booking_started',
      data: {
        taskId,
        taskName,
        supplyId,
        slot: {
          warehouseId: slot.warehouseId,
          warehouseName: slot.warehouseName,
          date: slot.date,
          coefficient: slot.coefficient,
          boxTypes: slot.boxTypes,
        },
      },
    });
  }

  /**
   * Отправка уведомления о завершении бронирования
   */
  async notifyBookingCompleted(userId: string, taskId: string, taskName: string, supplyId: string, bookingId: string, slot: any): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'booking_completed',
      data: {
        taskId,
        taskName,
        supplyId,
        bookingId,
        slot: {
          warehouseId: slot.warehouseId,
          warehouseName: slot.warehouseName,
          date: slot.date,
          coefficient: slot.coefficient,
          boxTypes: slot.boxTypes,
        },
      },
    });
  }

  /**
   * Отправка уведомления об ошибке бронирования
   */
  async notifyBookingFailed(userId: string, taskId: string, taskName: string, supplyId: string, slot: any, error: string): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'booking_failed',
      data: {
        taskId,
        taskName,
        supplyId,
        slot: {
          warehouseId: slot.warehouseId,
          warehouseName: slot.warehouseName,
          date: slot.date,
          coefficient: slot.coefficient,
          boxTypes: slot.boxTypes,
        },
        error,
      },
    });
  }

  /**
   * Отправка уведомления о найденных слотах
   */
  async notifySlotsFound(userId: string, taskId: string, taskName: string, slots: any[]): Promise<boolean> {
    try {
      const userSettings = await this.getUserTelegramSettings(userId);
      if (!userSettings || !userSettings.chatId) {
        console.log(`⚠️ Telegram настройки не найдены для пользователя ${userId}`);
        return false;
      }

      let message = `🎯 Найдены доступные слоты!\n\n`;
      message += `📋 Задача: ${taskName}\n`;
      message += `📊 Найдено слотов: ${slots.length}\n\n`;

      slots.forEach((slot, index) => {
        message += `📍 Слот ${index + 1}:\n`;
        message += `   🏪 Склад: ${slot.warehouseName || `Склад ${slot.warehouseId}`}\n`;
        message += `   📅 Дата: ${slot.date}\n`;
        message += `   💰 Коэффициент: ${slot.coefficient}\n`;
        message += `   📦 Типы коробок: ${slot.boxTypes.join(', ')}\n\n`;
      });

      message += `🔗 Перейдите в панель управления для просмотра деталей.`;

      return await this.sendMessage(userSettings.chatId, message);
    } catch (error) {
      console.error('Error sending slots found notification:', error);
      return false;
    }
  }

  /**
   * Отправка уведомления об успешном бронировании
   */
  async notifyBookingSuccess(userId: string, taskId: string, taskName: string, slot: any, bookingId: string): Promise<boolean> {
    try {
      const userSettings = await this.getUserTelegramSettings(userId);
      if (!userSettings || !userSettings.chatId) {
        console.log(`⚠️ Telegram настройки не найдены для пользователя ${userId}`);
        return false;
      }

      let message = `✅ Слот успешно забронирован!\n\n`;
      message += `📋 Задача: ${taskName}\n`;
      message += `🆔 ID бронирования: ${bookingId}\n\n`;
      message += `📍 Детали слота:\n`;
      message += `   🏪 Склад: ${slot.warehouseName || `Склад ${slot.warehouseId}`}\n`;
      message += `   📅 Дата: ${slot.date}\n`;
      message += `   💰 Коэффициент: ${slot.coefficient}\n`;
      message += `   📦 Типы коробок: ${slot.boxTypes.join(', ')}\n\n`;
      message += `🎉 Поздравляем! Ваш слот забронирован.`;

      return await this.sendMessage(userSettings.chatId, message);
    } catch (error) {
      console.error('Error sending booking success notification:', error);
      return false;
    }
  }

  /**
   * Отправка уведомления об ошибке бронирования
   */
  async notifyBookingError(userId: string, taskId: string, taskName: string, slot: any, error: string): Promise<boolean> {
    try {
      const userSettings = await this.getUserTelegramSettings(userId);
      if (!userSettings || !userSettings.chatId) {
        console.log(`⚠️ Telegram настройки не найдены для пользователя ${userId}`);
        return false;
      }

      let message = `❌ Ошибка при бронировании слота\n\n`;
      message += `📋 Задача: ${taskName}\n`;
      message += `❌ Ошибка: ${error}\n\n`;
      message += `📍 Детали слота:\n`;
      message += `   🏪 Склад: ${slot.warehouseName || `Склад ${slot.warehouseId}`}\n`;
      message += `   📅 Дата: ${slot.date}\n`;
      message += `   💰 Коэффициент: ${slot.coefficient}\n`;
      message += `   📦 Типы коробок: ${slot.boxTypes.join(', ')}\n\n`;
      message += `🔄 Поиск продолжается...`;

      return await this.sendMessage(userSettings.chatId, message);
    } catch (error) {
      console.error('Error sending booking error notification:', error);
      return false;
    }
  }
}
