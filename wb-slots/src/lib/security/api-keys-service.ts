import { prisma } from '@/lib/prisma';
import { encryptionService, EncryptedData } from './encryption-service';

export interface ApiKeyData {
  userId: string;
  keyType: 'wb_api' | 'telegram_bot' | 'wb_cookies' | 'proxy_auth';
  keyName: string;
  keyValue: string;
  description?: string;
  isActive: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface StoredApiKey {
  id: string;
  userId: string;
  keyType: string;
  keyName: string;
  encryptedData: EncryptedData;
  description?: string;
  isActive: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ApiKeysService {
  private static instance: ApiKeysService;

  private constructor() {}

  public static getInstance(): ApiKeysService {
    if (!ApiKeysService.instance) {
      ApiKeysService.instance = new ApiKeysService();
    }
    return ApiKeysService.instance;
  }

  /**
   * Сохраняет API ключ в зашифрованном виде
   */
  async storeApiKey(keyData: ApiKeyData): Promise<StoredApiKey> {
    try {
      // Шифруем ключ
      const encryptedData = encryptionService.encrypt(keyData.keyValue);

      // Сохраняем в БД
      const storedKey = await prisma.apiKey.create({
        data: {
          userId: keyData.userId,
          keyType: keyData.keyType,
          keyName: keyData.keyName,
          encryptedData: encryptedData as any, // Prisma JSON type
          description: keyData.description,
          isActive: keyData.isActive,
          expiresAt: keyData.expiresAt,
          metadata: keyData.metadata || {},
        },
      });

      console.log(`✅ API key stored: ${keyData.keyType}:${keyData.keyName} for user ${keyData.userId}`);

      return {
        id: storedKey.id,
        userId: storedKey.userId,
        keyType: storedKey.keyType,
        keyName: storedKey.keyName,
        encryptedData: storedKey.encryptedData as EncryptedData,
        description: storedKey.description,
        isActive: storedKey.isActive,
        expiresAt: storedKey.expiresAt,
        metadata: storedKey.metadata as Record<string, any>,
        createdAt: storedKey.createdAt,
        updatedAt: storedKey.updatedAt,
      };
    } catch (error) {
      console.error('❌ Error storing API key:', error);
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Получает и расшифровывает API ключ
   */
  async getApiKey(userId: string, keyType: string, keyName?: string): Promise<string | null> {
    try {
      const whereClause: any = {
        userId,
        keyType,
        isActive: true,
      };

      if (keyName) {
        whereClause.keyName = keyName;
      }

      const storedKey = await prisma.apiKey.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      if (!storedKey) {
        console.warn(`⚠️ API key not found: ${keyType}:${keyName || 'any'} for user ${userId}`);
        return null;
      }

      // Проверяем срок действия
      if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
        console.warn(`⚠️ API key expired: ${storedKey.id}`);
        return null;
      }

      // Расшифровываем ключ
      const decryptedKey = encryptionService.decrypt(storedKey.encryptedData as EncryptedData);

      console.log(`✅ API key retrieved: ${keyType}:${storedKey.keyName} for user ${userId}`);

      return decryptedKey;
    } catch (error) {
      console.error('❌ Error retrieving API key:', error);
      return null;
    }
  }

  /**
   * Получает все API ключи пользователя (без расшифровки)
   */
  async getUserApiKeys(userId: string): Promise<Omit<StoredApiKey, 'encryptedData'>[]> {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return keys.map(key => ({
        id: key.id,
        userId: key.userId,
        keyType: key.keyType,
        keyName: key.keyName,
        description: key.description,
        isActive: key.isActive,
        expiresAt: key.expiresAt,
        metadata: key.metadata as Record<string, any>,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      }));
    } catch (error) {
      console.error('❌ Error retrieving user API keys:', error);
      return [];
    }
  }

  /**
   * Обновляет API ключ
   */
  async updateApiKey(
    keyId: string,
    updates: Partial<Pick<ApiKeyData, 'keyValue' | 'description' | 'isActive' | 'expiresAt' | 'metadata'>>
  ): Promise<StoredApiKey | null> {
    try {
      const updateData: any = { ...updates };

      // Если обновляется значение ключа, шифруем его
      if (updates.keyValue) {
        updateData.encryptedData = encryptionService.encrypt(updates.keyValue);
        delete updateData.keyValue;
      }

      const updatedKey = await prisma.apiKey.update({
        where: { id: keyId },
        data: updateData,
      });

      console.log(`✅ API key updated: ${updatedKey.id}`);

      return {
        id: updatedKey.id,
        userId: updatedKey.userId,
        keyType: updatedKey.keyType,
        keyName: updatedKey.keyName,
        encryptedData: updatedKey.encryptedData as EncryptedData,
        description: updatedKey.description,
        isActive: updatedKey.isActive,
        expiresAt: updatedKey.expiresAt,
        metadata: updatedKey.metadata as Record<string, any>,
        createdAt: updatedKey.createdAt,
        updatedAt: updatedKey.updatedAt,
      };
    } catch (error) {
      console.error('❌ Error updating API key:', error);
      return null;
    }
  }

  /**
   * Удаляет API ключ
   */
  async deleteApiKey(keyId: string): Promise<boolean> {
    try {
      await prisma.apiKey.delete({
        where: { id: keyId },
      });

      console.log(`✅ API key deleted: ${keyId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting API key:', error);
      return false;
    }
  }

  /**
   * Деактивирует все ключи пользователя определенного типа
   */
  async deactivateUserKeys(userId: string, keyType: string): Promise<number> {
    try {
      const result = await prisma.apiKey.updateMany({
        where: {
          userId,
          keyType,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      console.log(`✅ Deactivated ${result.count} keys of type ${keyType} for user ${userId}`);
      return result.count;
    } catch (error) {
      console.error('❌ Error deactivating user keys:', error);
      return 0;
    }
  }

  /**
   * Очищает просроченные ключи
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await prisma.apiKey.updateMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      console.log(`✅ Cleaned up ${result.count} expired keys`);
      return result.count;
    } catch (error) {
      console.error('❌ Error cleaning up expired keys:', error);
      return 0;
    }
  }

  /**
   * Получает статистику ключей
   */
  async getKeysStats(userId?: string): Promise<{
    total: number;
    active: number;
    expired: number;
    byType: Record<string, number>;
  }> {
    try {
      const whereClause = userId ? { userId } : {};

      const [total, active, expired, byType] = await Promise.all([
        prisma.apiKey.count({ where: whereClause }),
        prisma.apiKey.count({ 
          where: { ...whereClause, isActive: true } 
        }),
        prisma.apiKey.count({ 
          where: { 
            ...whereClause, 
            expiresAt: { lt: new Date() },
            isActive: true 
          } 
        }),
        prisma.apiKey.groupBy({
          by: ['keyType'],
          where: whereClause,
          _count: { keyType: true },
        }),
      ]);

      const byTypeMap = byType.reduce((acc, item) => {
        acc[item.keyType] = item._count.keyType;
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        active,
        expired,
        byType: byTypeMap,
      };
    } catch (error) {
      console.error('❌ Error getting keys stats:', error);
      return {
        total: 0,
        active: 0,
        expired: 0,
        byType: {},
      };
    }
  }

  /**
   * Проверяет, есть ли у пользователя активный ключ определенного типа
   */
  async hasActiveKey(userId: string, keyType: string, keyName?: string): Promise<boolean> {
    try {
      const whereClause: any = {
        userId,
        keyType,
        isActive: true,
      };

      if (keyName) {
        whereClause.keyName = keyName;
      }

      const count = await prisma.apiKey.count({
        where: whereClause,
      });

      return count > 0;
    } catch (error) {
      console.error('❌ Error checking active key:', error);
      return false;
    }
  }
}

// Экспортируем singleton instance
export const apiKeysService = ApiKeysService.getInstance();
