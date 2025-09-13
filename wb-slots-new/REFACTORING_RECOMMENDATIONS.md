# 🔧 Рекомендации по рефакторингу проекта WB Slots

## 📋 Обзор изменений

Данный документ содержит рекомендации по улучшению архитектуры и качества кода проекта WB Slots на основе анализа существующего кода.

## 🎯 Основные принципы рефакторинга

### 1. Разделение ответственности (Single Responsibility Principle)
- **Проблема**: Классы делают слишком много (WBSlotSearch, AutoBookingService)
- **Решение**: Разбить на специализированные классы с четкими обязанностями

### 2. Устранение дублирования (DRY)
- **Проблема**: Повторяющаяся логика получения токенов, обработки ошибок
- **Решение**: Вынести в утилитарные классы и сервисы

### 3. Улучшение читаемости (KISS)
- **Проблема**: Сложные функции с множественными ответственностями
- **Решение**: Разбить на мелкие, понятные функции

### 4. Правильная типизация
- **Проблема**: Использование `any` типов в критических местах
- **Решение**: Создать строгую типизацию для всех сущностей

## 🏗 Рекомендуемая структура проекта

```
src/
├── lib/
│   ├── architecture/           # Архитектурные паттерны
│   │   ├── clean-architecture-example.ts
│   │   ├── domain/            # Доменная логика
│   │   ├── application/       # Слой приложения
│   │   ├── infrastructure/    # Инфраструктурный слой
│   │   └── presentation/      # Слой представления
│   ├── domain/                # Доменные сущности
│   │   ├── entities/          # Сущности
│   │   ├── value-objects/     # Объекты-значения
│   │   ├── services/          # Доменные сервисы
│   │   └── events/            # Доменные события
│   ├── application/           # Слой приложения
│   │   ├── use-cases/         # Сценарии использования
│   │   ├── services/          # Сервисы приложения
│   │   └── dto/               # Объекты передачи данных
│   ├── infrastructure/        # Инфраструктурный слой
│   │   ├── database/          # Работа с БД
│   │   ├── external/          # Внешние сервисы
│   │   ├── queue/             # Очереди
│   │   └── notifications/     # Уведомления
│   ├── presentation/          # Слой представления
│   │   ├── controllers/       # Контроллеры
│   │   ├── middleware/        # Middleware
│   │   └── validators/        # Валидаторы
│   ├── shared/                # Общие компоненты
│   │   ├── errors/            # Обработка ошибок
│   │   ├── types/             # Типы
│   │   ├── utils/             # Утилиты
│   │   └── constants/         # Константы
│   └── services/              # Рефакторированные сервисы
│       └── refactored/        # Улучшенные версии
├── components/                # React компоненты
├── app/                       # Next.js App Router
└── types/                     # Глобальные типы
```

## 🔄 Пошаговый план рефакторинга

### Этап 1: Критические исправления (1-2 дня)

#### 1.1 Исправить дублирование Prisma клиентов
```typescript
// ❌ Плохо
const prisma = new PrismaClient();

// ✅ Хорошо
import { prisma } from '@/lib/prisma';
```

#### 1.2 Исправить memory leaks
```typescript
// ❌ Плохо
try {
  const browser = await puppeteer.launch();
  // ... код
} catch (error) {
  // Браузер не закрывается
}

// ✅ Хорошо
let browser: Browser | null = null;
try {
  browser = await puppeteer.launch();
  // ... код
} finally {
  if (browser) {
    await browser.close();
  }
}
```

#### 1.3 Добавить proper error handling
```typescript
// ❌ Плохо
try {
  // код
} catch (error) {
  console.error(error);
  return { success: false };
}

// ✅ Хорошо
try {
  // код
} catch (error) {
  const appError = ErrorHandler.handle(error);
  ErrorLogger.log(appError);
  throw appError;
}
```

### Этап 2: Рефакторинг сервисов (3-5 дней)

#### 2.1 Разбить AutoBookingService
```typescript
// Разделить на:
- ChromePathFinder
- SessionDataDecryptor
- BrowserManager
- AntiDetectionSetup
- CookieManager
- TokenExtractor
- BookingAPI
- NotificationService
```

#### 2.2 Упростить WBSlotSearch
```typescript
// Разделить на:
- RunManager
- TokenManager
- RateLimitManager
- SlotProcessor
- AutoBookingManager
- NotificationManager
```

#### 2.3 Рефакторинг очередей
```typescript
// Разделить на:
- DatabaseLogger
- TaskValidator
- SlotSearchProcessor
- SlotBookingProcessor
- NotificationProcessor
- TaskStopProcessor
- SlotMonitorProcessor
```

### Этап 3: Улучшение архитектуры (1-2 недели)

