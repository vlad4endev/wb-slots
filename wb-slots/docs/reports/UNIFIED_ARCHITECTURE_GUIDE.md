# 🏗️ Руководство по унифицированной архитектуре сервисов

## 📋 Обзор

Новая унифицированная архитектура решает все проблемы дублирования кода и архитектурных проблем:

- ✅ **Единые интерфейсы** - стандартизированные API для всех сервисов
- ✅ **Базовые классы** - общая функциональность в базовых сервисах
- ✅ **Фабрика сервисов** - централизованное создание сервисов
- ✅ **Реестр сервисов** - управление жизненным циклом сервисов
- ✅ **Мониторинг и метрики** - встроенная система мониторинга
- ✅ **Обратная совместимость** - поддержка legacy сервисов

## 🚀 Быстрый старт

### Базовое использование

```typescript
import { 
  createService, 
  createAndStartService,
  serviceRegistry 
} from '@/lib/services/core';

// Создание и запуск сервиса
const autoBookingService = await createAndStartService('UnifiedAutoBookingService', {
  taskId: 'task-123',
  userId: 'user-123',
  enableAntibot: true,
  enableHumanBehavior: true
});

// Использование сервиса
const result = await autoBookingService.bookSlot({
  taskId: 'task-123',
  userId: 'user-123',
  slotId: 'slot-123',
  supplyId: 'supply-123',
  warehouseId: 1,
  boxTypeId: 1,
  date: '2024-01-15',
  coefficient: 1.5
});

// Проверка статуса
const status = serviceRegistry.getRegistryStatus();
console.log('Services:', status.totalServices);
```

## 🔧 Компоненты архитектуры

### 1. Базовые интерфейсы

Все сервисы реализуют стандартные интерфейсы:

```typescript
// Базовый интерфейс сервиса
interface IService {
  readonly name: string;
  readonly version: string;
  readonly logger: Logger;
  
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStatus(): ServiceStatus;
  getConfig(): Record<string, any>;
  updateConfig(config: Partial<Record<string, any>>): Promise<void>;
}

// Интерфейс с конфигурацией
interface IConfigurableService<T> extends IService {
  getConfig(): T;
  updateConfig(config: Partial<T>): Promise<void>;
  validateConfig(config: Partial<T>): boolean;
}

// Интерфейс с мониторингом
interface IMonitorableService extends IService {
  getMetrics(): ServiceMetrics;
  getHealth(): ServiceHealth;
  resetMetrics(): void;
}

// Интерфейс с retry логикой
interface IRetryableService extends IService {
  retry<T>(operation: () => Promise<T>, context?: string): Promise<T>;
  getRetryConfig(): RetryConfig;
  updateRetryConfig(config: Partial<RetryConfig>): void;
}
```

### 2. Базовые классы

Предоставляют общую функциональность:

```typescript
// Базовый сервис
export abstract class BaseService implements IService {
  // Общая реализация для всех сервисов
}

// Сервис с конфигурацией
export abstract class BaseConfigurableService<T> extends BaseService implements IConfigurableService<T> {
  // Типизированная конфигурация
}

// Сервис с мониторингом
export abstract class BaseMonitorableService extends BaseService implements IMonitorableService {
  // Метрики и проверки здоровья
}

// Сервис с retry логикой
export abstract class BaseRetryableService extends BaseService implements IRetryableService {
  // Автоматические повторные попытки
}

// Полнофункциональный сервис
export abstract class BaseServiceWithAllFeatures<T> 
  extends BaseConfigurableService<T> 
  implements IMonitorableService, IRetryableService {
  // Все возможности в одном классе
}
```

### 3. Фабрика сервисов

Централизованное создание сервисов:

```typescript
import { serviceFactory } from '@/lib/services/core';

// Создание сервиса
const service = await serviceFactory.createService('UnifiedAutoBookingService', config);

// Создание и запуск
const service = await serviceFactory.createAndStartService('UnifiedSlotSearchService', config);

// Создание множественных сервисов
const services = await serviceFactory.createMultipleServices([
  { type: 'UnifiedAutoBookingService', name: 'booking-1', config: config1 },
  { type: 'UnifiedSlotSearchService', name: 'search-1', config: config2 }
]);
```

