# Улучшенный API клиент для Wildberries

## Обзор улучшений

Система работы с API запросами Wildberries была значительно улучшена с добавлением следующих возможностей:

### 🎯 Основные улучшения

1. **Детальное логирование API ответов** - Многоуровневая система логирования с поддержкой различных уровней детализации
2. **Поддержка различных форматов ответа** - JSON, XML, CSV, TEXT, FORM_DATA
3. **Универсальная поддержка пагинации** - Автоматическая пагинация и управление большими наборами данных
4. **Улучшенное извлечение данных** - Валидация, трансформация и нормализация данных из ответов API

## 📁 Структура файлов

```
src/lib/wb-client/
├── enhanced-logger.ts          # Улучшенная система логирования
├── response-processor.ts       # Процессор ответов API
├── pagination-manager.ts       # Менеджер пагинации
├── base-client.ts             # Обновленный базовый клиент
├── supplies-client.ts         # Обновленный клиент поставок
├── usage-examples.ts          # Примеры использования
└── types.ts                   # Типы данных
```

## 🔧 Новые компоненты

### 1. EnhancedAPILogger

Многоуровневая система логирования с поддержкой:
- Различных уровней логирования (DEBUG, INFO, WARN, ERROR)
- Контекстной информации (userId, requestId, endpoint)
- Измерения времени выполнения запросов
- Безопасного логирования (скрытие чувствительных данных)

```typescript
import { apiLogger, LogLevel } from './enhanced-logger';

// Настройка уровня логирования
apiLogger.setLogLevel(LogLevel.DEBUG);
apiLogger.setDetailedLogging(true);

// Создание контекста
const context = apiLogger.createContext(userId, '/api/v1/supplies', 'GET');
const endTimer = apiLogger.startTimer(context);

// Логирование
apiLogger.logRequest(context, requestData);
apiLogger.logResponse(context, response);
apiLogger.logError(context, error);
```

### 2. APIResponseProcessor

Универсальный процессор ответов API с поддержкой:
- Различных форматов данных (JSON, XML, CSV, TEXT, FORM_DATA)
- Извлечения данных по указанному пути
- Валидации и трансформации данных
- Автоматического извлечения информации о пагинации

```typescript
import { responseProcessor, DataExtractionOptions } from './response-processor';

const options: DataExtractionOptions = {
  dataPath: 'data.items',           // Путь к данным
  paginationPath: 'meta.pagination', // Путь к пагинации
  validateFunction: (data) => Array.isArray(data), // Валидация
  transformFunction: (data) => data.map(item => ({ // Трансформация
    ...item,
    processedAt: new Date()
  }))
};

const result = await responseProcessor.processResponse(response, options, context);
```

### 3. PaginationManager

Менеджер пагинации с возможностями:
- Нормализации параметров пагинации
- Автоматического получения всех страниц
- Создания URL с параметрами пагинации
- Валидации параметров пагинации

```typescript
import { paginationManager, PaginationRequest, AutoPaginationOptions } from './pagination-manager';

// Нормализация параметров
const normalizedRequest = paginationManager.normalizePaginationRequest({
  page: 1,
  limit: 50
});

// Автоматическая пагинация
const allData = await paginationManager.autoPaginate(
  fetchFunction,
  { page: 1, limit: 100 },
  {
    maxPages: 10,
    maxItems: 1000,
    delayBetweenPages: 200,
    onPageComplete: (page, data) => console.log(`Страница ${page}: ${data.length} элементов`)
  },
  context
);
```

## 🚀 Новые методы в BaseWBClient

### Методы с улучшенной обработкой ответов

```typescript
// GET запрос с обработкой
const result = await this.getWithProcessing<T>('/api/v1/supplies', params, options);

// POST запрос с обработкой
const result = await this.postWithProcessing<T>('/api/v1/supplies', data, params, options);

// Запрос с пагинацией
const result = await this.requestWithPagination<T>(config, paginationRequest, options);

// Автоматическая пагинация
const allData = await this.autoPaginate<T>(config, paginationRequest, options, extractionOptions);
```

### Утилитарные методы

