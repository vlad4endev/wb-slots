# 🧪 Тестовое окружение WB Slots

## 📋 Обзор

Безопасное тестовое окружение для разработки и тестирования WB Slots без влияния на продакшен.

## 🚀 Быстрый старт

### 1. Запуск тестового окружения

```bash
# Linux/macOS
./scripts/test-environment.sh start

# Windows
scripts\test-environment.bat start
```

### 2. Проверка статуса

```bash
# Linux/macOS
./scripts/test-environment.sh status

# Windows
scripts\test-environment.bat status
```

### 3. Просмотр логов

```bash
# Все сервисы
./scripts/test-environment.sh logs

# Конкретный сервис
./scripts/test-environment.sh logs app-test
```

## 🏗️ Архитектура тестового окружения

### Сервисы

| Сервис | Порт | Описание |
|--------|------|----------|
| **app-test** | 3001 | Основное приложение |
| **worker-test** | - | Фоновые воркеры |
| **postgres-test** | 5433 | База данных PostgreSQL |
| **redis-test** | 6380 | Redis для очередей |
| **nginx-test** | 8080 | Load balancer (опционально) |

### Отличия от продакшена

- ✅ **Отдельные порты** - не конфликтуют с продакшеном
- ✅ **Тестовая база данных** - `wb_slots_test`
- ✅ **Тестовые ключи** - безопасные для разработки
- ✅ **Мягкие лимиты** - для удобства тестирования
- ✅ **Подробное логирование** - для отладки
- ✅ **Быстрая инициализация** - оптимизировано для разработки

## 🔧 Управление окружением

### Основные команды

```bash
# Запуск
./scripts/test-environment.sh start

# Остановка
./scripts/test-environment.sh stop

# Перезапуск
./scripts/test-environment.sh restart

# Очистка (удаление всех данных)
./scripts/test-environment.sh clean
```

### Работа с базой данных

```bash
# Сброс базы данных
./scripts/test-environment.sh reset-db

# Выполнение команд в контейнере
./scripts/test-environment.sh exec app-test npx prisma studio
```

### Тестирование

```bash
# Запуск тестов
./scripts/test-environment.sh test

# Выполнение линтера
./scripts/test-environment.sh exec app-test npm run lint
```

## 📊 Мониторинг

### Проверка статуса сервисов

```bash
./scripts/test-environment.sh status
```

### Просмотр логов

```bash
# Все сервисы
./scripts/test-environment.sh logs

# Конкретный сервис
./scripts/test-environment.sh logs app-test
./scripts/test-environment.sh logs worker-test
./scripts/test-environment.sh logs postgres-test
./scripts/test-environment.sh logs redis-test
```

### Health checks

- **Приложение**: http://localhost:3001/health
- **Nginx**: http://localhost:8080/health

## 🔐 Безопасность

### Тестовые ключи

- **JWT_SECRET**: `test-jwt-secret-key-for-development-only`
- **ENCRYPTION_KEY**: `dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n`
- **SESSION_SECRET**: `test-session-secret-key`

### Изоляция

- ✅ Отдельная сеть Docker
- ✅ Отдельные тома данных
- ✅ Отдельные порты
- ✅ Тестовая база данных

## 🛠️ Разработка

### Структура файлов

```
wb-slots/
├── docker-compose.test.yml    # Конфигурация тестового окружения
├── Dockerfile.dev             # Dockerfile для разработки
├── env.test                   # Переменные окружения для тестов
├── nginx/
│   └── nginx-test.conf        # Конфигурация Nginx для тестов
├── docker/
│   └── init-db-test.sql       # Инициализация тестовой БД
└── scripts/
    ├── test-environment.sh    # Скрипт управления (Linux/macOS)
    └── test-environment.bat   # Скрипт управления (Windows)
```

### Переменные окружения

Основные переменные для тестов:

```env
# База данных
DATABASE_URL="postgresql://postgres:test_password_123@localhost:5433/wb_slots_test?schema=public"
REDIS_URL="redis://localhost:6380"

# Безопасность
JWT_SECRET="test-jwt-secret-key-for-development-only"
ENCRYPTION_KEY="dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n"

# Приложение
APP_BASE_URL="http://localhost:3001"
NODE_ENV="test"
LOG_LEVEL="debug"
```

## 🐛 Отладка

### Частые проблемы

1. **Порты заняты**
   ```bash
   # Проверить занятые порты
   netstat -tulpn | grep :3001
   netstat -tulpn | grep :5433
   netstat -tulpn | grep :6380
   ```

2. **Контейнеры не запускаются**
   ```bash
   # Проверить логи
   ./scripts/test-environment.sh logs
   
   # Перезапустить
   ./scripts/test-environment.sh restart
   ```

3. **База данных не инициализируется**
   ```bash
   # Сбросить базу данных
   ./scripts/test-environment.sh reset-db
   ```

### Полезные команды

```bash
# Войти в контейнер приложения
./scripts/test-environment.sh exec app-test sh

# Проверить подключение к БД
./scripts/test-environment.sh exec app-test npx prisma db pull

# Запустить Prisma Studio
./scripts/test-environment.sh exec app-test npx prisma studio

# Проверить Redis
./scripts/test-environment.sh exec redis-test redis-cli ping
```

## 📈 Производительность

### Оптимизации для тестов

- **Меньше раундов bcrypt** (4 вместо 12)
- **Мягкие rate limits** (1000 запросов/минуту)
- **Быстрые таймауты** (10 секунд)
- **Подробное логирование** для отладки

### Мониторинг ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Логи производительности
./scripts/test-environment.sh logs app-test | grep "performance"
```

## 🔄 CI/CD

### Интеграция с GitHub Actions

```yaml
- name: Start Test Environment
  run: |
    chmod +x scripts/test-environment.sh
    ./scripts/test-environment.sh start
    
- name: Run Tests
  run: ./scripts/test-environment.sh test
  
- name: Cleanup
  run: ./scripts/test-environment.sh clean
```

## 📚 Дополнительные ресурсы

- [Docker Compose документация](https://docs.docker.com/compose/)
- [Prisma документация](https://www.prisma.io/docs/)
- [Next.js документация](https://nextjs.org/docs)
- [BullMQ документация](https://docs.bullmq.io/)

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи: `./scripts/test-environment.sh logs`
2. Проверьте статус: `./scripts/test-environment.sh status`
3. Перезапустите окружение: `./scripts/test-environment.sh restart`
4. Очистите и пересоздайте: `./scripts/test-environment.sh clean && ./scripts/test-environment.sh start`

---

**Важно**: Тестовое окружение использует тестовые ключи и настройки. Никогда не используйте их в продакшене!
