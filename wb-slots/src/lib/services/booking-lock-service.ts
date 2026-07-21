import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * BOOKING LOCK SERVICE
 * 
 * Сервис для управления распределёнными блокировками при автобронировании.
 * Предотвращает одновременное выполнение нескольких процессов бронирования
 * для одного пользователя (race conditions, дублирующие запросы).
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * ```typescript
 * const lock = await bookingLockService.acquireLock(userId, taskId);
 * if (!lock) {
 *   throw new Error('Booking already in progress');
 * }
 * 
 * try {
 *   // Выполняем бронирование
 *   await performBooking();
 * } finally {
 *   await bookingLockService.releaseLock(lock.id);
 * }
 * ```
 */

export interface BookingLockInfo {
  id: string;
  userId: string;
  lockKey: string;
  lockedBy: string;
  taskId?: string | null;
  supplyId?: string | null;
  warehouseId?: number | null;
  acquiredAt: Date;
  expiresAt: Date;
}

export interface AcquireLockOptions {
  taskId?: string;
  supplyId?: string;
  warehouseId?: number;
  ttlSeconds?: number; // Time To Live для автоматического освобождения
  metadata?: Record<string, any>;
}

export class BookingLockService {
  private static instance: BookingLockService;
  private readonly DEFAULT_TTL = 300; // 5 минут по умолчанию

  private constructor() {}

  public static getInstance(): BookingLockService {
    if (!BookingLockService.instance) {
      BookingLockService.instance = new BookingLockService();
    }
    return BookingLockService.instance;
  }

  /**
   * Попытка получить блокировку для пользователя
   * Возвращает null, если блокировка уже существует
   */
  async acquireLock(
    userId: string,
    options: AcquireLockOptions = {}
  ): Promise<BookingLockInfo | null> {
    const lockKey = `booking:${userId}`;
    const lockedBy = crypto.randomUUID();
    const ttl = options.ttlSeconds || this.DEFAULT_TTL;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    try {
      // Сначала удаляем истекшие блокировки
      await this.cleanupExpiredLocks();

      // Пытаемся создать блокировку (atomic operation благодаря unique constraint)
      const lock = await prisma.bookingLock.create({
        data: {
          userId,
          lockKey,
          lockedBy,
          taskId: options.taskId,
          supplyId: options.supplyId,
          warehouseId: options.warehouseId,
          expiresAt,
          metadata: options.metadata || {},
        },
      });

      console.log(`🔒 Lock acquired for user ${userId}`, {
        lockId: lock.id,
        lockedBy,
        expiresAt,
        taskId: options.taskId,
      });

      return {
        id: lock.id,
        userId: lock.userId,
        lockKey: lock.lockKey,
        lockedBy: lock.lockedBy,
        taskId: lock.taskId,
        supplyId: lock.supplyId,
        warehouseId: lock.warehouseId,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
      };
    } catch (error: any) {
      // Если произошла ошибка unique constraint - блокировка уже существует
      if (error.code === 'P2002') {
        console.warn(`⚠️ Lock already exists for user ${userId}`);
        
        // Проверяем, не истекла ли существующая блокировка
        const existingLock = await prisma.bookingLock.findUnique({
          where: { userId },
        });

        if (existingLock && existingLock.expiresAt < new Date()) {
          // Блокировка истекла, удаляем и пробуем снова
          console.log(`🔓 Existing lock expired, removing and retrying`);
          await this.releaseLock(existingLock.id);
          return this.acquireLock(userId, options);
        }

        return null;
      }

      // Другие ошибки пробрасываем
      throw error;
    }
  }

  /**
   * Освобождение блокировки
   */
  async releaseLock(lockId: string): Promise<boolean> {
    try {
      await prisma.bookingLock.update({
        where: { id: lockId },
        data: {
          releasedAt: new Date(),
        },
      });

      // Удаляем запись о блокировке
      await prisma.bookingLock.delete({
        where: { id: lockId },
      });

      console.log(`🔓 Lock released: ${lockId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to release lock ${lockId}:`, error);
      return false;
    }
  }

