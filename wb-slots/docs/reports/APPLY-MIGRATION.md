# 🔧 Инструкция по применению миграции

## Проблема

База данных не синхронизирована со схемой Prisma. Колонка `expires_at` отсутствует в таблице `wb_sessions`.

## Решение (без потери данных)

### Вариант 1: Применить миграцию через Prisma (рекомендуется)

```bash
cd wb-slots
npx prisma migrate dev --name add_expires_at_to_wb_sessions
```

Эта команда:
- ✅ Создаст миграцию, которая добавит колонку `expires_at`
- ✅ **НЕ удалит существующие данные**
- ✅ Применит миграцию к базе данных

### Вариант 2: Применить SQL напрямую (если Prisma не работает)

Если Prisma выдает ошибки, выполните SQL напрямую:

```sql
-- Добавляем колонку expires_at (NULL разрешен для обратной совместимости)
ALTER TABLE "wb_sessions" 
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

-- Создаем индекс для производительности
CREATE INDEX IF NOT EXISTS "wb_sessions_expires_at_idx" 
ON "wb_sessions"("expires_at");
```

### Вариант 3: Использовать db push (только для разработки)

```bash
cd wb-slots
npx prisma db push
```

**⚠️ Внимание:** `db push` синхронизирует схему, но не создает миграцию. Используйте только в разработке!

## После применения миграции

1. Обновите Prisma Client:
   ```bash
   npx prisma generate
   ```

2. Раскомментируйте использование `expiresAt` в коде:
   - `src/lib/auth/advanced-auth-manager.ts` (строка 334)
   - `src/lib/session/session-scheduler.ts` (строки 181-183, 189)
   - `src/lib/services/enhanced-session-manager.ts` (строки 338, 376, 463)
   - `src/lib/services/enhanced-wb-session-manager.ts` (строка 541)
   - `src/lib/session/wb-session-manager.ts` (строка 446)

3. Удалите временные комментарии и проверьте работу

## Проверка после миграции

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'wb_sessions' AND column_name = 'expires_at';
```

Ожидаемый результат:
- `column_name`: `expires_at`
- `data_type`: `timestamp without time zone`
- `is_nullable`: `YES`

