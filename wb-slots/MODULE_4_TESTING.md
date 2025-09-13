# Тестирование модуля 4 - Auto-Booking Worker (Puppeteer/Playwright)

## Обзор

Модуль 4 включает в себя:
- ✅ Воркер для бронирования с Puppeteer
- ✅ Авторизация через cookies или логин
- ✅ Переход к разделу поставок
- ✅ Выбор нужной поставки
- ✅ Выбор слота (по фильтрам)
- ✅ Подтверждение брони
- ✅ Логирование каждого шага, снятие скриншотов при ошибках
- ✅ Поддержка конфигов (proxy, headless/headful, селекторы)

## Компоненты

### Core Worker
- `src/lib/auto-booking/auto-booking-worker.ts` - основной воркер с Puppeteer
- `src/lib/auto-booking/auto-booking-service.ts` - сервис для управления задачами
- `src/lib/auto-booking/config.ts` - конфигурация и типы

### API Endpoints
- `src/app/api/auto-booking/route.ts` - создание и получение задач
- `src/app/api/auto-booking/execute/route.ts` - выполнение задач
- `src/app/api/auto-booking/[id]/route.ts` - управление конкретной задачей

### Тестовые скрипты
- `test-auto-booking-dry-run.js` - dry-run тестирование
- `test-auto-booking-real.js` - реальное тестирование

## Запуск тестирования

### 1. Подготовка окружения

```bash
# Установка зависимостей
cd wb-slots
npm install puppeteer @types/puppeteer playwright

# Создание папок для логов и скриншотов
mkdir -p test-screenshots test-logs real-test-screenshots real-test-logs
```

### 2. Запуск сервисов

```bash
# Frontend
npm run dev

# Backend (если нужен)
cd backend
npm run start:dev
```

### 3. Dry-Run тестирование

```bash
# Автоматический dry-run тест
node test-auto-booking-dry-run.js

# Dry-run с детальным логированием
DEBUG=true node test-auto-booking-dry-run.js
```

### 4. Реальное тестирование

```bash
# ВНИМАНИЕ: Реальное бронирование!
# Сначала отредактируйте test-auto-booking-real.js
# Укажите реальные данные:
# - ID поставки
# - Email и пароль
# - Настройки

# Затем запустите тест
AUTO_CONFIRM=true node test-auto-booking-real.js
```

## Тестовые сценарии

### 1. Dry-Run тестирование
- **Цель**: Проверить работу воркера без реального бронирования
- **Ожидаемый результат**: Все шаги выполняются успешно, но бронирование не происходит
- **Проверка**: Логи показывают все шаги, скриншоты создаются

### 2. Реальное тестирование
- **Цель**: Проверить реальное бронирование на тестовом аккаунте
- **Ожидаемый результат**: Слот успешно бронируется
- **Проверка**: Получение ID бронирования, подтверждение в WB

### 3. Тестирование конфигурации
- **Цель**: Проверить различные настройки воркера
- **Параметры**: headless/headful, proxy, timeouts, селекторы
- **Проверка**: Корректная работа с разными конфигами

## Конфигурация тестирования

### Базовый конфиг для dry-run
```javascript
const config = {
  headless: true,
  dryRun: true, // ВАЖНО для dry-run
  screenshots: {
    enabled: true,
    path: './test-screenshots',
    onError: true,
    onSuccess: true,
    onStep: true,
  },
  logging: {
    level: 'debug',
    console: true,
    file: true,
    filePath: './test-logs/auto-booking-dry-run.log',
  },
  timeouts: {
    pageLoad: 10000,
    elementWait: 5000,
    actionDelay: 500,
    screenshotDelay: 200,
  },
};
```

### Конфиг для реального тестирования
```javascript
const config = {
  headless: false, // Показываем браузер для отладки
  dryRun: false, // РЕАЛЬНОЕ бронирование
  screenshots: {
    enabled: true,
    path: './real-test-screenshots',
    onError: true,
    onSuccess: true,
    onStep: true,
  },
  logging: {
    level: 'debug',
    console: true,
    file: true,
    filePath: './real-test-logs/auto-booking-real.log',
  },
  timeouts: {
    pageLoad: 30000,
    elementWait: 15000,
    actionDelay: 2000,
    screenshotDelay: 1000,
  },
};
```

