# 💾 WB Slots - Инструкции по резервному копированию

## 🚀 Быстрый старт

### Полное резервное копирование
```bash
# Запустите скрипт полного backup
backup-project.bat
```

### Backup только данных
```bash
# Запустите скрипт backup данных
backup-data-only.bat
```

### Через менеджер проекта
```bash
# Запустите главный менеджер
wb-slots-manager.bat
# Выберите:
# 12. 💾 Полное резервное копирование
# 13. 💾 Backup только данных
```

## 📋 Что включают backup'ы

### Полное резервное копирование (`backup-project.bat`)
- ✅ **База данных PostgreSQL** - полный дамп всех таблиц и данных
- ✅ **Данные Redis** - кэш и очереди задач
- ✅ **Исходный код** - весь проект в архиве
- ✅ **Конфигурационные файлы** - .env, docker-compose.yml, package.json
- ✅ **Скрипты управления** - все .bat файлы и документация
- ✅ **Финальный архив** - все в одном ZIP файле

### Backup только данных (`backup-data-only.bat`)
- ✅ **База данных PostgreSQL** - database.sql
- ✅ **Данные Redis** - redis.rdb

## 🔧 Ручные команды

### Backup базы данных
```bash
# Перейдите в директорию проекта
cd wb-slots

# Создайте backup PostgreSQL
docker exec wb-slots-postgres pg_dump -U postgres wb_slots > backup-database.sql

# Создайте backup Redis
docker exec wb-slots-redis redis-cli BGSAVE
docker cp wb-slots-redis:/data/dump.rdb backup-redis.rdb
```

### Backup через Docker Image Manager
```bash
# Запустите Docker Image Manager
wb-slots\docker-image-manager.bat
# Выберите: 13. Backup data
```

## 🔄 Восстановление из backup

### Восстановление полного backup
1. **Распакуйте архив** `wb-slots-backup-YYYYMMDD_HHMMSS.zip`
2. **Запустите настройку** `setup-project.bat`
3. **Восстановите данные**:
   ```bash
   # Остановите сервисы
   stop-services.bat
   
   # Восстановите базу данных
   docker exec -i wb-slots-postgres psql -U postgres wb_slots < database.sql
   
   # Восстановите Redis
   docker cp redis.rdb wb-slots-redis:/data/dump.rdb
   docker restart wb-slots-redis
   
   # Запустите сервисы
   start-services.bat
   ```

### Восстановление только данных
```bash
# Остановите сервисы
stop-services.bat

# Восстановите базу данных
docker exec -i wb-slots-postgres psql -U postgres wb_slots < backup-database.sql

# Восстановите Redis
docker cp backup-redis.rdb wb-slots-redis:/data/dump.rdb
docker restart wb-slots-redis

# Запустите сервисы
start-services.bat
```

## 📁 Структура backup файлов

### Полный backup
```
backups/
└── wb-slots-backup-20241213_143022.zip
    ├── database.sql          # База данных PostgreSQL
    ├── redis.rdb             # Данные Redis
    ├── source-code.zip       # Исходный код проекта
    ├── .env                  # Конфигурация
    ├── docker-compose.yml    # Docker конфигурация
    ├── package.json          # Зависимости
    └── *.bat                 # Скрипты управления
```

### Backup только данных
```
wb-slots-data-20241213_143022-database.sql  # База данных
wb-slots-data-20241213_143022-redis.rdb     # Redis данные
```

## ⚠️ Важные замечания

### Перед созданием backup
- ✅ Убедитесь, что Docker контейнеры запущены
- ✅ Проверьте, что база данных содержит актуальные данные
- ✅ Остановите активные задачи поиска слотов

### После восстановления
- ✅ Проверьте подключение к базе данных
- ✅ Убедитесь, что Redis работает корректно
- ✅ Проверьте настройки в .env файле
- ✅ Перезапустите все сервисы

### Автоматизация backup
Для регулярного создания backup'ов можно настроить:
- **Windows Task Scheduler** - для автоматического запуска скриптов
- **Cron** (если используете WSL) - для Linux-подобного планировщика
- **Docker Compose** - для периодических backup'ов

## 🆘 Решение проблем

### Ошибка "контейнер не запущен"
```bash
# Запустите сервисы перед backup
start-services.bat
```

### Ошибка "не удалось создать backup"
```bash
# Проверьте статус контейнеров
docker ps

# Проверьте логи
docker logs wb-slots-postgres
docker logs wb-slots-redis
```

### Ошибка восстановления
```bash
# Очистите базу данных перед восстановлением
docker exec wb-slots-postgres psql -U postgres -c "DROP DATABASE wb_slots;"
docker exec wb-slots-postgres psql -U postgres -c "CREATE DATABASE wb_slots;"
```

## 📞 Поддержка

Если у вас возникли проблемы с backup'ом:
1. Проверьте логи Docker контейнеров
2. Убедитесь, что все сервисы запущены
3. Проверьте права доступа к файлам
4. Обратитесь к документации проекта

---
**Создано для WB Slots Project** 🚀
