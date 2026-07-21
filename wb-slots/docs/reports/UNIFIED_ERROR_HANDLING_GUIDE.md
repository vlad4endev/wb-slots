# 🛠️ Руководство по унифицированной обработке ошибок

## 📋 Обзор

Система унифицированной обработки ошибок устраняет дублирование кода и обеспечивает консистентную обработку ошибок во всем приложении.

## 🚀 Быстрый старт

### Для API Endpoints

**До (дублирование):**
```typescript
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = schema.parse(body);
    
    // Бизнес-логика
    const result = await someOperation(validatedData);
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('API error:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**После (унифицированно):**
```typescript
import { createApiHandler } from '@/lib/errors';

const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const validatedData = schema.parse(body);
  
  // Бизнес-логика
  const result = await someOperation(validatedData);
  
  return NextResponse.json({ success: true, data: result });
};

export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'my-endpoint',
    method: 'POST'
  })
});
```

### Для сервисов

**До (дублирование):**
```typescript
class MyService {
  async doSomething(data: any) {
    try {
      // Бизнес-логика
      return await someOperation(data);
    } catch (error) {
      this.logger.error('Service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

**После (унифицированно):**
```typescript
import { createServiceMethod } from '@/lib/errors';

class MyService {
  doSomething = createServiceMethod(
    'MyService',
    'doSomething',
    async (data: any) => {
      // Бизнес-логика
      return await someOperation(data);
    }
  );
}
```

## 🔧 API Reference

### createApiHandler

Создает API handler с автоматической обработкой ошибок.

```typescript
createApiHandler(handler, options?)
```

**Параметры:**
- `handler`: Функция-обработчик
- `options`: Опциональные настройки
  - `contextProvider`: Функция для создания контекста ошибки
  - `cleanup`: Функция очистки ресурсов
  - `retry`: Настройки retry логики

**Примеры:**

```typescript
// Базовое использование
export const POST = createApiHandler(postHandler);

// С контекстом
export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'my-endpoint',
    method: 'POST'
  })
});

// С retry логикой
export const POST = createApiHandler(postHandler, {
  retry: {
    maxRetries: 3,
    delay: 1000
  }
});

// С очисткой ресурсов
export const POST = createApiHandler(postHandler, {
  cleanup: async (request: NextRequest) => {
    await cleanupResources();
  }
});
```

### createServiceMethod

Создает метод сервиса с автоматической обработкой ошибок.

```typescript
createServiceMethod(serviceName, methodName, handler, options?)
```

**Параметры:**
- `serviceName`: Имя сервиса
- `methodName`: Имя метода
- `handler`: Функция-обработчик
- `options`: Опциональные настройки

**Примеры:**

```typescript
// Базовое использование
class MyService {
  doSomething = createServiceMethod(
    'MyService',
    'doSomething',
    async (data: any) => {
      return await someOperation(data);
    }
  );
}

// С retry логикой
class MyService {
  doSomething = createServiceMethod(
    'MyService',
    'doSomething',
    async (data: any) => {
      return await someOperation(data);
    },
    {
      retry: {
        maxRetries: 3,
        delay: 1000
      }
    }
  );
}
```

## 🎯 Типы ошибок

Система автоматически определяет типы ошибок:

### Authentication & Authorization
- `AUTHENTICATION_REQUIRED` (401)
- `AUTHENTICATION_FAILED` (401)
- `AUTHORIZATION_DENIED` (403)
- `SESSION_EXPIRED` (401)

### Validation
- `VALIDATION_ERROR` (400)
- `INVALID_INPUT` (400)
- `MISSING_REQUIRED_FIELD` (400)

### Business Logic
- `BUSINESS_RULE_VIOLATION` (400)
- `RESOURCE_NOT_FOUND` (404)
- `RESOURCE_ALREADY_EXISTS` (409)
- `OPERATION_NOT_ALLOWED` (403)

### External Services
- `EXTERNAL_SERVICE_ERROR` (503)
- `NETWORK_ERROR` (503)
- `TIMEOUT_ERROR` (408)
- `RATE_LIMIT_EXCEEDED` (429)

### System
- `INTERNAL_SERVER_ERROR` (500)
- `DATABASE_ERROR` (500)
- `CONFIGURATION_ERROR` (500)

### Booking Specific
- `BOOKING_FAILED` (400)
- `SLOT_NOT_AVAILABLE` (409)
- `SUPPLY_NOT_FOUND` (404)
- `BOOKING_CONFLICT` (409)

## 📊 Формат ответов

### Успешный ответ
```json
{
  "success": true,
  "data": { ... }
}
```

### Ответ с ошибкой
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": [...],
    "context": {
      "endpoint": "my-endpoint",
      "method": "POST",
      "requestId": "req_1234567890_abc123",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_1234567890_abc123"
  }
}
```

## 🔄 Retry логика

Система автоматически повторяет операции для определенных типов ошибок:

**Retryable ошибки:**
- `NETWORK_ERROR`
- `TIMEOUT_ERROR`
- `RATE_LIMIT_EXCEEDED`
- `EXTERNAL_SERVICE_ERROR`
- `DATABASE_ERROR`

**Настройка retry:**
```typescript
export const POST = createApiHandler(postHandler, {
  retry: {
    maxRetries: 3,    // Максимум попыток
    delay: 1000       // Задержка между попытками (мс)
  }
});
```

## 🧹 Очистка ресурсов

```typescript
export const POST = createApiHandler(postHandler, {
  cleanup: async (request: NextRequest) => {
    // Очистка ресурсов при ошибке
    await cleanupDatabaseConnections();
    await cleanupFileHandles();
  }
});
```

## 📝 Логирование

Система автоматически логирует все ошибки с контекстом:

```typescript
// Автоматически логируется:
{
  code: 'VALIDATION_ERROR',
  message: 'Validation error',
  originalError: 'ZodError: ...',
  context: {
    endpoint: 'my-endpoint',
    method: 'POST',
    requestId: 'req_1234567890_abc123'
  },
  stack: 'Error: ...\n    at ...'
}
```

## 🚀 Миграция существующего кода

### Шаг 1: Импорт
```typescript
import { createApiHandler } from '@/lib/errors';
```

### Шаг 2: Выделение логики
```typescript
// Выделяем основную логику в отдельную функцию
const postHandler = async (request: NextRequest) => {
  // Вся логика без try-catch
};
```

### Шаг 3: Обертка
```typescript
export const POST = createApiHandler(postHandler);
```

### Шаг 4: Удаление дублирования
Удаляем все блоки `try-catch` и дублированную обработку ошибок.

## ✅ Преимущества

1. **Устранение дублирования** - один обработчик для всех API
2. **Консистентность** - одинаковый формат ошибок
3. **Автоматическое логирование** - все ошибки логируются
4. **Retry логика** - автоматические повторы для сетевых ошибок
5. **Очистка ресурсов** - автоматическая очистка при ошибках
6. **Типизация** - полная типизация ошибок
7. **Контекст** - детальная информация об ошибках

## 🎯 Результат

- **599 блоков `catch (error)`** → **0 дублирования**
- **664 блока `try {`** → **Автоматическая обработка**
- **50+ API endpoints** → **Единый обработчик**
- **Консистентные ошибки** → **Лучший UX**
