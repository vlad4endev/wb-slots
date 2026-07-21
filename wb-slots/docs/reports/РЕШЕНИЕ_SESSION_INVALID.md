# 🔧 РЕШЕНИЕ ОШИБКИ "Session validation failed"

## 🚨 Проблема

```json
{
  "success": false,
  "error": "Session validation failed",
  "details": {
    "stepResults": [
      {
        "step": "session_validation",
        "success": false,
        "error": "Session invalid"
      }
    ]
  }
}
```

## 🔍 Причина

После наших исправлений система **строго проверяет браузерные сессии** перед бронированием:

1. ✅ Наличие активной `WBSession` в БД
2. ✅ Проверка `expiresAt < now` (не истекла ли)
3. ✅ Проверка `isActive = true`
4. ✅ Наличие auth cookies в браузере
5. ✅ Отсутствие редиректа на `/login`

**Ошибка = хотя бы одна проверка не прошла.**

---

## ✅ РЕШЕНИЕ 1: Создать сессию через UI (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Проверьте текущую сессию

```bash
npx tsx check-session.ts
# Покажет всех пользователей

npx tsx check-session.ts <ваш-user-id>
# Проверит конкретного пользователя
```

**Возможные результаты:**

#### ❌ "Сессия не найдена"
```
❌ Сессия не найдена в БД
💡 Решение:
   1. Откройте страницу аутентификации: /wb-auth
   2. Войдите в личный кабинет Wildberries
   3. Система автоматически сохранит сессию
```

#### ⚠️ "Сессия НЕ активна"
```
⚠️ Сессия НЕ активна
   Причина деактивации: Session expired during booking validation
💡 Решение:
   Необходимо создать новую сессию через /wb-auth
```

#### ⚠️ "Сессия ИСТЕКЛА"
```
⚠️ Сессия ИСТЕКЛА
   Истекла: 2025-10-28T12:00:00.000Z
   Сейчас:  2025-11-01T14:00:00.000Z
💡 Решение:
   1. Деактивируем старую сессию ✅
   2. Создайте новую сессию через /wb-auth
```

#### ✅ "СЕССИЯ ВАЛИДНА"
```
✅ СЕССИЯ ВАЛИДНА
   sessionData размер: 4567 байт
   До истечения: 4320 минут
```

---

### Шаг 2: Создайте новую сессию

**2.1. Запустите dev сервер:**
```bash
npm run dev
```

**2.2. Откройте страницу аутентификации:**
```
http://localhost:3000/wb-auth
```

**2.3. Войдите в Wildberries:**
- Введите логин/пароль от seller.wildberries.ru
- Пройдите 2FA если требуется
- Дождитесь успешного входа

**2.4. Проверьте, что сессия сохранена:**
```bash
npx tsx check-session.ts <ваш-user-id>
# Должно показать: ✅ СЕССИЯ ВАЛИДНА
```

**2.5. Попробуйте бронирование снова:**
```bash
curl -X POST http://localhost:3000/api/auto-booking/book-slot \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "ваш-user-id",
    "taskId": "test-task",
    "runId": "test-run",
    "slotId": "test-slot",
    "supplyId": "test-supply",
    "warehouseId": 301983,
    "boxTypeId": 1,
    "date": "2025-11-05",
    "coefficient": 1.5
  }'
```

---

## ✅ РЕШЕНИЕ 2: Быстрая тестовая сессия (ДЛЯ ОТЛАДКИ)

⚠️ **Внимание:** Это создаст **ФЕЙКОВУЮ** сессию только для тестирования кода.  
Реальное бронирование **НЕ СРАБОТАЕТ** без настоящих cookies от WB!

```bash
# Создать тестовую сессию
npx tsx create-test-session.ts <ваш-user-id>

# Проверить
npx tsx check-session.ts <ваш-user-id>
# Должно показать: ✅ СЕССИЯ ВАЛИДНА (но с пометкой "тестовая")
```

Это полезно для:
- ✅ Проверки логики валидации сессий
- ✅ Тестирования retry policy
- ✅ Проверки cleanup браузера
- ❌ **НЕ для реального бронирования!**

---

## 📊 ДИАГНОСТИКА ПРОБЛЕМ

### Проблема 1: "No active session found"

**Причина:** В таблице `wb_sessions` нет записи для вашего `userId`.

**Решение:**
```sql
-- Проверка в БД
SELECT * FROM wb_sessions WHERE user_id = 'ваш-user-id';

-- Если пусто → создайте сессию через /wb-auth
```

