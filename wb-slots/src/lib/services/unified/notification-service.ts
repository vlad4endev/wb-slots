// ===== UNIFIED NOTIFICATION SERVICE =====

import { BaseServiceWithAllFeatures } from '../core/base-service-with-all-features';
import { 
  INotificationService,
  NotificationHistory,
  RetryConfig
} from '../core/interfaces';
import { prisma } from '../../prisma';
import { botSettingsService } from '../bot-settings.service';
import path from 'path';

// ===== CONFIGURATION INTERFACE =====

export interface UnifiedNotificationConfig {
  enableTelegram: boolean;
  enableEmail: boolean;
  enableWebhook: boolean;
  defaultRetryAttempts: number;
  retryDelay: number;
  maxMessageLength: number;
  enableTemplates: boolean;
  templateDir: string;
}

// ===== UNIFICATION SERVICE =====

export class UnifiedNotificationService 
  extends BaseServiceWithAllFeatures<UnifiedNotificationConfig>
  implements INotificationService {
  
  private botToken: string | null = null;
  private notificationHistory: NotificationHistory[] = [];

  constructor() {
    const defaultConfig: UnifiedNotificationConfig = {
      enableTelegram: true,
      enableEmail: false,
      enableWebhook: false,
      defaultRetryAttempts: 3,
      retryDelay: 1000,
      maxMessageLength: 4096,
      enableTemplates: true,
      templateDir: path.join(process.cwd(), 'templates', 'notifications')
    };

    const defaultRetryConfig: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        'NETWORK_ERROR',
        'RATE_LIMIT_ERROR',
        'TIMEOUT_ERROR'
      ]
    };

    super('UnifiedNotificationService', defaultConfig, defaultRetryConfig);
    this.initializeBotTokenSync();
  }

  // ===== ABSTRACT METHODS IMPLEMENTATION =====

  async initialize(): Promise<void> {
      this.logger.info('Initializing Unified Notification Service');
      
    // Ensure bot token is available
    await this.ensureBotToken();
      
    this._addHealthCheck('initialization', 'pass', 'Service initialized successfully');
  }

  async start(): Promise<void> {
      this.logger.info('Starting Unified Notification Service');
    this._startService();
    this._addHealthCheck('service_status', 'pass', 'Service started successfully');
  }

  async stop(): Promise<void> {
      this.logger.info('Stopping Unified Notification Service');
    this._stopService();
    this._addHealthCheck('service_status', 'pass', 'Service stopped successfully');
  }

  validateConfig(config: Partial<UnifiedNotificationConfig>): boolean {
    const requiredFields: (keyof UnifiedNotificationConfig)[] = [
      'enableTelegram',
      'defaultRetryAttempts',
      'retryDelay',
      'maxMessageLength'
    ];

    return this._validateRequiredConfig(config, requiredFields);
  }

  // ===== INotificationService IMPLEMENTATION =====

  async sendNotification(userId: string, message: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Sending notification', { userId, messageLength: message.length });
      
      // Validate message length
      if (message.length > this._typedConfig.maxMessageLength) {
        this.logger.warn('Message too long, truncating', { 
          originalLength: message.length, 
          maxLength: this._typedConfig.maxMessageLength 
        });
        message = message.substring(0, this._typedConfig.maxMessageLength - 3) + '...';
      }

      const result = await this.retry(async () => {
        return await this._sendNotificationInternal(userId, message);
      }, 'send_notification');

      const duration = Date.now() - startTime;
      this._logOperation('sendNotification', result, duration, { userId, messageLength: message.length });

      // Save to history
      this._addToHistory({
        id: `notification-${Date.now()}`,
        userId,
        type: 'MANUAL',
        message,
        status: result ? 'SENT' : 'FAILED',
        sentAt: new Date()
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this._logOperation('sendNotification', false, duration, { userId, error: (error as Error).message });

      // Save to history
      this._addToHistory({
        id: `notification-${Date.now()}`,
        userId,
        type: 'MANUAL',
        message,
        status: 'FAILED',
        error: (error as Error).message,
          sentAt: new Date()
      });

      return false;
    }
  }

  async sendTemplatedNotification(
    userId: string, 
    templateType: string, 
    variables: Record<string, any> = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Sending templated notification', { userId, templateType, variables });
      
      const message = await this._renderTemplate(templateType, variables);
      
      const result = await this.sendNotification(userId, message);

      const duration = Date.now() - startTime;
      this._logOperation('sendTemplatedNotification', result, duration, { 
        userId, 
        templateType, 
        variablesCount: Object.keys(variables).length 
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this._logOperation('sendTemplatedNotification', false, duration, { 
        userId, 
        templateType, 
        error: (error as Error).message 
      });

      return false;
    }
  }

  async isNotificationConfigured(userId: string): Promise<boolean> {
    try {
      const userSettings = await prisma.userSettings.findFirst({
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
      this.logger.error('Failed to check notification settings', { userId, error });
      return false;
    }
  }

  getNotificationHistory(userId: string): NotificationHistory[] {
    return this.notificationHistory.filter(n => n.userId === userId);
  }

  // ===== PRIVATE METHODS =====

  private initializeBotTokenSync(): void {
    // Try environment variable first for immediate availability
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    if (this.botToken) {
      this.logger.info('Bot token loaded from environment');
    } else {
      this.logger.info('Bot token not found in environment, will load from database on first use');
    }
  }

  private async ensureBotToken(): Promise<string | null> {
    if (this.botToken) {
      return this.botToken;
    }

    // Load from database if not available
    const dbToken = await botSettingsService.getTelegramBotToken();
    if (dbToken) {
      this.botToken = dbToken;
      this.logger.info('Bot token loaded from database');
      return this.botToken;
    }

    this.logger.warn('No Telegram bot token available');
    return null;
  }

  private async _sendNotificationInternal(userId: string, message: string): Promise<boolean> {
    if (!this._typedConfig.enableTelegram) {
      this.logger.warn('Telegram notifications disabled');
      return false;
    }

    const token = await this.ensureBotToken();
    if (!token) {
      this.logger.warn('Telegram bot token not configured');
      return false;
    }

    // Get user notification settings
    const userSettings = await prisma.userSettings.findFirst({
      where: { 
        userId,
        category: 'NOTIFICATION'
      },
    });

    const telegramSettings = userSettings?.settings as any || {};
    const telegramEnabled = telegramSettings.telegram?.enabled || false;
    const telegramChatId = telegramSettings.telegram?.chatId || '';

    if (!telegramEnabled || !telegramChatId) {
      this.logger.warn(`No notification channels configured for user ${userId}`);
      return false;
    }

    // Send message through Telegram Bot API
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
      this.logger.error('Telegram API error', { errorData, userId });
      return false;
    }

    this.logger.info(`Telegram notification sent to user ${userId}`);
    return true;
  }

  private async _renderTemplate(templateType: string, variables: Record<string, any>): Promise<string> {
    if (!this._typedConfig.enableTemplates) {
      return this._getDefaultMessage(templateType, variables);
    }

    try {
      // Try to get template from database
      const template = await prisma.notificationTemplate.findFirst({
        where: {
          type: templateType as any,
          isActive: true
        }
      });

      if (!template) {
        this.logger.warn(`Template not found for type: ${templateType}, using default message`);
        return this._getDefaultMessage(templateType, variables);
      }

      // Replace variables in template
      let message = template.template;
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        message = message.replace(regex, String(value));
      });

      // Add date and time
      const now = new Date();
      message = message.replace(/{{date}}/g, now.toLocaleDateString('ru-RU'));
      message = message.replace(/{{time}}/g, now.toLocaleTimeString('ru-RU'));

      return message;

    } catch (error) {
      this.logger.warn(`Template rendering failed for type: ${templateType}, using default message`, { error });
      return this._getDefaultMessage(templateType, variables);
    }
  }

  private _getDefaultMessage(templateType: string, variables: Record<string, any>): string {
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

  private _addToHistory(notification: NotificationHistory): void {
    this.notificationHistory.push(notification);
    
    // Keep only last 1000 notifications
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory = this.notificationHistory.slice(-1000);
    }
  }
}