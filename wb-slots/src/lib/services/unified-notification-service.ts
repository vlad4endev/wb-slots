/**
 * 🏗️ Унифицированный сервис уведомлений
 * Заменяет все дублирующиеся версии сервисов уведомлений
 */

import { 
  BaseService, 
  INotificationService, 
  NotificationConfig, 
  NotificationMessage, 
  NotificationResult,
  ServiceError,
  ValidationError 
} from '../architecture';
import { prisma } from '../prisma';
import TelegramBot from 'node-telegram-bot-api';
import nodemailer from 'nodemailer';

export class UnifiedNotificationService extends BaseService implements INotificationService {
  private notificationHistory: NotificationResult[] = [];
  private telegramBots: Map<string, TelegramBot> = new Map();
  private emailTransports: Map<string, nodemailer.Transporter> = new Map();

  constructor() {
    super('UnifiedNotificationService', '1.0.0');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ
  // ============================================================================

  protected async doInitialize(): Promise<void> {
    this.log('info', 'Initializing notification service...');
    this.log('info', 'Notification service initialized');
  }

  protected async doStart(): Promise<void> {
    this.log('info', 'Starting notification service...');
    this.log('info', 'Notification service started');
  }

  protected async doStop(): Promise<void> {
    this.log('info', 'Stopping notification service...');
    
    // Закрываем все Telegram боты
    for (const [userId, bot] of this.telegramBots) {
      try {
        await bot.stopPolling();
        this.log('info', `Stopped Telegram bot for user ${userId}`);
      } catch (error) {
        this.log('error', `Failed to stop Telegram bot for user ${userId}`, error);
      }
    }
    this.telegramBots.clear();
    
    // Закрываем все email транспорты
    for (const [userId, transport] of this.emailTransports) {
      try {
        transport.close();
        this.log('info', `Closed email transport for user ${userId}`);
      } catch (error) {
        this.log('error', `Failed to close email transport for user ${userId}`, error);
      }
    }
    this.emailTransports.clear();
    
    this.log('info', 'Notification service stopped');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА INotificationService
  // ============================================================================

  async sendNotification(userId: string, message: NotificationMessage): Promise<NotificationResult> {
    return this.executeWithMetrics('sendNotification', async () => {
      this.validateNotificationMessage(message);
      
      const startTime = Date.now();
      const results: NotificationResult[] = [];
      
      try {
        // Получаем конфигурацию уведомлений пользователя
        const config = await this.getNotificationConfig(userId);
        
        if (!config.enabled) {
          return {
            success: false,
            error: 'Notifications disabled for user',
            sentAt: new Date(),
            channel: 'none'
          };
        }
        
        // Отправляем уведомления по всем активным каналам
        const sendPromises: Promise<NotificationResult>[] = [];
        
        if (config.type === 'telegram' && config.settings.telegram) {
          sendPromises.push(this.sendTelegramNotification(userId, message, config.settings.telegram));
        }
        
        if (config.type === 'email' && config.settings.email) {
          sendPromises.push(this.sendEmailNotification(userId, message, config.settings.email));
        }
        
        if (config.type === 'webhook' && config.settings.webhook) {
          sendPromises.push(this.sendWebhookNotification(userId, message, config.settings.webhook));
        }
        
        // Ждем результаты всех отправок
        const notificationResults = await Promise.allSettled(sendPromises);
        
        // Обрабатываем результаты
        for (const result of notificationResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: result.reason?.message || 'Unknown error',
              sentAt: new Date(),
              channel: 'unknown'
            });
          }
        }
        
        // Определяем общий результат
        const success = results && Array.isArray(results) ? results.some(r => r.success) : false;
        const primaryResult = results && Array.isArray(results) ? (results.find(r => r.success) || results[0]) : null;
        
        const finalResult: NotificationResult = {
          success,
          messageId: primaryResult?.messageId,
          error: success ? undefined : results.map(r => r.error).filter(Boolean).join('; '),
          sentAt: new Date(),
          channel: primaryResult?.channel || 'unknown'
        };
        
        // Сохраняем в историю
        this.notificationHistory.unshift(finalResult);
        if (this.notificationHistory.length > 1000) {
          this.notificationHistory = this.notificationHistory.slice(0, 1000);
        }
        
        // Сохраняем в базу данных
        await this.saveNotificationResult(userId, message, finalResult);
        
        this.log('info', `Notification sent: ${success ? 'success' : 'failed'} via ${finalResult.channel}`);
        return finalResult;
        
      } catch (error) {
        const result: NotificationResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          sentAt: new Date(),
          channel: 'error'
        };
        
        this.notificationHistory.unshift(result);
        throw new ServiceError(this.name, 'sendNotification', 'Notification failed', undefined, error);
      }
    });
  }

  async sendBulkNotifications(messages: Array<{ userId: string; message: NotificationMessage }>): Promise<NotificationResult[]> {
    return this.executeWithMetrics('sendBulkNotifications', async () => {
      this.log('info', `Sending bulk notifications to ${messages.length} users`);
      
      const results: NotificationResult[] = [];
      
      // Группируем сообщения по пользователям для оптимизации
      const userMessages = new Map<string, NotificationMessage[]>();
      for (const { userId, message } of messages) {
        if (!userMessages.has(userId)) {
          userMessages.set(userId, []);
        }
        userMessages.get(userId)!.push(message);
      }
      
      // Отправляем уведомления каждому пользователю
      for (const [userId, userMessagesList] of userMessages) {
        try {
          // Для каждого пользователя отправляем все его сообщения
          for (const message of userMessagesList) {
            const result = await this.sendNotification(userId, message);
            results.push(result);
          }
        } catch (error) {
          this.log('error', `Failed to send notifications to user ${userId}`, error);
          // Добавляем ошибку для каждого сообщения пользователя
          for (const message of userMessagesList) {
            results.push({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              sentAt: new Date(),
              channel: 'error'
            });
          }
        }
      }
      
      this.log('info', `Bulk notifications completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      return results;
    });
  }

  async updateNotificationConfig(userId: string, config: NotificationConfig): Promise<void> {
    return this.executeWithMetrics('updateNotificationConfig', async () => {
      this.validateNotificationConfig(config);
      
      try {
        // Сохраняем конфигурацию в базу данных
        await prisma.notificationChannel.upsert({
          where: {
            userId_type: {
              userId,
              type: config.type
            }
          },
          update: {
            enabled: config.enabled,
            settings: config.settings
          },
          create: {
            userId,
            type: config.type,
            enabled: config.enabled,
            settings: config.settings
          }
        });
        
        // Обновляем кэш
        if (config.type === 'telegram' && config.settings.telegram) {
          await this.initializeTelegramBot(userId, config.settings.telegram);
        }
        
        if (config.type === 'email' && config.settings.email) {
          await this.initializeEmailTransport(userId, config.settings.email);
        }
        
        this.log('info', `Updated notification config for user ${userId}`);
      } catch (error) {
        throw new ServiceError(this.name, 'updateNotificationConfig', 'Failed to update config', undefined, error);
      }
    });
  }

  async getNotificationConfig(userId: string): Promise<NotificationConfig> {
    try {
      const config = await prisma.notificationChannel.findFirst({
        where: {
          userId,
          enabled: true
        }
      });
      
      if (!config) {
        // Возвращаем конфигурацию по умолчанию
        return {
          userId,
          type: 'telegram',
          enabled: false,
          settings: {}
        };
      }
      
      return {
        userId,
        type: config.type as 'telegram' | 'email' | 'webhook',
        enabled: config.enabled,
        settings: config.settings as any
      };
    } catch (error) {
      throw new ServiceError(this.name, 'getNotificationConfig', 'Failed to get config', undefined, error);
    }
  }

  async getNotificationMetrics(): Promise<{
    totalSent: number;
    successfulSent: number;
    failedSent: number;
    averageDeliveryTime: number;
    channelStats: Record<string, number>;
  }> {
    const totalSent = this.notificationHistory.length;
    const successfulSent = this.notificationHistory.filter(n => n.success).length;
    const failedSent = totalSent - successfulSent;
    
    // Подсчитываем статистику по каналам
    const channelStats: Record<string, number> = {};
    for (const notification of this.notificationHistory) {
      channelStats[notification.channel] = (channelStats[notification.channel] || 0) + 1;
    }
    
    return {
      totalSent,
      successfulSent,
      failedSent,
      averageDeliveryTime: 0, // TODO: Реализовать подсчет времени доставки
      channelStats
    };
  }

  // ============================================================================
  // ЗАЩИЩЕННЫЕ МЕТОДЫ
  // ============================================================================

  private async sendTelegramNotification(
    userId: string, 
    message: NotificationMessage, 
    settings: { botToken: string; chatId: string }
  ): Promise<NotificationResult> {
    try {
      const bot = await this.getTelegramBot(userId, settings.botToken);
      
      const text = `*${message.title}*\n\n${message.message}`;
      const options: any = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      };
      
      // Добавляем кнопки в зависимости от типа сообщения
      if (message.type === 'slot_found') {
        options.reply_markup = {
          inline_keyboard: [[
            { text: 'Перейти к бронированию', url: 'https://seller.wildberries.ru/supplier/supplies' }
          ]]
        };
      }
      
      const result = await bot.sendMessage(settings.chatId, text, options);
      
      return {
        success: true,
        messageId: result.message_id.toString(),
        sentAt: new Date(),
        channel: 'telegram'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Telegram send failed',
        sentAt: new Date(),
        channel: 'telegram'
      };
    }
  }

  private async sendEmailNotification(
    userId: string, 
    message: NotificationMessage, 
    settings: { smtp: any; to: string }
  ): Promise<NotificationResult> {
    try {
      const transport = await this.getEmailTransport(userId, settings.smtp);
      
      const mailOptions = {
        from: settings.smtp.from || 'noreply@wb-slots.com',
        to: settings.to,
        subject: message.title,
        html: `
          <h2>${message.title}</h2>
          <p>${message.message}</p>
          <p><small>WB Slots - ${new Date().toLocaleString()}</small></p>
        `
      };
      
      const result = await transport.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: result.messageId,
        sentAt: new Date(),
        channel: 'email'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed',
        sentAt: new Date(),
        channel: 'email'
      };
    }
  }

  private async sendWebhookNotification(
    userId: string, 
    message: NotificationMessage, 
    settings: { url: string; headers: Record<string, string> }
  ): Promise<NotificationResult> {
    try {
      const response = await fetch(settings.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...settings.headers
        },
        body: JSON.stringify({
          userId,
          message,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        messageId: result.id || `webhook_${Date.now()}`,
        sentAt: new Date(),
        channel: 'webhook'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook send failed',
        sentAt: new Date(),
        channel: 'webhook'
      };
    }
  }

  private async getTelegramBot(userId: string, botToken: string): Promise<TelegramBot> {
    if (!this.telegramBots.has(userId)) {
      await this.initializeTelegramBot(userId, { botToken, chatId: '' });
    }
    
    const bot = this.telegramBots.get(userId);
    if (!bot) {
      throw new Error('Failed to initialize Telegram bot');
    }
    
    return bot;
  }

  private async initializeTelegramBot(userId: string, settings: { botToken: string; chatId: string }): Promise<void> {
    try {
      const bot = new TelegramBot(settings.botToken, { polling: false });
      this.telegramBots.set(userId, bot);
      this.log('info', `Initialized Telegram bot for user ${userId}`);
    } catch (error) {
      this.log('error', `Failed to initialize Telegram bot for user ${userId}`, error);
      throw error;
    }
  }

  private async getEmailTransport(userId: string, smtpConfig: any): Promise<nodemailer.Transporter> {
    if (!this.emailTransports.has(userId)) {
      await this.initializeEmailTransport(userId, { smtp: smtpConfig, to: '' });
    }
    
    const transport = this.emailTransports.get(userId);
    if (!transport) {
      throw new Error('Failed to initialize email transport');
    }
    
    return transport;
  }

  private async initializeEmailTransport(userId: string, settings: { smtp: any; to: string }): Promise<void> {
    try {
      const transport = nodemailer.createTransporter(settings.smtp);
      this.emailTransports.set(userId, transport);
      this.log('info', `Initialized email transport for user ${userId}`);
    } catch (error) {
      this.log('error', `Failed to initialize email transport for user ${userId}`, error);
      throw error;
    }
  }

  private async saveNotificationResult(
    userId: string, 
    message: NotificationMessage, 
    result: NotificationResult
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'notification_sent',
          details: {
            message,
            result
          }
        }
      });
    } catch (error) {
      this.log('error', 'Failed to save notification result to database', error);
    }
  }

  private validateNotificationMessage(message: NotificationMessage): void {
    if (!message.id || !message.type || !message.title || !message.message) {
      throw new ValidationError(
        this.name,
        'validateNotificationMessage',
        'Message must have id, type, title, and message'
      );
    }
  }

  private validateNotificationConfig(config: NotificationConfig): void {
    if (!config.userId || !config.type) {
      throw new ValidationError(
        this.name,
        'validateNotificationConfig',
        'Config must have userId and type'
      );
    }
  }
}
