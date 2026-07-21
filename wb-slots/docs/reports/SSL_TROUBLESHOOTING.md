# Решение проблем с SSL сертификатами Wildberries API

## 🚨 Проблема

При работе с API Wildberries возникают SSL ошибки типа:
```
TypeError: fetch failed
[cause]: [Error: Hostname/IP does not match certificate's altnames: 
Host: api.wildberries.ru. is not in the cert's altnames: 
DNS:*.wildberries.global, DNS:wildberries.global]
```

## 🔍 Анализ проблемы

### Причина
Wildberries использует разные домены для своих API endpoints, и некоторые из них имеют SSL сертификаты, которые не соответствуют домену запроса:

- `api.wildberries.ru` - основной API домен
- `*.wildberries.global` - сертификат действителен только для global доменов
- `suppliers-api.wildberries.ru` - официальный suppliers API
- `seller.wildberries.ru` - seller API (часто возвращает HTML)

### Типы SSL ошибок
1. **ERR_TLS_CERT_ALTNAME_INVALID** - сертификат не соответствует домену
2. **ERR_TLS_CERT_INVALID** - недействительный сертификат
3. **ERR_TLS_CERT_AUTHORITY_INVALID** - сертификат не доверен
4. **ERR_TLS_CERT_EXPIRED** - сертификат истек

## 🛠️ Решения

### 1. Автоматическое решение (рекомендуется)

Используйте новый robust HTTP клиент, который автоматически обрабатывает SSL ошибки:

```typescript
import { robustHTTPClient } from '@/lib/wb-client/robust-http-client';

// Автоматически пробует альтернативные endpoints при SSL ошибках
const response = await robustHTTPClient.get('https://api.wildberries.ru/api/v1/warehouses', {
  // опции запроса
}, {
  enableSSLRetry: true, // включить автоматический retry
  retries: 3, // количество попыток
  timeout: 30000 // таймаут
});
```

### 2. Ручное решение

Если автоматическое решение не работает, используйте альтернативные endpoints:

```typescript
// Вместо проблемного endpoint
const problematicUrl = 'https://api.wildberries.ru/api/v1/warehouses';

// Используйте рабочие endpoints
const workingUrls = [
  'https://suppliers-api.wildberries.ru/api/v1/warehouses', // Официальный
  'https://suppliers-api.wildberries.global/api/v1/warehouses', // Global
  'https://api.wildberries.global/api/v1/warehouses' // Global API
];

for (const url of workingUrls) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': 'your-token',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Используем данные
      break;
    }
  } catch (error) {
    console.log(`Endpoint ${url} не работает:`, error.message);
    continue;
  }
}
```

### 3. Диагностика проблем

Используйте встроенную диагностику SSL проблем:

```typescript
import { sslDiagnostics } from '@/lib/wb-client/ssl-diagnostics';

// Диагностика конкретного API
const report = await sslDiagnostics.diagnoseAPI('warehouses');
console.log('Результат диагностики:', report);

// Диагностика всех API
const allReports = await sslDiagnostics.diagnoseAllAPIs();
console.log('Все отчеты:', allReports);
```

### 4. API endpoint для диагностики

Используйте REST API для диагностики:

```bash
# Диагностика всех API
GET /api/diagnostics/ssl

# Диагностика конкретного API
GET /api/diagnostics/ssl?apiType=warehouses

# Подробная диагностика
GET /api/diagnostics/ssl?apiType=warehouses&detailed=true

# Проверка конкретного endpoint
POST /api/diagnostics/ssl
{
  "action": "check_endpoint",
  "endpoint": "https://api.wildberries.ru/api/v1/warehouses"
}
```

## 📋 Рекомендуемые endpoints

### Warehouses API
```typescript
const warehouseEndpoints = [
  'https://suppliers-api.wildberries.ru/api/v1/warehouses', // ✅ Рекомендуется
  'https://suppliers-api.wildberries.global/api/v1/warehouses', // ✅ Альтернатива
  'https://api.wildberries.global/api/v1/warehouses', // ✅ Global API
  'https://api.wildberries.ru/api/v1/warehouses', // ⚠️ Может иметь SSL проблемы
  'https://seller.wildberries.ru/api/v1/warehouses' // ❌ Возвращает HTML
];
```

### Supplies API
```typescript
const suppliesEndpoints = [
  'https://supplies-api.wildberries.ru/api/v1/supplies', // ✅ Рекомендуется
  'https://supplies-api.wildberries.global/api/v1/supplies', // ✅ Альтернатива
  'https://api.wildberries.ru/api/v1/supplies' // ⚠️ Может иметь SSL проблемы
];
```