## Проверка результатов

### 1. Логи выполнения
```bash
# Просмотр логов dry-run
tail -f test-logs/auto-booking-dry-run.log

# Просмотр логов реального теста
tail -f real-test-logs/auto-booking-real.log
```

### 2. Скриншоты
```bash
# Просмотр скриншотов dry-run
ls -la test-screenshots/

# Просмотр скриншотов реального теста
ls -la real-test-screenshots/
```

### 3. API ответы
```bash
# Получение списка задач
curl "http://localhost:3000/api/auto-booking"

# Получение конкретной задачи
curl "http://localhost:3000/api/auto-booking/TASK_ID"
```

## Ожидаемые результаты

### Dry-Run тест
```json
{
  "success": true,
  "data": {
    "result": {
      "success": true,
      "bookingId": "DRY_RUN_1234567890",
      "executionTime": 15000,
      "screenshots": [
        "./test-screenshots/login_page_1234567890.png",
        "./test-screenshots/supplies_page_1234567891.png",
        "./test-screenshots/slot_selected_1234567892.png"
      ],
      "logs": [
        {
          "timestamp": "2024-01-15T10:00:00.000Z",
          "level": "info",
          "step": "initialize",
          "message": "Browser initialized successfully"
        }
      ]
    }
  }
}
```

### Реальный тест
```json
{
  "success": true,
  "data": {
    "result": {
      "success": true,
      "bookingId": "BOOKING_1234567890",
      "executionTime": 25000,
      "screenshots": [
        "./real-test-screenshots/booking_success_1234567890.png"
      ],
      "logs": [
        {
          "timestamp": "2024-01-15T10:00:00.000Z",
          "level": "info",
          "step": "confirmBooking",
          "message": "Booking confirmed successfully"
        }
      ]
    }
  }
}
```

## Устранение неполадок

### 1. Ошибка "Failed to initialize browser"
- Проверьте установку Puppeteer: `npm list puppeteer`
- Убедитесь, что Chrome/Chromium доступен
- Проверьте права доступа к папкам

### 2. Ошибка "Login failed"
- Проверьте правильность email и пароля
- Убедитесь, что аккаунт не заблокирован
- Проверьте наличие капчи

### 3. Ошибка "Supply not found"
- Проверьте правильность ID поставки
- Убедитесь, что поставка активна
- Проверьте селекторы в конфиге

### 4. Ошибка "No matching slots found"
- Проверьте фильтры слотов
- Убедитесь, что есть доступные слоты
- Проверьте диапазон дат

### 5. Ошибка "Booking confirmation failed"
- Проверьте селекторы кнопок подтверждения
- Убедитесь, что слот еще доступен
- Проверьте логи на наличие ошибок

## Критерии завершения

- [x] Dry-run (без подтверждения) отрабатывает без ошибок
- [ ] Реальный тест на тестовом аккаунте бронирует слот
- [x] Логи показывают всю цепочку действий

## Безопасность

### Рекомендации для тестирования
1. Используйте только тестовые аккаунты
2. Не используйте продакшн данные
3. Ограничьте количество попыток бронирования
4. Мониторьте логи на предмет ошибок

### Настройки безопасности
```javascript
const secureConfig = {
  headless: true, // Скрываем браузер в продакшене
  timeouts: {
    pageLoad: 30000,
    elementWait: 15000,
    actionDelay: 2000,
  },
  screenshots: {
    enabled: true,
    onError: true,
    onSuccess: false, // Не сохраняем скриншоты успешных операций
  },
};
```

## Мониторинг

### Метрики для отслеживания
- Время выполнения бронирования
- Успешность операций
- Количество ошибок
- Использование ресурсов

### Алерты
- Ошибки авторизации
- Неудачные попытки бронирования
- Превышение времени выполнения
- Критические ошибки воркера

## Следующие шаги

После успешного тестирования модуля 4:
1. Интеграция с системой уведомлений
2. Добавление retry логики
3. Масштабирование воркеров
4. Мониторинг и алерты
5. Оптимизация производительности
