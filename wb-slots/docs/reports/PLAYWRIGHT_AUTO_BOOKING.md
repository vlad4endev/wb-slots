# Модуль автобронирования на основе Playwright

## Обзор

Модуль автобронирования на основе Playwright реализует автоматическое бронирование лотов поставок на портале Wildberries согласно техническому заданию. Модуль использует фреймворк Playwright для имитации действий пользователя и обхода механизмов двухфакторной аутентификации.

## Архитектура

### Основные компоненты

1. **PlaywrightAutoBooking** - Основной класс для работы с браузером
2. **PlaywrightAutoBookingService** - Сервисный слой для бизнес-логики
3. **PlaywrightAutoBookingWorker** - Воркер для обработки задач в очереди
4. **API роуты** - REST API для управления бронированием

### Модуль управления сессиями

- Сохранение состояния браузера в файл `wb-session-state.json`
- Загрузка сохраненного состояния при запуске
- Интеграция с базой данных для долгосрочного хранения сессий
- Автоматическое обновление cookies и localStorage

### Модуль автоматизации

- Имитация реальных пользовательских действий
- Обработка всплывающих окон и диалогов
- Автоматический ввод SMS-кодов через внешние сервисы
- Пошаговая последовательность бронирования

## Установка и настройка

### Зависимости

```json
{
  "playwright": "^1.55.0",
  "@playwright/test": "^1.40.1"
}
```

### Установка браузеров Playwright

```bash
npx playwright install chromium
```

### Переменные окружения

```env
# SMS-провайдер (опционально)
SMS_PROVIDER_API_KEY=your_api_key
SMS_PROVIDER_SERVICE_ID=your_service_id
SMS_PROVIDER_PHONE=+79999999999

# Настройки браузера
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_TIMEOUT=30000
```

## Использование

### Базовое использование

```typescript
import { PlaywrightAutoBooking } from '@/lib/playwright-auto-booking';

const playwright = new PlaywrightAutoBooking();
await playwright.init();

// Авторизация
const credentials = {
  email: 'your@email.com',
  password: 'your_password',
  phone: '+79999999999'
};

const isLoggedIn = await playwright.login(credentials);

// Бронирование слота
const params = {
  warehouseId: 1,
  warehouseName: 'Склад 1',
  date: '2024-01-15',
  timeSlot: '10:00-12:00',
  boxTypes: ['Короба'],
  supplyId: 'SUPPLY123',
  coefficient: 1.5
};

const result = await playwright.bookSlot(params);

await playwright.close();
```

### Использование через сервис

```typescript
import { PlaywrightAutoBookingService } from '@/lib/services/playwright-auto-booking-service';

const service = new PlaywrightAutoBookingService('userId', 'taskId', 'supplyId');

const slot = {
  warehouseId: 1,
  warehouseName: 'Склад 1',
  date: '2024-01-15',
  timeSlot: '10:00-12:00',
  coefficient: 1.5,
  boxTypes: ['Короба'],
  foundAt: new Date()
};

const result = await service.bookSlot(slot);
```

### Использование через API

#### Авторизация

```bash
curl -X POST http://localhost:3000/api/auto-booking/playwright/session \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "action": "login",
    "credentials": {
      "email": "your@email.com",
      "password": "your_password",
      "phone": "+79999999999"
    }
  }'
```

#### Бронирование слота

```bash
curl -X POST http://localhost:3000/api/auto-booking/playwright \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "taskId": "task123",
    "supplyId": "supply123",
    "slot": {
      "warehouseId": 1,
      "warehouseName": "Склад 1",
      "date": "2024-01-15",
      "timeSlot": "10:00-12:00",
      "coefficient": 1.5,
      "boxTypes": ["Короба"],
      "foundAt": "2024-01-15T10:00:00Z"
    }
  }'
```

#### Добавление в очередь

```bash
curl -X POST http://localhost:3000/api/auto-booking/playwright/queue \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "taskId": "task123",
    "supplyId": "supply123",
    "slot": { ... },
    "priority": 1,
    "delay": 0
  }'
```

