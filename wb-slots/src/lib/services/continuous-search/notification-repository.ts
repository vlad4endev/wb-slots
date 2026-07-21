import { getTelegramService } from '@/lib/services/telegram-service';
import { logger } from '@/lib/logging';

/**
 * Repository для отправки уведомлений пользователям
 * Использует TelegramService для отправки уведомлений
 */
export class NotificationRepository {
  /**
   * Отправить уведомление о проблеме с токеном (401 Unauthorized)
   */
  async sendTokenExpiredNotification(
    userId: string,
    taskId: string,
    errorDetails?: {
      statusCode: number;
      message: string;
      detail?: string;
    }
  ): Promise<void> {
    try {
      let message = `🔐 Требуется обновление токена Wildberries\n\n`;
      message += `Ваш токен Wildberries истёк или недействителен. Пожалуйста, обновите токен в настройках API.\n\n`;
      if (errorDetails?.detail) {
        message += `${errorDetails.detail}\n\n`;
      }
      message += `📋 Действие: Перейдите в настройки → API → Обновить токен\n`;
      message += `🔗 Получить токен: https://seller.wildberries.ru/supplier-settings/access-to-api`;

      const success = await getTelegramService().sendNotification(userId, message);

      if (success) {
        logger.info(
          {
            userId,
            taskId,
            notificationType: 'token_unauthorized',
          },
          'Token expired notification sent successfully'
        );
      } else {
        logger.warn(
          {
            userId,
            taskId,
          },
          'Failed to send token expired notification (user may not have Telegram configured)'
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          taskId,
        },
        'Error sending token expired notification'
      );
    }
  }

  /**
   * Отправить уведомление о критической ошибке API
   */
  async sendApiErrorNotification(
    userId: string,
    taskId: string,
    errorType: 'forbidden' | 'server_error' | 'rate_limit',
    errorDetails: {
      statusCode: number;
      message: string;
      detail?: string;
    }
  ): Promise<void> {
    try {
      const titles: Record<typeof errorType, string> = {
        forbidden: '🚫 Доступ к API Wildberries запрещён',
        server_error: '⚠️ Ошибка сервера Wildberries',
        rate_limit: '⏱️ Превышен лимит запросов к API',
      };

      const descriptions: Record<typeof errorType, string> = {
        forbidden: 'Доступ к API запрещён. Проверьте права доступа вашего токена.',
        server_error: 'Сервер Wildberries временно недоступен. Поиск будет приостановлен.',
        rate_limit: 'Превышен лимит запросов к API. Поиск автоматически продолжится после задержки.',
      };

      let message = `${titles[errorType]}\n\n`;
      message += `${descriptions[errorType]}\n\n`;
      message += `Код ошибки: ${errorDetails.statusCode}\n`;
      if (errorDetails.detail) {
        message += `Детали: ${errorDetails.detail}`;
      }

      const success = await getTelegramService().sendNotification(userId, message);

      if (success) {
        logger.info(
          {
            userId,
            taskId,
            errorType,
            notificationType: 'api_error',
          },
          'API error notification sent successfully'
        );
      } else {
        logger.warn(
          {
            userId,
            taskId,
            errorType,
          },
          'Failed to send API error notification (user may not have Telegram configured)'
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          taskId,
        },
        'Error sending API error notification'
      );
    }
  }

  /**
   * Отправить уведомление о найденных слотах (сразу при обнаружении)
   */
  async sendSlotsFoundNotification(
    userId: string,
    taskId: string,
    slots: Array<{
      warehouseName: string;
      date: string;
      timeSlot?: string;
      coefficient: number;
      boxTypes: number[];
    }>
  ): Promise<void> {
    try {
      // Формируем сообщение
      let message = `🎯 Найдены подходящие слоты!\n\n`;
      message += `Обнаружено ${slots.length} ${slots.length === 1 ? 'слот' : 'слотов'} для бронирования\n\n`;
      
      // Показываем максимум 5 слотов в уведомлении
      const slotsToShow = slots.slice(0, 5);
      slotsToShow.forEach((slot, index) => {
        message += `📍 Слот ${index + 1}:\n`;
        message += `   🏪 Склад: ${slot.warehouseName}\n`;
        message += `   📅 Дата: ${slot.date}`;
        if (slot.timeSlot) {
          message += ` (${slot.timeSlot})`;
        }
        message += `\n   💰 Коэффициент: ${slot.coefficient}\n`;
        message += `   📦 Типы коробок: ${slot.boxTypes.join(', ')}\n\n`;
      });
      
      if (slots.length > 5) {
        message += `... и ещё ${slots.length - 5} слотов\n\n`;
      }
      
      message += `🔗 Перейдите в панель управления для просмотра деталей.`;

      // Отправляем через TelegramService
      const success = await getTelegramService().sendNotification(userId, message);

      if (success) {
        logger.info(
          {
            userId,
            taskId,
            slotsCount: slots.length,
          },
          'Slots found notification sent successfully'
        );
      } else {
        logger.warn(
          {
            userId,
            taskId,
            slotsCount: slots.length,
          },
          'Failed to send slots found notification (user may not have Telegram configured)'
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          taskId,
        },
        'Error sending slots found notification'
      );
    }
  }

  /**
   * Отправить уведомление об успешном завершении поиска
   */
  async sendSearchCompletedNotification(
    userId: string,
    taskId: string,
    result: {
      foundSlots: number;
      totalSearches: number;
      searchTime: number;
    }
  ): Promise<void> {
    try {
      let message = `✅ Поиск слотов завершён успешно\n\n`;
      message += `Найдено слотов: ${result.foundSlots}\n`;
      message += `Выполнено поисков: ${result.totalSearches}\n`;
      const minutes = Math.floor(result.searchTime / 60000);
      message += `Время поиска: ${minutes} мин.`;

      const success = await getTelegramService().sendNotification(userId, message);

      if (success) {
        logger.info(
          {
            userId,
            taskId,
            foundSlots: result.foundSlots,
          },
          'Search completed notification sent successfully'
        );
      } else {
        logger.warn(
          {
            userId,
            taskId,
          },
          'Failed to send search completed notification (user may not have Telegram configured)'
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          taskId,
        },
        'Error sending search completed notification'
      );
    }
  }

  /**
   * Отправить уведомление о провале задачи
   */
  async sendTaskFailedNotification(
    userId: string,
    taskId: string,
    reason: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      let message = `❌ Задача поиска слотов завершилась с ошибкой\n\n`;
      message += `Причина: ${reason}`;
      if (errorMessage) {
        message += `\nОшибка: ${errorMessage}`;
      }

      const success = await getTelegramService().sendNotification(userId, message);

      if (success) {
        logger.info(
          {
            userId,
            taskId,
            reason,
          },
          'Task failed notification sent successfully'
        );
      } else {
        logger.warn(
          {
            userId,
            taskId,
          },
          'Failed to send task failed notification (user may not have Telegram configured)'
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          taskId,
        },
        'Error sending task failed notification'
      );
    }
  }
}

