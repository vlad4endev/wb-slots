export interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview: boolean;
  disableNotification: boolean;
  timeout: number;
  retryDelay: number;
  maxRetries: number;
}

export interface TelegramUser {
  userId: string;
  chatId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  template: string;
  variables: string[];
  isActive: boolean;
}

export enum NotificationType {
  SLOT_FOUND = 'slot_found',
  BOOKING_STARTED = 'booking_started',
  BOOKING_SUCCESS = 'booking_success',
  BOOKING_ERROR = 'booking_error',
  BOOKING_CAPTCHA = 'booking_captcha',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  SYSTEM_ERROR = 'system_error',
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  parseMode: 'HTML',
  disableWebPagePreview: true,
  disableNotification: false,
  timeout: 30000,
  retryDelay: 1000,
  maxRetries: 3,
};

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  [NotificationType.SLOT_FOUND]: {
    id: 'slot_found',
    name: 'Слот найден',
    type: NotificationType.SLOT_FOUND,
    template: `🎯 <b>Слот найден!</b>

📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склад:</b> {warehouseName}
📅 <b>Дата:</b> {slotDate}
⏰ <b>Время:</b> {slotTime}
📊 <b>Коэффициент:</b> {coefficient}
📋 <b>Задача:</b> {taskName}

🚀 <i>Начинаем бронирование...</i>`,
    variables: ['supplyName', 'supplyId', 'warehouseName', 'slotDate', 'slotTime', 'coefficient', 'taskName'],
    isActive: true,
  },
  
  [NotificationType.BOOKING_STARTED]: {
    id: 'booking_started',
    name: 'Начало бронирования',
    type: NotificationType.BOOKING_STARTED,
    template: `🚀 <b>Начинаем бронирование</b>

📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склад:</b> {warehouseName}
📅 <b>Дата:</b> {slotDate}
⏰ <b>Время:</b> {slotTime}
📊 <b>Коэффициент:</b> {coefficient}

⏳ <i>Ожидайте результат...</i>`,
    variables: ['supplyName', 'supplyId', 'warehouseName', 'slotDate', 'slotTime', 'coefficient'],
    isActive: true,
  },
  
  [NotificationType.BOOKING_SUCCESS]: {
    id: 'booking_success',
    name: 'Успешная бронь',
    type: NotificationType.BOOKING_SUCCESS,
    template: `✅ <b>Бронирование успешно!</b>

🎉 <b>Слот забронирован</b>
📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склад:</b> {warehouseName}
📅 <b>Дата:</b> {slotDate}
⏰ <b>Время:</b> {slotTime}
📊 <b>Коэффициент:</b> {coefficient}
🆔 <b>ID бронирования:</b> {bookingId}

⏱️ <b>Время выполнения:</b> {executionTime}с
📋 <b>Задача:</b> {taskName}

🎯 <i>Отлично! Слот зарезервирован для вас.</i>`,
    variables: ['supplyName', 'supplyId', 'warehouseName', 'slotDate', 'slotTime', 'coefficient', 'bookingId', 'executionTime', 'taskName'],
    isActive: true,
  },
  
  [NotificationType.BOOKING_ERROR]: {
    id: 'booking_error',
    name: 'Ошибка бронирования',
    type: NotificationType.BOOKING_ERROR,
    template: `❌ <b>Ошибка бронирования</b>

📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склад:</b> {warehouseName}
📅 <b>Дата:</b> {slotDate}
⏰ <b>Время:</b> {slotTime}
📊 <b>Коэффициент:</b> {coefficient}

🚨 <b>Ошибка:</b> {errorMessage}

⏱️ <b>Время выполнения:</b> {executionTime}с
📋 <b>Задача:</b> {taskName}

🔄 <i>Попробуем еще раз через некоторое время...</i>`,
    variables: ['supplyName', 'supplyId', 'warehouseName', 'slotDate', 'slotTime', 'coefficient', 'errorMessage', 'executionTime', 'taskName'],
    isActive: true,
  },
  
  [NotificationType.BOOKING_CAPTCHA]: {
    id: 'booking_captcha',
    name: 'Нужен ввод капчи',
    type: NotificationType.BOOKING_CAPTCHA,
    template: `🤖 <b>Требуется ввод капчи</b>

📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склад:</b> {warehouseName}
📅 <b>Дата:</b> {slotDate}
⏰ <b>Время:</b> {slotTime}
📊 <b>Коэффициент:</b> {coefficient}

🔐 <b>Капча обнаружена</b>
⏳ <b>Статус:</b> Ожидание решения капчи

📋 <b>Задача:</b> {taskName}

⚠️ <i>Пожалуйста, решите капчу в браузере для продолжения бронирования.</i>`,
    variables: ['supplyName', 'supplyId', 'warehouseName', 'slotDate', 'slotTime', 'coefficient', 'taskName'],
    isActive: true,
  },
  
  [NotificationType.TASK_STARTED]: {
    id: 'task_started',
    name: 'Задача запущена',
    type: NotificationType.TASK_STARTED,
    template: `🚀 <b>Задача запущена</b>

📋 <b>Название:</b> {taskName}
📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склады:</b> {warehouseNames}
📊 <b>Коэффициенты:</b> {coefficientMin} - {coefficientMax}
📅 <b>Период:</b> {dateFrom} - {dateTo}

⏳ <i>Начинаем поиск слотов...</i>`,
    variables: ['taskName', 'supplyName', 'supplyId', 'warehouseNames', 'coefficientMin', 'coefficientMax', 'dateFrom', 'dateTo'],
    isActive: true,
  },
  
  [NotificationType.TASK_COMPLETED]: {
    id: 'task_completed',
    name: 'Задача завершена',
    type: NotificationType.TASK_COMPLETED,
    template: `✅ <b>Задача завершена</b>

📋 <b>Название:</b> {taskName}
📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склады:</b> {warehouseNames}

📊 <b>Результаты:</b>
• Найдено слотов: {foundSlots}
• Успешных бронирований: {successfulBookings}
• Ошибок: {errors}
⏱️ <b>Время выполнения:</b> {executionTime}

🎯 <i>Задача выполнена успешно!</i>`,
    variables: ['taskName', 'supplyName', 'supplyId', 'warehouseNames', 'foundSlots', 'successfulBookings', 'errors', 'executionTime'],
    isActive: true,
  },
  
  [NotificationType.TASK_FAILED]: {
    id: 'task_failed',
    name: 'Задача провалена',
    type: NotificationType.TASK_FAILED,
    template: `❌ <b>Задача провалена</b>

📋 <b>Название:</b> {taskName}
📦 <b>Поставка:</b> {supplyName} ({supplyId})
🏢 <b>Склады:</b> {warehouseNames}

🚨 <b>Ошибка:</b> {errorMessage}

📊 <b>Результаты:</b>
• Найдено слотов: {foundSlots}
• Успешных бронирований: {successfulBookings}
• Ошибок: {errors}
⏱️ <b>Время выполнения:</b> {executionTime}

🔄 <i>Попробуйте запустить задачу заново.</i>`,
    variables: ['taskName', 'supplyName', 'supplyId', 'warehouseNames', 'errorMessage', 'foundSlots', 'successfulBookings', 'errors', 'executionTime'],
    isActive: true,
  },
  
  [NotificationType.SYSTEM_ERROR]: {
    id: 'system_error',
    name: 'Системная ошибка',
    type: NotificationType.SYSTEM_ERROR,
    template: `🚨 <b>Системная ошибка</b>

📋 <b>Компонент:</b> {component}
🚨 <b>Ошибка:</b> {errorMessage}
⏰ <b>Время:</b> {timestamp}

📊 <b>Детали:</b>
{errorDetails}

⚠️ <i>Обратитесь к администратору для решения проблемы.</i>`,
    variables: ['component', 'errorMessage', 'timestamp', 'errorDetails'],
    isActive: true,
  },
};