## Особенности реализации

### Обработка 2FA

Модуль автоматически обнаруживает форму двухфакторной аутентификации и может:

1. Использовать сохраненную сессию (если действительна)
2. Запросить SMS-код через внешний API
3. Автоматически ввести полученный код

### Обработка всплывающих окон

```typescript
// Автоматическая обработка диалогов
page.on('dialog', async dialog => {
  await dialog.accept();
});

// Обработка всплывающих окон
page.on('popup', async popup => {
  await popup.close();
});
```

### Сохранение состояния сессии

```typescript
// Сохранение в файл
await context.storageState({ path: 'wb-session-state.json' });

// Загрузка из файла
const context = await browser.newContext({
  storageState: 'wb-session-state.json'
});
```

### Обработка ошибок и повторные попытки

- Максимум 3 попытки бронирования
- Экспоненциальная задержка между попытками
- Детальное логирование ошибок
- Скриншоты для отладки

## Мониторинг и отладка

### Логирование

```typescript
const logger = new Logger('PlaywrightAutoBooking');
logger.info('Начинаем бронирование...');
logger.error('Ошибка бронирования:', error);
```

### Скриншоты

При ошибках автоматически создаются скриншоты в формате base64 для отладки.

### Статистика

```typescript
const stats = await service.getBookingStats();
console.log(`Успешных бронирований: ${stats.successfulBookings}`);
console.log(`Процент успеха: ${stats.successRate}%`);
```

## Безопасность

### Шифрование данных

- Учетные данные шифруются перед сохранением в БД
- Cookies и сессии зашифрованы
- SMS-коды не сохраняются

### Изоляция сессий

- Каждый пользователь имеет изолированную сессию
- Автоматическая очистка истекших сессий
- Защита от утечек данных между пользователями

## Производительность

### Оптимизации

- Переиспользование браузерных контекстов
- Кэширование сессий
- Параллельная обработка задач (до 2 одновременно)
- Автоматическая очистка ресурсов

### Масштабирование

- Горизонтальное масштабирование через очереди
- Изоляция воркеров
- Мониторинг производительности

## Тестирование

### Запуск тестов

```bash
npm test playwright-auto-booking
```

### Покрытие тестами

- Unit тесты для всех основных функций
- Моки для внешних зависимостей
- Тестирование обработки ошибок

## Устранение неполадок

### Частые проблемы

1. **Браузер не запускается**
   - Проверьте установку Playwright: `npx playwright install`
   - Проверьте права доступа к файлам

2. **Ошибки авторизации**
   - Проверьте корректность учетных данных
   - Убедитесь, что SMS-провайдер настроен

3. **Сессия не сохраняется**
   - Проверьте права на запись в директорию
   - Убедитесь, что файл `wb-session-state.json` не заблокирован

### Отладка

```typescript
// Включение отладочного режима
const playwright = new PlaywrightAutoBooking();
await playwright.init();

// Просмотр логов
const logger = new Logger('PlaywrightAutoBooking');
logger.debug('Отладочная информация');
```

## API Reference

### PlaywrightAutoBooking

#### Методы

- `init()` - Инициализация браузера
- `login(credentials)` - Авторизация
- `bookSlot(params)` - Бронирование слота
- `isAuthenticated()` - Проверка авторизации
- `close()` - Закрытие браузера

### PlaywrightAutoBookingService

#### Методы

- `bookSlot(slot)` - Бронирование через сервис
- `isServiceAvailable()` - Проверка доступности
- `getBookingStats()` - Получение статистики

### API Endpoints

- `POST /api/auto-booking/playwright` - Бронирование слота
- `POST /api/auto-booking/playwright/session` - Управление сессиями
- `GET /api/auto-booking/playwright/session` - Получение сессий
- `POST /api/auto-booking/playwright/queue` - Добавление в очередь
- `GET /api/auto-booking/playwright/queue` - Статистика очереди
- `DELETE /api/auto-booking/playwright/queue` - Удаление задач
