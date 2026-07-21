# 🐳 Docker Image Configuration Examples

Этот файл содержит примеры использования `docker-image.yml` для различных сценариев.

## 📋 Содержание

1. [Базовое использование](#базовое-использование)
2. [Сборка образов](#сборка-образов)
3. [Запуск контейнеров](#запуск-контейнеров)
4. [Управление реестром](#управление-реестром)
5. [Тестирование](#тестирование)
6. [Мониторинг](#мониторинг)
7. [Backup и восстановление](#backup-и-восстановление)
8. [CI/CD интеграция](#cicd-интеграция)

---

## 🚀 Базовое использование

### Просмотр конфигурации
```bash
# Просмотр всех настроек
cat docker-image.yml

# Просмотр только настроек образа
yq eval '.image' docker-image.yml

# Просмотр переменных окружения
yq eval '.environment' docker-image.yml
```

### Валидация конфигурации
```bash
# Проверка синтаксиса YAML
yq eval '.' docker-image.yml > /dev/null

# Проверка с помощью Docker
docker build --dry-run -f Dockerfile .
```

---

## 🔨 Сборка образов

### Стандартная сборка
```bash
# Сборка основного образа
docker build -t wb-slots-app:latest .

# Сборка с тегом версии
docker build -t wb-slots-app:v1.2.0 .

# Сборка с кэшированием
docker build --cache-from wb-slots-app:latest -t wb-slots-app:latest .
```

### Многоэтапная сборка
```bash
# Сборка только этапа зависимостей
docker build --target deps -t wb-slots-app:deps .

# Сборка только этапа сборки
docker build --target builder -t wb-slots-app:builder .

# Сборка только production этапа
docker build --target runner -t wb-slots-app:prod .
```

### Сборка с аргументами
```bash
# Сборка с пользовательскими аргументами
docker build \
  --build-arg NODE_ENV=production \
  --build-arg NPM_CONFIG_LOGLEVEL=warn \
  -t wb-slots-app:latest .
```

### Параллельная сборка
```bash
# Сборка нескольких тегов одновременно
docker build -t wb-slots-app:latest -t wb-slots-app:stable -t wb-slots-app:dev .
```

---

## 🏃 Запуск контейнеров

### Базовый запуск
```bash
# Запуск с переменными окружения
docker run -d \
  --name wb-slots-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots" \
  wb-slots-app:latest
```

### Запуск с томами
```bash
# Запуск с монтированием данных
docker run -d \
  --name wb-slots-app \
  -p 3000:3000 \
  -v wb-slots-data:/app/data \
  -v wb-slots-logs:/app/logs \
  wb-slots-app:latest
```

### Запуск в сети
```bash
# Создание сети
docker network create wb-slots-network

# Запуск в сети
docker run -d \
  --name wb-slots-app \
  --network wb-slots-network \
  -p 3000:3000 \
  wb-slots-app:latest
```

### Запуск с ограничениями ресурсов
```bash
# Запуск с лимитами памяти и CPU
docker run -d \
  --name wb-slots-app \
  -p 3000:3000 \
  --memory="1g" \
  --cpus="1.0" \
  wb-slots-app:latest
```

### Запуск с health check
```bash
# Запуск с проверкой здоровья
docker run -d \
  --name wb-slots-app \
  -p 3000:3000 \
  --health-cmd="curl -f http://localhost:3000/api/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  wb-slots-app:latest
```

---

## 📦 Управление реестром

### Тегирование образов
```bash
# Создание тегов для реестра
docker tag wb-slots-app:latest your-registry.com/wb-slots:latest
docker tag wb-slots-app:latest your-registry.com/wb-slots:v1.2.0
docker tag wb-slots-app:latest your-registry.com/wb-slots:stable
```

### Загрузка в реестр
```bash
# Загрузка образа
docker push your-registry.com/wb-slots:latest
docker push your-registry.com/wb-slots:v1.2.0

# Загрузка всех тегов
docker push your-registry.com/wb-slots --all-tags
```

### Загрузка из реестра
```bash
# Загрузка образа
docker pull your-registry.com/wb-slots:latest

# Загрузка конкретной версии
docker pull your-registry.com/wb-slots:v1.2.0
```

### Аутентификация в реестре
```bash
# Вход в реестр
docker login your-registry.com

# Вход с токеном
echo "your-token" | docker login your-registry.com --username your-username --password-stdin
```

---

## 🧪 Тестирование

### Unit тесты
```bash
# Запуск unit тестов
docker run --rm wb-slots-app:latest npm test

# Запуск с покрытием кода
docker run --rm -v $(pwd)/coverage:/app/coverage wb-slots-app:latest npm run test:coverage
```

### Integration тесты
```bash
# Запуск integration тестов
docker run --rm wb-slots-app:latest npm run test:integration

# Запуск с базой данных
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### E2E тесты
```bash
# Запуск E2E тестов
docker run --rm wb-slots-app:latest npm run test:e2e

# Запуск с браузером
docker run --rm --shm-size=2g wb-slots-app:latest npm run test:e2e
```

### Нагрузочное тестирование
```bash
# Запуск нагрузочных тестов
docker run --rm wb-slots-app:latest npm run test:load

# Запуск с метриками
docker run --rm -p 9090:9090 wb-slots-app:latest npm run test:load
```

---

## 📊 Мониторинг

### Просмотр логов
```bash
# Просмотр логов контейнера
docker logs wb-slots-app

# Просмотр логов в реальном времени
docker logs -f wb-slots-app

# Просмотр последних 100 строк
docker logs --tail 100 wb-slots-app
```

### Мониторинг ресурсов
```bash
# Статистика использования ресурсов
docker stats wb-slots-app

# Статистика в реальном времени
docker stats --no-stream wb-slots-app
```

### Проверка здоровья
```bash
# Проверка статуса health check
docker inspect wb-slots-app --format='{{.State.Health.Status}}'

# Подробная информация о health check
docker inspect wb-slots-app --format='{{json .State.Health}}' | jq
```

### Метрики Prometheus
```bash
# Запуск с метриками
docker run -d \
  --name wb-slots-app \
  -p 3000:3000 \
  -p 9090:9090 \
  wb-slots-app:latest

# Просмотр метрик
curl http://localhost:9090/metrics
```

---

## 💾 Backup и восстановление

### Backup данных
```bash
# Backup базы данных
docker exec wb-slots-postgres pg_dump -U postgres wb_slots > backup-$(date +%Y%m%d).sql

# Backup Redis
docker exec wb-slots-redis redis-cli BGSAVE
docker cp wb-slots-redis:/data/dump.rdb backup-$(date +%Y%m%d).rdb

# Backup томов
docker run --rm -v wb-slots-data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup-$(date +%Y%m%d).tar.gz /data
```

### Восстановление данных
```bash
# Восстановление базы данных
docker exec -i wb-slots-postgres psql -U postgres wb_slots < backup-20240101.sql

# Восстановление Redis
docker cp backup-20240101.rdb wb-slots-redis:/data/dump.rdb
docker restart wb-slots-redis

# Восстановление томов
docker run --rm -v wb-slots-data:/data -v $(pwd):/backup alpine tar xzf /backup/data-backup-20240101.tar.gz -C /
```

---

## 🔄 CI/CD интеграция

### GitHub Actions
```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker image
      run: |
        docker build -t wb-slots-app:${{ github.sha }} .
        docker build -t wb-slots-app:latest .
    
    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push wb-slots-app:${{ github.sha }}
        docker push wb-slots-app:latest
```

### GitLab CI
```yaml
stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - docker build -t wb-slots-app:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

test:
  stage: test
  script:
    - docker run --rm wb-slots-app:$CI_COMMIT_SHA npm test

deploy:
  stage: deploy
  script:
    - docker tag wb-slots-app:$CI_COMMIT_SHA wb-slots-app:latest
    - docker push wb-slots-app:latest
```

### Jenkins Pipeline
```groovy
pipeline {
    agent any
    
    stages {
        stage('Build') {
            steps {
                sh 'docker build -t wb-slots-app:${BUILD_NUMBER} .'
                sh 'docker tag wb-slots-app:${BUILD_NUMBER} wb-slots-app:latest'
            }
        }
        
        stage('Test') {
            steps {
                sh 'docker run --rm wb-slots-app:${BUILD_NUMBER} npm test'
            }
        }
        
        stage('Deploy') {
            steps {
                sh 'docker push wb-slots-app:${BUILD_NUMBER}'
                sh 'docker push wb-slots-app:latest'
            }
        }
    }
}
```

---

## 🛠️ Полезные команды

### Управление образами
```bash
# Просмотр всех образов
docker images wb-slots-app

# Удаление неиспользуемых образов
docker image prune -f

# Удаление всех образов wb-slots-app
docker rmi $(docker images wb-slots-app -q)
```

### Управление контейнерами
```bash
# Просмотр запущенных контейнеров
docker ps

# Просмотр всех контейнеров
docker ps -a

# Остановка всех контейнеров wb-slots-app
docker stop $(docker ps -q --filter "name=wb-slots-app")

# Удаление всех контейнеров wb-slots-app
docker rm $(docker ps -aq --filter "name=wb-slots-app")
```

### Отладка
```bash
# Выполнение команд в контейнере
docker exec -it wb-slots-app sh

# Просмотр процессов в контейнере
docker exec wb-slots-app ps aux

# Просмотр переменных окружения
docker exec wb-slots-app env
```

---

## 📚 Дополнительные ресурсы

- [Docker Documentation](https://docs.docker.com/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-stage Builds](https://docs.docker.com/develop/dev-best-practices/dockerfile_best-practices/#use-multi-stage-builds)
- [Docker Security](https://docs.docker.com/engine/security/)