  /**
   * Освобождение блокировки по userId
   */
  async releaseLockByUserId(userId: string): Promise<boolean> {
    try {
      const lock = await prisma.bookingLock.findUnique({
        where: { userId },
      });

      if (!lock) {
        console.warn(`⚠️ No lock found for user ${userId}`);
        return false;
      }

      return await this.releaseLock(lock.id);
    } catch (error) {
      console.error(`❌ Failed to release lock for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Проверка наличия активной блокировки
   */
  async hasActiveLock(userId: string): Promise<boolean> {
    try {
      const lock = await prisma.bookingLock.findUnique({
        where: { userId },
      });

      if (!lock) {
        return false;
      }

      // Проверяем, не истекла ли блокировка
      if (lock.expiresAt < new Date()) {
        await this.releaseLock(lock.id);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Failed to check lock for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Получение информации о текущей блокировке
   */
  async getLockInfo(userId: string): Promise<BookingLockInfo | null> {
    try {
      const lock = await prisma.bookingLock.findUnique({
        where: { userId },
      });

      if (!lock) {
        return null;
      }

      // Проверяем, не истекла ли блокировка
      if (lock.expiresAt < new Date()) {
        await this.releaseLock(lock.id);
        return null;
      }

      return {
        id: lock.id,
        userId: lock.userId,
        lockKey: lock.lockKey,
        lockedBy: lock.lockedBy,
        taskId: lock.taskId,
        supplyId: lock.supplyId,
        warehouseId: lock.warehouseId,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
      };
    } catch (error) {
      console.error(`❌ Failed to get lock info for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Продление времени жизни блокировки
   */
  async extendLock(lockId: string, additionalSeconds: number = 60): Promise<boolean> {
    try {
      const lock = await prisma.bookingLock.findUnique({
        where: { id: lockId },
      });

      if (!lock) {
        console.warn(`⚠️ Lock ${lockId} not found`);
        return false;
      }

      const newExpiresAt = new Date(lock.expiresAt.getTime() + additionalSeconds * 1000);

      await prisma.bookingLock.update({
        where: { id: lockId },
        data: { expiresAt: newExpiresAt },
      });

      console.log(`⏱️ Lock ${lockId} extended until ${newExpiresAt.toISOString()}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to extend lock ${lockId}:`, error);
      return false;
    }
  }

  /**
   * Очистка истекших блокировок (cleanup job)
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const result = await prisma.bookingLock.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        console.log(`🧹 Cleaned up ${result.count} expired locks`);
      }

      return result.count;
    } catch (error) {
      console.error('❌ Failed to cleanup expired locks:', error);
      return 0;
    }
  }

  /**
   * Получение всех активных блокировок (для мониторинга)
   */
  async getActiveLocks(): Promise<BookingLockInfo[]> {
    try {
      const locks = await prisma.bookingLock.findMany({
        where: {
          expiresAt: {
            gte: new Date(),
          },
        },
        orderBy: {
          acquiredAt: 'desc',
        },
      });

      return locks.map(lock => ({
        id: lock.id,
        userId: lock.userId,
        lockKey: lock.lockKey,
        lockedBy: lock.lockedBy,
        taskId: lock.taskId,
        supplyId: lock.supplyId,
        warehouseId: lock.warehouseId,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
      }));
    } catch (error) {
      console.error('❌ Failed to get active locks:', error);
      return [];
    }
  }

  /**
   * Принудительное освобождение всех блокировок (для экстренных случаев)
   */
  async releaseAllLocks(): Promise<number> {
    try {
      const result = await prisma.bookingLock.deleteMany({});
      console.warn(`⚠️ Force released ${result.count} locks`);
      return result.count;
    } catch (error) {
      console.error('❌ Failed to release all locks:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const bookingLockService = BookingLockService.getInstance();

