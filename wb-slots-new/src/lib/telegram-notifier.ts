import { FoundSlot } from './wb-slot-search';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export class TelegramNotifier {
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  /**
   * Отправка уведомления о найденных слотах
   */
  async sendSlotsFoundNotification(slots: FoundSlot[]): Promise<NotificationResult> {
    if (!slots || slots.length === 0) {
      return { success: false, error: 'Нет слотов для отправки' };
    }

    const message = this.formatSlotsMessage(slots);
    return await this.sendMessage(message);
  }

  /**
   * Отправка сообщения об ошибке
   */
  async sendErrorNotification(error: string): Promise<NotificationResult> {
    const message = `⚠️ Ошибка поиска слотов: ${error}`;
    return await this.sendMessage(message);
  }

  /**
   * Отправка сообщения о завершении поиска
   */
  async sendCompletionNotification(foundSlots: number, totalChecked: number, searchTime: number): Promise<NotificationResult> {
    const message = `✅ Поиск завершен\n` +
      `Найдено слотов: ${foundSlots}\n` +
      `Проверено записей: ${totalChecked}\n` +
      `Время поиска: ${Math.round(searchTime / 1000)} секунд`;
    
    return await this.sendMessage(message);
  }

  /**
   * Отправка сообщения с инлайн-кнопкой для бронирования
   */
  async sendBookingNotification(slots: FoundSlot[]): Promise<NotificationResult> {
    if (!slots || slots.length === 0) {
      return { success: false, error: 'Нет слотов для отправки' };
    }

    const message = this.formatSlotsMessage(slots);
    return await this.sendMessageWithButton(message);
  }

  /**
   * Форматирование сообщения о найденных слотах
   */
  private formatSlotsMessage(slots: FoundSlot[]): string {
    const header = `🎯 Найдены доступные слоты (${slots.length}):\n\n`;
    
    const slotsText = slots.map((slot, index) => {
      const date = new Date(slot.date).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
      
      return `${index + 1}. ${slot.warehouseName}\n` +
             `   📅 ${date} ${slot.timeSlot}\n` +
             `   📦 ${slot.boxTypes.join(', ')}\n` +
             `   🔢 Коэффициент: ${slot.coefficient}\n`;
    }).join('\n');

    return header + slotsText;
  }

  /**
   * Отправка обычного сообщения
   */
  private async sendMessage(text: string): Promise<NotificationResult> {
    try {
      console.log(`📤 Отправка сообщения в Telegram. chatId: ${this.config.chatId}`);
      
      if (!this.config.chatId || isNaN(Number(this.config.chatId)) || this.config.chatId.toString().trim() === "") {
        console.warn('❌ Пропуск отправки сообщения: chatId недействителен:', this.config.chatId);
        return { success: false, error: 'chatId недействителен' };
      }

      const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json();

      if (data.ok) {
        console.log(`✅ Сообщение успешно отправлено в Telegram:`, data);
        return { success: true, messageId: data.result.message_id };
      } else {
        console.warn(`❌ Неудачная отправка сообщения в Telegram:`, data);
        return { success: false, error: `Telegram API вернул ошибку: ${data.description || 'неизвестная ошибка'}` };
      }
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения в Telegram:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }
  }

  /**
   * Отправка сообщения с инлайн-кнопкой
   */
  private async sendMessageWithButton(text: string): Promise<NotificationResult> {
    try {
      console.log(`📤 Отправка сообщения с кнопкой в Telegram. chatId: ${this.config.chatId}`);
      
      if (!this.config.chatId || isNaN(Number(this.config.chatId)) || this.config.chatId.toString().trim() === "") {
        console.warn('❌ Пропуск отправки сообщения: chatId недействителен:', this.config.chatId);
        return { success: false, error: 'chatId недействителен' };
      }

      const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🚀 БРОНИРОВАТЬ",
                  url: "https://seller.wildberries.ru/supplies-management/all-supplies"
                }
              ]
            ]
          }
        }),
      });

      const data = await response.json();

      if (data.ok) {
        console.log(`✅ Сообщение с кнопкой успешно отправлено в Telegram:`, data);
        return { success: true, messageId: data.result.message_id };
      } else {
        console.warn(`❌ Неудачная отправка сообщения с кнопкой в Telegram:`, data);
        return { success: false, error: `Telegram API вернул ошибку: ${data.description || 'неизвестная ошибка'}` };
      }
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения с кнопкой в Telegram:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }
  }

  /**
   * Проверка валидности конфигурации
   */
  static validateConfig(config: TelegramConfig): { valid: boolean; error?: string } {
    if (!config.botToken || config.botToken.trim() === '') {
      return { valid: false, error: 'Токен бота не указан' };
    }

    if (!config.chatId || config.chatId.trim() === '') {
      return { valid: false, error: 'Chat ID не указан' };
    }

    if (isNaN(Number(config.chatId))) {
      return { valid: false, error: 'Chat ID должен быть числом' };
    }

    return { valid: true };
  }
}
