# 🚀 Быстрый старт WB Slots на Docker

## ⚡ За 5 минут

### 1. Проверка системы
```bash
# Windows
check-system.bat

# Linux/Mac
chmod +x check-system.sh
./check-system.sh
```

### 2. Развертывание
```bash
# Windows - Полное развертывание с проверками
full-deploy.bat

# Или быстрое развертывание
quick-deploy.bat

# Linux/Mac
chmod +x full-deploy.sh
./full-deploy.sh
```

### 3. Доступ к приложению
- **Development**: http://localhost:3000
- **Production**: http://localhost (через Nginx)

---

## 📋 Что происходит при развертывании

### Development режим:
- ✅ PostgreSQL база данных (порт 5432)
- ✅ Redis кэш (порт 6379)  
- ✅ Приложение (порт 3000)
- ✅ Фоновые воркеры
- ✅ Автоматические миграции БД

### Production режим:
- ✅ PostgreSQL база данных
- ✅ Redis кэш
- ✅ Приложение (2 реплики)
- ✅ Фоновые воркеры (2 реплики)
- ✅ Nginx load balancer (порт 80)
- ✅ Health checks
- ✅ Автоматическое масштабирование

---

## 🔧 Управление

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
```

### Масштабирование
```bash
# Увеличить количество реплик приложения
docker service scale wb-slots_app=5
```

### Остановка
```bash
# Development
docker stack rm wb-slots-dev

# Production
docker stack rm wb-slots
```

---

## 🆘 Если что-то пошло не так

### 1. Проверьте логи
```bash
docker service logs wb-slots_app
```

### 2. Проверьте статус
```bash
docker stack ps wb-slots
```

### 3. Перезапустите сервис
```bash
docker service update --force wb-slots_app
```

### 4. Полная переустановка
```bash
# Остановить и удалить все
docker stack rm wb-slots
docker system prune -f

# Запустить заново
full-deploy.bat
```

---

## 📚 Подробная документация

- **Полная инструкция**: `DOCKER_DEPLOYMENT_GUIDE.md`
- **Docker Stack документация**: `README-DOCKER-STACK.md`
- **Настройка переменных**: `env.example`

---

## 🎯 Готово!

Ваше приложение WB Slots теперь работает в Docker! 🎉
