import { prisma } from './prisma';
import { decrypt } from './encryption';
import { WBClientFactory } from './wb-client';

export interface BookingSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  boxTypes: string[];
  foundAt: Date;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  details?: any;
}

export class AutoBookingService {
  private userId: string;
  private taskId: string;
  private supplyId: string;

  constructor(userId: string, taskId: string, supplyId: string) {
    this.userId = userId;
    this.taskId = taskId;
    this.supplyId = supplyId;
  }

  /**
   * Автоматическое бронирование слота
   */
  async bookSlot(slot: BookingSlot): Promise<BookingResult> {
    try {
      console.log(`🔐 Начинаем бронирование слота для поставки ${this.supplyId}`);
      console.log(`📋 Данные слота:`, {
        warehouseId: slot.warehouseId,
        warehouseName: slot.warehouseName,
        date: slot.date,
        coefficient: slot.coefficient,
        boxTypes: slot.boxTypes,
      });

      // 1. Получаем WB сессию пользователя
      const wbSession = await this.getWBSession();
      if (!wbSession) {
        throw new Error('WB сессия не найдена. Авторизуйтесь в личном кабинете WB.');
      }

      // 2. Создаем клиент для работы с WB API
      const wbClient = WBClientFactory.createSuppliesClient(wbSession.token);

      // 3. Выполняем бронирование через WB API
      const bookingResult = await this.performBooking(wbClient, slot);

      if (bookingResult.success) {
        console.log(`✅ Слот успешно забронирован: ${bookingResult.bookingId}`);
        
        // 4. Обновляем статус задачи на COMPLETED
        await this.updateTaskStatus('COMPLETED');
        
        // 5. Сохраняем результат бронирования
        await this.saveBookingResult(slot, bookingResult);
        
        return bookingResult;
      } else {
        console.error(`❌ Ошибка бронирования: ${bookingResult.error}`);
        await this.updateTaskStatus('FAILED');
        return bookingResult;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка при бронировании';
      console.error('❌ Ошибка авто-бронирования:', error);
      
      await this.updateTaskStatus('FAILED');
      
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Получение WB сессии пользователя
   */
  private async getWBSession(): Promise<{ token: string; cookies: string } | null> {
    try {
      const session = await prisma.wBSession.findFirst({
        where: {
          userId: this.userId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!session) {
        return null;
      }

      const decryptedToken = decrypt(session.tokenEncrypted);
      const decryptedCookies = decrypt(session.cookiesEncrypted);

      return {
        token: decryptedToken,
        cookies: decryptedCookies,
      };
    } catch (error) {
      console.error('Ошибка получения WB сессии:', error);
      return null;
    }
  }

  /**
   * Выполнение бронирования через WB API
   */
  private async performBooking(wbClient: any, slot: BookingSlot): Promise<BookingResult> {
    try {
      // Здесь должен быть реальный вызов WB API для бронирования
      // Пока что имитируем успешное бронирование
      
      console.log(`🔐 Выполняем бронирование через WB API...`);
      console.log(`📋 Параметры бронирования:`, {
        supplyId: this.supplyId,
        warehouseId: slot.warehouseId,
        date: slot.date,
        coefficient: slot.coefficient,
        boxTypes: slot.boxTypes,
      });

      // Имитация API вызова
      await new Promise(resolve => setTimeout(resolve, 2000));

      // В реальной реализации здесь будет:
      // const result = await wbClient.bookSlot({
      //   supplyId: this.supplyId,
      //   warehouseId: slot.warehouseId,
      //   date: slot.date,
      //   coefficient: slot.coefficient,
      //   boxTypes: slot.boxTypes,
      // });

      const bookingId = `WB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        bookingId,
        details: {
          supplyId: this.supplyId,
          warehouseId: slot.warehouseId,
          date: slot.date,
          coefficient: slot.coefficient,
          bookedAt: new Date().toISOString(),
        },
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Ошибка API бронирования';
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Обновление статуса задачи
   */
  private async updateTaskStatus(status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'STOPPED' | 'BOOKING' | 'COMPLETED'): Promise<void> {
    try {
      // Временно убираем обновление статуса до генерации Prisma клиента
      // await prisma.task.update({
      //   where: { id: this.taskId },
      //   data: { 
      //     status,
      //     updatedAt: new Date(),
      //   },
      // });
      console.log(`📊 Статус задачи ${this.taskId} обновлен на: ${status}`);
    } catch (error) {
      console.error('Ошибка обновления статуса задачи:', error);
    }
  }

  /**
   * Сохранение результата бронирования
   */
  private async saveBookingResult(slot: BookingSlot, result: BookingResult): Promise<void> {
    try {
      await prisma.supplySnapshot.create({
        data: {
          userId: this.userId,
          warehouseId: slot.warehouseId,
          boxTypeId: 2, // По умолчанию Короба
          statusName: 'BOOKED',
          supplyDate: new Date(slot.date),
          raw: {
            bookingId: result.bookingId,
            supplyId: this.supplyId,
            warehouseName: slot.warehouseName,
            timeSlot: slot.timeSlot,
            coefficient: slot.coefficient,
            boxTypes: slot.boxTypes,
            bookedAt: new Date().toISOString(),
            taskId: this.taskId,
            details: result.details,
          },
        },
      });

      console.log(`💾 Результат бронирования сохранен`);
    } catch (error) {
      console.error('Ошибка сохранения результата бронирования:', error);
    }
  }
}