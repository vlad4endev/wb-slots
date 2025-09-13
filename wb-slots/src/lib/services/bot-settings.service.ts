import { prisma } from '../prisma';
import { encrypt, decrypt } from '../encryption';

export interface BotSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BotSettingsService {
  /**
   * Получить настройку бота по ключу
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      const setting = await (prisma as any).botSettings.findUnique({
        where: { key }
      });
      
      if (!setting?.value) {
        return null;
      }
      
      // If the setting is encrypted, decrypt it
      if (setting.isEncrypted) {
        try {
          return decrypt(setting.value);
        } catch (error) {
          console.error(`Error decrypting setting ${key}:`, error);
          return null;
        }
      }
      
      return setting.value;
    } catch (error) {
      console.error('Error getting bot setting:', error);
      return null;
    }
  }

  /**
   * Сохранить настройку бота
   */
  async setSetting(key: string, value: string, description?: string, isEncrypted: boolean = false): Promise<boolean> {
    try {
      // If the setting should be encrypted, encrypt the value
      const finalValue = isEncrypted ? encrypt(value) : value;
      
      await (prisma as any).botSettings.upsert({
        where: { key },
        update: {
          value: finalValue,
          description,
          isEncrypted
        },
        create: {
          key,
          value: finalValue,
          description,
          isEncrypted
        }
      });
      return true;
    } catch (error) {
      console.error('Error setting bot setting:', error);
      return false;
    }
  }

  /**
   * Получить все настройки бота
   */
  async getAllSettings(): Promise<BotSetting[]> {
    try {
      return await (prisma as any).botSettings.findMany({
        orderBy: { key: 'asc' }
      });
    } catch (error) {
      console.error('Error getting all bot settings:', error);
      return [];
    }
  }

  /**
   * Удалить настройку бота
   */
  async deleteSetting(key: string): Promise<boolean> {
    try {
      await (prisma as any).botSettings.delete({
        where: { key }
      });
      return true;
    } catch (error) {
      console.error('Error deleting bot setting:', error);
      return false;
    }
  }

  /**
   * Получить токен Telegram бота
   */
  async getTelegramBotToken(): Promise<string | null> {
    return this.getSetting('telegram_bot_token');
  }

  /**
   * Сохранить токен Telegram бота
   */
  async setTelegramBotToken(token: string): Promise<boolean> {
    return this.setSetting('telegram_bot_token', token, 'Telegram Bot Token for notifications', true);
  }

  /**
   * Проверить, настроен ли бот
   */
  async isBotConfigured(): Promise<boolean> {
    const token = await this.getTelegramBotToken();
    return !!token;
  }
}

export const botSettingsService = new BotSettingsService();
