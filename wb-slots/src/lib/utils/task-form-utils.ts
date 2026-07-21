/**
 * Утилиты для форм создания задач
 */

import { DateRange } from '@/components/shared/date-presets';

export interface TaskFormData {
  name: string;
  description: string;
  autoBook: boolean;
  autoBookSupplyId: string;
  preorderID: string;
  filters: {
    coefficientMin: number;
    coefficientMax: number;
    warehouseIds: number[];
    boxTypeIds: number[];
    dates: DateRange;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  priority: number;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Валидация формы создания задачи
 */
export function validateTaskForm(formData: TaskFormData): FormValidationResult {
  const errors: string[] = [];

  // Проверка названия
  if (!formData.name || formData.name.trim().length === 0) {
    errors.push('Название задачи обязательно');
  }

  if (formData.name.trim().length > 100) {
    errors.push('Название задачи не должно превышать 100 символов');
  }

  // Проверка складов
  if (!formData.filters.warehouseIds || formData.filters.warehouseIds.length === 0) {
    errors.push('Выберите хотя бы один склад');
  }

  // Проверка типов поставки
  if (!formData.filters.boxTypeIds || formData.filters.boxTypeIds.length === 0) {
    errors.push('Выберите хотя бы один тип поставки');
  }

  // Проверка коэффициентов
  if (formData.filters.coefficientMin > formData.filters.coefficientMax) {
    errors.push('Минимальный коэффициент не может быть больше максимального');
  }

  if (formData.filters.coefficientMin < -10 || formData.filters.coefficientMin > 50) {
    errors.push('Минимальный коэффициент должен быть от -10 до 50');
  }

  if (formData.filters.coefficientMax < -10 || formData.filters.coefficientMax > 50) {
    errors.push('Максимальный коэффициент должен быть от -10 до 50');
  }

  // Проверка дат
  if (!formData.filters.dates.from || !formData.filters.dates.to) {
    errors.push('Укажите период поиска');
  } else {
    const fromDate = new Date(formData.filters.dates.from);
    const toDate = new Date(formData.filters.dates.to);

    if (fromDate >= toDate) {
      errors.push('Дата начала должна быть раньше даты окончания');
    }

    // Проверка, что даты не в прошлом
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (toDate < now) {
      errors.push('Дата окончания не может быть в прошлом');
    }

    // Проверка максимального периода (например, не более 3 месяцев)
    const maxDays = 90;
    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > maxDays) {
      errors.push(`Максимальный период поиска - ${maxDays} дней`);
    }
  }

  // Проверка автобронирования
  if (formData.autoBook && !formData.autoBookSupplyId) {
    errors.push('Укажите номер поставки для автобронирования');
  }

  // Проверка политики повторов
  if (formData.retryPolicy.maxRetries < 0 || formData.retryPolicy.maxRetries > 10) {
    errors.push('Количество повторов должно быть от 0 до 10');
  }

  if (formData.retryPolicy.backoffMs < 1000 || formData.retryPolicy.backoffMs > 60000) {
    errors.push('Задержка между повторами должна быть от 1 до 60 секунд');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Сохранение настроек формы в localStorage
 */
export function saveFormSettings(formData: Partial<TaskFormData>): void {
  try {
    const settings = {
      filters: formData.filters,
      retryPolicy: formData.retryPolicy,
      priority: formData.priority,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('task-form-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving form settings:', error);
  }
}

/**
 * Загрузка сохраненных настроек из localStorage
 */
export function loadFormSettings(): Partial<TaskFormData> | null {
  try {
    const saved = localStorage.getItem('task-form-settings');
    if (!saved) return null;

    const settings = JSON.parse(saved);
    
    // Проверяем, не устарели ли настройки (старше 30 дней)
    const savedAt = new Date(settings.savedAt);
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      localStorage.removeItem('task-form-settings');
      return null;
    }

    return settings;
  } catch (error) {
    console.error('Error loading form settings:', error);
    return null;
  }
}

/**
 * Создание шаблона задачи
 */
export function createTaskTemplate(name: string, description: string): Partial<TaskFormData> {
  return {
    name,
    description,
    filters: {
      coefficientMin: 0,
      coefficientMax: 20,
      warehouseIds: [],
      boxTypeIds: [2, 5],
      dates: {
        from: new Date().toISOString().slice(0, 16),
        to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      },
    },
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 5000,
    },
    priority: 4, // Максимальный приоритет по умолчанию
    autoBook: false,
    autoBookSupplyId: '',
    preorderID: '',
  };
}

/**
 * Популярные шаблоны задач
 */
export const TASK_TEMPLATES = [
  {
    id: 'urgent-moscow',
    name: 'Срочный поиск - Москва',
    description: 'Поиск слотов в Москве с низким коэффициентом',
    filters: {
      coefficientMin: 0,
      coefficientMax: 5,
      boxTypeIds: [2],
      warehouseIds: [130750], // Москва
    },
    priority: 4,
  },
  {
    id: 'standard-search',
    name: 'Стандартный поиск',
    description: 'Поиск по всем складам на месяц',
    filters: {
      coefficientMin: 0,
      coefficientMax: 20,
      boxTypeIds: [2, 5],
    },
    priority: 2,
  },
  {
    id: 'low-coefficient',
    name: 'Низкий коэффициент',
    description: 'Поиск только с низким коэффициентом приёмки',
    filters: {
      coefficientMin: 0,
      coefficientMax: 10,
      boxTypeIds: [2, 5],
    },
    priority: 3,
  },
];

/**
 * Форматирование данных формы для API
 */
export function formatTaskDataForAPI(formData: TaskFormData): any {
  return {
    name: formData.name.trim(),
    description: formData.description?.trim() || '',
    enabled: true,
    scheduleCron: '',
    priority: formData.priority,
    autoBook: formData.autoBook,
    autoBookSupplyId: formData.autoBook ? formData.autoBookSupplyId : '',
    preorderID: formData.autoBook ? formData.preorderID : '',
    filters: {
      ...formData.filters,
      allowUnload: true,
      dates: {
        from: new Date(formData.filters.dates.from).toISOString(),
        to: new Date(formData.filters.dates.to).toISOString(),
      },
    },
    retryPolicy: formData.retryPolicy,
  };
}

