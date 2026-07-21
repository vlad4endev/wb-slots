<!-- 2b1e60a8-e9f7-4830-a003-6c394572038b 881c5643-2796-4670-8c0d-efb6921fa819 -->
# План рефакторинга проекта WB Slots

## Общая стратегия

План разбит на 4 этапа, где каждый этап должен быть завершен перед переходом к следующему. Приоритет: безопасность → производительность → архитектура → качество.

---

## ЭТАП 1: Критические проблемы безопасности и баги (Высокий приоритет)

### 1.1 Исправление небезопасных fallback значений

**Файлы:**

- `src/middleware.ts:5`
- `src/lib/auth.ts:31,42`
- `src/lib/encryption.ts:14`

**Действия:**

1. Создать утилиту `src/lib/env.ts` для валидации переменных окружения
2. В продакшене выбрасывать ошибку, если `JWT_SECRET` не установлен
3. В продакшене выбрасывать ошибку, если `ENCRYPTION_KEY` не установлен
4. Добавить проверку на старте приложения

**Код:**

```typescript
// src/lib/env.ts
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value || '';
}
```

### 1.2 Удаление console.log из production кода

**Файлы:**

- `src/middleware.ts` (8+ console.log)
- `src/lib/auth.ts` (10+ console.log)
- `src/lib/encryption.ts` (10+ console.log)
- `src/workers/slot-search-worker.ts:34,83,87`
- Все файлы в `src/app/api/` с console.error

**Действия:**

1. Заменить все `console.log` на структурированный логгер из `src/lib/logging.ts`
2. Использовать условное логирование: `process.env.NODE_ENV === 'development'` для DEBUG
3. В middleware использовать только WARN и ERROR уровни

**Пример замены:**

```typescript
// Было:
console.log('Token found:', !!token);

// Стало:
import { logger } from '@/lib/logging';
if (process.env.NODE_ENV === 'development') {
  logger.debug({ tokenFound: !!token }, 'Token check in middleware');
}
```

### 1.3 Исправление критического бага с runId

**Файл:** `src/workers/slot-search-worker.ts:95`

**Исправление:**

```typescript
// Было:
await prisma.runLog.create({
  data: {
    runId: searchConfig.taskId, // ❌ Неправильно
    ...
  }
});

// Стало:
await prisma.runLog.create({
  data: {
    runId: run.id, // ✅ Правильно
    ...
  }
});
```

### 1.4 Исправление пустых catch блоков

**Файлы:**

- `src/lib/services/continuous-slot-search-service.ts:197`
- `src/lib/services/enhanced-auto-booking-service.ts:434`
- `src/lib/services/auto-booking-service.ts:434`

**Действия:**

Добавить логирование ошибок вместо пустых catch:

```typescript
} catch (error) {
  logger.warn({ error }, 'Failed to close page');
}
```

---

## ЭТАП 2: Оптимизация производительности и БД (Средний приоритет)

### 2.1 Добавление индексов в базу данных

**Файл:** `prisma/schema.prisma`

**Добавить индексы:**

```prisma
model Task {
  // ...
  @@index([userId, status])
  @@index([enabled, status])
  @@index([createdAt])
}

model Run {
  // ...
  @@index([taskId, status])
  @@index([userId, status])
  @@index([startedAt])
}

model UserToken {
  // ...
  @@index([userId, category, isActive])
}

model FoundSlot {
  // ...
  @@index([userId, runId])
  @@index([warehouseId, date])
}
```

**Действие:**

Создать миграцию: `npx prisma migrate dev --name add_performance_indexes`

### 2.2 Оптимизация запросов к БД

**Файлы:**

- `src/app/api/tasks/route.ts`
- `src/app/api/analytics/advanced/route.ts`
- Все endpoints с множественными запросами

**Действия:**

1. Использовать `include` для предзагрузки связей (частично уже есть)
2. Добавить пагинацию в `src/app/api/analytics/advanced/route.ts:61`
3. Использовать `$transaction` для связанных операций

**Пример:**

```typescript
// Добавить пагинацию
const runs = await prisma.run.findMany({
  where: { userId: user.id },
  take: limit,
  skip: (page - 1) * limit,
  orderBy: { startedAt: 'desc' },
  include: { task: true }
});
```

### 2.3 Кэширование расшифрованных токенов

**Файл:** `src/lib/encryption.ts`

**Действия:**

1. Интегрировать Redis для кэширования
2. Кэшировать расшифрованные токены с TTL 5 минут
3. Использовать в `getCurrentUser()` для избежания повторной расшифровки

**Создать:** `src/lib/cache/token-cache.ts`

---

## ЭТАП 3: Унификация кода и архитектуры (Средний приоритет)

### 3.1 Унификация обработки ошибок в API routes

**Файлы:** Все файлы в `src/app/api/*`

**Действия:**

1. Использовать существующий `createApiHandler` из `src/lib/errors/error-handling-middleware.ts`
2. Рефакторинг всех API endpoints по примеру `src/app/api/example-refactored/route.ts`
3. Удалить дублирующийся код обработки ошибок

**Пример применения:**

```typescript
// src/app/api/tasks/route.ts
import { createApiHandler } from '@/lib/errors/error-handling-middleware';

const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  // ... логика без try-catch
  return NextResponse.json({ success: true, data });
};

export const GET = createApiHandler(getHandler);
```

**Приоритетные файлы:**

- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/alerts/route.ts`
- `src/app/api/analytics/advanced/route.ts`

### 3.2 Добавление валидации во все API endpoints

**Действия:**

1. Проверить все endpoints на наличие Zod валидации
2. Добавить недостающие схемы в `src/lib/validation.ts`
3. Применить валидацию для query parameters и body

**Приоритетные endpoints:**

- `src/app/api/monitoring/performance/route.ts`
- `src/app/api/alerts/*`
- Все endpoints без валидации

### 3.3 Устранение использования типа `any`

**Приоритетные файлы:**

- `src/lib/services/continuous-slot-search-service.ts:118,261`
- `src/app/api/monitoring/performance/route.ts:64`
- `src/components/analytics/advanced-analytics-dashboard.tsx:185`

**Действия:**

1. Создать интерфейсы для типов
2. Заменить `any` на конкретные типы или `unknown` с проверками

**Пример:**

```typescript
// Создать src/types/metrics.ts
export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  // ...
}

// Заменить
function generateAlerts(metrics: PerformanceMetrics) {
  // ...
}
```

### 3.4 Разделение ответственности в сервисах

**Файл:** `src/lib/services/continuous-slot-search-service.ts`

**Действия:**

1. Выделить `SlotSearchService` - только поиск
2. Выделить `SlotStorageService` - сохранение в БД
3. Выделить `SlotNotificationService` - отправка уведомлений
4. Использовать паттерн Dependency Injection

---

## ЭТАП 4: Улучшение качества кода (Низкий приоритет)

### 4.1 Добавление JSDoc комментариев

**Действия:**

1. Добавить JSDoc для всех публичных функций
2. Добавить примеры использования для сложных функций

**Приоритетные файлы:**

- `src/lib/auth.ts`
- `src/lib/encryption.ts`
- Все сервисы в `src/lib/services/`

### 4.2 Реорганизация структуры проекта

**Действия:**

1. Создать `docs/reports/` и переместить все markdown отчеты
2. Создать `docs/guides/` для инструкций
3. Оставить только README.md и QUICK_START.md в корне

### 4.3 Улучшение тестового покрытия

**Действия:**

1. Добавить unit-тесты для `src/lib/encryption.ts`
2. Добавить unit-тесты для `src/lib/auth.ts`
3. Добавить интеграционные тесты для API endpoints
4. Увеличить покрытие до 80%+

### 4.4 Обработка TODO комментариев

**Действия:**

1. Создать задачи для каждого TODO
2. Добавить контекст и приоритет в комментарии
3. Или удалить устаревшие TODO

**Приоритетные TODO:**

- `src/lib/session/session-auto-refresh-service.ts:316,317,318` - Add encryption
- `src/lib/services/unified-notification-service.ts:298` - Реализовать подсчет времени доставки

---

## Порядок выполнения

1. **Неделя 1:** Этап 1 (Критические проблемы) - 3-4 дня
2. **Неделя 1-2:** Этап 2 (Оптимизация) - 4-5 дней
3. **Неделя 2-3:** Этап 3 (Унификация) - 5-7 дней
4. **Неделя 3-4:** Этап 4 (Качество) - 3-5 дней

**Итого:** ~3-4 недели

---

## Критерии готовности каждого этапа

- **Этап 1:** Все тесты проходят, нет console.log в production, безопасность исправлена
- **Этап 2:** Индексы добавлены, запросы оптимизированы, производительность улучшена на 30%+
- **Этап 3:** Все API используют единую обработку ошибок, нет `any` типов, валидация везде
- **Этап 4:** Покрытие тестами 80%+, документация добавлена, структура проекта улучшена

---

## Риски и меры митигации

1. **Риск:** Рефакторинг может сломать существующий функционал

   - **Митигация:** Писать тесты перед рефакторингом критических частей

2. **Риск:** Изменение БД может повлиять на production

   - **Митигация:** Создавать миграции, тестировать на staging

3. **Риск:** Унификация может потребовать больше времени

   - **Митигация:** Рефакторить по одному endpoint за раз, проверять после каждого

### To-dos

- [ ] Создать src/lib/env.ts для валидации переменных окружения и исправить небезопасные fallback значения в middleware.ts, auth.ts, encryption.ts
- [ ] Заменить все console.log на структурированный логгер (Pino) во всех файлах проекта
- [ ] Исправить критический баг с runId в src/workers/slot-search-worker.ts:95
- [ ] Добавить логирование в пустые catch блоки в continuous-slot-search-service.ts, enhanced-auto-booking-service.ts, auto-booking-service.ts
- [ ] Добавить индексы в prisma/schema.prisma для Task, Run, UserToken, FoundSlot моделей и создать миграцию
- [ ] Оптимизировать запросы к БД: добавить пагинацию в analytics, использовать include для предзагрузки связей, применять $transaction
- [ ] Реализовать кэширование расшифрованных токенов в Redis для избежания повторной расшифровки
- [ ] Применить createApiHandler из error-handling-middleware.ts во всех API routes, начиная с tasks/route.ts
- [ ] Добавить Zod валидацию во все API endpoints, где она отсутствует
- [ ] Убрать все использования типа any, заменив на конкретные типы или unknown с проверками
- [ ] Разделить continuous-slot-search-service.ts на отдельные сервисы по принципу Single Responsibility
- [ ] Добавить JSDoc комментарии для всех публичных функций в lib/auth.ts, lib/encryption.ts и сервисах
- [ ] Реорганизовать структуру проекта: переместить markdown файлы в docs/reports/ и docs/guides/
- [ ] Добавить unit-тесты для encryption.ts и auth.ts, увеличить покрытие до 80%+
- [ ] Обработать все TODO комментарии: добавить контекст, создать задачи или удалить устаревшие