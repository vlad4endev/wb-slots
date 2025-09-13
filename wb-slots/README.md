# 🚀 WB Slots - Автоматический поиск и бронирование слотов Wildberries

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue?style=for-the-badge&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=for-the-badge&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker)

**Профессиональное решение для автоматизации работы с поставками Wildberries**

[Демо](#-демо) • [Установка](#-быстрый-старт) • [Документация](#-документация) • [Поддержка](#-поддержка)

</div>

## 🎯 О проекте

**WB Slots** — это мощная платформа для автоматизации работы с поставками на Wildberries, которая помогает продавцам:

- 🔍 **Автоматически находить** доступные слоты для поставок
- ⏰ **Мониторить** изменения в расписании складов
- 📦 **Управлять** типами тары и предпочтениями складов
- 🔔 **Получать уведомления** о найденных слотах
- 📊 **Анализировать** статистику и эффективность

### ✨ Ключевые особенности

- 🏢 **Мультитенантность** - каждый пользователь видит только свои данные
- 🔐 **Безопасность** - шифрование токенов и Row Level Security
- 🚀 **Производительность** - система очередей и кэширование
- 🎨 **Современный UI** - адаптивный интерфейс с темной темой
- 🐳 **Docker Ready** - полная поддержка контейнеризации
- 📱 **Responsive** - работает на всех устройствах

## 🛠 Технологический стек

### Frontend
- **Next.js 15.5.2** с App Router
- **TypeScript** для типобезопасности
- **TailwindCSS** + **shadcn/ui** для UI
- **Framer Motion** для анимаций
- **React Icons** для иконок

### Backend
- **Next.js API Routes** для серверной логики
- **Prisma ORM** для работы с базой данных
- **BullMQ** + **Redis** для очередей задач
- **JWT** для аутентификации
- **bcryptjs** для хеширования паролей

### База данных
- **PostgreSQL 15** с Row Level Security
- **Redis 7** для кэширования и очередей

### Инфраструктура
- **Docker** + **Docker Compose**
- **Puppeteer** для автоматизации браузера
- **Pino** для структурированного логирования

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+ 
- Docker и Docker Compose
- Git

### 1️⃣ Клонирование репозитория

```bash
git clone https://github.com/your-username/wb-slots.git
cd wb-slots
```

### 2️⃣ Настройка окружения

```bash
# Скопируйте файл с переменными окружения
cp env.example .env.local

# Отредактируйте .env.local
nano .env.local
```

**Обязательные переменные:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
ENCRYPTION_KEY="your-32-byte-base64-encryption-key-here"
APP_BASE_URL="http://localhost:3000"
```

### 3️⃣ Запуск через Docker (рекомендуется)

```bash
# Запуск всех сервисов
npm run docker:up

# Просмотр логов
npm run docker:logs
```

### 4️⃣ Или локальная установка

```bash
# Установка зависимостей
npm install

# Запуск PostgreSQL и Redis
docker-compose up postgres redis -d

# Применение миграций
npm run db:push

# Заполнение тестовыми данными
npm run db:seed

# Запуск приложения
npm run dev

# В отдельном терминале - воркеры
npm run worker
```

### 5️⃣ Открытие приложения

Перейдите по адресу: **http://localhost:3000**

## 🎮 Демо

### Тестовые аккаунты

| Роль | Email | Пароль | Описание |
|------|-------|--------|----------|
| **Пользователь** | `demo@wb-slots.com` | `demo123` | Стандартный пользователь |
| **Администратор** | `admin@wb-slots.com` | `admin123` | Полные права доступа |
| **Разработчик** | `dev@wb-slots.com` | `dev123` | Технические функции |

### Основные функции

1. **🔐 Аутентификация** - Регистрация и вход в систему
2. **⚙️ Настройки** - Управление токенами WB API и предпочтениями
3. **📦 Склады** - Выбор и настройка складов для мониторинга
4. **🎯 Задачи** - Создание и управление задачами поиска слотов
5. **📊 Мониторинг** - Отслеживание выполнения задач в реальном времени
6. **🔔 Уведомления** - Настройка Telegram и Email уведомлений

## 📋 Функциональность

### ✅ Реализовано

- **Аутентификация и авторизация** с ролевой моделью
- **Управление токенами WB API** с шифрованием
- **Настройка складов и предпочтений** пользователя
- **Создание и управление задачами** поиска слотов
- **Система очередей** для фоновых задач
- **Мониторинг в реальном времени** выполнения задач
- **Логирование и аудит** всех действий
- **Мультитенантность** с изоляцией данных
- **Telegram уведомления** о найденных слотах
- **Адаптивный UI** с темной темой
- **Docker поддержка** для развертывания

### 🚧 В разработке

- **Автобронирование слотов** (экспериментально)
- **Расширенная аналитика** и отчеты
- **Мобильное приложение**
- **API для внешних интеграций**

## 🏗 Архитектура

### Диаграмма базы данных

```mermaid
erDiagram
    User ||--o{ UserToken : has
    User ||--o{ WarehousePref : has
    User ||--o{ Task : has
    User ||--o{ Run : has
    User ||--o{ FoundSlot : has
    User ||--o{ NotificationChannel : has
    User ||--o{ AuditLog : has
    
    Task ||--o{ Run : executes
    Run ||--o{ FoundSlot : finds
    Run ||--o{ RunLog : contains
    
    User {
        string id PK
        string email UK
        string passwordHash
        string name
        string role
        boolean isActive
        boolean isProtected
        datetime createdAt
        datetime updatedAt
    }
    
    Task {
        string id PK
        int taskNumber UK
        string userId FK
        string name
        string description
        boolean enabled
        string status
        json filters
        boolean autoBook
        datetime createdAt
        datetime updatedAt
    }
    
    Run {
        string id PK
        string taskId FK
        string userId FK
        string status
        datetime startedAt
        datetime finishedAt
        int foundSlots
        json summary
    }
```

### Компоненты системы

```mermaid
graph TB
    subgraph "Frontend (Next.js)"
        A[Web Interface] --> B[API Routes]
        A --> C[Components]
        A --> D[Pages]
    end
    
    subgraph "Backend Services"
        B --> E[Auth Service]
        B --> F[Task Service]
        B --> G[WB API Client]
        B --> H[Notification Service]
    end
    
    subgraph "Workers"
        I[Slot Search Worker] --> J[WB API]
        K[Auto Booking Worker] --> J
        L[Notification Worker] --> M[Telegram API]
    end
    
    subgraph "Database"
        N[(PostgreSQL)] --> O[Prisma ORM]
        P[(Redis)] --> Q[BullMQ]
    end
    
    E --> N
    F --> N
    G --> J
    H --> M
    I --> N
    K --> N
    L --> N
```

## 🔧 Настройка

### Получение токенов WB API

1. Войдите в [Личный кабинет продавца WB](https://seller.wildberries.ru/)
2. Перейдите в **"Настройки"** → **"Доступ к API"**
3. Создайте токены для нужных категорий:
   - **Supplies** - для работы с поставками FBW
   - **Marketplace** - для FBS поставок (опционально)
   - **Statistics** - для аналитики (опционально)

### Настройка уведомлений

#### 📧 Email уведомления

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@wb-slots.com"
```

#### 📱 Telegram уведомления

```env
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_WEBHOOK_URL="https://your-domain.com/api/telegram"
```

**Создание Telegram бота:**
1. Напишите [@BotFather](https://t.me/BotFather)
2. Создайте нового бота командой `/newbot`
3. Получите токен и добавьте в настройки

## 📊 Мониторинг и логирование

### Структурированные логи

- **Pino** для высокопроизводительного логирования
- **Аудит-логи** в базе данных для отслеживания действий
- **Логи выполнения задач** с детальной информацией

### Метрики

- Количество активных задач
- Статистика выполнения и успешности
- Использование WB API и rate limits
- Производительность системы

## 🧪 Тестирование

```bash
# Unit тесты
npm run test

# E2E тесты с Playwright
npm run test:e2e

# Линтинг кода
npm run lint

# Проверка типов TypeScript
npm run type-check
```

## 🐳 Docker

### Доступные команды

```bash
# Сборка образов
npm run docker:build

# Запуск всех сервисов
npm run docker:up

# Остановка сервисов
npm run docker:down

# Просмотр логов
npm run docker:logs

# Перезапуск
npm run docker:restart

# Полная очистка
npm run docker:clean
```

### Сервисы

| Сервис | Порт | Описание |
|--------|------|----------|
| **app** | 3000 | Основное приложение |
| **postgres** | 5432 | База данных PostgreSQL |
| **redis** | 6379 | Redis для очередей |
| **worker** | - | Фоновые воркеры |

## 🚨 Важные замечания

### ⚠️ Правовые аспекты

**ВНИМАНИЕ:** Автобронирование слотов может нарушать правила Wildberries. Функция включена только в экспериментальном режиме с явным согласием пользователя.

### 🔐 Безопасность

- Все токены шифруются перед сохранением в БД
- Используется Row Level Security для изоляции данных
- Токены маскируются в логах
- JWT токены имеют ограниченный срок жизни
- Регулярные обновления зависимостей

### 📈 Ограничения

- Публичного API для бронирования FBW слотов не существует
- Соблюдайте rate limits WB API
- Автобронирование реализовано через UI-автоматизацию

## 📈 Roadmap

### 🎯 Ближайшие планы

- [ ] **v2.0** - Стабильная версия автобронирования
- [ ] **v2.1** - Расширенная аналитика и отчеты
- [ ] **v2.2** - Мобильное приложение
- [ ] **v3.0** - API для внешних интеграций

### 🔮 Долгосрочные цели

- [ ] Интеграция с другими маркетплейсами
- [ ] Машинное обучение для оптимизации поиска
- [ ] Расширенная система уведомлений
- [ ] Корпоративные функции

## 🤝 Вклад в проект

Мы приветствуем вклад в развитие проекта! 

### Как внести вклад

1. **Fork** репозитория
2. Создайте **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** изменения (`git commit -m 'Add amazing feature'`)
4. **Push** в branch (`git push origin feature/amazing-feature`)
5. Откройте **Pull Request**

### Руководство по разработке

- Следуйте существующему стилю кода
- Добавляйте тесты для новой функциональности
- Обновляйте документацию при необходимости
- Используйте осмысленные сообщения коммитов

## 📄 Лицензия

Этот проект распространяется под лицензией **MIT**. См. файл [LICENSE](LICENSE) для подробностей.

## 📞 Поддержка

- 📧 **Email**: support@wb-slots.com
- 💬 **Telegram**: [@wb_slots_support](https://t.me/wb_slots_support)
- 📖 **Документация**: [docs.wb-slots.com](https://docs.wb-slots.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-username/wb-slots/issues)

## 🙏 Благодарности

- Команде **Wildberries** за предоставление API
- Сообществу **Next.js** и **React**
- Всем **контрибьюторам** проекта
- Пользователям за обратную связь и предложения

## 📊 Статистика проекта

![GitHub stars](https://img.shields.io/github/stars/your-username/wb-slots?style=social)
![GitHub forks](https://img.shields.io/github/forks/your-username/wb-slots?style=social)
![GitHub issues](https://img.shields.io/github/issues/your-username/wb-slots)
![GitHub pull requests](https://img.shields.io/github/issues-pr/your-username/wb-slots)

---

<div align="center">

**Сделано с ❤️ для сообщества продавцов Wildberries**

[⭐ Поставить звезду](https://github.com/your-username/wb-slots) • [🐛 Сообщить об ошибке](https://github.com/your-username/wb-slots/issues) • [💡 Предложить функцию](https://github.com/your-username/wb-slots/issues)

</div>