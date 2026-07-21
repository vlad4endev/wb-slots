# Docker Setup для WB Slots

Этот документ описывает, как запустить проект WB Slots с помощью Docker.

## Предварительные требования

- Docker Desktop или Docker Engine
- Docker Compose

## Быстрый старт

### 1. Клонирование и подготовка

```bash
git clone <repository-url>
cd wb-slots
```

### 2. Настройка переменных окружения

Скопируйте файл с переменными окружения:

```bash
cp env.docker .env.local
```

Отредактируйте `.env.local` и установите необходимые значения:

```bash
# Обязательные переменные
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
ENCRYPTION_KEY="your-32-byte-base64-encryption-key-here"

# Опциональные переменные
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
SMTP_HOST="your-smtp-host"
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
```

### 3. Запуск через Docker Compose

```bash
# Сборка и запуск всех сервисов
npm run docker:up

# Или пошагово:
npm run docker:build
docker-compose up -d
```

### 4. Проверка статуса

```bash
# Просмотр логов
npm run docker:logs

# Проверка статуса контейнеров
docker-compose ps
```

## Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run docker:build` | Сборка Docker образов |
| `npm run docker:up` | Запуск всех сервисов в фоне |
| `npm run docker:down` | Остановка всех сервисов |
| `npm run docker:logs` | Просмотр логов всех сервисов |
| `npm run docker:restart` | Перезапуск всех сервисов |
| `npm run docker:clean` | Очистка всех контейнеров и данных |

## Сервисы

### 1. PostgreSQL (postgres)
- **Порт**: 5432
- **База данных**: wb_slots
- **Пользователь**: postgres
- **Пароль**: password

### 2. Redis (redis)
- **Порт**: 6379
- **Использование**: Очереди задач и кэширование

### 3. Приложение (app)
- **Порт**: 3000
- **URL**: http://localhost:3000
- **Функции**: Web API, фронтенд

### 4. Worker (worker)
- **Функции**: Обработка фоновых задач, поиск слотов

## Доступ к приложению

После запуска приложение будет доступно по адресу:
- **Web интерфейс**: http://localhost:3000
- **API**: http://localhost:3000/api

## Управление данными

### Миграции базы данных

Миграции выполняются автоматически при запуске приложения.

### Семена базы данных

Семена (seed) выполняются автоматически при первом запуске.

### Резервное копирование

```bash
# Создание бэкапа базы данных
docker exec wb-slots-postgres pg_dump -U postgres wb_slots > backup.sql

# Восстановление из бэкапа
docker exec -i wb-slots-postgres psql -U postgres wb_slots < backup.sql
```

## Отладка

### Просмотр логов

```bash
# Все сервисы
npm run docker:logs

# Конкретный сервис
docker-compose logs -f app
docker-compose logs -f worker
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Подключение к контейнерам

```bash
# Подключение к приложению
docker exec -it wb-slots-app sh

# Подключение к базе данных
docker exec -it wb-slots-postgres psql -U postgres wb_slots

# Подключение к Redis
docker exec -it wb-slots-redis redis-cli
```

### Перезапуск сервисов

```bash
# Перезапуск приложения
docker-compose restart app

# Перезапуск worker
docker-compose restart worker

# Перезапуск всех сервисов
npm run docker:restart
```

## Очистка

### Остановка и удаление контейнеров

```bash
# Остановка контейнеров
npm run docker:down

# Остановка и удаление с данными
npm run docker:clean
```

### Очистка Docker системы

```bash
# Удаление неиспользуемых образов
docker image prune -f

# Полная очистка системы
docker system prune -a -f
```

## Производственное развертывание

Для производственного развертывания:

1. Измените пароли в `docker-compose.yml`
2. Настройте SSL сертификаты
3. Используйте внешние базы данных
4. Настройте мониторинг и логирование
5. Используйте Docker Swarm или Kubernetes для оркестрации

## Troubleshooting

### Проблемы с портами

Если порты заняты, измените их в `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Вместо 3000:3000
```

### Проблемы с памятью

Увеличьте лимиты памяти для Docker в настройках Docker Desktop.

### Проблемы с базой данных

```bash
# Проверка статуса базы данных
docker-compose exec postgres pg_isready -U postgres

# Сброс базы данных
docker-compose down -v
docker-compose up -d
```
