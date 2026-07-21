# Руководство по миграции на унифицированную архитектуру

## Обзор изменений

Данное руководство описывает процесс миграции с существующей архитектуры на новую унифицированную архитектуру сервисов, которая решает проблемы дублирования кода, нарушений принципов SOLID и избыточной сложности.

## Основные изменения

### 1. Новая архитектура сервисов

#### До (проблемы):
- ❌ Множественные реализации одной функциональности (4+ auto-booking сервиса, 3+ slot search сервиса, 3+ Telegram сервиса)
- ❌ Нарушение DRY принципа
- ❌ Нарушение SOLID принципов (особенно SRP)
- ❌ Избыточная сложность архитектуры
- ❌ Низкое покрытие тестами

#### После (решения):
- ✅ Унифицированные сервисы с единым интерфейсом
- ✅ Соблюдение DRY принципа
- ✅ Соблюдение SOLID принципов
- ✅ Упрощенная архитектура
- ✅ Высокое покрытие тестами

### 2. Новые компоненты

#### Core компоненты:
- `IService` - базовый интерфейс для всех сервисов
- `IConfigurableService<T>` - интерфейс для сервисов с типизированной конфигурацией
- `IMonitorableService` - интерфейс для мониторинга сервисов
- `IRetryableService` - интерфейс для сервисов с retry логикой
- `BaseServiceWithAllFeatures<T>` - базовый класс с полным функционалом
- `ServiceFactory` - фабрика для создания сервисов
- `ServiceRegistry` - реестр для управления сервисами

#### Unified сервисы:
- `UnifiedAutoBookingService` - унифицированный сервис автобронирования
- `UnifiedNotificationService` - унифицированный сервис уведомлений
- `UnifiedSlotSearchService` - унифицированный сервис поиска слотов

## Пошаговая миграция

### Шаг 1: Установка новых зависимостей

Убедитесь, что все необходимые зависимости установлены:

```bash
npm install
```

### Шаг 2: Импорт новых компонентов

```typescript
// Импорт core компонентов
import {
  createService,
  createAndStartService,
  serviceRegistry,
  BaseServiceWithAllFeatures,
  IService,
  IConfigurableService,
  IMonitorableService,
  IRetryableService
} from '@/lib/services/core';

// Импорт unified сервисов
import {
  UnifiedAutoBookingService,
  UnifiedNotificationService,
  UnifiedSlotSearchService
} from '@/lib/services/unified';
```

### Шаг 3: Замена существующих сервисов

#### Замена AutoBookingService

**До:**
```typescript
import { AutoBookingService } from '@/lib/services/auto-booking-service';

const autoBookingService = new AutoBookingService();
await autoBookingService.initialize();
await autoBookingService.start();
```

**После:**
```typescript
import { createAndStartService } from '@/lib/services/core';

const autoBookingService = await createAndStartService('UnifiedAutoBookingService', {
  taskId: 'task-123',
  userId: 'user-123',
  enableAntibot: true,
  enableHumanBehavior: true
});
```

#### Замена TelegramService

**До:**
```typescript
import { TelegramService } from '@/lib/services/telegram-service';

const telegramService = new TelegramService();
await telegramService.sendNotification(userId, message);
```

**После:**
```typescript
import { createAndStartService } from '@/lib/services/core';

const notificationService = await createAndStartService('UnifiedNotificationService', {
  enableTelegram: true,
  enableEmail: false,
  enableSms: false
});

await notificationService.sendNotification({
  userId,
  message,
  type: 'TELEGRAM'
});
```

#### Замена SlotSearchService

**До:**
```typescript
import { SlotSearchService } from '@/lib/services/slot-search-service';

const slotSearchService = new SlotSearchService();
const result = await slotSearchService.searchSlots(config);
```

**После:**
```typescript
import { createAndStartService } from '@/lib/services/core';

const slotSearchService = await createAndStartService('UnifiedSlotSearchService', {
  enableAutoBooking: true,
  maxRetries: 3,
  retryDelay: 1000
});

const result = await slotSearchService.searchSlots({
  userId: 'user-123',
  warehouseId: 1,
  boxTypeId: 1,
  date: '2024-01-15',
  coefficient: 1.5
});
```

### Шаг 4: Обновление конфигурации

#### Новая структура конфигурации

```typescript
// Конфигурация для UnifiedAutoBookingService
interface AutoBookingConfig {
  taskId: string;
  userId: string;
  enableAntibot: boolean;
  enableHumanBehavior: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

// Конфигурация для UnifiedNotificationService
interface NotificationConfig {
  enableTelegram: boolean;
  enableEmail: boolean;
  enableSms: boolean;
  telegramBotToken?: string;
  emailConfig?: EmailConfig;
  smsConfig?: SmsConfig;
}

// Конфигурация для UnifiedSlotSearchService
interface SlotSearchConfig {
  enableAutoBooking: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  autoBookSupplyId?: string;
}
```

