# Настройка Telegram Web App для автоматического получения ID

## Описание
Telegram Web App позволяет автоматически получать Telegram ID пользователя без необходимости ручного ввода. Пользователь может авторизоваться через Telegram и получить свой ID автоматически.

## Настройка бота для Web App

### 1. Создание бота
1. Напишите @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный токен

### 2. Настройка Web App
1. Напишите @BotFather
2. Отправьте `/setmenubutton`
3. Выберите вашего бота
4. Отправьте текст кнопки (например: "Открыть WB Slots")
5. Отправьте URL вашего приложения (например: `https://yourdomain.com/settings/telegram`)

### 3. Настройка домена
1. Отправьте @BotFather команду `/setdomain`
2. Выберите вашего бота
3. Укажите домен вашего приложения (например: `yourdomain.com`)

## Использование в приложении

### 1. Компонент TelegramAuthButton
```tsx
import TelegramAuthButton from '@/components/telegram-auth-button';

<TelegramAuthButton
  onSuccess={(telegramId, userInfo) => {
    console.log('Telegram ID:', telegramId);
    console.log('User Info:', userInfo);
  }}
  onError={(error) => {
    console.error('Error:', error);
  }}
/>
```

### 2. API Endpoints

#### POST /api/settings/telegram/get-user-id
Получает и сохраняет Telegram ID пользователя.

**Request:**
```json
{
  "telegramData": {
    "id": 123456789,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Telegram ID получен и сохранен автоматически",
  "telegramId": "123456789",
  "userInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe"
  }
}
```

#### GET /api/settings/telegram/get-user-id
Получает текущие настройки Telegram пользователя.

**Response:**
```json
{
  "chatId": "123456789",
  "enabled": true,
  "userInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe"
  },
  "hasTelegramId": true
}
```

## Безопасность

### 1. Валидация данных
- Все данные от Telegram Web App должны быть проверены
- Используйте официальный API Telegram для валидации
- Проверяйте подпись данных (если необходимо)

### 2. Ограничения доступа
- API доступен только авторизованным пользователям
- Telegram ID привязывается к аккаунту пользователя в системе

## Отладка

### 1. Проверка Web App
```javascript
// В консоли браузера
console.log('Telegram WebApp:', window.Telegram?.WebApp);
console.log('User data:', window.Telegram?.WebApp?.initDataUnsafe?.user);
```

### 2. Тестирование
1. Откройте приложение в Telegram через бота
2. Проверьте, что `window.Telegram.WebApp` доступен
3. Убедитесь, что данные пользователя загружаются
4. Протестируйте получение ID

## Примеры использования

### 1. Простая авторизация
```tsx
const handleTelegramAuth = (telegramId, userInfo) => {
  setChatId(telegramId);
  setEnabled(true);
  setUserInfo(userInfo);
};
```

### 2. Обработка ошибок
```tsx
const handleTelegramError = (error) => {
  setError(error);
  // Показать пользователю инструкции по ручному вводу
};
```

## Преимущества

1. **Удобство**: Пользователю не нужно искать свой Chat ID
2. **Безопасность**: Данные получаются напрямую от Telegram
3. **Автоматизация**: ID сохраняется автоматически
4. **Информация о пользователе**: Дополнительные данные (имя, username)

## Ограничения

1. **Только в Telegram**: Работает только при открытии через бота
2. **Зависимость от бота**: Требует настройки бота и Web App
3. **Ограничения Telegram**: Подчиняется правилам Telegram Web App
