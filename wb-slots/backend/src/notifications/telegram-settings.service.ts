import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

export interface TelegramSettings {
  chatId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  notificationTypes: NotificationType[];
  testMode: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  language: string;
  timezone: string;
}

@Injectable()
export class TelegramSettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Получить настройки Telegram для пользователя
   */
  async getSettings(userId: string): Promise<TelegramSettings | null> {
    try {
      const channel = await this.prisma.notificationChannel.findFirst({
        where: {
          userId,
          type: 'TELEGRAM',
        },
      });

      if (!channel) {
        return null;
      }

      const config = channel.config as any;
      return {
        chatId: config.chatId,
        username: config.username,
        firstName: config.firstName,
        lastName: config.lastName,
        enabled: channel.enabled,
        notificationTypes: config.notificationTypes || [],
        testMode: config.testMode || false,
        quietHours: config.quietHours || {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
        language: config.language || 'ru',
        timezone: config.timezone || 'Europe/Moscow',
      };
    } catch (error) {
      console.error('Error getting Telegram settings:', error);
      return null;
    }
  }

  /**
   * Сохранить настройки Telegram для пользователя
   */
  async saveSettings(userId: string, settings: Partial<TelegramSettings>): Promise<boolean> {
    try {
      const existingChannel = await this.prisma.notificationChannel.findFirst({
        where: {
          userId,
          type: 'TELEGRAM',
        },
      });

      const config = {
        chatId: settings.chatId,
        username: settings.username,
        firstName: settings.firstName,
        lastName: settings.lastName,
        notificationTypes: settings.notificationTypes || [],
        testMode: settings.testMode || false,
        quietHours: settings.quietHours || {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
        language: settings.language || 'ru',
        timezone: settings.timezone || 'Europe/Moscow',
      };

      if (existingChannel) {
        await this.prisma.notificationChannel.update({
          where: { id: existingChannel.id },
          data: {
            config,
            enabled: settings.enabled !== undefined ? settings.enabled : existingChannel.enabled,
          },
        });
      } else {
        await this.prisma.notificationChannel.create({
          data: {
            userId,
            type: 'TELEGRAM',
            config,
            enabled: settings.enabled !== undefined ? settings.enabled : true,
          },
        });
      }

      return true;
    } catch (error) {
      console.error('Error saving Telegram settings:', error);
      return false;
    }
  }

  /**
   * Обновить статус регистрации пользователя
   */
  async updateRegistration(
    userId: string,
    chatId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<boolean> {
    try {
      const settings = await this.getSettings(userId);
      const updatedSettings = {
        ...settings,
        chatId,
        username,
        firstName,
        lastName,
        enabled: true,
      };

      return await this.saveSettings(userId, updatedSettings);
    } catch (error) {
      console.error('Error updating Telegram registration:', error);
      return false;
    }
  }

  /**
   * Отключить уведомления для пользователя
   */
  async disableNotifications(userId: string): Promise<boolean> {
    try {
      const existingChannel = await this.prisma.notificationChannel.findFirst({
        where: {
          userId,
          type: 'TELEGRAM',
        },
      });

      if (existingChannel) {
        await this.prisma.notificationChannel.update({
          where: { id: existingChannel.id },
          data: { enabled: false },
        });
      }

      return true;
    } catch (error) {
      console.error('Error disabling Telegram notifications:', error);
      return false;
    }
  }

  /**
   * Получить статистику по пользователям Telegram
   */
  async getStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
  }> {
    try {
      const totalUsers = await this.prisma.notificationChannel.count({
        where: { type: 'TELEGRAM' },
      });

      const activeUsers = await this.prisma.notificationChannel.count({
        where: {
          type: 'TELEGRAM',
          enabled: true,
        },
      });

      const inactiveUsers = totalUsers - activeUsers;

      return {
        totalUsers,
        activeUsers,
        inactiveUsers,
      };
    } catch (error) {
      console.error('Error getting Telegram stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
      };
    }
  }

  /**
   * Получить всех пользователей с настройками Telegram
   */
  async getAllUsers(): Promise<Array<{
    userId: string;
    chatId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
    createdAt: Date;
  }>> {
    try {
      const channels = await this.prisma.notificationChannel.findMany({
        where: { type: 'TELEGRAM' },
        select: {
          userId: true,
          config: true,
          enabled: true,
          createdAt: true,
        },
      });

      return channels.map(channel => {
        const config = channel.config as any;
        return {
          userId: channel.userId,
          chatId: config.chatId,
          username: config.username,
          firstName: config.firstName,
          lastName: config.lastName,
          enabled: channel.enabled,
          createdAt: channel.createdAt,
        };
      });
    } catch (error) {
      console.error('Error getting all Telegram users:', error);
      return [];
    }
  }
}
