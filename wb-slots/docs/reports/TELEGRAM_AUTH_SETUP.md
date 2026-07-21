# 🤖 Настройка авторизации через Telegram

## 📋 Обзор

Система авторизации через Telegram Web App позволяет пользователям входить в приложение используя свой Telegram аккаунт. При первом входе автоматически создается профиль пользователя с данными из Telegram.

## 🚀 Возможности

- ✅ **Безопасная авторизация** через Telegram Web App
- ✅ **Автоматическое создание профиля** при первом входе
- ✅ **Сохранение данных Telegram** в профиле пользователя
- ✅ **Автоматическая настройка уведомлений** Telegram
- ✅ **Обновление данных профиля** из Telegram
- ✅ **Поддержка Premium пользователей** Telegram

## 🛠 Настройка

### 1. Создание Telegram бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Создайте нового бота командой `/newbot`
3. Следуйте инструкциям и получите токен бота
4. Настройте Web App командой `/newapp`

### 2. Настройка переменных окружения

Добавьте в ваш `.env` файл:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="your_bot_token_here"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="your_bot_username"
```

### 3. Настройка Web App в BotFather

1. Откройте [@BotFather](https://t.me/BotFather)
2. Выберите вашего бота
3. Выполните команду `/newapp`
4. Укажите URL вашего приложения: `https://yourdomain.com/auth/telegram`
5. Загрузите иконку и описание приложения

## 📱 Использование

### Для пользователей

1. **Открытие в Telegram:**
   - Перейдите к вашему боту в Telegram
   - Нажмите кнопку "Запустить" или используйте команду `/start`
   - Выберите "Открыть Web App"

2. **Авторизация:**
   - При первом входе автоматически создается профиль
   - Данные из Telegram сохраняются в профиле
   - Настройки уведомлений автоматически настраиваются

3. **Доступ к приложению:**
   - После авторизации пользователь перенаправляется в приложение
   - Все функции доступны как при обычной авторизации

### Для разработчиков

#### API Endpoints

**POST** `/api/auth/telegram`
- Авторизация через Telegram Web App
- Создание нового пользователя при первом входе
- Обновление данных профиля

**GET** `/api/auth/profile`
- Получение профиля пользователя с данными Telegram

#### Компоненты

**TelegramAuth** (`/components/telegram-auth.tsx`)
- Компонент авторизации через Telegram
- Автоматическое определение Web App окружения
- Обработка ошибок и состояний загрузки

**UserProfileTelegram** (`/components/user-profile-telegram.tsx`)
- Отображение информации о Telegram аккаунте
- Интеграция с профилем пользователя

## 🔒 Безопасность

### Проверка подписи

В продакшене система проверяет подпись данных Telegram Web App:

```typescript
function validateTelegramWebAppData(initData: string, botToken: string): boolean {
  // Проверка HMAC-SHA256 подписи
  // Защита от подделки данных
}
```

### Защита данных

- Все данные пользователя шифруются
- Telegram ID сохраняется в зашифрованном виде
- JWT токены для авторизации
- Проверка прав доступа

## 📊 Структура данных

### Модель пользователя

```typescript
interface User {
  id: string;
  email: string; // Временный email для Telegram пользователей
  name: string; // Из Telegram профиля
  telegramUser?: {
    id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isPremium?: boolean;
  };
}
```

### Настройки Telegram

```typescript
interface TelegramSettings {
  chatId: string;
  enabled: boolean;
  userInfo: {
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isPremium?: boolean;
  };
}
```

## 🔄 Workflow авторизации

1. **Пользователь открывает Web App в Telegram**
2. **Система получает данные пользователя** из `window.Telegram.WebApp`
3. **Проверяется подпись данных** (в продакшене)
4. **Поиск существующего пользователя** по Telegram ID
5. **Создание нового пользователя** (если не найден)
6. **Обновление данных профиля** из Telegram
7. **Генерация JWT токена** для авторизации
8. **Перенаправление в приложение**

## 🐛 Отладка

### Проверка Web App

1. Откройте `/test-telegram-webapp` в браузере
2. Проверьте доступность `window.Telegram.WebApp`
3. Убедитесь в корректности данных пользователя

### Логи

```bash
# Проверка логов авторизации
tail -f logs/app.log | grep "Telegram auth"
```

### Тестирование

```bash
# Запуск тестов
npm test -- --grep "telegram"
```

## 📝 Примеры использования

### Создание кнопки авторизации

```tsx
import TelegramAuth from '@/components/telegram-auth';

function LoginPage() {
  const handleSuccess = (user) => {
    console.log('User authenticated:', user);
    // Перенаправление в приложение
  };

  return (
    <TelegramAuth 
      onSuccess={handleSuccess}
      redirectTo="/dashboard"
    />
  );
}
```

### Получение профиля с Telegram данными

```tsx
const response = await fetch('/api/auth/profile');
const data = await response.json();

if (data.success) {
  const { user } = data.data;
  console.log('Telegram user:', user.telegramUser);
}
```

## 🚨 Важные замечания

1. **Токен бота** должен храниться в безопасности
2. **Web App URL** должен быть HTTPS в продакшене
3. **Проверка подписи** обязательна в продакшене
4. **Временные email** создаются для Telegram пользователей
5. **Обновление данных** происходит при каждом входе

## 📞 Поддержка

При возникновении проблем:

1. Проверьте настройки бота в BotFather
2. Убедитесь в корректности переменных окружения
3. Проверьте логи приложения
4. Убедитесь в доступности Web App URL

## 🔄 Обновления

### v1.0.0
- ✅ Базовая авторизация через Telegram Web App
- ✅ Автоматическое создание профилей
- ✅ Сохранение данных Telegram
- ✅ Интеграция с настройками уведомлений

### Планируемые функции
- 🔄 Синхронизация аватаров
- 🔄 Поддержка групп и каналов
- 🔄 Расширенные настройки уведомлений
- 🔄 Аналитика использования
