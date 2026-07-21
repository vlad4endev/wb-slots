# 🚀 GitHub Actions для WB Slots

Полная система CI/CD для автоматической сборки, тестирования и развертывания Docker образов.

## 📁 Структура файлов

```
.github/
├── workflows/
│   ├── docker-build.yml          # Основная сборка Docker образов
│   ├── docker-multi-stage.yml    # Многоэтапная сборка
│   ├── docker-hub.yml            # Публикация в Docker Hub
│   ├── security-scan.yml         # Сканирование безопасности
│   └── release.yml               # Создание релизов
├── dependabot.yml                # Автоматические обновления зависимостей
└── codeql.yml                    # Анализ кода
```

## 🔄 Workflows

### 1. **docker-build.yml** - Основная сборка
**Триггеры:**
- Push в `main` или `develop`
- Push тегов `v*`
- Pull requests в `main`

**Что делает:**
- ✅ Сборка Docker образа для multiple platforms (amd64, arm64)
- ✅ Публикация в GitHub Container Registry
- ✅ Запуск тестов (unit, integration, linting)
- ✅ Сканирование безопасности с Trivy
- ✅ Автоматическое развертывание (staging/production)

### 2. **docker-multi-stage.yml** - Многоэтапная сборка
**Триггеры:**
- Push в `main` или `develop`
- Push тегов `v*`
- Pull requests в `main`
- Manual dispatch

**Что делает:**
- ✅ Сборка development образа (`builder` target)
- ✅ Сборка production образа (`runner` target)
- ✅ Сборка test образа (`builder` target)
- ✅ Запуск всех типов тестов
- ✅ Сканирование безопасности
- ✅ Performance тестирование
- ✅ Условное развертывание

### 3. **docker-hub.yml** - Docker Hub
**Триггеры:**
- Push в `main`
- Push тегов `v*`
- Manual dispatch

**Что делает:**
- ✅ Публикация в Docker Hub
- ✅ Обновление описания образа
- ✅ Уведомления о статусе

### 4. **security-scan.yml** - Безопасность
**Триггеры:**
- Push в `main` или `develop`
- Pull requests в `main`
- Еженедельно по понедельникам
- Manual dispatch

**Что делает:**
- ✅ Trivy vulnerability scanner
- ✅ Dependency scan (npm audit, Snyk)
- ✅ CodeQL анализ
- ✅ Dockerfile scan (Hadolint)
- ✅ Secret scan (TruffleHog)
- ✅ License scan

### 5. **release.yml** - Релизы
**Триггеры:**
- Push тегов `v*`
- Manual dispatch

**Что делает:**
- ✅ Создание GitHub Release
- ✅ Генерация changelog
- ✅ Сборка всех образов (prod, dev, test)
- ✅ Загрузка Docker образов как assets
- ✅ Уведомления

## 🚀 Быстрый старт

### 1. Настройка репозитория

```bash
# Клонирование репозитория
git clone https://github.com/your-username/wb-slots.git
cd wb-slots

# Создание ветки для разработки
git checkout -b develop
git push -u origin develop
```

### 2. Настройка секретов

В настройках репозитория (`Settings` → `Secrets and variables` → `Actions`) добавьте:

#### Обязательные секреты:
- `GITHUB_TOKEN` - автоматически предоставляется GitHub

#### Опциональные секреты:
- `DOCKERHUB_USERNAME` - имя пользователя Docker Hub
- `DOCKERHUB_TOKEN` - токен Docker Hub
- `SNYK_TOKEN` - токен Snyk для сканирования зависимостей

### 3. Запуск сборки

#### Автоматический запуск:
```bash
# Push в main ветку
git push origin main

# Push тега для релиза
git tag v1.0.0
git push origin v1.0.0

# Создание Pull Request
git checkout -b feature/new-feature
git push origin feature/new-feature
# Создать PR через GitHub UI
```

#### Ручной запуск:
1. Перейдите в `Actions` вкладку
2. Выберите нужный workflow
3. Нажмите `Run workflow`
4. Выберите ветку и параметры

## 📊 Мониторинг

### Просмотр статуса
- **Actions вкладка** - все запуски workflows
- **Security вкладка** - результаты сканирования безопасности
- **Packages** - опубликованные Docker образы
- **Releases** - созданные релизы

### Уведомления
- Email уведомления о статусе сборки
- Slack уведомления (если настроены)
- GitHub notifications

## 🐳 Docker образы

### Опубликованные образы:
- **Production**: `ghcr.io/your-username/wb-slots:latest`
- **Development**: `ghcr.io/your-username/wb-slots-dev:latest`
- **Test**: `ghcr.io/your-username/wb-slots-test:latest`

### Использование:
```bash
# Production
docker pull ghcr.io/your-username/wb-slots:latest
docker run -d --name wb-slots-app -p 3000:3000 ghcr.io/your-username/wb-slots:latest

# Development
docker pull ghcr.io/your-username/wb-slots-dev:latest
docker run -d --name wb-slots-dev -p 3000:3000 ghcr.io/your-username/wb-slots-dev:latest

# Test
docker pull ghcr.io/your-username/wb-slots-test:latest
docker run --rm ghcr.io/your-username/wb-slots-test:latest npm test
```

## 🔧 Настройка

### Изменение триггеров
Отредактируйте файлы в `.github/workflows/`:

```yaml
on:
  push:
    branches: [ main, develop ]  # Изменить ветки
    tags: [ 'v*' ]               # Изменить теги
  schedule:
    - cron: '0 2 * * 1'          # Изменить расписание
```

### Добавление новых тестов
```yaml
- name: Run custom tests
  run: |
    docker run --rm wb-slots-app:test npm run test:custom
```

### Изменение платформ сборки
```yaml
platforms: linux/amd64,linux/arm64,linux/arm/v7  # Добавить платформы
```

### Настройка уведомлений
```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 🆘 Troubleshooting

### Проблемы с сборкой
1. **Проверьте логи** в Actions вкладке
2. **Убедитесь в правильности Dockerfile**
3. **Проверьте секреты** в настройках репозитория
4. **Убедитесь в достаточности ресурсов** GitHub Actions

### Проблемы с публикацией
1. **Проверьте права доступа** к Container Registry
2. **Убедитесь в правильности токенов**
3. **Проверьте лимиты** GitHub Packages

### Проблемы с тестами
1. **Проверьте зависимости** в package.json
2. **Убедитесь в правильности тестовых файлов**
3. **Проверьте переменные окружения**

## 📚 Полезные ссылки

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Buildx](https://docs.docker.com/buildx/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Trivy Security Scanner](https://aquasecurity.github.io/trivy/)
- [CodeQL](https://codeql.github.com/)

## 🎯 Готово!

Теперь у вас есть полная система CI/CD для автоматической сборки и развертывания Docker образов! 🚀

### Основные команды:
- **Просмотр статуса**: GitHub Actions вкладка
- **Ручной запуск**: Actions → Run workflow
- **Просмотр образов**: Packages вкладка
- **Создание релиза**: `git tag v1.0.0 && git push origin v1.0.0`
