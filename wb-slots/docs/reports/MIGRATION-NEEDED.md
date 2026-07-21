# ⚠️ ТРЕБУЕТСЯ МИГРАЦИЯ БАЗЫ ДАННЫХ

## Проблема

Колонка `expires_at` не существует в текущей базе данных, но используется в коде. Это вызывает ошибки при выполнении запросов.

## Решение

Необходимо применить миграцию Prisma для добавления колонки `expires_at`.

### Шаг 1: Создать миграцию

```bash
cd wb-slots
npx prisma migrate dev --name add_expires_at_to_wb_sessions --create-only
```

### Шаг 2: Проверить сгенерированную миграцию

Убедитесь, что миграция:
- ✅ Добавляет колонку `expires_at` как `nullable` (не обязательную)
- ✅ **НЕ** удаляет существующие данные
- ✅ Устанавливает дефолтное значение только для новых записей

### Шаг 3: Применить миграцию

```bash
npx prisma migrate deploy
```

### Шаг 4: Обновить Prisma Client

```bash
npx prisma generate
```

## Временное решение

Код уже исправлен для работы без колонки `expires_at`. Все запросы, использующие это поле, временно закомментированы или используют условные проверки.

**После применения миграции:**
1. Раскомментируйте использование `expiresAt` в:
   - `src/lib/auth/advanced-auth-manager.ts` (строка 332)
   - `src/lib/session/session-scheduler.ts` (строки 179-181, 187)
   - Другие файлы, использующие `expiresAt` в where-условиях

2. Проверьте работу всех функций, использующих `expiresAt`

## Проверка после миграции

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'wb_sessions' AND column_name = 'expires_at';
```

Ожидаемый результат:
- `column_name`: `expires_at`
- `data_type`: `timestamp without time zone` (или похожий)
- `is_nullable`: `YES`