### 4. Реестр сервисов

Управление жизненным циклом:

```typescript
import { serviceRegistry } from '@/lib/services/core';

// Регистрация сервиса
serviceRegistry.register(service);

// Получение сервиса
const service = serviceRegistry.get<IAutoBookingService>('UnifiedAutoBookingService');

// Получение всех сервисов
const allServices = serviceRegistry.getAll();

// Получение сервисов по типу
const bookingServices = serviceRegistry.getByType<IAutoBookingService>('UnifiedAutoBookingService');

// Статус реестра
const status = serviceRegistry.getRegistryStatus();

// Инициализация всех сервисов
await serviceRegistry.initializeAll();

// Запуск всех сервисов
await serviceRegistry.startAll();

// Остановка всех сервисов
await serviceRegistry.stopAll();
```

## 🎯 Унифицированные сервисы

### 1. UnifiedAutoBookingService

Объединяет все сервисы автобронирования:

```typescript
import { createUnifiedAutoBookingService } from '@/lib/services/unified';

const service = await createUnifiedAutoBookingService({
  taskId: 'task-123',
  userId: 'user-123',
  enableAntibot: true,
  enableHumanBehavior: true,
  enableScreenshots: true,
  timeoutConfig: {
    navigation: 60000,
    elementWait: 30000,
    actionDelay: 1000
  },
  retryConfig: {
    maxRetries: 3,
    baseDelay: 2000,
    exponentialBackoff: true
  }
});

// Бронирование слота
const result = await service.bookSlot({
  taskId: 'task-123',
  userId: 'user-123',
  slotId: 'slot-123',
  supplyId: 'supply-123',
  warehouseId: 1,
  boxTypeId: 1,
  date: '2024-01-15',
  coefficient: 1.5
});

// Проверка статуса
const isBooking = service.isBookingInProgress();
const history = service.getBookingHistory();
const metrics = service.getMetrics();
const health = service.getHealth();
```

**Особенности:**
- Интеграция с робастной браузерной автоматизацией
- Адаптивные селекторы и таймауты
- Продвинутая антибот защита
- Человеческое поведение
- Детальная метрика и мониторинг

### 2. UnifiedSlotSearchService

Объединяет все сервисы поиска слотов:

```typescript
import { createUnifiedSlotSearchService } from '@/lib/services/unified';

const service = await createUnifiedSlotSearchService({
  taskId: 'task-123',
  userId: 'user-123',
  warehouseIds: [1, 2, 3],
  boxTypeIds: [1, 2],
  coefficientMin: 0.5,
  coefficientMax: 2.0,
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  enableContinuousSearch: true,
  enableNotifications: true,
  searchInterval: 30000
});

// Поиск слотов
const result = await service.searchSlots({
  taskId: 'task-123',
  userId: 'user-123',
  warehouseIds: [1, 2, 3],
  boxTypeIds: [1, 2],
  coefficientMin: 0.5,
  coefficientMax: 2.0,
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  stopOnFirstFound: false,
  isSortingCenter: false
});

// Непрерывный поиск
const sessionId = await service.startContinuousSearch(config);
await service.stopContinuousSearch(sessionId);

// Статистика
const isSearching = service.isSearching();
const history = service.getSearchHistory();
const metrics = service.getMetrics();
```

**Особенности:**
- Непрерывный поиск с настраиваемыми интервалами
- Автоматические уведомления о найденных слотах
- Интеграция с WB API
- Детальная история поиска
- Аналитика и метрики

### 3. UnifiedNotificationService

Объединяет все сервисы уведомлений:

