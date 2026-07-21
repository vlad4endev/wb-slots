# 🔄 Решение проблемы SESSION_EXPIRED - Автоматическое обновление сессий

## 📋 Обзор проблемы

**Проблема:** Пользователь `cmfvmlf4x0000pmjsmd3eouhu` получал ошибку `SESSION_EXPIRED` при попытке бронирования через задачу `test-booking`. Система выполняла retry, но не пыталась обновить сессию, что приводило к повторным неудачам.

**Решение:** Реализована комплексная система автоматического обновления сессий с интеллектуальной обработкой ошибок и улучшенным логированием.

## 🚀 Новые компоненты

### 1. SessionAutoRefreshService
**Файл:** `src/lib/session/session-auto-refresh-service.ts`

**Функции:**
- ✅ Проверка здоровья сессии
- ✅ Автоматическое обновление при ошибке SESSION_EXPIRED
- ✅ Обновление в существующем контексте браузера или с новым браузером
- ✅ Retry логика с экспоненциальной задержкой
- ✅ Уведомления о состоянии обновления

**Основные методы:**
```typescript
// Проверка здоровья сессии
const healthCheck = await sessionAutoRefreshService.checkSessionHealth(userId);

// Обработка ошибки SESSION_EXPIRED
const result = await sessionAutoRefreshService.handleSessionExpired(userId, browserContext);
```

### 2. SessionErrorHandler
**Файл:** `src/lib/errors/session-error-handler.ts`

**Функции:**
- ✅ Интеллектуальная обработка ошибок сессии
- ✅ Предотвращение множественных одновременных обновлений
- ✅ Лимит попыток обновления (максимум 2)
- ✅ Логирование в AuditLog
- ✅ Проверка сессии перед началом операций

**Основные методы:**
```typescript
// Обработка ошибки SESSION_EXPIRED
const result = await sessionErrorHandler.handleSessionExpired({
  userId,
  taskId,
  supplyId,
  warehouseId,
  retryCount,
  originalError,
  browserContext
});

// Проверка сессии перед операцией
const validation = await sessionErrorHandler.validateSessionBeforeOperation(userId);
```

### 3. EnhancedRunLogger
**Файл:** `src/lib/logging/enhanced-run-logger.ts`

**Новые поля в RunLog:**
- ✅ `stepName` - название шага выполнения
- ✅ `actionType` - тип действия
- ✅ `retryCount` - количество попыток
- ✅ `sessionInfo` - информация о сессии
- ✅ `performanceMetrics` - метрики производительности
- ✅ `errorDetails` - детали ошибок
- ✅ `bookingContext` - контекст бронирования

**Расширенная статистика Run:**
```typescript
interface RunSummary {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  sessionRefreshCount: number;
  errorBreakdown: Record<string, number>;
  performanceMetrics: {
    averageMemoryUsage: number;
    totalApiCalls: number;
    totalSlotsFound: number;
    totalSlotsChecked: number;
  };
}
```

### 4. SessionAwareBookingIntegration
**Файл:** `src/lib/services/session-aware-booking-integration.ts`

**Функции:**
- ✅ Интеграция с существующими сервисами бронирования
- ✅ Автоматическая проверка сессии перед началом
- ✅ Обработка ошибок сессии с retry
- ✅ Расширенное логирование всех этапов

## 🔧 API Endpoints

### POST `/api/session/auto-refresh-enhanced`
Автоматическое обновление сессии с расширенной логикой.

**Запрос:**
```json
{
  "userId": "optional-user-id",
  "forceRefresh": false,
  "context": "browser-context-if-available"
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-id",
    "newExpiresAt": "2025-01-08T10:30:00.000Z",
    "refreshMethod": "automatic",
    "isHealthy": true,
    "needsRefresh": false,
    "message": "Сессия успешно обновлена"
  }
}
```

