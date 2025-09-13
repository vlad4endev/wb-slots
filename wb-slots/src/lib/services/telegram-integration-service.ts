import { getTelegramService } from '@/lib/services/telegram-service';

export interface SlotFoundData {
  taskId: string;
  taskName: string;
  slots: Array<{
    warehouseId: number;
    warehouseName: string;
    date: string;
    coefficient: number;
    boxTypes: string[];
  }>;
  userId: string;
}

export class TelegramIntegrationService {
  /**
   * Преобразование кодов типов коробок в полные наименования согласно документации WB
   */
  private getBoxTypeNames(boxTypes: string[]): string {
    const boxTypeMap: { [key: string]: string } = {
      '2': 'Короба',
      '5': 'Монопаллеты',
      '6': 'Суперсейф'
    };

    return boxTypes.map(type => boxTypeMap[type] || `Тип ${type}`).join(', ');
  }

  /**
   * Отправка уведомления о найденных слотах через новую систему Telegram
   */
  async notifySlotsFound(data: SlotFoundData): Promise<boolean> {
    try {
      console.log(`📱 Отправка Telegram уведомления пользователю ${data.userId} о ${data.slots.length} найденных слотах`);

      // Формируем сообщение
      const message = this.formatSlotsFoundMessage(data);

      // Отправляем через TelegramService (он сам проверит настройки пользователя)
      const telegramService = getTelegramService();
      const success = await telegramService.sendNotification(data.userId, message);

      if (success) {
        console.log(`✅ Telegram уведомление отправлено пользователю ${data.userId}`);
      } else {
        console.warn(`⚠️ Не удалось отправить Telegram уведомление пользователю ${data.userId}`);
      }

      return success;

    } catch (error) {
      console.error('❌ Ошибка отправки Telegram уведомления:', error);
      return false;
    }
  }


  /**
   * Форматирование сообщения о найденных слотах
   */
  private formatSlotsFoundMessage(data: SlotFoundData): string {
    let message = `🎯 Найдены доступные слоты!\n\n`;
    message += `📋 Задача: ${data.taskName}\n`;
    message += `📊 Найдено слотов: ${data.slots.length}\n\n`;

    // Показываем первые 5 слотов (чтобы не перегружать сообщение)
    const slotsToShow = data.slots.slice(0, 5);
    
    slotsToShow.forEach((slot, index) => {
      message += `📍 Слот ${index + 1}:\n`;
      message += `   🏪 Склад: ${slot.warehouseName}\n`;
      message += `   📅 Дата: ${new Date(slot.date).toLocaleDateString('ru-RU')}\n`;
      message += `   💰 Коэффициент: ${slot.coefficient}\n`;
      message += `   📦 Типы коробок: ${this.getBoxTypeNames(slot.boxTypes)}\n\n`;
    });

    if (data.slots.length > 5) {
      message += `... и еще ${data.slots.length - 5} слотов\n\n`;
    }

    message += `🔗 Перейдите в панель управления для просмотра всех слотов и начала бронирования.`;

    return message;
  }

  /**
   * Отправка уведомления об успешном бронировании
   */
  async notifyBookingSuccess(data: {
    userId: string;
    taskId: string;
    taskName: string;
    slot: {
      warehouseId: number;
      warehouseName: string;
      date: string;
      coefficient: number;
    };
    bookingId: string;
  }): Promise<boolean> {
    try {
      const message = `✅ Бронирование успешно!\n\n` +
        `📋 Задача: ${data.taskName}\n` +
        `🏪 Склад: ${data.slot.warehouseName}\n` +
        `📅 Дата: ${new Date(data.slot.date).toLocaleDateString('ru-RU')}\n` +
        `💰 Коэффициент: ${data.slot.coefficient}\n` +
        `🆔 ID бронирования: ${data.bookingId}\n\n` +
        `🎉 Слот успешно забронирован!`;

      const telegramService = getTelegramService();
      return await telegramService.sendNotification(data.userId, message);

    } catch (error) {
      console.error('Ошибка отправки уведомления об успешном бронировании:', error);
      return false;
    }
  }

  /**
   * Отправка уведомления об ошибке бронирования
   */
  async notifyBookingError(data: {
    userId: string;
    taskId: string;
    taskName: string;
    slot: {
      warehouseId: number;
      warehouseName: string;
      date: string;
      coefficient: number;
    };
    error: string;
  }): Promise<boolean> {
    try {
      const message = `❌ Ошибка бронирования\n\n` +
        `📋 Задача: ${data.taskName}\n` +
        `🏪 Склад: ${data.slot.warehouseName}\n` +
        `📅 Дата: ${new Date(data.slot.date).toLocaleDateString('ru-RU')}\n` +
        `💰 Коэффициент: ${data.slot.coefficient}\n\n` +
        `⚠️ Ошибка: ${data.error}\n\n` +
        `🔄 Попробуйте еще раз или выберите другой слот.`;

      const telegramService = getTelegramService();
      return await telegramService.sendNotification(data.userId, message);

    } catch (error) {
      console.error('Ошибка отправки уведомления об ошибке бронирования:', error);
      return false;
    }
  }
}

export const telegramIntegrationService = new TelegramIntegrationService();
