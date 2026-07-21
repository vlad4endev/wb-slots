# 🔧 Руководство по управлению сессиями WB

## 📋 Обзор

Система теперь корректно определяет недействительные сессии и предоставляет инструменты для их управления.

## 🚨 Текущая ситуация

Из ваших логов видно, что система работает правильно:
- ✅ **Cookies восстанавливаются** - `🍪 Restoring 9 cookies`
- ✅ **Диагностика работает** - собирает полную информацию о сессии
- ✅ **Валидация срабатывает** - `Session integrity validation failed: Нет индикаторов авторизации`
- ✅ **Сессия деактивируется** - `🔒 Session deactivated due to error`

**Проблема:** Сессия действительно недействительна - пользователь не авторизован на WB.

## 🛠️ Инструменты для решения

### 1. **Принудительное создание новой сессии**

```bash
POST /api/wb-session/force-create
{
  "userId": "cmfvmlf4x0000pmjsmd3eouhu",
  "phoneNumber": "+7XXXXXXXXXX"
}
```

**Процесс:**
1. Открывается браузер для авторизации
2. Вводится номер телефона
3. Вводится SMS код
4. Создается новая валидная сессия

### 2. **Очистка недействительных сессий**

```bash
POST /api/wb-session/cleanup
{
  "userId": "cmfvmlf4x0000pmjsmd3eouhu",
  "action": "deactivate-invalid"
}
```

**Доступные действия:**
- `deactivate-invalid` - деактивирует недействительные сессии
- `deactivate-all` - деактивирует все сессии пользователя
- `validate-and-cleanup` - валидирует через браузер и очищает

### 3. **Скрипт для быстрой очистки**

```bash
# Очистка недействительных сессий
node cleanup-sessions.js cmfvmlf4x0000pmjsmd3eouhu deactivate-invalid

# Просмотр всех сессий
node cleanup-sessions.js cmfvmlf4x0000pmjsmd3eouhu list

# Деактивация всех сессий
node cleanup-sessions.js cmfvmlf4x0000pmjsmd3eouhu deactivate-all
```

### 4. **Детальная диагностика**

```bash
POST /api/wb-session/diagnostics
{
  "userId": "cmfvmlf4x0000pmjsmd3eouhu",
  "generateReport": true
}
```

## 🔄 Рекомендуемый порядок действий

### **Шаг 1: Очистка старых сессий**
```bash
node cleanup-sessions.js cmfvmlf4x0000pmjsmd3eouhu deactivate-invalid
```

### **Шаг 2: Создание новой сессии**
```bash
POST /api/wb-session/force-create
{
  "userId": "cmfvmlf4x0000pmjsmd3eouhu",
  "phoneNumber": "+7XXXXXXXXXX"
}
```

### **Шаг 3: Проверка статуса**
```bash
GET /api/wb-session/status?userId=cmfvmlf4x0000pmjsmd3eouhu
```

## 📊 Что изменилось в системе

### **Улучшенная валидация:**
- ✅ Проверка наличия данных в localStorage/sessionStorage
- ✅ Проверка заголовка страницы (не должен быть пустым)
- ✅ Множественные критерии валидации
- ✅ Строгая проверка целостности сессии

### **Детальная диагностика:**
- ✅ Полная информация о состоянии сессии
- ✅ Проверка всех компонентов (cookies, storage, DOM)
- ✅ Генерация подробных отчетов
- ✅ Рекомендации по исправлению

### **Надежное восстановление:**
- ✅ Валидация cookies перед восстановлением
- ✅ Фильтрация поврежденных данных
- ✅ Логирование процесса восстановления

## 🎯 Ожидаемые результаты

После использования новых инструментов:

1. **✅ Корректные сессии** - только валидные сессии будут активны
2. **✅ Надежная работа** - авто бронирование будет видеть только рабочие сессии
3. **✅ Детальная диагностика** - полная информация о проблемах
4. **✅ Простое управление** - легкая очистка и создание сессий

## 🚀 Быстрый старт

```bash
# 1. Очистить недействительные сессии
node cleanup-sessions.js YOUR_USER_ID deactivate-invalid

# 2. Создать новую сессию через API
curl -X POST http://localhost:3000/api/wb-session/force-create \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","phoneNumber":"+7XXXXXXXXXX"}'

# 3. Проверить статус
curl http://localhost:3000/api/wb-session/status?userId=YOUR_USER_ID
```

## 📞 Поддержка

Если возникают проблемы:
1. Проверьте логи в консоли
2. Используйте диагностику: `POST /api/wb-session/diagnostics`
3. Очистите все сессии: `node cleanup-sessions.js USER_ID deactivate-all`
4. Создайте новую сессию заново