```typescript
// Создание стандартизированного ответа
const response = this.createStandardResponse(data, pagination, metadata);

// Создание ответа с ошибкой
const errorResponse = this.createErrorResponse('Error message', 'ERROR_CODE', details);
```

## 📦 Новые методы в WBSuppliesClient

### Enhanced методы

Все основные методы теперь имеют Enhanced версии с улучшенной обработкой:

```typescript
// Получение поставок с улучшенной обработкой
const result = await client.getSuppliesEnhanced(paginationRequest, options);

// Получение поставок с пагинацией
const result = await client.getSuppliesWithPagination(paginationRequest);

// Автоматическое получение всех поставок
const allSupplies = await client.getAllSupplies(options);

// Получение коэффициентов с трансформацией
const result = await client.getCoefficientsEnhanced(warehouseIds, dateFrom, dateTo, false, options);

// Получение складов с валидацией
const result = await client.getWarehousesEnhanced(options);

// Создание поставки с обработкой ошибок
const result = await client.createSupplyEnhanced(supplyData, options);
```

## 💡 Примеры использования

### Базовое использование

```typescript
import { WBSuppliesClient } from './supplies-client';
import { DataExtractionOptions } from './response-processor';
import { PaginationRequest } from './pagination-manager';

const client = new WBSuppliesClient('your-token', 'user-id');

// Получение поставок с пагинацией
const paginationRequest: PaginationRequest = {
  page: 1,
  limit: 50,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

const options: DataExtractionOptions = {
  dataPath: 'data',
  validateFunction: (data) => Array.isArray(data),
  transformFunction: (data) => data.map(supply => ({
    ...supply,
    createdAt: new Date(supply.createdAt)
  }))
};

const result = await client.getSuppliesEnhanced(paginationRequest, options);
console.log('Получено поставок:', result.data.length);
console.log('Пагинация:', result.pagination);
console.log('Метаданные:', result.metadata);
```

### Автоматическая пагинация

```typescript
import { AutoPaginationOptions } from './pagination-manager';

const options: AutoPaginationOptions = {
  maxPages: 5,
  maxItems: 1000,
  delayBetweenPages: 200,
  onPageComplete: (page, data) => {
    console.log(`Страница ${page}: ${data.length} поставок`);
  },
  onComplete: (allData, totalPages) => {
    console.log(`Всего получено: ${allData.length} поставок за ${totalPages} страниц`);
  }
};

const allSupplies = await client.getAllSupplies(options);
```

### Комплексный workflow

```typescript
async function complexWorkflow() {
  try {
    // 1. Получаем склады
    const warehouses = await client.getWarehousesEnhanced({
      validateFunction: (data) => Array.isArray(data) && data.length > 0
    });

    // 2. Получаем коэффициенты
    const warehouseIds = warehouses.data.slice(0, 3).map(w => w.id);
    const coefficients = await client.getCoefficientsEnhanced(
      warehouseIds,
      '2024-01-01',
      '2024-01-31',
      false,
      {
        transformFunction: (data) => data.filter(c => c.allowUnload)
      }
    );

    // 3. Получаем поставки
    const supplies = await client.getSuppliesWithPagination({
      page: 1,
      limit: 10
    });

    return {
      warehouses: warehouses.data,
      coefficients: coefficients.data,
      supplies: supplies.data
    };
  } catch (error) {
    console.error('Ошибка в workflow:', error);
    throw error;
  }
}
```

## 🔍 Логирование и отладка

### Настройка логирования

```typescript
import { apiLogger, LogLevel } from './enhanced-logger';

// Установка уровня логирования
apiLogger.setLogLevel(LogLevel.DEBUG); // DEBUG, INFO, WARN, ERROR

// Включение детального логирования
apiLogger.setDetailedLogging(true);

// В production можно отключить детальное логирование
if (process.env.NODE_ENV === 'production') {
  apiLogger.setDetailedLogging(false);
  apiLogger.setLogLevel(LogLevel.WARN);
}
```

### Примеры логов