### Шаг 5: Обновление обработки ошибок

#### Новая система обработки ошибок

```typescript
import { ErrorHandler, ErrorFactory } from '@/lib/services/core';

try {
  const result = await service.performOperation();
} catch (error) {
  const appError = ErrorFactory.createFromError(error);
  ErrorHandler.handle(appError);
}
```

### Шаг 6: Обновление мониторинга

#### Новые возможности мониторинга

```typescript
// Получение статуса сервиса
const status = service.getStatus();
const health = service.getHealth();
const metrics = service.getMetrics();

// Получение статуса реестра
const registryStatus = serviceRegistry.getRegistryStatus();
const unhealthyServices = serviceRegistry.getUnhealthyServices();
```

### Шаг 7: Обновление тестов

#### Новые тесты для unified сервисов

```typescript
import { UnifiedAutoBookingService } from '@/lib/services/unified';

describe('UnifiedAutoBookingService', () => {
  let service: UnifiedAutoBookingService;

  beforeEach(async () => {
    service = new UnifiedAutoBookingService();
    await service.initialize();
  });

  afterEach(async () => {
    await service.stop();
  });

  it('should book slot successfully', async () => {
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

    expect(result.success).toBe(true);
  });
});
```

## Преимущества новой архитектуры

### 1. Устранение дублирования кода
- Единые интерфейсы для всех сервисов
- Общая базовая функциональность в `BaseServiceWithAllFeatures`
- Централизованная обработка ошибок и логирование

### 2. Соблюдение SOLID принципов
- **SRP**: Каждый сервис имеет одну ответственность
- **OCP**: Легко расширяется через наследование и композицию
- **LSP**: Все сервисы взаимозаменяемы через общие интерфейсы
- **ISP**: Интерфейсы разделены по функциональности
- **DIP**: Зависимости инвертированы через интерфейсы

### 3. Упрощение архитектуры
- Единая точка входа через `ServiceFactory`
- Централизованное управление через `ServiceRegistry`
- Стандартизированные конфигурации и интерфейсы

### 4. Улучшение тестируемости
- Мокирование через интерфейсы
- Изолированное тестирование компонентов
- Автоматические тесты для базовой функциональности

## Обратная совместимость

### Временная поддержка старых сервисов

Для плавной миграции старые сервисы будут поддерживаться в течение переходного периода:

```typescript
// Старый способ (deprecated)
import { AutoBookingService } from '@/lib/services/auto-booking-service';

// Новый способ (рекомендуется)
import { createAndStartService } from '@/lib/services/core';
```

### Предупреждения о deprecated API

Все старые сервисы будут помечены как deprecated с предупреждениями в консоли:

```typescript
console.warn('AutoBookingService is deprecated. Use UnifiedAutoBookingService instead.');
```

## План миграции по этапам

### Этап 1: Подготовка (1-2 недели)
- [ ] Установка новых зависимостей
- [ ] Создание тестов для новой архитектуры
- [ ] Документирование изменений

### Этап 2: Миграция core компонентов (2-3 недели)
- [ ] Миграция базовых сервисов
- [ ] Обновление фабрики и реестра
- [ ] Тестирование core функциональности

### Этап 3: Миграция unified сервисов (3-4 недели)
- [ ] Миграция AutoBookingService
- [ ] Миграция NotificationService
- [ ] Миграция SlotSearchService
- [ ] Интеграционное тестирование

### Этап 4: Финальная миграция (1-2 недели)
- [ ] Удаление старых сервисов
- [ ] Обновление документации
- [ ] Финальное тестирование

## Поддержка и помощь

### Документация
- `UNIFIED_ARCHITECTURE_GUIDE.md` - подробное руководство по архитектуре
- `SERVICES_IDENTIFICATION_REPORT.md` - отчет о выявленных проблемах
- `PROJECT_COMPLETE_SUMMARY.md` - обзор проекта

### Примеры использования
- `src/examples/unified-services-example.ts` - примеры использования
- `src/__tests__/unit/unified-services.test.ts` - тесты

### Контакты
При возникновении вопросов или проблем обращайтесь к команде разработки.

## Заключение

Новая унифицированная архитектура решает все выявленные проблемы качества кода:
- ✅ Устранено дублирование кода
- ✅ Соблюдается DRY принцип
- ✅ Соблюдаются SOLID принципы
- ✅ Упрощена архитектура
- ✅ Улучшено покрытие тестами

Миграция должна проводиться поэтапно с тщательным тестированием на каждом этапе.