### GET `/api/session/auto-refresh-enhanced?userId=user-id`
Проверка состояния сессии.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "isHealthy": true,
    "needsRefresh": false,
    "expiresIn": 3600000,
    "lastUsedAt": "2025-01-07T10:30:00.000Z",
    "refreshAttempts": 0,
    "timestamp": "2025-01-07T11:30:00.000Z"
  }
}
```

### DELETE `/api/session/auto-refresh-enhanced`
Сброс счетчика попыток обновления.

**Запрос:**
```json
{
  "userId": "user-id"
}
```

## 📊 Улучшенное логирование

### AuditLog записи
Теперь система создает детальные записи в AuditLog:

```json
{
  "userId": "cmfvmlf4x0000pmjsmd3eouhu",
  "action": "SESSION_REFRESH_SUCCESS",
  "target": "test-booking",
  "meta": {
    "eventType": "session_refresh",
    "taskId": "test-booking",
    "supplyId": "test-supply-id",
    "warehouseId": 301983,
    "sessionId": "wb_session_1234567890_abc123",
    "newExpiresAt": "2025-01-08T10:30:00.000Z",
    "refreshMethod": "automatic",
    "retryCount": 2,
    "metadata": {
      "success": true,
      "autoRefresh": true
    },
    "timestamp": "2025-01-07T23:19:36.140Z"
  }
}
```

### RunLog записи
Расширенные записи в RunLog с новыми полями:

```json
{
  "runId": "run-123",
  "level": "INFO",
  "message": "Session refreshed successfully",
  "meta": {
    "stepName": "session_management",
    "actionType": "refresh_session",
    "retryCount": 1,
    "sessionInfo": {
      "sessionId": "wb_session_1234567890_abc123",
      "expiresAt": "2025-01-08T10:30:00.000Z"
    },
    "errorDetails": null,
    "bookingContext": {
      "taskId": "test-booking",
      "supplyId": "test-supply-id",
      "warehouseId": 301983
    },
    "timestamp": "2025-01-07T23:19:36.140Z"
  }
}
```

## 🔄 Алгоритм работы

### 1. Проверка сессии перед началом
```typescript
const validation = await sessionErrorHandler.validateSessionBeforeOperation(userId);
if (!validation.isValid) {
  // Сессия недействительна, требуется повторная авторизация
  return { success: false, error: validation.error };
}
```

### 2. Обработка SESSION_EXPIRED
```typescript
if (error instanceof SessionExpiredError) {
  const result = await sessionErrorHandler.handleSessionExpired({
    userId,
    taskId,
    supplyId,
    warehouseId,
    retryCount: attempt,
    originalError: error,
    browserContext: context
  });

  if (result.sessionRefreshed && result.shouldRetry) {
    // Сессия обновлена, повторяем попытку
    await sleep(result.retryAfter);
    continue;
  }
}
```

### 3. Автоматическое обновление сессии
```typescript
const refreshResult = await sessionAutoRefreshService.handleSessionExpired(userId, browserContext);

if (refreshResult.success) {
  // Сессия успешно обновлена
  // Продолжаем выполнение
} else {
  // Не удалось обновить сессию
  // Требуется ручная повторная авторизация
}
```

## 🎯 Интеграция с существующими сервисами

### Использование SessionAwareBookingIntegration
```typescript
import { sessionAwareBookingIntegration } from '@/lib/services/session-aware-booking-integration';

// Интеграция с существующим сервисом бронирования
const result = await sessionAwareBookingIntegration.executeBookingWithSessionAwareness(
  {
    userId: 'cmfvmlf4x0000pmjsmd3eouhu',
    taskId: 'test-booking',
    supplyId: 'test-supply-id',
    warehouseId: 301983,
    date: '2025-01-08'
  },
  existingBookingService // Существующий сервис бронирования
);
```

## 📈 Преимущества решения

### ✅ Автоматическое восстановление
- Система автоматически обновляет сессию при ошибке SESSION_EXPIRED
- Не требует вмешательства пользователя в большинстве случаев
- Продлевает срок жизни сессии до 7 дней

### ✅ Интеллектуальная обработка ошибок
- Предотвращает множественные одновременные обновления
- Ограничивает количество попыток обновления
- Логирует все действия для диагностики

### ✅ Улучшенная диагностика
- Детальные логи с контекстом выполнения
- Метрики производительности и статистика
- Разбивка ошибок по типам

### ✅ Обратная совместимость
- Интеграция с существующими сервисами
- Не нарушает текущую логику работы
- Постепенное внедрение

## 🚀 Внедрение

### 1. Обновление существующих сервисов
```typescript
// В существующем сервисе бронирования
import { sessionAwareBookingIntegration } from '@/lib/services/session-aware-booking-integration';

// Замена прямого вызова на session-aware версию
const result = await sessionAwareBookingIntegration.executeBookingWithSessionAwareness(
  config,
  this // текущий сервис
);
```

### 2. Настройка планировщика
```typescript
// В планировщике задач
import { sessionAutoRefreshService } from '@/lib/session/session-auto-refresh-service';

// Периодическая проверка здоровья сессий
setInterval(async () => {
  const users = await getActiveUsers();
  for (const user of users) {
    const health = await sessionAutoRefreshService.checkSessionHealth(user.id);
    if (health.needsRefresh) {
      await sessionAutoRefreshService.handleSessionExpired(user.id);
    }
  }
}, 30 * 60 * 1000); // каждые 30 минут
```

### 3. Мониторинг
```typescript
// Мониторинг статистики обновлений
import { sessionErrorHandler } from '@/lib/errors/session-error-handler';

const stats = sessionErrorHandler.getRefreshStats();
console.log('Session refresh statistics:', stats);
```

## 🔍 Мониторинг и диагностика

### Ключевые метрики для отслеживания:
1. **Количество обновлений сессий** - должно быть минимальным
2. **Успешность обновлений** - должно быть > 90%
3. **Время восстановления** - должно быть < 30 секунд
4. **Количество неудачных бронирований из-за сессий** - должно стремиться к 0

### Алерты для настройки:
- Более 3 неудачных обновлений сессии подряд
- Время обновления сессии > 60 секунд
- Более 10% бронирований завершаются ошибкой сессии

## 📝 Заключение

Новая система решает проблему SESSION_EXPIRED путем:

1. **Проактивной проверки** сессии перед началом операций
2. **Автоматического обновления** при обнаружении проблем
3. **Интеллектуального retry** с учетом состояния сессии
4. **Детального логирования** для диагностики и мониторинга

Пользователь `cmfvmlf4x0000pmjsmd3eouhu` больше не будет сталкиваться с проблемой SESSION_EXPIRED, так как система автоматически обновит сессию и продолжит выполнение задачи бронирования.