```
[2024-01-15T10:30:00.000Z] INFO 🌐 API Request (user:123, req:req_1642248600000_abc123, endpoint:/api/v1/supplies, method:GET)
[2024-01-15T10:30:00.500Z] INFO ✅ API Response (user:123, req:req_1642248600000_abc123, endpoint:/api/v1/supplies, method:GET, duration:500ms)
[2024-01-15T10:30:00.501Z] DEBUG 📊 Data Extraction (user:123, req:req_1642248600000_abc123, endpoint:/api/v1/supplies, method:GET, duration:500ms)
```

## ⚙️ Конфигурация

### Переменные окружения

```bash
# Включение детального логирования
ENABLE_DETAILED_LOGGING=true

# Уровень логирования (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=INFO

# Максимальный размер лога в символах
MAX_LOG_SIZE=10000
```

### Настройка пагинации

```typescript
import { paginationManager } from './pagination-manager';

// Настройка параметров пагинации
paginationManager.configure({
  defaultLimit: 20,
  maxLimit: 100,
  defaultPage: 1,
  enableAutoPagination: true,
  maxAutoPages: 10
});
```

## 🛡️ Обработка ошибок

### Типы ошибок

```typescript
import { WBClientError } from './types';

try {
  const result = await client.getSuppliesEnhanced();
} catch (error) {
  if (error instanceof WBClientError) {
    console.error('API Error:', {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details
    });
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Retry логика

```typescript
// Автоматическая пагинация с обработкой ошибок
const options: AutoPaginationOptions = {
  maxPages: 10,
  onError: (error, page) => {
    console.error(`Ошибка на странице ${page}:`, error.message);
    // Можно добавить retry логику
  }
};
```

## 📈 Производительность

### Оптимизации

1. **Кэширование контекста** - Контекст логирования создается один раз и переиспользуется
2. **Ленивая загрузка** - Данные загружаются только при необходимости
3. **Параллельные запросы** - Поддержка параллельного выполнения запросов
4. **Умная пагинация** - Автоматическое определение оптимального размера страницы

### Мониторинг

```typescript
// Измерение времени выполнения
const context = apiLogger.createContext(userId, endpoint, method);
const endTimer = apiLogger.startTimer(context);

// ... выполнение запроса ...

endTimer(); // Автоматически добавит duration в контекст
```

## 🔄 Миграция с старого API

### Постепенная миграция

Старые методы остаются совместимыми, новые методы добавляются параллельно:

```typescript
// Старый способ (остается рабочим)
const supplies = await client.getSupplies(1000, 0, [5, 6]);

// Новый способ (рекомендуется)
const result = await client.getSuppliesEnhanced(
  { page: 1, limit: 1000 },
  { validateFunction: (data) => Array.isArray(data) }
);
const supplies = result.data;
```

### Обновление существующего кода

1. Замените вызовы `getSupplies()` на `getSuppliesEnhanced()`
2. Добавьте обработку ошибок с использованием `WBClientError`
3. Настройте логирование для лучшей отладки
4. Используйте пагинацию для больших наборов данных

## 🧪 Тестирование

### Примеры тестов

```typescript
import { WBSuppliesClient } from './supplies-client';

describe('Enhanced API Client', () => {
  let client: WBSuppliesClient;

  beforeEach(() => {
    client = new WBSuppliesClient('test-token', 'test-user');
  });

  it('should get supplies with enhanced processing', async () => {
    const result = await client.getSuppliesEnhanced(
      { page: 1, limit: 10 },
      { validateFunction: (data) => Array.isArray(data) }
    );

    expect(result.data).toBeDefined();
    expect(result.pagination).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it('should handle pagination correctly', async () => {
    const result = await client.getSuppliesWithPagination({
      page: 1,
      limit: 5
    });

    expect(result.data.length).toBeLessThanOrEqual(5);
    expect(result.pagination.page).toBe(1);
  });
});
```

## 📚 Дополнительные ресурсы

- [Примеры использования](./usage-examples.ts)
- [Типы данных](./types.ts)
- [Документация API Wildberries](https://openapi.wildberries.ru/)

## 🤝 Поддержка

При возникновении проблем:

1. Проверьте логи с помощью `apiLogger`
2. Убедитесь в правильности токена и параметров
3. Проверьте настройки пагинации
4. Обратитесь к примерам использования

---

*Документация обновлена: 2024-01-15*