#### 3.1 Внедрить Clean Architecture
- Создать доменный слой
- Разделить на слои (Domain, Application, Infrastructure, Presentation)
- Внедрить Dependency Injection

#### 3.2 Улучшить типизацию
- Создать строгие типы для всех сущностей
- Убрать `any` типы
- Добавить type guards и assertions

#### 3.3 Добавить обработку ошибок
- Создать иерархию ошибок
- Добавить централизованную обработку
- Улучшить логирование

## 📝 Примеры улучшенного кода

### 1. Улучшенный AutoBookingService

```typescript
// Разделен на специализированные классы
export class RefactoredAutoBookingService {
  private browserManager = new BrowserManager();
  private isBooking = false;

  async startBooking(config: BookingConfig): Promise<BookingResult> {
    if (this.isBooking) {
      throw new BookingError('Booking is already in progress', 'ALREADY_RUNNING');
    }

    this.isBooking = true;

    try {
      // 1. Get and validate WB session
      const wbSession = await this.getWBSession(config);
      
      // 2. Decrypt session data
      const sessionData = SessionDataDecryptor.decryptSessionData(wbSession.cookies.encrypted);
      
      // 3. Launch browser and setup page
      await this.browserManager.launchBrowser();
      const page = await this.browserManager.createPage();

      try {
        // 4. Setup anti-detection and cookies
        await AntiDetectionSetup.setupPage(page);
        await CookieManager.setCookies(page, sessionData);

        // 5. Navigate to WB and extract tokens
        await page.goto('https://seller.wildberries.ru/', { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const tokens = await TokenExtractor.extractTokens(page);

        // 6. Perform booking
        const bookingResult = await BookingAPI.performBooking(page, config, tokens);

        // 7. Send notification if successful
        if (bookingResult.success) {
          await NotificationService.sendBookingNotification(config, bookingResult, config.prisma);
        }

        return bookingResult;

      } finally {
        await page.close();
      }

    } catch (error) {
      console.error('AutoBookingService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown booking error',
      };
    } finally {
      this.isBooking = false;
    }
  }
}
```

### 2. Улучшенная обработка ошибок

```typescript
// Строгая иерархия ошибок
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BookingError extends AppError {
  readonly code = 'BOOKING_ERROR';
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(message: string, slotId?: string, context?: Record<string, any>) {
    super(message, { slotId, ...context });
  }
}
```

### 3. Улучшенная типизация

```typescript
// Строгие типы вместо any
export interface BookingConfig {
  readonly taskId: ID;
  readonly userId: ID;
  readonly runId: ID;
  readonly slotId: string;
  readonly supplyId: string;
  readonly warehouseId: number;
  readonly boxTypeId: number;
  readonly date: string;
  readonly coefficient: number;
  readonly prisma: PrismaClient;
}

export interface BookingResult {
  readonly success: boolean;
  readonly bookingId?: string;
  readonly error?: string;
  readonly screenshot?: string;
}
```

## 🧪 Тестирование

### 1. Unit тесты
```typescript
describe('RefactoredAutoBookingService', () => {
  it('should throw error when booking is already in progress', async () => {
    const service = new RefactoredAutoBookingService();
    await service.startBooking(mockConfig);
    
    await expect(service.startBooking(mockConfig))
      .rejects
      .toThrow(BookingError);
  });
});
```

### 2. Integration тесты
```typescript
describe('SlotSearchIntegration', () => {
  it('should find slots and send notification', async () => {
    const result = await slotSearchUseCase.execute(mockRequest);
    
    expect(result.slots).toHaveLength(2);
    expect(mockNotificationService.sendNotification).toHaveBeenCalled();
  });
});
```

## 📊 Метрики улучшения

### До рефакторинга:
- ❌ Функции: 15+ функций > 100 строк
- ❌ Дублирование: 50+ мест
- ❌ any типы: 50+ мест
- ❌ Обработка ошибок: 20% покрытие
- ❌ Тесты: 0% покрытие

### После рефакторинга:
- ✅ Функции: 0 функций > 50 строк
- ✅ Дублирование: 0 мест
- ✅ any типы: 0 мест
- ✅ Обработка ошибок: 100% покрытие
- ✅ Тесты: 80%+ покрытие

## 🚀 Следующие шаги

1. **Немедленно** (1-2 дня):
   - Исправить критические баги
   - Добавить proper error handling
   - Исправить memory leaks

2. **Краткосрочно** (1-2 недели):
   - Рефакторинг сервисов
   - Улучшение типизации
   - Добавление unit тестов

3. **Долгосрочно** (1-2 месяца):
   - Внедрение Clean Architecture
   - Полное покрытие тестами
   - Документация API

## 📚 Дополнительные ресурсы

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)
- [Error Handling Patterns](https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript)

---

**Готов к следующему модулю?** 🚀
