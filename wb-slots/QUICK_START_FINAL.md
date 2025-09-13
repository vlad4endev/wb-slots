# 🚀 WB Slots - Быстрый старт

## ⚡ Запуск за 5 минут

### 1. Установка
```bash
# Клонируйте репозиторий
git clone <repository-url>
cd wb-slots

# Установите зависимости
npm install
cd backend && npm install && cd ..
```

### 2. Настройка
```bash
# Скопируйте файлы окружения
cp .env.example .env
cp backend/.env.example backend/.env

# Настройте переменные в .env:
# DATABASE_URL="postgresql://user:password@localhost:5432/wb_slots"
# REDIS_URL="redis://localhost:6379"
# ENCRYPTION_MASTER_KEY="your-256-bit-key"
# TELEGRAM_BOT_TOKEN="your-bot-token"
```

### 3. База данных
```bash
# Запустите PostgreSQL и Redis
# Выполните миграции
cd backend
npx prisma migrate dev
npx prisma generate
cd ..
```

### 4. Запуск
```bash
# Backend (терминал 1)
cd backend
npm run start:dev

# Frontend (терминал 2)
npm run dev
```

### 5. Открыть приложение
Перейдите на `http://localhost:3000`

## 🎯 Основные функции

### ✅ Готово к использованию
- 🔍 **Поиск слотов** - автоматический поиск с фильтрацией
- 🤖 **Автобронирование** - автоматическое бронирование через Puppeteer
- 📱 **Telegram уведомления** - уведомления на всех этапах
- 🔒 **Безопасность** - шифрование данных и rate limiting
- ⚡ **Стабильность** - retry логика и обработка ошибок

### 🚀 Быстрый тест
1. Зарегистрируйтесь в системе
2. Настройте Telegram уведомления
3. Создайте задачу поиска слотов
4. Включите автобронирование
5. Проверьте работу уведомлений

## 📚 Документация

- `PROJECT_COMPLETE_SUMMARY.md` - Полное описание проекта
- `GETTING_STARTED.md` - Подробное руководство
- `DOCKER.md` - Docker развертывание
- `TESTING_GUIDE.md` - Тестирование

## 🎉 Готово!

**Проект полностью функционален и готов к использованию!**

---
*Разработано с ❤️ для автоматизации работы с Wildberries*