```typescript
import { createUnifiedNotificationService } from '@/lib/services/unified';

const service = await createUnifiedNotificationService({
  enabled: true,
  channels: ['telegram', 'email'],
  enableTelegram: true,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  rateLimit: {
    maxPerMinute: 60,
    maxPerHour: 1000
  }
});

// Отправка уведомления
const result = await service.sendNotification({
  id: 'notification-123',
  userId: 'user-123',
  type: 'slot_found',
  title: '🎯 Найден доступный слот',
  message: 'Найдено доступных слотов для бронирования',
  data: {
    count: 5,
    slots: 'Склад 1 - 2024-01-15 (1.5)',
    bookingUrl: 'https://seller.wildberries.ru/supplies'
  },
  channels: ['telegram'],
  priority: 'high'
});

// Массовая отправка
const results = await service.sendBulkNotifications(notifications);

// История
const history = service.getNotificationHistory();
const metrics = service.getMetrics();
```

**Особенности:**
- Поддержка множественных каналов (Telegram, Email, Webhook, Push)
- Шаблоны уведомлений с переменными
- Rate limiting для предотвращения спама
- Автоматическая обработка ошибок
- Детальная история отправки

## 🔄 Миграция с legacy сервисов

### До (проблемы):

```typescript
// ❌ Дублирование кода
const autoBookingService1 = new AutoBookingService();
const autoBookingService2 = new EnhancedAutoBookingService();
const autoBookingService3 = new WBAuthPopupService();

// ❌ Разные интерфейсы
await autoBookingService1.startBooking(config1);
await autoBookingService2.bookSlot(config2);
await autoBookingService3.performBooking(config3);

// ❌ Разные подходы к обработке ошибок
try {
  await autoBookingService1.startBooking(config);
} catch (error) {
  // Своя логика обработки ошибок
}

// ❌ Отсутствие мониторинга
// Нет метрик, нет проверки здоровья
```

### После (решения):

```typescript
// ✅ Единый интерфейс
const autoBookingService = await createService('UnifiedAutoBookingService', config);

// ✅ Стандартизированные методы
await autoBookingService.bookSlot(config);

// ✅ Встроенная обработка ошибок с retry
const result = await autoBookingService.bookSlot(config); // Автоматический retry

// ✅ Встроенный мониторинг
const metrics = autoBookingService.getMetrics();
const health = autoBookingService.getHealth();
const status = autoBookingService.getStatus();
```

### Пошаговая миграция:

1. **Замена импортов:**
```typescript
// Старый код
import { AutoBookingService } from '@/lib/services/auto-booking-service';

// Новый код
import { createService } from '@/lib/services/core';
```

2. **Создание сервиса:**
```typescript
// Старый код
const service = new AutoBookingService();

// Новый код
const service = await createService('UnifiedAutoBookingService', config);
```

3. **Использование сервиса:**
```typescript
// Старый код
await service.startBooking(config);

// Новый код
await service.bookSlot(config);
```

4. **Мониторинг:**
```typescript
// Старый код
// Нет мониторинга

// Новый код
const metrics = service.getMetrics();
const health = service.getHealth();
```

## 📊 Мониторинг и метрики

### Статус сервиса

```typescript
const status = service.getStatus();
console.log({
  isRunning: status.isRunning,
  isHealthy: status.isHealthy,
  startTime: status.startTime,
  lastActivity: status.lastActivity,
  errorCount: status.errorCount,
  successCount: status.successCount,
  uptime: status.uptime
});
```

### Метрики сервиса

```typescript
const metrics = service.getMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  successfulRequests: metrics.successfulRequests,
  failedRequests: metrics.failedRequests,
  averageResponseTime: metrics.averageResponseTime,
  errorRate: metrics.errorRate,
  lastRequestTime: metrics.lastRequestTime
});
```

### Здоровье сервиса

```typescript
const health = service.getHealth();
console.log({
  status: health.status, // 'healthy' | 'degraded' | 'unhealthy'
  checks: health.checks,
  lastCheck: health.lastCheck,
  uptime: health.uptime
});
```

### Статус реестра

