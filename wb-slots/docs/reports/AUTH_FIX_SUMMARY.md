# Исправление проблемы с аутентификацией JWT

## Проблема
При загрузке поставок в форме создания задачи возникала ошибка 401 Unauthorized:
```
❌ Backend API error: 401 {"message":"Unauthorized","statusCode":401}
```

## Причина
Frontend и backend использовали разные JWT_SECRET:
- **Frontend**: `'wb-slots-super-secret-jwt-key-2024'` (fallback)
- **Backend**: ожидал переменную окружения `JWT_SECRET`

## Решение

### 1. Создан файл `.env` для backend
```bash
# wb-slots/backend/.env
JWT_SECRET="wb-slots-super-secret-jwt-key-2024"
JWT_EXPIRES_IN="7d"
# ... другие настройки
```

### 2. Создан файл `.env.local` для frontend
```bash
# wb-slots/.env.local
JWT_SECRET="wb-slots-super-secret-jwt-key-2024"
JWT_EXPIRES_IN="7d"
# ... другие настройки
```

### 3. Исправлен API `/api/supplies/route.ts`
- Добавлено извлечение JWT токена из cookie
- Токен теперь правильно передается в backend

## Изменения в коде

### `src/app/api/supplies/route.ts`
```typescript
// Извлекаем JWT токен из cookie для передачи в backend
const authToken = request.cookies.get('auth-token')?.value;
if (!authToken) {
  console.error('❌ No auth token found in cookies');
  return NextResponse.json(
    { success: false, error: 'Authentication token not found' },
    { status: 401 }
  );
}

const backendResponse = await fetch(backendUrl.toString(), {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`, // Используем токен из cookie
    'Content-Type': 'application/json',
  },
});
```

## Тестирование

### Скрипты для тестирования
1. `setup-backend-env.js` - создает .env для backend
2. `setup-frontend-env.js` - создает .env.local для frontend  
3. `test-auth-fix.js` - тестирует исправленную аутентификацию

### Запуск тестов
```bash
# Настройка переменных окружения
node setup-backend-env.js
node setup-frontend-env.js

# Тестирование
node test-auth-fix.js
```

## Проверка работы

### 1. Запустите backend
```bash
cd backend
npm run start:dev
```

### 2. Запустите frontend
```bash
npm run dev
```

### 3. Авторизуйтесь в браузере
- Откройте http://localhost:3000
- Войдите в систему
- Перейдите к созданию задачи

### 4. Проверьте загрузку поставок
- Включите автобронирование
- Должны загрузиться поставки со статусом "черновик"

## Ожидаемый результат

После исправления:
- ✅ Backend правильно требует аутентификацию
- ✅ Frontend API передает JWT токен в backend
- ✅ Поставки загружаются со статусом "черновик"
- ✅ Нет ошибок 401 Unauthorized

## Дополнительные файлы

- `DRAFT_SUPPLIES_FEATURE.md` - документация по загрузке поставок-черновиков
- `test-draft-supplies.js` - тест загрузки поставок
- `AUTH_FIX_SUMMARY.md` - этот файл

## Устранение неполадок

### Если все еще есть ошибка 401:
1. Проверьте, что файлы .env созданы
2. Перезапустите backend и frontend
3. Очистите cookies в браузере
4. Авторизуйтесь заново

### Если backend не запускается:
1. Проверьте, что база данных запущена
2. Проверьте переменные в .env
3. Установите зависимости: `npm install`

### Если frontend не работает:
1. Проверьте переменные в .env.local
2. Перезапустите Next.js: `npm run dev`
3. Очистите кэш: `rm -rf .next`
