# 🐳 Полная инструкция по развертыванию WB Slots на Docker

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Подготовка проекта](#подготовка-проекта)
3. [Настройка переменных окружения](#настройка-переменных-окружения)
4. [Развертывание в Development режиме](#развертывание-в-development-режиме)
5. [Развертывание в Production режиме](#развертывание-в-production-режиме)
6. [Управление и мониторинг](#управление-и-мониторинг)
7. [Troubleshooting](#troubleshooting)
8. [Backup и восстановление](#backup-и-восстановление)

---

## 🔧 Предварительные требования

### Системные требования

- **Windows 10/11** с WSL2 или **Linux/macOS**
- **Docker Desktop** версии 4.0+
- **Docker Compose** версии 2.0+
- **Минимум 4GB RAM** (рекомендуется 8GB+)
- **10GB свободного места** на диске

### Установка Docker

#### Windows:
1. Скачайте Docker Desktop с [docker.com](https://www.docker.com/products/docker-desktop/)
2. Установите и запустите Docker Desktop
3. Включите WSL2 backend в настройках

#### Linux (Ubuntu/Debian):
```bash
# Обновление пакетов
sudo apt update

# Установка зависимостей
sudo apt install apt-transport-https ca-certificates curl gnupg lsb-release

# Добавление GPG ключа Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Добавление репозитория Docker
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
```

#### macOS:
1. Скачайте Docker Desktop с [docker.com](https://www.docker.com/products/docker-desktop/)
2. Установите и запустите Docker Desktop

### Проверка установки

```bash
# Проверка версии Docker
docker --version

# Проверка версии Docker Compose
docker compose version

# Проверка работы Docker
docker run hello-world
```

---

## 📁 Подготовка проекта

### 1. Клонирование/скачивание проекта

```bash
# Если проект в Git репозитории
git clone <your-repo-url> wb-slots
cd wb-slots

# Или перейдите в папку с проектом
cd wb-slots
```

### 2. Проверка структуры файлов

Убедитесь, что у вас есть следующие файлы:
```
wb-slots/
├── docker-compose.yml          # Основной compose файл
├── docker-stack.yml           # Docker Stack для Swarm
├── docker-stack-dev.yml       # Development версия
├── Dockerfile                 # Docker образ приложения
├── env.example               # Пример переменных окружения
├── env.production            # Production переменные
├── nginx/
│   └── nginx.conf           # Конфигурация Nginx
├── deploy-stack.bat          # Windows скрипт развертывания
├── deploy-stack.sh           # Linux/Mac скрипт развертывания
├── manage-stack.bat          # Windows скрипт управления
├── quick-deploy.bat          # Быстрое развертывание
└── README-DOCKER-STACK.md    # Документация
```

---

## ⚙️ Настройка переменных окружения

### 1. Создание файла переменных окружения

```bash
# Скопируйте пример файла
cp env.example .env

# Или для production
cp env.example env.production
```

### 2. Настройка Development переменных (.env)

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="dev-jwt-secret-key-for-development-only"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="dev-encryption-key-for-development-only"

# App
APP_BASE_URL="http://localhost:3000"
NODE_ENV="development"

# Email (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@wb-slots.com"

# Telegram (optional)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_URL=""

# Rate limiting
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"
```

### 3. Настройка Production переменных (env.production)

```env
# Database Configuration
POSTGRES_PASSWORD=your-super-secure-postgres-password-here
DATABASE_URL=postgresql://postgres:your-super-secure-postgres-password-here@postgres:5432/wb_slots?schema=public

# Redis Configuration
REDIS_URL=redis://redis:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production-min-32-chars
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-byte-base64-encryption-key-here

# Application Configuration
APP_BASE_URL=https://your-domain.com
NODE_ENV=production

# Email Configuration (optional)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=noreply@your-domain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@your-domain.com

# Telegram Configuration (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Monitoring (optional)
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn-here

# Security
CORS_ORIGIN=https://your-domain.com
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### 4. Генерация безопасных ключей

```bash
# Генерация JWT секрета (32+ символов)
openssl rand -base64 32

# Генерация ключа шифрования (32 байта в base64)
openssl rand -base64 32

# Генерация пароля для PostgreSQL
openssl rand -base64 16
```

---

## 🚀 Развертывание в Development режиме

### Способ 1: Быстрое развертывание (рекомендуется)

```bash
# Windows
quick-deploy.bat
# Выберите опцию 1 (Development)

# Linux/Mac
chmod +x quick-deploy.sh
./quick-deploy.sh
# Выберите опцию 1 (Development)
```

### Способ 2: Ручное развертывание

#### 1. Сборка образа приложения

```bash
# Перейдите в папку проекта
cd wb-slots

# Сборка Docker образа
docker build -t wb-slots-app:latest .
```

#### 2. Запуск с Docker Compose

```bash
# Запуск всех сервисов
docker-compose up -d

# Или с просмотром логов
docker-compose up
```

#### 3. Проверка статуса

```bash
# Просмотр запущенных контейнеров
docker-compose ps

# Просмотр логов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f app
```

### Способ 3: Docker Stack (Development)

```bash
# Инициализация Docker Swarm
docker swarm init

# Развертывание development стека
docker stack deploy -c docker-stack-dev.yml wb-slots-dev

# Проверка статуса
docker stack services wb-slots-dev
```

### Доступ к приложению

После успешного развертывания приложение будет доступно по адресам:

- **Основное приложение**: http://localhost:3000
- **База данных**: localhost:5432
- **Redis**: localhost:6379

---

## 🏭 Развертывание в Production режиме

### Способ 1: Быстрое развертывание

```bash
# Windows
quick-deploy.bat
# Выберите опцию 2 (Production)

# Linux/Mac
chmod +x quick-deploy.sh
./quick-deploy.sh
# Выберите опцию 2 (Production)
```

### Способ 2: Ручное развертывание

#### 1. Подготовка production окружения

```bash
# Убедитесь, что env.production настроен
cat env.production

# Создайте директорию для SSL сертификатов (если нужен HTTPS)
mkdir -p nginx/ssl
```

#### 2. Настройка SSL (опционально)

```bash
# Поместите SSL сертификаты в nginx/ssl/
# cert.pem - SSL сертификат
# key.pem - Приватный ключ

# Раскомментируйте HTTPS секцию в nginx/nginx.conf
```

#### 3. Сборка и развертывание

```bash
# Сборка образа
docker build -t wb-slots-app:latest .

# Инициализация Docker Swarm
docker swarm init

# Развертывание production стека
docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
```

#### 4. Проверка развертывания

```bash
# Статус сервисов
docker stack services wb-slots

# Детальная информация
docker stack ps wb-slots

# Логи приложения
docker service logs -f wb-slots_app
```

### Доступ к приложению

- **Основное приложение**: http://localhost (через Nginx)
- **Прямой доступ**: http://localhost:3000
- **HTTPS** (если настроен): https://your-domain.com

---

## 📊 Управление и мониторинг

### Основные команды

```bash
# Просмотр статуса стека
docker stack services wb-slots

# Детальная информация о задачах
docker stack ps wb-slots

# Логи конкретного сервиса
docker service logs -f wb-slots_app
docker service logs -f wb-slots_worker
docker service logs -f wb-slots_nginx

# Масштабирование сервисов
docker service scale wb-slots_app=5
docker service scale wb-slots_worker=3

# Обновление сервиса
docker service update --image wb-slots-app:new-tag wb-slots_app

# Перезапуск сервиса
docker service update --force wb-slots_app
```

### Мониторинг ресурсов

```bash
# Статистика использования ресурсов
docker stats

# Информация о системе
docker system df

# События Docker
docker events --filter type=service
```

### Управление через скрипты

#### Windows:
```cmd
# Запуск скрипта управления
manage-stack.bat

# Доступные опции:
# 1. View stack status
# 2. View service logs
# 3. Scale services
# 4. Update stack
# 5. Remove stack
# 6. View stack services
# 7. View stack tasks
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

---

## 🔧 Troubleshooting

### Проблемы с развертыванием

#### 1. Ошибка "Docker is not running"

```bash
# Запустите Docker Desktop
# Или на Linux:
sudo systemctl start docker
sudo systemctl enable docker
```

#### 2. Ошибка "Port already in use"

```bash
# Проверьте, какие порты заняты
netstat -tulpn | grep :3000
netstat -tulpn | grep :5432
netstat -tulpn | grep :6379

# Остановите конфликтующие сервисы
# Или измените порты в docker-compose.yml
```

#### 3. Ошибка "Image not found"

```bash
# Пересоберите образ
docker build -t wb-slots-app:latest .

# Или скачайте образ
docker pull wb-slots-app:latest
```

#### 4. Ошибка "Permission denied"

```bash
# На Linux добавьте пользователя в группу docker
sudo usermod -aG docker $USER
# Перелогиньтесь или выполните:
newgrp docker
```

### Проблемы с базой данных

#### 1. База данных не запускается

```bash
# Проверьте логи PostgreSQL
docker service logs wb-slots_postgres

# Проверьте переменные окружения
docker service inspect wb-slots_postgres

# Перезапустите сервис
docker service update --force wb-slots_postgres
```

#### 2. Ошибки миграций

```bash
# Выполните миграции вручную
docker exec -it $(docker ps -q -f name=wb-slots_postgres) psql -U postgres -d wb_slots

# Или через приложение
docker exec -it $(docker ps -q -f name=wb-slots_app) npx prisma migrate deploy
```

#### 3. Проблемы с подключением

```bash
# Проверьте сеть
docker network ls
docker network inspect wb-slots_wb-slots-network

# Проверьте DNS
docker exec -it $(docker ps -q -f name=wb-slots_app) nslookup postgres
```

### Проблемы с производительностью

#### 1. Медленная работа

```bash
# Проверьте использование ресурсов
docker stats

# Увеличьте количество реплик
docker service scale wb-slots_app=3

# Проверьте логи на ошибки
docker service logs wb-slots_app | grep -i error
```

#### 2. Высокое использование памяти

```bash
# Очистите неиспользуемые ресурсы
docker system prune -f

# Проверьте настройки ресурсов в docker-stack.yml
# Увеличьте лимиты памяти
```

#### 3. Проблемы с диском

```bash
# Проверьте использование диска
docker system df

# Очистите неиспользуемые образы
docker image prune -f

# Очистите неиспользуемые тома
docker volume prune -f
```

### Проблемы с сетью

#### 1. Сервисы не могут связаться

```bash
# Проверьте сеть
docker network ls
docker network inspect wb-slots_wb-slots-network

# Пересоздайте сеть
docker network rm wb-slots_wb-slots-network
docker stack deploy -c docker-stack.yml wb-slots
```

#### 2. Проблемы с портами

```bash
# Проверьте, какие порты открыты
netstat -tulpn | grep :3000

# Проверьте firewall
sudo ufw status
sudo iptables -L
```

---

## 💾 Backup и восстановление

### Backup базы данных

#### 1. Создание backup

```bash
# Создание backup PostgreSQL
docker exec -it $(docker ps -q -f name=wb-slots_postgres) pg_dump -U postgres wb_slots > backup_$(date +%Y%m%d_%H%M%S).sql

# Или через docker-compose
docker-compose exec postgres pg_dump -U postgres wb_slots > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 2. Восстановление из backup

```bash
# Восстановление из backup
docker exec -i $(docker ps -q -f name=wb-slots_postgres) psql -U postgres wb_slots < backup_20240101_120000.sql

# Или через docker-compose
docker-compose exec -T postgres psql -U postgres wb_slots < backup_20240101_120000.sql
```

### Backup Redis

#### 1. Создание backup

```bash
# Создание backup Redis
docker exec -it $(docker ps -q -f name=wb-slots_redis) redis-cli BGSAVE

# Копирование файла backup
docker cp $(docker ps -q -f name=wb-slots_redis):/data/dump.rdb ./redis-backup_$(date +%Y%m%d_%H%M%S).rdb
```

#### 2. Восстановление Redis

```bash
# Остановка Redis
docker service update --replicas 0 wb-slots_redis

# Копирование backup файла
docker cp ./redis-backup_20240101_120000.rdb $(docker ps -q -f name=wb-slots_redis):/data/dump.rdb

# Запуск Redis
docker service update --replicas 1 wb-slots_redis
```

### Backup конфигурации

```bash
# Создание backup всех конфигурационных файлов
tar -czf wb-slots-config-backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  docker-compose.yml \
  docker-stack.yml \
  docker-stack-dev.yml \
  env.production \
  nginx/ \
  *.bat \
  *.sh
```

---

## 🔄 Обновление приложения

### 1. Обновление кода

```bash
# Получение обновлений (если используется Git)
git pull origin main

# Пересборка образа
docker build -t wb-slots-app:latest .

# Обновление стека
docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
```

### 2. Обновление с тегами версий

```bash
# Сборка с тегом версии
docker build -t wb-slots-app:v1.2.0 .

# Обновление сервиса на новую версию
docker service update --image wb-slots-app:v1.2.0 wb-slots_app
```

### 3. Откат к предыдущей версии

```bash
# Просмотр истории обновлений
docker service inspect wb-slots_app --pretty

# Откат к предыдущей версии
docker service rollback wb-slots_app
```

---

## 🛡️ Безопасность

### 1. Настройка firewall

```bash
# Ubuntu/Debian
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### 2. Настройка SSL/TLS

```bash
# Получение SSL сертификата (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# Копирование сертификатов
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
sudo chown $USER:$USER nginx/ssl/*.pem
```

### 3. Регулярные обновления

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Обновление Docker
sudo apt install docker-ce docker-ce-cli containerd.io

# Очистка неиспользуемых ресурсов
docker system prune -f
```

---

## 📈 Мониторинг и логирование

### 1. Настройка логирования

```bash
# Просмотр логов в реальном времени
docker service logs -f wb-slots_app

# Сохранение логов в файл
docker service logs wb-slots_app > app.log 2>&1

# Ротация логов
docker service update --log-opt max-size=10m --log-opt max-file=3 wb-slots_app
```

### 2. Мониторинг ресурсов

```bash
# Установка htop для мониторинга
sudo apt install htop

# Мониторинг в реальном времени
htop

# Мониторинг Docker
docker stats
```

### 3. Настройка алертов

```bash
# Создание скрипта мониторинга
cat > monitor.sh << 'EOF'
#!/bin/bash
while true; do
    # Проверка статуса сервисов
    if ! docker service ls | grep -q "wb-slots_app.*1/1"; then
        echo "ALERT: App service is down!" | mail -s "Docker Alert" admin@your-domain.com
    fi
    
    # Проверка использования памяти
    if [ $(free | grep Mem | awk '{print $3/$2 * 100.0}' | cut -d. -f1) -gt 90 ]; then
        echo "ALERT: High memory usage!" | mail -s "Docker Alert" admin@your-domain.com
    fi
    
    sleep 60
done
EOF

chmod +x monitor.sh
nohup ./monitor.sh &
```

---

## 🎯 Заключение

Теперь у вас есть полная инструкция по развертыванию WB Slots на Docker! 

### Основные шаги:

1. ✅ **Установите Docker** и проверьте работу
2. ✅ **Настройте переменные окружения** в `.env` или `env.production`
3. ✅ **Выберите режим развертывания** (Development или Production)
4. ✅ **Запустите развертывание** через скрипты или вручную
5. ✅ **Проверьте работу** приложения
6. ✅ **Настройте мониторинг** и backup

### Полезные ссылки:

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)

### Поддержка:

При возникновении проблем:
1. Проверьте логи сервисов
2. Убедитесь в правильности переменных окружения
3. Проверьте доступность портов
4. Убедитесь в достаточности ресурсов

Удачи с развертыванием! 🚀
