# 🚀 Быстрое исправление проблемы с expires_at

## Текущая ситуация

Колонка `expires_at` отсутствует в базе данных, но используется в коде. Все запросы с `expiresAt` временно закомментированы для безопасной работы.

## ✅ Что уже исправлено

1. ✅ Код работает без колонки `expires_at`
2. ✅ Все запросы с `expiresAt` временно отключены
3. ✅ Создан файл миграции SQL

## 📋 Что нужно сделать

### Вариант 1: SQL напрямую (самый быстрый)

Подключитесь к PostgreSQL и выполните:

```sql
ALTER TABLE "wb_sessions" 
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "wb_sessions_expires_at_idx" 
ON "wb_sessions"("expires_at");
```

Затем обновите Prisma Client:
```bash
cd wb-slots
npx prisma generate
```

### Вариант 2: Через Prisma (рекомендуется)

```bash
cd wb-slots

# Применить изменения схемы
npx prisma db push

# Или создать миграцию
npx prisma migrate dev --name add_expires_at_to_wb_sessions
```

**Если Prisma выдает ошибку о конфликте .env файлов:**
- Убедитесь, что используете правильный `.env` файл
- Или временно переименуйте `..\.env` в `..\.env.backup`

## После применения миграции

Код будет работать корректно, но для полной функциональности:

1. Раскомментируйте использование `expiresAt` в файлах:
   - `src/lib/auth/advanced-auth-manager.ts`
   - `src/lib/session/session-scheduler.ts`
   - `src/lib/services/enhanced-session-manager.ts`
   - `src/lib/services/enhanced-wb-session-manager.ts`
   - `src/lib/session/wb-session-manager.ts`

2. Проверьте работу приложения

## ⚠️ Важно

Миграция **НЕ удалит** существующие данные. Колонка `expires_at` будет `NULL` для старых записей, что нормально - код обрабатывает это.

