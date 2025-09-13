import { prisma } from '../prisma';
import { botSettingsService } from './bot-settings.service';

export class TelegramService {
  private botToken: string | null = null;
  private prisma: any = null;

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
    // Initialize token synchronously for immediate use
    this.initializeBotTokenSync();
  }

  private initializeBotTokenSync() {
    // Try environment variable first for immediate availability
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    if (this.botToken) {
      console.log('TelegramService initialized with bot token from environment');
    } else {
      console.log('TelegramService initialized without token, will load from database on first use');
    }
  }

  private async ensureBotToken() {
    if (this.botToken) {
      return this.botToken;
    }

    // Load from database if not available
    const dbToken = await botSettingsService.getTelegramBotToken();
    if (dbToken) {
      this.botToken = dbToken;
      console.log('TelegramService loaded bot token from database');
      return this.botToken;
    }

    console.warn('No Telegram bot token available');
    return null;
  }

  /**
   * Отправить уведомление пользователю
   */
  async sendNotification(userId: string, message: string): Promise<boolean> {
    try {
      const token = await this.ensureBotToken();
      if (!token) {
        console.warn('Telegram bot token not configured');
        return false;
      }

      // Используем переданный prisma или импортируем по умолчанию
      const prismaClient = this.prisma || prisma;
      
      // Получаем настройки уведомлений пользователя из раздела NOTIFICATION
      const userSettings = await prismaClient.userSettings.findFirst({
        where: { 
          userId,
          category: 'NOTIFICATION'
        },
      });

      const telegramSettings = userSettings?.settings as any || {};
      const telegramEnabled = telegramSettings.telegram?.enabled || false;
      const telegramChatId = telegramSettings.telegram?.chatId || '';

      if (!telegramEnabled || !telegramChatId) {
        console.warn(`No notification channels configured for user ${userId}`);
        return false;
      }

      // Отправляем сообщение через Telegram Bot API
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram API error:', errorData);
        return false;
      }

      console.log(`Telegram notification sent to user ${userId}`);
      return true;

    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
      return false;
    }
  }

  /**
   * Отправить уведомление о найденном слоте
   */
  async sendSlotFoundNotification(userId: string, slotData: any): Promise<boolean> {
    const message = `🎯 Найден подходящий слот!\n\n` +
      `🏪 Склад: ${slotData.warehouseName} (${slotData.warehouseID})\n` +
      `📦 Тип: ${slotData.boxTypeName}\n` +
      `📅 Дата: ${slotData.date}\n` +
      `💰 Коэффициент: ${slotData.coefficient}\n` +
      `✅ Разгрузка: ${slotData.allowUnload ? 'Да' : 'Нет'}\n\n` +
      `🔄 Начинаю процесс бронирования...`;

    return this.sendNotification(userId, message);
  }

  /**
   * Отправить уведомление об успешном бронировании
   */
  async sendBookingSuccessNotification(userId: string, bookingData: any): Promise<boolean> {
    const message = `✅ Слот успешно забронирован!\n\n` +
      `📦 ID поставки: ${bookingData.supplyId}\n` +
      `🏪 Склад: ${bookingData.warehouseId}\n` +
      `📦 Тип: ${bookingData.boxTypeId}\n` +
      `📅 Дата: ${bookingData.date}\n` +
      `💰 Коэффициент: ${bookingData.coefficient}\n` +
      `🆔 ID бронирования: ${bookingData.bookingId}`;

    return this.sendNotification(userId, message);
  }

  /**
   * Отправить уведомление об ошибке бронирования
   */
  async sendBookingErrorNotification(userId: string, error: string): Promise<boolean> {
    const message = `❌ Ошибка при бронировании слота!\n\n` +
      `❌ Ошибка: ${error}\n\n` +
      `🔄 Попробую найти другой слот...`;

    return this.sendNotification(userId, message);
  }

  /**
   * Отправить уведомление с использованием шаблона
   */
  async sendTemplatedNotification(
    userId: string, 
    templateType: string, 
    variables: Record<string, any> = {}
  ): Promise<boolean> {
    const token = await this.ensureBotToken();
    if (!token) {
      console.warn('⚠️ Telegram Bot Token не настроен');
      return false;
    }

    const prismaClient = this.prisma || prisma;
    
    // Получаем настройки пользователя
    const userSettings = await prismaClient.userSettings.findFirst({
      where: { 
        userId,
        category: 'NOTIFICATION'
      },
    });

    const telegramSettings = userSettings?.settings as any || {};
    const telegramEnabled = telegramSettings.telegram?.enabled || false;
    const telegramChatId = telegramSettings.telegram?.chatId || '';

    if (!telegramEnabled || !telegramChatId) {
      console.warn(`No notification channels configured for user ${userId}`);
      return false;
    }

    // Получаем шаблон (с обработкой ошибок для отсутствующей таблицы)
    let template = null;
    try {
      template = await prismaClient.notificationTemplate.findFirst({
        where: {
          type: templateType,
          isActive: true
        }
      });
    } catch (error) {
      console.warn(`NotificationTemplate table not found, falling back to default message for type: ${templateType}`);
      // Fallback to default message
      const defaultMessage = this.getDefaultMessage(templateType, variables);
      return this.sendNotification(userId, defaultMessage);
    }

    if (!template) {
      console.warn(`Template not found for type: ${templateType}, using default message`);
      const defaultMessage = this.getDefaultMessage(templateType, variables);
      return this.sendNotification(userId, defaultMessage);
    }

    // Заменяем переменные в шаблоне
    let message = template.template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, String(value));
    });

    // Добавляем дату и время
    const now = new Date();
    message = message.replace(/{{date}}/g, now.toLocaleDateString('ru-RU'));
    message = message.replace(/{{time}}/g, now.toLocaleTimeString('ru-RU'));

    try {
      // Отправляем сообщение через Telegram Bot API
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Ошибка отправки Telegram уведомления пользователю', userId, errorData);
        return false;
      }

      console.log('✅ Telegram уведомление отправлено пользователю', userId, 'с шаблоном', templateType);
      return true;
    } catch (error) {
      console.error('❌ Ошибка отправки Telegram уведомления пользователю', userId, error);
      return false;
    }
  }

  /**
   * Получить сообщение по умолчанию для типа уведомления
   */
  private getDefaultMessage(templateType: string, variables: Record<string, any>): string {
    const now = new Date();
    const date = now.toLocaleDateString('ru-RU');
    const time = now.toLocaleTimeString('ru-RU');

    switch (templateType) {
      case 'SLOT_FOUND':
        return `🎯 <b>Слот найден!</b>\n\n` +
               `🏪 Склад: ${variables.warehouseName || 'Неизвестно'}\n` +
               `📦 Тип: ${variables.boxTypeName || 'Неизвестно'}\n` +
               `📅 Дата: ${variables.date || date}\n` +
               `💰 Коэффициент: ${variables.coefficient || 'Неизвестно'}\n` +
               `✅ Разгрузка: ${variables.allowUnload ? 'Да' : 'Нет'}\n\n` +
               `🔄 Начинаю процесс бронирования...`;

      case 'BOOKING_SUCCESS':
        return `✅ <b>Слот успешно забронирован!</b>\n\n` +
               `📦 ID поставки: ${variables.supplyId || 'Неизвестно'}\n` +
               `🏪 Склад: ${variables.warehouseName || 'Неизвестно'}\n` +
               `📦 Тип: ${variables.boxTypeName || 'Неизвестно'}\n` +
               `📅 Дата: ${variables.date || date}\n` +
               `💰 Коэффициент: ${variables.coefficient || 'Неизвестно'}`;

      case 'BOOKING_FAILED':
        return `❌ <b>Ошибка при бронировании слота!</b>\n\n` +
               `❌ Ошибка: ${variables.error || 'Неизвестная ошибка'}\n\n` +
               `🔄 Попробую найти другой слот...`;

      case 'TASK_STARTED':
        return `🚀 <b>Задача запущена</b>\n\n` +
               `📝 Название: ${variables.taskName || 'Неизвестно'}\n` +
               `⏰ Время: ${time}\n` +
               `📅 Дата: ${date}`;

      case 'TASK_COMPLETED':
        return `✅ <b>Задача завершена</b>\n\n` +
               `📝 Название: ${variables.taskName || 'Неизвестно'}\n` +
               `🎯 Найдено слотов: ${variables.foundSlots || 0}\n` +
               `📦 Забронировано: ${variables.bookedSlots || 0}\n` +
               `⏰ Время: ${time}`;

      case 'TASK_FAILED':
        return `❌ <b>Задача провалена</b>\n\n` +
               `📝 Название: ${variables.taskName || 'Неизвестно'}\n` +
               `❌ Ошибка: ${variables.error || 'Неизвестная ошибка'}\n` +
               `⏰ Время: ${time}`;

      case 'TASK_STOPPED':
        return `⏹️ <b>Задача остановлена</b>\n\n` +
               `📝 Название: ${variables.taskName || 'Неизвестно'}\n` +
               `📝 Причина: ${variables.reason || 'Не указана'}\n` +
               `⏰ Время: ${time}`;

      default:
        return `📢 <b>Уведомление</b>\n\n` +
               `Тип: ${templateType}\n` +
               `⏰ Время: ${time}\n` +
               `📅 Дата: ${date}`;
    }
  }

  /**
   * Проверить, настроены ли уведомления для пользователя
   */
  async isNotificationConfigured(userId: string): Promise<boolean> {
    try {
      // Используем переданный prisma или импортируем по умолчанию
      const prismaClient = this.prisma || prisma;
      
      const userSettings = await prismaClient.userSettings.findFirst({
        where: { 
          userId,
          category: 'NOTIFICATION'
        },
      });

      const telegramSettings = userSettings?.settings as any || {};
      const telegramEnabled = telegramSettings.telegram?.enabled || false;
      const telegramChatId = telegramSettings.telegram?.chatId || '';

      return !!(telegramEnabled && telegramChatId);
    } catch (error) {
      console.error('Failed to check notification settings:', error);
      return false;
    }
  }

  /**
   * Обновить токен бота
   */
  async updateBotToken(token: string): Promise<boolean> {
    try {
      const saved = await botSettingsService.setTelegramBotToken(token);
      if (saved) {
        this.botToken = token;
        console.log('Bot token updated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update bot token:', error);
      return false;
    }
  }

  /**
   * Проверить, настроен ли бот
   */
  async isBotConfigured(): Promise<boolean> {
    if (this.botToken) {
      return true;
    }
    
    // Try to get token from database
    const dbToken = await botSettingsService.getTelegramBotToken();
    if (dbToken) {
      this.botToken = dbToken;
      return true;
    }
    
    return false;
  }
}

// Singleton instance - будет создан лениво
let telegramServiceInstance: TelegramService | null = null;

export function getTelegramService(): TelegramService {
  if (!telegramServiceInstance) {
    telegramServiceInstance = new TelegramService();
  }
  return telegramServiceInstance;
}

// Для обратной совместимости
export const telegramService = {
  get instance() {
    return getTelegramService();
  }
};
