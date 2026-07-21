# Настройка аутентификации

## Проблема
Ошибка `AuthError: Authentication required` с кодом статуса 401 указывает, что запросы к API не аутентифицированы.

## Решение

### 1. Настройка переменных окружения

Создайте файл `.env.local` в корне проекта с следующими настройками:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT - ВАЖНО: Используйте сильный секретный ключ
JWT_SECRET="wb-slots-super-secret-jwt-key-2024-production-ready-key-change-this"
JWT_EXPIRES_IN="30d"

# Encryption - 32-байтный ключ в base64
ENCRYPTION_KEY="dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n"

# App
APP_BASE_URL="http://localhost:3000"
NODE_ENV="development"
```

### 2. Генерация сильного JWT секрета

Для продакшена сгенерируйте сильный секретный ключ:

```bash
# Используйте онлайн генератор или:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Проверка аутентификации

Убедитесь, что:

1. **Пользователь залогинен** - проверьте, что в браузере есть cookie `auth-token`
2. **Токен валиден** - проверьте, что токен не истек
3. **Правильные заголовки** - API запросы должны содержать токен в заголовке `Authorization: Bearer <token>` или в cookie

### 4. Отладка

Добавлены логи для отладки аутентификации:

- `No token found in request` - токен не найден в запросе
- `Token found in Authorization header` - токен найден в заголовке
- `Token found in cookie` - токен найден в cookie
- `User not found for token payload` - пользователь не найден в базе данных

### 5. Исправленные API маршруты

Обновлены следующие маршруты для правильной обработки ошибок аутентификации:

- `/api/tasks` - GET, POST
- `/api/dashboard/stats` - GET
- `/api/tokens` - GET, POST
- `/api/warehouses` - GET, POST

Теперь они возвращают статус 401 вместо 500 при ошибках аутентификации.

### 6. Проверка работы

1. Запустите приложение: `npm run dev`
2. Откройте браузер и перейдите на `http://localhost:3000`
3. Войдите в систему
4. Проверьте, что API запросы работают без ошибок 401

### 7. Дополнительные рекомендации

- Убедитесь, что база данных PostgreSQL запущена
- Проверьте, что Redis запущен (если используется)
- Убедитесь, что все зависимости установлены: `npm install`
