# 🐳 WB Slots - Docker Deployment

Полная инструкция по развертыванию WB Slots приложения с использованием Docker.

## 📁 Структура файлов

```
wb-slots/
├── 📄 DOCKER_DEPLOYMENT_GUIDE.md    # Полная инструкция
├── 📄 QUICK_START.md                # Быстрый старт
├── 📄 README-DOCKER-STACK.md        # Docker Stack документация
├── 📄 README-DOCKER.md              # Этот файл
├── 🐳 docker-compose.yml            # Основной compose файл
├── 🐳 docker-stack.yml              # Production Docker Stack
├── 🐳 docker-stack-dev.yml          # Development Docker Stack
├── 🐳 Dockerfile                    # Docker образ приложения
├── ⚙️ env.example                   # Пример переменных окружения
├── ⚙️ env.production                # Production переменные
├── 📁 nginx/
│   └── nginx.conf                   # Конфигурация Nginx
├── 🔧 check-system.bat/.sh          # Проверка системы
├── 🚀 full-deploy.bat/.sh           # Полное развертывание
├── ⚡ quick-deploy.bat              # Быстрое развертывание
├── 🛠️ deploy-stack.bat/.sh          # Развертывание стека
└── 📊 manage-stack.bat              # Управление стеком
```

## 🚀 Быстрый старт

### Windows:
```cmd
# 1. Проверка системы
check-system.bat

# 2. Полное развертывание
full-deploy.bat

# 3. Или быстрое развертывание
quick-deploy.bat
```

### Linux/Mac:
```bash
# 1. Сделать скрипты исполняемыми
chmod +x *.sh

# 2. Проверка системы
./check-system.sh

# 3. Полное развертывание
./full-deploy.sh

# 4. Или быстрое развертывание
./quick-deploy.sh
```

## 🏗️ Режимы развертывания

### Development режим
- ✅ **1 реплика** каждого сервиса
- ✅ **Открытые порты** для прямого доступа
- ✅ **Автоматические миграции** БД
- ✅ **Быстрый запуск** для разработки

**Доступ:**
- Приложение: http://localhost:3000
- База данных: localhost:5432
- Redis: localhost:6379

### Production режим
- ✅ **2+ реплики** приложения и воркеров
- ✅ **Nginx load balancer** с rate limiting
- ✅ **Health checks** для всех сервисов
- ✅ **Автоматическое масштабирование**
- ✅ **Security headers** и SSL поддержка

**Доступ:**
- Приложение: http://localhost (через Nginx)
- Прямой доступ: http://localhost:3000

## ⚙️ Настройка

### 1. Переменные окружения

#### Development (.env):
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-jwt-secret-key-for-development-only"
ENCRYPTION_KEY="dev-encryption-key-for-development-only"
APP_BASE_URL="http://localhost:3000"
NODE_ENV="development"
```

#### Production (env.production):
```env
POSTGRES_PASSWORD=your-super-secure-postgres-password-here
DATABASE_URL=postgresql://postgres:your-password@postgres:5432/wb_slots?schema=public
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=your-32-byte-base64-encryption-key
APP_BASE_URL=https://your-domain.com
NODE_ENV=production
```

### 2. Генерация безопасных ключей

```bash
# JWT секрет (32+ символов)
openssl rand -base64 32

# Ключ шифрования (32 байта в base64)
openssl rand -base64 32

# Пароль PostgreSQL
openssl rand -base64 16
```

## 📊 Управление

### Просмотр статуса
```bash
# Development
docker stack services wb-slots-dev

# Production
docker stack services wb-slots
```

### Просмотр логов
```bash
# Логи приложения
docker service logs -f wb-slots_app

# Логи воркеров
docker service logs -f wb-slots_worker

# Логи Nginx
docker service logs -f wb-slots_nginx
```

### Масштабирование
```bash
# Увеличить реплики приложения
docker service scale wb-slots_app=5

# Увеличить реплики воркеров
docker service scale wb-slots_worker=3
```

### Обновление
```bash
# Пересборка образа
docker build -t wb-slots-app:latest .

# Обновление стека
docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
```

### Остановка
```bash
# Development
docker stack rm wb-slots-dev

# Production
docker stack rm wb-slots
```

## 🔧 Troubleshooting

### Проблемы с запуском

1. **Docker не запущен**
   ```bash
   # Windows: Запустите Docker Desktop
   # Linux: sudo systemctl start docker
   ```

2. **Порты заняты**
   ```bash
   # Проверить занятые порты
   netstat -tulpn | grep :3000
   netstat -tulpn | grep :5432
   ```

3. **Недостаточно памяти**
   ```bash
   # Проверить память
   free -h
   # Рекомендуется минимум 4GB
   ```

### Проблемы с базой данных

```bash
# Проверить логи PostgreSQL
docker service logs wb-slots_postgres

# Подключиться к БД
docker exec -it $(docker ps -q -f name=wb-slots_postgres) psql -U postgres -d wb_slots

# Выполнить миграции
docker exec -it $(docker ps -q -f name=wb-slots_app) npx prisma migrate deploy
```

### Проблемы с производительностью

```bash
# Мониторинг ресурсов
docker stats

# Очистка неиспользуемых ресурсов
docker system prune -f

# Проверка использования диска
docker system df
```

## 💾 Backup и восстановление

### Backup базы данных
```bash
# Создание backup
docker exec -it $(docker ps -q -f name=wb-slots_postgres) pg_dump -U postgres wb_slots > backup.sql

# Восстановление
docker exec -i $(docker ps -q -f name=wb-slots_postgres) psql -U postgres wb_slots < backup.sql
```

### Backup Redis
```bash
# Создание backup
docker exec -it $(docker ps -q -f name=wb-slots_redis) redis-cli BGSAVE
docker cp $(docker ps -q -f name=wb-slots_redis):/data/dump.rdb ./redis-backup.rdb
```

## 🔒 Безопасность

### Production настройки

1. **Измените все пароли** в `env.production`
2. **Настройте SSL сертификаты** в `nginx/ssl/`
3. **Ограничьте доступ** к портам базы данных
4. **Настройте firewall** для защиты кластера

### SSL/TLS настройка

```bash
# Получение SSL сертификата (Let's Encrypt)
sudo certbot certonly --standalone -d your-domain.com

# Копирование сертификатов
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

## 📈 Мониторинг

### Логирование
```bash
# Настройка ротации логов
docker service update --log-opt max-size=10m --log-opt max-file=3 wb-slots_app
```

### Мониторинг ресурсов
```bash
# Установка htop
sudo apt install htop

# Мониторинг в реальном времени
htop
docker stats
```

## 📚 Дополнительная документация

- **Полная инструкция**: `DOCKER_DEPLOYMENT_GUIDE.md`
- **Docker Stack документация**: `README-DOCKER-STACK.md`
- **Быстрый старт**: `QUICK_START.md`

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи сервисов
2. Убедитесь в правильности переменных окружения
3. Проверьте доступность портов
4. Убедитесь в достаточности ресурсов кластера

## 🎯 Готово!

Ваше приложение WB Slots теперь работает в Docker! 🎉

### Основные команды:
- **Развертывание**: `full-deploy.bat` / `./full-deploy.sh`
- **Управление**: `manage-stack.bat`
- **Проверка**: `check-system.bat` / `./check-system.sh`
- **Быстрый старт**: `quick-deploy.bat` / `./quick-deploy.sh`
