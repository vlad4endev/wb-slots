# Тестирование модуля 3 - UI Обновление (автобронирование + выбор поставки)

## Обзор

Модуль 3 включает в себя:
- ✅ Чекбокс «Автобронирование» в форме
- ✅ При включении чекбокса → запрос к supply-fetcher, выпадающий список поставок
- ✅ Сохранение выбранной поставки в задаче (chosen_supply_id)
- ✅ UI корректно отправляет выбранную поставку и флаг авто
- ✅ В БД сохраняются новые поля
- ✅ Тест: создать задачу → убедиться, что выбранная поставка появляется в логах

## Компоненты

### Backend
- `backend/src/supplies/` - новый модуль для работы с поставками
- `backend/src/tasks/dto/create-task.dto.ts` - обновлен DTO с полем `chosenSupplyId`
- `backend/src/tasks/tasks.service.ts` - обновлен для сохранения `chosenSupplyId`
- `backend/prisma/schema.prisma` - добавлено поле `chosenSupplyId` в модель Task
- `backend/prisma/migrations/add_chosen_supply_id.sql` - миграция для БД

### Frontend
- `src/app/api/supplies/route.ts` - API роут для получения поставок
- `src/components/create-task-modal.tsx` - обновлена форма с выпадающим списком поставок
- `src/app/api/tasks/route.ts` - обновлен для передачи `chosenSupplyId`

## Запуск тестирования

### 1. Подготовка окружения

```bash
# Установка зависимостей
cd wb-slots
npm install

# Запуск миграций БД
cd backend
npx prisma db push
# или
npx prisma migrate dev --name add_chosen_supply_id
```

### 2. Запуск сервисов

```bash
# Backend
cd backend
npm run start:dev

# Frontend (в другом терминале)
cd wb-slots
npm run dev
```

### 3. Выполнение тестов

```bash
# Автоматические тесты
node test-autobooking-integration.js

# Ручное тестирование через UI
# Откройте http://localhost:3000/tasks
# Нажмите "Создать задачу"
# Включите "Автобронирование"
# Выберите поставку из выпадающего списка
```

## Тестовые сценарии

### 1. Получение списка поставок
- **URL**: `GET /api/supplies?limit=10&status=active`
- **Ожидаемый результат**: Список активных поставок пользователя
- **Проверка**: Количество поставок > 0, корректная структура данных

### 2. Создание задачи с автобронированием
- **Данные**: 
  ```json
  {
    "name": "Тестовая задача с автобронированием",
    "autoBook": true,
    "autoBookSupplyId": "WBS123456789",
    "chosenSupplyId": "WBS123456789",
    "filters": { ... }
  }
  ```
- **Ожидаемый результат**: Задача создана с правильными полями
- **Проверка**: `autoBook = true`, `chosenSupplyId` сохранен

### 3. Проверка сохранения в БД
- **Запрос**: `SELECT chosen_supply_id FROM tasks WHERE id = ?`
- **Ожидаемый результат**: Поле `chosen_supply_id` содержит ID выбранной поставки
- **Проверка**: Соответствие отправленных и сохраненных данных

### 4. Проверка логов
- **Запрос**: `SELECT * FROM slot_search_logs WHERE meta->>'chosenSupplyId' IS NOT NULL`
- **Ожидаемый результат**: Логи содержат информацию о выбранной поставке
- **Проверка**: Наличие `chosenSupplyId` в метаданных логов

## Проверка UI

### 1. Форма создания задачи
- [ ] Чекбокс "Автобронирование" присутствует
- [ ] При включении чекбокса появляется выпадающий список поставок
- [ ] Список поставок загружается автоматически
- [ ] Можно выбрать поставку из списка
- [ ] Выбранная поставка отображается корректно
- [ ] Можно отменить выбор поставки

### 2. Валидация формы
- [ ] При включении автобронирования выбор поставки обязателен
- [ ] Форма не отправляется без выбранной поставки
- [ ] Отображаются ошибки валидации

### 3. Отправка данных
- [ ] При отправке формы передается `autoBook: true`
- [ ] При отправке формы передается `chosenSupplyId`
- [ ] Данные корректно сохраняются в БД

## Проверка API

### 1. Backend API
```bash
# Получение поставок
curl "http://localhost:3001/supplies?limit=10&status=active" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Создание задачи
curl "http://localhost:3001/tasks" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Task",
    "autoBook": true,
    "chosenSupplyId": "WBS123456789",
    "filters": { ... }
  }'
```

### 2. Frontend API
```bash
# Получение поставок
curl "http://localhost:3000/api/supplies?limit=10&status=active"

# Создание задачи
curl "http://localhost:3000/api/tasks" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Task",
    "autoBook": true,
    "chosenSupplyId": "WBS123456789",
    "filters": { ... }
  }'
```

## Ожидаемые результаты

### 1. Структура ответа API поставок
```json
{
  "success": true,
  "data": {
    "supplies": [
      {
        "id": "WBS123456789",
        "name": "Поставка #123456789",
        "status": "ACTIVE",
        "warehouseId": 117501,
        "boxTypeId": 2,
        "supplyDate": "2024-01-15T00:00:00.000Z",
        "createdAt": "2024-01-10T10:00:00.000Z",
        "updatedAt": "2024-01-10T10:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 1,
      "hasMore": false
    }
  },
  "message": "Found 1 supplies"
}
```

### 2. Структура задачи в БД
```sql
SELECT 
  id,
  name,
  auto_book,
  auto_book_supply_id,
  chosen_supply_id,
  created_at
FROM tasks 
WHERE id = 'task_id';
```

### 3. Логи с информацией о поставке
```json
{
  "level": "INFO",
  "message": "Task created with auto-booking enabled",
  "meta": {
    "userId": "user_id",
    "taskId": "task_id",
    "chosenSupplyId": "WBS123456789",
    "autoBook": true
  }
}
```

## Устранение неполадок

### 1. Ошибка "No active supplies token found"
- Убедитесь, что пользователь добавил SUPPLIES токен в настройках
- Проверьте, что токен активен в базе данных

### 2. Ошибка "Supplies not found"
- Проверьте, что у пользователя есть активные поставки в WB
- Убедитесь, что токен имеет права на получение поставок

### 3. Ошибка "chosenSupplyId not saved"
- Проверьте, что миграция БД выполнена
- Убедитесь, что поле `chosenSupplyId` добавлено в модель Task

### 4. UI не загружает поставки
- Проверьте консоль браузера на ошибки
- Убедитесь, что API `/api/supplies` работает
- Проверьте, что пользователь авторизован

## Критерии завершения

- [x] UI корректно отправляет выбранную поставку и флаг авто
- [x] В БД сохраняются новые поля
- [x] Тест: создать задачу → убедиться, что выбранная поставка появляется в логах

## Следующие шаги

После успешного тестирования модуля 3 можно переходить к:
- Модуль 4: Реализация автобронирования
- Модуль 5: Интеграция с WB API для бронирования
- Модуль 6: Уведомления о результатах бронирования
