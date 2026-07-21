# Тестирование модуля поиска слотов

## Обзор

Модульное обновление фильтрации задач включает в себя:
- ✅ Переписанная фильтрация на backend (коэффициент, даты, склады)
- ✅ Параметр интервала обновления (по умолчанию 30 сек)
- ✅ Настроенное логирование ошибок и пустых результатов
- ✅ Структурированный JSON ответ в UI

## Компоненты

### Backend
- `backend/src/tasks/tasks.controller.ts` - новый endpoint `/tasks/search-slots`
- `backend/src/tasks/tasks.service.ts` - метод `searchSlots()` с фильтрацией
- `backend/src/lib/wb-client/` - WB API клиент для backend
- `backend/src/lib/logger.service.ts` - улучшенное логирование
- `backend/src/lib/encryption.ts` - шифрование токенов

### Frontend
- `src/app/api/tasks/search-slots/route.ts` - API роут для frontend
- `src/components/slot-search.tsx` - компонент поиска слотов
- `src/components/slot-search-stats.tsx` - статистика поиска
- `src/app/slot-search/page.tsx` - страница поиска слотов
- `src/types/slot-search.ts` - типы для поиска слотов

## Запуск тестирования

### 1. Подготовка окружения

```bash
# Установка зависимостей
cd wb-slots
npm install

# Настройка переменных окружения
cp .env.example .env.local
# Добавьте BACKEND_URL=http://localhost:3001 в .env.local
```

### 2. Запуск backend

```bash
cd backend
npm install
npm run start:dev
```

### 3. Запуск frontend

```bash
npm run dev
```

### 4. Выполнение тестов

```bash
# Автоматические тесты
node test-slot-search.js

# Ручное тестирование через UI
# Откройте http://localhost:3000/slot-search
```

## Тестовые сценарии

### 1. Базовый поиск
- **Фильтры**: Склад Подольск (117501), короб + монопаллета, коэффициент 0-10
- **Ожидаемый результат**: Найдены слоты с коэффициентом ≤ 10

### 2. Поиск с высоким коэффициентом
- **Фильтры**: Склад Подольск, коэффициент 50-100
- **Ожидаемый результат**: Слоты не найдены (пустой результат)

### 3. Поиск по нескольким складам
- **Фильтры**: Склады 117501, 130744, 130745, коэффициент 0-20
- **Ожидаемый результат**: Найдены слоты с разных складов

### 4. Фильтрация по типам коробов
- **Фильтры**: Только короб (ID: 2), коэффициент 0-15
- **Ожидаемый результат**: Найдены только слоты с типом короб

### 5. Поиск в прошлом
- **Фильтры**: Даты в прошлом (30 дней назад)
- **Ожидаемый результат**: Слоты не найдены

## Проверка логирования

### 1. Логи в консоли
```bash
# Backend логи
cd backend
npm run start:dev
# Смотрите логи в консоли при выполнении поиска
```

### 2. Логи в базе данных
```sql
-- Проверка логов поиска
SELECT * FROM slot_search_logs 
WHERE level = 'ERROR' 
ORDER BY created_at DESC 
LIMIT 10;

-- Проверка пустых результатов
SELECT * FROM slot_search_logs 
WHERE level = 'WARN' 
AND message LIKE '%No slots found%'
ORDER BY created_at DESC 
LIMIT 10;
```

## Проверка структурированного ответа

### 1. Backend API
```bash
curl "http://localhost:3001/tasks/search-slots?warehouseIds=117501&boxTypeIds=2,5&coefficientMin=0&coefficientMax=10"
```

### 2. Frontend API
```bash
curl "http://localhost:3000/api/tasks/search-slots?warehouseIds=117501&boxTypeIds=2,5&coefficientMin=0&coefficientMax=10"
```

### Ожидаемый формат ответа:
```json
{
  "success": true,
  "data": {
    "foundSlots": [
      {
        "warehouseId": 117501,
        "warehouseName": "Подольск",
        "date": "2024-01-15",
        "timeSlot": "09:00-18:00",
        "coefficient": 5.5,
        "available": true,
        "boxTypes": [2],
        "boxTypeName": "Короб",
        "isSortingCenter": false,
        "storageCoef": "1.0",
        "deliveryCoef": "1.0"
      }
    ],
    "totalSearches": 1,
    "searchTime": 1250,
    "filters": {
      "warehouseIds": [117501],
      "boxTypeIds": [2, 5],
      "coefficientMin": 0,
      "coefficientMax": 10,
      "dateFrom": "2024-01-15T00:00:00.000Z",
      "dateTo": "2024-01-22T00:00:00.000Z",
      "isSortingCenter": false,
      "updateInterval": 30
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "updateInterval": 30
  },
  "message": "Found 1 slots"
}
```

## Критерии завершения

- [x] Фильтрация корректно применяется на стороне сервера
- [x] В интерфейсе отображаются только подходящие результаты
- [x] Тест: разные фильтры → разные результаты (проверка на staging)
- [x] Логи ошибок/пустых результатов появляются в консоли или БД

## Устранение неполадок

### 1. Ошибка "No active supplies token found"
- Убедитесь, что пользователь добавил SUPPLIES токен в настройках
- Проверьте, что токен активен в базе данных

### 2. Ошибка "Backend API error"
- Убедитесь, что backend запущен на порту 3001
- Проверьте переменную окружения BACKEND_URL

### 3. Пустые результаты поиска
- Проверьте правильность ID складов
- Убедитесь, что даты поиска корректны
- Проверьте логи для диагностики

### 4. Ошибки TypeScript
- Выполните `npm run build` для проверки типов
- Убедитесь, что все импорты корректны

## Мониторинг производительности

### 1. Время ответа API
- Backend: < 5 секунд
- Frontend: < 2 секунд

### 2. Использование памяти
- Backend: < 100MB
- Frontend: < 50MB

### 3. Логирование
- Ошибки: немедленно
- Пустые результаты: с предупреждением
- Успешные поиски: с информацией о количестве слотов
