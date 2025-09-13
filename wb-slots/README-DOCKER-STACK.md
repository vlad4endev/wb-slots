# Docker Stack Deployment Guide

Этот документ описывает развертывание WB Slots приложения с использованием Docker Stack в Docker Swarm кластере.

## 📁 Структура файлов

```
wb-slots/
├── docker-stack.yml          # Основной файл Docker Stack
├── env.production            # Production переменные окружения
├── nginx/
│   └── nginx.conf           # Конфигурация Nginx load balancer
├── deploy-stack.bat         # Windows скрипт развертывания
├── deploy-stack.sh          # Linux/Mac скрипт развертывания
├── manage-stack.bat         # Windows скрипт управления
└── README-DOCKER-STACK.md   # Этот файл
```

## 🚀 Быстрый старт

### 1. Подготовка

1. **Создайте файл `env.production`** на основе `env.example`:
   ```bash
   cp env.example env.production
   ```

2. **Настройте переменные окружения** в `env.production`:
   ```env
   POSTGRES_PASSWORD=your-super-secure-password
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   ENCRYPTION_KEY=your-32-byte-base64-encryption-key
   APP_BASE_URL=https://your-domain.com
   ```

### 2. Развертывание

#### Windows:
```cmd
deploy-stack.bat
```

#### Linux/Mac:
```bash
chmod +x deploy-stack.sh
./deploy-stack.sh
```

### 3. Управление

#### Windows:
```cmd
manage-stack.bat
```

#### Linux/Mac:
```bash
# Просмотр статуса
docker stack services wb-slots

# Просмотр логов
docker service logs -f wb-slots_app

# Масштабирование
docker service scale wb-slots_app=3

# Удаление стека
docker stack rm wb-slots
```

## 🏗️ Архитектура

### Сервисы

1. **postgres** - База данных PostgreSQL
   - Реплики: 1
   - Память: 256MB-512MB
   - Размещение: Manager node

2. **redis** - Кэш Redis
   - Реплики: 1
   - Память: 128MB-256MB
   - Размещение: Manager node

3. **app** - Основное приложение
   - Реплики: 2
   - Память: 512MB-1GB
   - Размещение: Worker nodes
   - Порт: 3000

4. **worker** - Фоновые задачи
   - Реплики: 2
   - Память: 256MB-512MB
   - Размещение: Worker nodes

5. **nginx** - Load balancer
   - Реплики: 1
   - Память: 64MB-128MB
   - Размещение: Manager node
   - Порт: 80, 443

### Сеть

- **wb-slots-network** - Overlay сеть для всех сервисов

### Тома

- **postgres_data** - Данные PostgreSQL
- **redis_data** - Данные Redis

## ⚙️ Конфигурация

### Nginx Load Balancer

Nginx настроен для:
- Load balancing между репликами приложения
- Rate limiting для API endpoints
- Gzip сжатие
- Security headers
- SSL termination (настраивается отдельно)

### Health Checks

Все сервисы имеют health checks:
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`
- **Nginx**: `/health` endpoint

### Resource Limits

Настроены ограничения ресурсов для каждого сервиса:
- CPU: Без ограничений (можно настроить)
- Memory: Минимальные и максимальные значения

## 🔧 Управление

### Просмотр статуса

```bash
# Общий статус стека
docker stack services wb-slots

# Детальная информация о задачах
docker stack ps wb-slots

# Логи конкретного сервиса
docker service logs -f wb-slots_app
```

### Масштабирование

```bash
# Увеличить количество реплик приложения
docker service scale wb-slots_app=5

# Увеличить количество воркеров
docker service scale wb-slots_worker=3
```

### Обновление

```bash
# Обновить стек
docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots

# Обновить только образ
docker service update --image wb-slots-app:new-tag wb-slots_app
```

### Мониторинг

```bash
# Статистика ресурсов
docker stats

# События стека
docker events --filter type=service

# Логи всех сервисов
docker service logs wb-slots_app wb-slots_worker wb-slots_nginx
```

## 🔒 Безопасность

### Production настройки

1. **Измените все пароли** в `env.production`
2. **Настройте SSL сертификаты** в `nginx/ssl/`
3. **Ограничьте доступ** к портам базы данных
4. **Настройте firewall** для защиты кластера

### SSL/TLS

Для настройки HTTPS:

1. Поместите сертификаты в `nginx/ssl/`:
   - `cert.pem` - SSL сертификат
   - `key.pem` - Приватный ключ

2. Раскомментируйте HTTPS секцию в `nginx/nginx.conf`

3. Обновите `APP_BASE_URL` в `env.production`

## 🐛 Troubleshooting

### Проблемы с развертыванием

```bash
# Проверить логи развертывания
docker service logs wb-slots_app

# Проверить статус задач
docker stack ps wb-slots --no-trunc

# Перезапустить сервис
docker service update --force wb-slots_app
```

### Проблемы с базой данных

```bash
# Проверить подключение к БД
docker exec -it $(docker ps -q -f name=wb-slots_postgres) psql -U postgres -d wb_slots

# Выполнить миграции вручную
docker exec -it $(docker ps -q -f name=wb-slots_app) npx prisma migrate deploy
```

### Проблемы с производительностью

```bash
# Мониторинг ресурсов
docker stats

# Проверить использование диска
docker system df

# Очистить неиспользуемые ресурсы
docker system prune -f
```

## 📊 Мониторинг

### Рекомендуемые метрики

1. **CPU и Memory** для каждого сервиса
2. **Response time** приложения
3. **Database connections** и query time
4. **Redis memory usage**
5. **Network traffic**

### Логирование

Логи доступны через:
```bash
docker service logs wb-slots_app
docker service logs wb-slots_worker
docker service logs wb-slots_nginx
```

## 🔄 Backup и восстановление

### Backup базы данных

```bash
# Создать backup
docker exec -it $(docker ps -q -f name=wb-slots_postgres) pg_dump -U postgres wb_slots > backup.sql

# Восстановить из backup
docker exec -i $(docker ps -q -f name=wb-slots_postgres) psql -U postgres wb_slots < backup.sql
```

### Backup Redis

```bash
# Создать backup
docker exec -it $(docker ps -q -f name=wb-slots_redis) redis-cli BGSAVE

# Скопировать файл backup
docker cp $(docker ps -q -f name=wb-slots_redis):/data/dump.rdb ./redis-backup.rdb
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи сервисов
2. Убедитесь в правильности переменных окружения
3. Проверьте доступность портов
4. Убедитесь в достаточности ресурсов кластера
