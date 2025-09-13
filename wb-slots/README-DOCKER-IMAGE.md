# 🐳 Docker Image Configuration

Конфигурационный файл `docker-image.yml` содержит все настройки для сборки, управления и развертывания Docker образов WB Slots.

## 📁 Файлы

- `docker-image.yml` - Основной конфигурационный файл
- `docker-image-manager.bat/.sh` - Скрипт управления образами
- `docker-image-examples.md` - Примеры использования
- `README-DOCKER-IMAGE.md` - Этот файл

## 🚀 Быстрый старт

### Windows:
```cmd
# Запуск менеджера образов
docker-image-manager.bat

# Или прямое использование
docker build -t wb-slots-app:latest .
docker run -d --name wb-slots-app -p 3000:3000 wb-slots-app:latest
```

### Linux/Mac:
```bash
# Сделать скрипт исполняемым
chmod +x docker-image-manager.sh

# Запуск менеджера образов
./docker-image-manager.sh

# Или прямое использование
docker build -t wb-slots-app:latest .
docker run -d --name wb-slots-app -p 3000:3000 wb-slots-app:latest
```

## ⚙️ Основные разделы конфигурации

### 🏗️ Сборка образа
```yaml
image:
  name: wb-slots-app
  tag: latest
  build_args:
    NODE_ENV: production
    NPM_CONFIG_LOGLEVEL: warn
```

### 🔒 Безопасность
```yaml
security:
  user: "nextjs:nodejs"
  read_only: true
  cap_drop: [ALL]
  cap_add: [CHOWN, SETGID, SETUID]
```

### 📊 Ресурсы
```yaml
resources:
  memory:
    limit: "1g"
    reservation: "512m"
  cpus:
    limit: "1.0"
    reservation: "0.5"
```

### 🏥 Health Check
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## 🛠️ Управление образами

### Сборка
```bash
# Стандартная сборка
docker build -t wb-slots-app:latest .

# Development сборка
docker build -t wb-slots-app:dev --target builder .

# Production сборка
docker build -t wb-slots-app:prod --target runner .
```

### Запуск
```bash
# Базовый запуск
docker run -d --name wb-slots-app -p 3000:3000 wb-slots-app:latest

# С переменными окружения
docker run -d --name wb-slots-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  wb-slots-app:latest
```

### Управление
```bash
# Просмотр логов
docker logs -f wb-slots-app

# Выполнение команд
docker exec -it wb-slots-app sh

# Остановка
docker stop wb-slots-app
docker rm wb-slots-app
```

## 📦 Реестр образов

### Тегирование
```bash
# Создание тегов
docker tag wb-slots-app:latest your-registry.com/wb-slots:latest
docker tag wb-slots-app:latest your-registry.com/wb-slots:v1.2.0
```

### Загрузка/скачивание
```bash
# Загрузка в реестр
docker push your-registry.com/wb-slots:latest

# Скачивание из реестра
docker pull your-registry.com/wb-slots:latest
```

## 🧪 Тестирование

### Unit тесты
```bash
docker run --rm wb-slots-app:latest npm test
```

### Integration тесты
```bash
docker run --rm wb-slots-app:latest npm run test:integration
```

### E2E тесты
```bash
docker run --rm wb-slots-app:latest npm run test:e2e
```

## 💾 Backup и восстановление

### Backup данных
```bash
# База данных
docker exec wb-slots-postgres pg_dump -U postgres wb_slots > backup.sql

# Redis
docker exec wb-slots-redis redis-cli BGSAVE
docker cp wb-slots-redis:/data/dump.rdb backup.rdb
```

### Восстановление
```bash
# База данных
docker exec -i wb-slots-postgres psql -U postgres wb_slots < backup.sql

# Redis
docker cp backup.rdb wb-slots-redis:/data/dump.rdb
docker restart wb-slots-redis
```

## 🔄 CI/CD

### GitHub Actions
```yaml
- name: Build and Push
  run: |
    docker build -t wb-slots-app:${{ github.sha }} .
    docker push wb-slots-app:${{ github.sha }}
```

### GitLab CI
```yaml
build:
  script:
    - docker build -t wb-slots-app:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## 📊 Мониторинг

### Логи
```bash
# Просмотр логов
docker logs wb-slots-app

# Логи в реальном времени
docker logs -f wb-slots-app
```

### Ресурсы
```bash
# Статистика использования
docker stats wb-slots-app

# Проверка здоровья
docker inspect wb-slots-app --format='{{.State.Health.Status}}'
```

## 🆘 Troubleshooting

### Проблемы с сборкой
```bash
# Сборка без кэша
docker build --no-cache -t wb-slots-app:latest .

# Сборка с подробным выводом
docker build --progress=plain -t wb-slots-app:latest .
```

### Проблемы с запуском
```bash
# Проверка логов
docker logs wb-slots-app

# Проверка конфигурации
docker inspect wb-slots-app
```

### Проблемы с производительностью
```bash
# Мониторинг ресурсов
docker stats wb-slots-app

# Проверка процессов
docker exec wb-slots-app ps aux
```

## 📚 Дополнительная документация

- **Примеры использования**: `docker-image-examples.md`
- **Полная инструкция**: `DOCKER_DEPLOYMENT_GUIDE.md`
- **Docker Stack**: `README-DOCKER-STACK.md`
- **Быстрый старт**: `QUICK_START.md`

## 🎯 Готово!

Теперь у вас есть полная конфигурация для управления Docker образами WB Slots! 🚀

### Основные команды:
- **Управление**: `docker-image-manager.bat` / `./docker-image-manager.sh`
- **Сборка**: `docker build -t wb-slots-app:latest .`
- **Запуск**: `docker run -d --name wb-slots-app -p 3000:3000 wb-slots-app:latest`
- **Логи**: `docker logs -f wb-slots-app`
