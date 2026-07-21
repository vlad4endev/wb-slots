// ===== NOTIFICATION SERVICE - SRP: Уведомления =====

import { ILogger } from '../../core/interfaces';

export interface NotificationConfig {
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  email?: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    to: string[];
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
}

export interface NotificationMessage {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  data?: Record<string, any>;
}

export interface INotificationService {
  sendSuccess(message: NotificationMessage): Promise<void>;
  sendError(message: NotificationMessage): Promise<void>;
  sendInfo(message: NotificationMessage): Promise<void>;
  sendWarning(message: NotificationMessage): Promise<void>;
}

export class NotificationService implements INotificationService {
  constructor(
    private logger: ILogger,
    private config: NotificationConfig
  ) {}

  async sendSuccess(message: NotificationMessage): Promise<void> {
    this.logger.info('Sending success notification:', message);
    await this.sendNotification({ ...message, type: 'success' });
  }

  async sendError(message: NotificationMessage): Promise<void> {
    this.logger.error('Sending error notification:', message);
    await this.sendNotification({ ...message, type: 'error' });
  }

  async sendInfo(message: NotificationMessage): Promise<void> {
    this.logger.info('Sending info notification:', message);
    await this.sendNotification({ ...message, type: 'info' });
  }

  async sendWarning(message: NotificationMessage): Promise<void> {
    this.logger.warn('Sending warning notification:', message);
    await this.sendNotification({ ...message, type: 'warning' });
  }

  private async sendNotification(message: NotificationMessage): Promise<void> {
    const promises: Promise<void>[] = [];

    // Telegram notification
    if (this.config.telegram?.enabled) {
      promises.push(this.sendTelegramNotification(message));
    }

    // Email notification
    if (this.config.email?.enabled) {
      promises.push(this.sendEmailNotification(message));
    }

    // Webhook notification
    if (this.config.webhook?.enabled) {
      promises.push(this.sendWebhookNotification(message));
    }

    // Execute all notifications in parallel
    await Promise.allSettled(promises);
  }

  private async sendTelegramNotification(message: NotificationMessage): Promise<void> {
    try {
      const { botToken, chatId } = this.config.telegram!;
      
      const emoji = this.getEmojiForType(message.type);
      const text = `${emoji} ${message.title}\n\n${message.message}`;
      
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      this.logger.info('Telegram notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Telegram notification:', error);
    }
  }

  private async sendEmailNotification(message: NotificationMessage): Promise<void> {
    try {
      // This would require an email library like nodemailer
      // For now, just log the intention
      this.logger.info('Email notification would be sent:', {
        to: this.config.email!.to,
        subject: message.title,
        body: message.message
      });
    } catch (error) {
      this.logger.error('Failed to send email notification:', error);
    }
  }

  private async sendWebhookNotification(message: NotificationMessage): Promise<void> {
    try {
      const { url, headers = {} } = this.config.webhook!;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          type: message.type,
          title: message.title,
          message: message.message,
          data: message.data,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.statusText}`);
      }

      this.logger.info('Webhook notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send webhook notification:', error);
    }
  }

  private getEmojiForType(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  }
}
