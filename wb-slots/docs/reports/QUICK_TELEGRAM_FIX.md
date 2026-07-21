# 🚀 Быстрое решение проблемы "Bot token not configured"

## 🎯 Проблема
Ошибка: **"Bot token not configured"** - токен Telegram бота не настроен.

## ✅ Пошаговое решение

### Шаг 1: Проверка текущего состояния
```bash
node check-telegram-token.js
```

**Ожидаемый результат:** ❌ No Telegram bot token found!

### Шаг 2: Изменение роли пользователя (если нужно)

Если у вас роль USER, нужно изменить на DEVELOPER или ADMIN:

```bash
node set-user-role.js
```

**Введите:**
- Email: `vl4en.95@yandex.ru` (ваш email)
- Role: `DEVELOPER`

### Шаг 3: Создание Telegram бота

1. **Откройте Telegram** и найдите [@BotFather](https://t.me/botfather)
2. **Отправьте команду:** `/newbot`
3. **Введите имя бота:** `WB Slots Notifier`
4. **Введите username:** `wb_slots_notifier_bot` (должен быть уникальным)
5. **Скопируйте токен** (формат: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Шаг 4: Сохранение токена

```bash
node set-telegram-token.js
```

**Вставьте токен** из шага 3.

### Шаг 5: Проверка результата

```bash
node check-telegram-token.js
```

**Ожидаемый результат:** ✅ Telegram bot token is configured!

## 🔧 Альтернативный способ (через файл)

Если скрипты не работают, можно настроить через файл:

1. **Откройте `.env.local`**
2. **Найдите строку:** `TELEGRAM_BOT_TOKEN=""`
3. **Замените на:** `TELEGRAM_BOT_TOKEN="ваш_токен_здесь"`
4. **Перезапустите сервер:** `npm run dev`

## 🧪 Проверка через браузер

1. **Откройте:** http://localhost:3000/settings/telegram
2. **Проверьте статус бота** - должен быть зеленый
3. **Попробуйте отправить тестовое сообщение**

## 🆘 Если ничего не помогает

### Проверьте логи сервера:
- Откройте терминал где запущен `npm run dev`
- Посмотрите на ошибки в консоли

### Проверьте базу данных:
```sql
SELECT * FROM bot_settings WHERE key = 'telegram_bot_token';
SELECT * FROM "User" WHERE email = 'vl4en.95@yandex.ru';
```

### Проверьте права доступа:
- Убедитесь, что у вас роль DEVELOPER или ADMIN
- Проверьте, что можете сохранять данные в базу

## 📋 Чек-лист

- [ ] Роль пользователя: DEVELOPER или ADMIN
- [ ] Telegram бот создан через @BotFather
- [ ] Токен бота получен и сохранен
- [ ] Сервер перезапущен (если изменяли .env.local)
- [ ] Статус бота: "настроен" (зеленый)
- [ ] Тестовое сообщение отправляется

---

*После выполнения всех шагов ошибка "Bot token not configured" должна исчезнуть!* ✅