---

### Проблема 2: "Session expired"

**Причина:** `WBSession.expiresAt < now()`

**Решение:**
```sql
-- Проверка истекших сессий
SELECT 
  user_id, 
  expires_at, 
  is_active,
  NOW() - expires_at as expired_ago
FROM wb_sessions 
WHERE expires_at < NOW();

-- Автоматическая очистка (уже встроена в код)
DELETE FROM wb_sessions WHERE expires_at < NOW();
```

---

### Проблема 3: "Authentication cookies missing"

**Причина:** В сессии нет cookies с именами `auth`, `session`, `token`.

**Решение:**
1. Пересоздайте сессию через `/wb-auth`
2. Убедитесь, что браузер разрешает cookies для `wildberries.ru`
3. Проверьте, не блокирует ли firewall/antivirus cookies

---

### Проблема 4: "Redirected to login"

**Причина:** Wildberries редиректит на страницу логина → сессия невалидна.

**Решение:**
1. Cookies истекли → пересоздайте сессию
2. IP адрес изменился → WB заблокировал сессию
3. Слишком много запросов → rate limit

---

## 🛠️ ОТЛАДКА ШАГ ЗА ШАГОМ

### 1. Найдите ваш userId

```typescript
// В консоли браузера (Developer Tools)
localStorage.getItem('userId');

// Или в БД
SELECT id, email FROM users LIMIT 10;
```

### 2. Проверьте наличие сессии

```bash
npx tsx check-session.ts <userId>
```

### 3. Если сессии нет → создайте

```
http://localhost:3000/wb-auth
```

### 4. Проверьте снова

```bash
npx tsx check-session.ts <userId>
# Должно: ✅ СЕССИЯ ВАЛИДНА
```

### 5. Запустите бронирование

```typescript
import { autoBookingService } from '@/lib/services/auto-booking-service';

const result = await autoBookingService.startBooking({
  taskId: 'test-task',
  userId: 'ваш-user-id',
  runId: 'test-run',
  slotId: 'test-slot',
  supplyId: 'test-supply',
  warehouseId: 301983,
  boxTypeId: 1,
  date: '2025-11-05',
  coefficient: 1.5,
});

console.log('Результат:', result);
```

---

## 🔐 БЕЗОПАСНОСТЬ СЕССИЙ

После наших исправлений система стала **СТРОЖЕ**:

| Проверка | ДО | ПОСЛЕ |
|----------|-----|-------|
| expiresAt | ❌ Не проверяется | ✅ Проверяется |
| isActive | ⚠️ Иногда | ✅ Всегда |
| Cookies | ❌ Не проверяется | ✅ Проверяется |
| Redirect | ❌ Не проверяется | ✅ Проверяется |
| Деактивация при ошибке | ❌ Нет | ✅ Да |

**Это нормально!** Теперь система не будет тратить время на бронирование с невалидной сессией.

---

## 📝 ЧЕКЛИСТ ПЕРЕД БРОНИРОВАНИЕМ

- [ ] Сессия существует в БД (`wb_sessions`)
- [ ] `isActive = true`
- [ ] `expiresAt > now()` или `expiresAt IS NULL`
- [ ] `sessionData` не пустой
- [ ] Cookies созданы через реальный вход в WB
- [ ] Последняя валидация < 24 часов назад

**Если всё ✅ → бронирование должно работать!**

---

## 🆘 Если ничего не помогло

1. **Проверьте логи браузера:**
   ```
   screenshots/auto-booking/error-*.png
   ```

2. **Проверьте логи БД:**
   ```sql
   SELECT * FROM run_logs 
   WHERE level = 'ERROR' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Проверьте блокировки:**
   ```sql
   SELECT * FROM booking_locks 
   WHERE user_id = 'ваш-user-id';
   
   -- Если есть "зависшая" блокировка → удалите
   DELETE FROM booking_locks WHERE user_id = 'ваш-user-id';
   ```

4. **Откройте issue с логами:**
   - Результат `check-session.ts`
   - Скриншот из `screenshots/`
   - Логи из `run_logs`

---

## ✅ ИТОГ

**Ошибка "Session validation failed" — это ХОРОШО!** 

Наши исправления **предотвращают** попытки бронирования с невалидной сессией, экономя время и ресурсы.

**Решение простое:**
1. Создайте сессию через `/wb-auth`
2. Проверьте через `check-session.ts`
3. Запустите бронирование

**Готово!** 🚀