### Coefficients API
```typescript
const coefficientsEndpoints = [
  'https://supplies-api.wildberries.ru/api/v1/acceptance/coefficients', // ✅ Рекомендуется
  'https://api.wildberries.ru/api/v1/acceptance/coefficients' // ⚠️ Может иметь SSL проблемы
];
```

## 🔧 Настройка клиента

### Обновление существующего кода

Замените прямые вызовы fetch на robust HTTP клиент:

```typescript
// Старый код
const response = await fetch('https://api.wildberries.ru/api/v1/warehouses', {
  headers: { 'Authorization': token }
});

// Новый код
const response = await robustHTTPClient.get('https://api.wildberries.ru/api/v1/warehouses', {
  headers: { 'Authorization': token }
}, {
  enableSSLRetry: true,
  retries: 3
});
```

### Настройка retry логики

```typescript
import { robustHTTPClient } from '@/lib/wb-client/robust-http-client';

// Настройка retry параметров
robustHTTPClient.configureRetry({
  maxRetries: 5,
  retryDelay: 1000,
  backoffMultiplier: 2,
  retryOnSSL: true,
  retryOnTimeout: true,
  retryOn5xx: true
});
```

## 📊 Мониторинг

### Логирование SSL ошибок

```typescript
import { apiLogger, LogLevel } from '@/lib/wb-client/enhanced-logger';

// Включить детальное логирование
apiLogger.setLogLevel(LogLevel.DEBUG);
apiLogger.setDetailedLogging(true);
```

### Отслеживание проблемных endpoints

```typescript
import { sslErrorHandler } from '@/lib/wb-client/ssl-error-handler';

// Получить статистику по endpoints
const stats = sslErrorHandler.getEndpointStats();
console.log('Статистика endpoints:', stats);

// Обновить статус endpoint
sslErrorHandler.updateEndpointStatus('https://api.wildberries.ru/api/v1/warehouses', false);
```

## 🚀 Быстрое решение

Если нужно быстро решить проблему, используйте этот код:

```typescript
async function fetchWarehousesWithFallback(token: string) {
  const endpoints = [
    'https://suppliers-api.wildberries.ru/api/v1/warehouses',
    'https://suppliers-api.wildberries.global/api/v1/warehouses',
    'https://api.wildberries.global/api/v1/warehouses'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Успешно получены данные с ${endpoint}`);
        return data;
      }
    } catch (error) {
      console.log(`❌ Ошибка с ${endpoint}:`, error.message);
      continue;
    }
  }

  throw new Error('Все endpoints недоступны');
}
```

## 🔍 Диагностика

### Проверка SSL сертификата

```bash
# Проверка сертификата через openssl
openssl s_client -connect api.wildberries.ru:443 -servername api.wildberries.ru

# Проверка через curl
curl -I https://api.wildberries.ru/api/v1/warehouses
```

### Проверка DNS

```bash
# Проверка DNS записей
nslookup api.wildberries.ru
nslookup suppliers-api.wildberries.ru
nslookup suppliers-api.wildberries.global
```

## 📈 Производительность

### Оптимизация запросов

1. **Кэширование** - кэшируйте результаты запросов
2. **Connection pooling** - переиспользуйте соединения
3. **Timeout настройки** - установите разумные таймауты
4. **Retry стратегия** - используйте экспоненциальный backoff

### Мониторинг производительности

```typescript
import { apiLogger } from '@/lib/wb-client/enhanced-logger';

// Логирование времени выполнения
const context = apiLogger.createContext(userId, endpoint, 'GET');
const endTimer = apiLogger.startTimer(context);

// ... выполнение запроса ...

endTimer(); // Автоматически добавит duration в логи
```

## 🛡️ Безопасность

### Валидация сертификатов

Хотя мы обходим SSL ошибки, важно понимать риски:

1. **Man-in-the-middle атаки** - используйте только доверенные endpoints
2. **Валидация данных** - всегда валидируйте полученные данные
3. **Логирование** - логируйте все SSL ошибки для анализа

### Рекомендации по безопасности

```typescript
// Валидация ответа API
function validateAPIResponse(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // Проверяем структуру ответа
  if (Array.isArray(data)) {
    return data.every(item => item.id && item.name);
  }
  
  return data.data && Array.isArray(data.data);
}
```

## 📞 Поддержка

Если проблемы продолжаются:

1. **Проверьте логи** - используйте детальное логирование
2. **Запустите диагностику** - используйте `/api/diagnostics/ssl`
3. **Проверьте сеть** - убедитесь в стабильности соединения
4. **Обновите код** - используйте последние версии клиентов

---

*Документация обновлена: 2024-01-15*