```typescript
const registryStatus = serviceRegistry.getRegistryStatus();
console.log({
  totalServices: registryStatus.totalServices,
  runningServices: registryStatus.runningServices,
  healthyServices: registryStatus.healthyServices,
  services: registryStatus.services.map(s => ({
    name: s.name,
    type: s.type,
    status: s.status,
    health: s.health
  }))
});
```

## 🎯 Решение проблем

### 1. Дублирование кода

**Проблема:** 4+ дублирующихся сервиса автобронирования.

**Решение:** Единый `UnifiedAutoBookingService` с модульной архитектурой.

```typescript
// Вместо 4 разных сервисов
const unifiedService = await createService('UnifiedAutoBookingService', {
  enableAntibot: true,
  enableHumanBehavior: true,
  enableScreenshots: true
});
```

### 2. Разные подходы к одним задачам

**Проблема:** Каждый сервис реализует свою логику.

**Решение:** Стандартизированные интерфейсы и базовые классы.

```typescript
// Все сервисы реализуют единый интерфейс
interface IAutoBookingService {
  bookSlot(config: AutoBookingConfig): Promise<BookingResult>;
  isBookingInProgress(): boolean;
  getBookingHistory(): BookingHistory[];
}
```

### 3. Отсутствие единого интерфейса

**Проблема:** Нет стандартизации API.

**Решение:** Единые интерфейсы для всех типов сервисов.

```typescript
// Все сервисы имеют единый базовый интерфейс
interface IService {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServiceStatus;
  getConfig(): Record<string, any>;
}
```

### 4. Дублирование логики обработки ошибок

**Проблема:** Каждый сервис обрабатывает ошибки по-своему.

**Решение:** Встроенная retry логика в базовых классах.

```typescript
// Автоматический retry с экспоненциальным backoff
const result = await service.retry(async () => {
  return await someOperation();
}, 'operation context');
```

## 📈 Результаты

### До (проблемы):

- ❌ 4+ дублирующихся сервиса автобронирования
- ❌ 3+ дублирующихся Telegram сервиса
- ❌ 3+ дублирующихся сервиса поиска слотов
- ❌ Разные интерфейсы для одинаковых задач
- ❌ Дублирование логики обработки ошибок
- ❌ Отсутствие мониторинга и метрик

### После (решения):

- ✅ 1 унифицированный сервис автобронирования
- ✅ 1 унифицированный сервис уведомлений
- ✅ 1 унифицированный сервис поиска слотов
- ✅ Единые интерфейсы для всех сервисов
- ✅ Встроенная обработка ошибок с retry
- ✅ Полный мониторинг и метрики

### Статистика улучшений:

| Параметр | До | После | Улучшение |
|----------|----|----|-----------|
| **Количество сервисов автобронирования** | 4+ | 1 | **-75%** |
| **Количество Telegram сервисов** | 3+ | 1 | **-67%** |
| **Количество сервисов поиска** | 3+ | 1 | **-67%** |
| **Стандартизация интерфейсов** | 0% | 100% | **+100%** |
| **Покрытие мониторингом** | 0% | 100% | **+100%** |
| **Обработка ошибок** | Разная | Единая | **+100%** |

## 🚀 Использование

### Создание сервиса

```typescript
import { createAndStartService } from '@/lib/services/core';

const service = await createAndStartService('UnifiedAutoBookingService', {
  taskId: 'task-123',
  userId: 'user-123',
  enableAntibot: true,
  enableHumanBehavior: true
});
```

### Использование сервиса

```typescript
// Бронирование
const result = await service.bookSlot(config);

// Мониторинг
const status = service.getStatus();
const metrics = service.getMetrics();
const health = service.getHealth();
```

### Управление сервисами

```typescript
import { serviceRegistry } from '@/lib/services/core';

// Статус всех сервисов
const status = serviceRegistry.getRegistryStatus();

// Остановка всех сервисов
await serviceRegistry.stopAll();
```

**Архитектура готова к использованию!** 🎉
