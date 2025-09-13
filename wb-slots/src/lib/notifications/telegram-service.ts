import TelegramBot from 'node-telegram-bot-api';
import { TelegramConfig, TelegramUser, NotificationTemplate, NotificationType, DEFAULT_TELEGRAM_CONFIG, NOTIFICATION_TEMPLATES } from './telegram-config';
import { botSettingsService } from '../services/bot-settings.service';

export interface NotificationData {
  [key: string]: any;
}

export interface SendNotificationOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyToMessageId?: number;
  replyMarkup?: any;
}

export class TelegramService {
  private bot: TelegramBot | null = null;
  private config: TelegramConfig;
  private users: Map<string, TelegramUser> = new Map();
  private isInitializing: boolean = false;

  constructor(config: Partial<TelegramConfig> = {}) {
    this.config = { ...DEFAULT_TELEGRAM_CONFIG, ...config };
    // Bot will be initialized lazily when first needed
  }

  private async initializeBot(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      return;
    }
    
    if (this.bot) {
      return; // Already initialized
    }
    
    this.isInitializing = true;
    
    try {
      // Always try to get fresh token from database
      let botToken = this.config.botToken;
      
      try {
        const dbToken = await botSettingsService.getTelegramBotToken();
        if (dbToken) {
          botToken = dbToken;
          this.config.botToken = dbToken;
          console.log('✅ Telegram bot token loaded from database');
        }
      } catch (error) {
        console.warn('Failed to load bot token from database:', error);
      }

      if (!botToken) {
        console.warn('⚠️ Telegram bot token not provided. Notifications will be disabled.');
        return;
      }

      try {
        this.bot = new TelegramBot(botToken, { polling: false });
        console.log('✅ Telegram bot initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Telegram bot:', error);
        this.bot = null;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Регистрирует пользователя для получения уведомлений
   */
  async registerUser(
    userId: string,
    chatId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<boolean> {
    try {
      // Ensure bot is initialized
      if (!this.bot) {
        console.log('🔄 Telegram bot not initialized, loading token from database...');
        await this.initializeBot();
        
        if (!this.bot) {
          console.warn('⚠️ Failed to initialize Telegram bot. Cannot register user.');
          return false;
        }
      }

      // Проверяем, что чат существует
      const chat = await this.bot.getChat(chatId);
      if (!chat) {
        console.error(`❌ Chat ${chatId} not found`);
        return false;
      }

      const user: TelegramUser = {
        userId,
        chatId,
        username,
        firstName,
        lastName,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.users.set(userId, user);
      console.log(`✅ User ${userId} registered for Telegram notifications (chat: ${chatId})`);
      
      // Отправляем приветственное сообщение
      await this.sendMessage(chatId, `🎉 <b>Добро пожаловать!</b>\n\nВы успешно подписались на уведомления о бронировании слотов Wildberries.\n\n📋 <b>Что вы будете получать:</b>\n• Уведомления о найденных слотах\n• Статус бронирования\n• Результаты выполнения задач\n• Ошибки и предупреждения\n\n🚀 <i>Готово к работе!</i>`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to register user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Отписывает пользователя от уведомлений
   */
  async unregisterUser(userId: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        console.warn(`⚠️ User ${userId} not found`);
        return false;
      }

      user.isActive = false;
      user.updatedAt = new Date();
      
      console.log(`✅ User ${userId} unregistered from Telegram notifications`);
      
      // Отправляем сообщение об отписке
      await this.sendMessage(user.chatId, `👋 <b>До свидания!</b>\n\nВы отписались от уведомлений о бронировании слотов.\n\nЕсли захотите вернуться, просто зарегистрируйтесь заново в настройках.`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to unregister user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Отправляет уведомление пользователю
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    data: NotificationData,
    options: SendNotificationOptions = {}
  ): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user || !user.isActive) {
        console.warn(`⚠️ User ${userId} not registered or inactive`);
        return false;
      }

      const template = NOTIFICATION_TEMPLATES[type];
      if (!template || !template.isActive) {
        console.warn(`⚠️ Template for ${type} not found or inactive`);
        return false;
      }

      const message = this.formatMessage(template, data);
      if (!message) {
        console.error(`❌ Failed to format message for ${type}`);
        return false;
      }

      return await this.sendMessage(user.chatId, message, options);
    } catch (error) {
      console.error(`❌ Failed to send notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Отправляет уведомление всем активным пользователям
   */
  async broadcastNotification(
    type: NotificationType,
    data: NotificationData,
    options: SendNotificationOptions = {}
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const [userId, user] of this.users) {
      if (user.isActive) {
        const success = await this.sendNotification(userId, type, data, options);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    console.log(`📢 Broadcast notification sent: ${sent} successful, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Отправляет сообщение в чат
   */
  async sendMessage(
    chatId: number,
    message: string,
    options: SendNotificationOptions = {}
  ): Promise<boolean> {
    // Always try to ensure bot is initialized with fresh token
    if (!this.bot) {
      console.log('🔄 Telegram bot not initialized, loading token from database...');
      await this.initializeBot();
      
      if (!this.bot) {
        console.warn('⚠️ Failed to initialize Telegram bot. Cannot send message.');
        return false;
      }
    }

    try {
      const sendOptions = {
        parse_mode: options.parseMode || this.config.parseMode,
        disable_web_page_preview: options.disableWebPagePreview ?? this.config.disableWebPagePreview,
        disable_notification: options.disableNotification ?? this.config.disableNotification,
        reply_to_message_id: options.replyToMessageId,
        reply_markup: options.replyMarkup,
      };

      await this.bot.sendMessage(chatId, message, sendOptions);
      console.log(`✅ Message sent to chat ${chatId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message to chat ${chatId}:`, error);
      return false;
    }
  }

  /**
   * Форматирует сообщение по шаблону
   */
  private formatMessage(template: NotificationTemplate, data: NotificationData): string | null {
    try {
      let message = template.template;

      // Заменяем переменные в шаблоне
      for (const variable of template.variables) {
        const value = data[variable];
        if (value !== undefined && value !== null) {
          message = message.replace(new RegExp(`{${variable}}`, 'g'), String(value));
        } else {
          console.warn(`⚠️ Variable ${variable} not provided for template ${template.id}`);
          message = message.replace(new RegExp(`{${variable}}`, 'g'), 'N/A');
        }
      }

      return message;
    } catch (error) {
      console.error(`❌ Failed to format message for template ${template.id}:`, error);
      return null;
    }
  }

  /**
   * Получает информацию о пользователе
   */
  getUser(userId: string): TelegramUser | null {
    return this.users.get(userId) || null;
  }

  /**
   * Получает всех активных пользователей
   */
  getActiveUsers(): TelegramUser[] {
    return Array.from(this.users.values()).filter(user => user.isActive);
  }

  /**
   * Получает статистику
   */
  getStats(): {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    botInitialized: boolean;
  } {
    const users = Array.from(this.users.values());
    return {
      totalUsers: users.length,
      activeUsers: users.filter(user => user.isActive).length,
      inactiveUsers: users.filter(user => !user.isActive).length,
      botInitialized: this.bot !== null,
    };
  }

  /**
   * Проверяет, инициализирован ли бот
   */
  isInitialized(): boolean {
    return this.bot !== null;
  }

  /**
   * Обновляет конфигурацию
   */
  updateConfig(newConfig: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeBot();
  }

  /**
   * Очищает ресурсы
   */
  async cleanup(): Promise<void> {
    try {
      if (this.bot) {
        await this.bot.stopPolling();
        this.bot = null;
      }
      console.log('✅ Telegram service cleaned up');
    } catch (error) {
      console.error('❌ Error during Telegram service cleanup:', error);
    }
  }
}

// Singleton instance - will be created lazily
let telegramServiceInstance: TelegramService | null = null;

export function getTelegramService(): TelegramService {
  if (!telegramServiceInstance) {
    telegramServiceInstance = new TelegramService();
  }
  return telegramServiceInstance;
}

// For backward compatibility
export const telegramService = {
  get instance() {
    return getTelegramService();
  }
};
