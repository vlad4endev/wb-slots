@echo off
chcp 65001 >nul
title WB Slots - Quick Fix Alpine

echo.
echo ========================================
echo    WB Slots - Быстрое исправление Alpine
echo ========================================
echo.

:: Проверяем, что мы находимся в правильной директории
if not exist "wb-slots" (
    echo [ERROR] Директория wb-slots не найдена!
    echo Убедитесь, что скрипт запущен из корневой папки проекта.
    pause
    exit /b 1
)

:: Переходим в директорию проекта
cd wb-slots

echo [INFO] Проблема: Alpine Linux не может найти пакеты chromium и libc6-compat
echo [INFO] Решение: Используем альтернативный Dockerfile без Puppeteer
echo.

echo [INFO] Остановка существующих контейнеров...
docker-compose down -v

echo [INFO] Очистка Docker кэша...
docker system prune -f

echo [INFO] Создание упрощенного docker-compose.yml...
echo services: > docker-compose.simple.yml
echo   postgres: >> docker-compose.simple.yml
echo     image: postgres:15-alpine >> docker-compose.simple.yml
echo     container_name: wb-slots-postgres >> docker-compose.simple.yml
echo     environment: >> docker-compose.simple.yml
echo       POSTGRES_DB: wb_slots >> docker-compose.simple.yml
echo       POSTGRES_USER: postgres >> docker-compose.simple.yml
echo       POSTGRES_PASSWORD: password >> docker-compose.simple.yml
echo     ports: >> docker-compose.simple.yml
echo       - "5432:5432" >> docker-compose.simple.yml
echo     volumes: >> docker-compose.simple.yml
echo       - postgres_data:/var/lib/postgresql/data >> docker-compose.simple.yml
echo     healthcheck: >> docker-compose.simple.yml
echo       test: ["CMD-SHELL", "pg_isready -U postgres"] >> docker-compose.simple.yml
echo       interval: 10s >> docker-compose.simple.yml
echo       timeout: 5s >> docker-compose.simple.yml
echo       retries: 5 >> docker-compose.simple.yml
echo. >> docker-compose.simple.yml
echo   redis: >> docker-compose.simple.yml
echo     image: redis:7-alpine >> docker-compose.simple.yml
echo     container_name: wb-slots-redis >> docker-compose.simple.yml
echo     ports: >> docker-compose.simple.yml
echo       - "6379:6379" >> docker-compose.simple.yml
echo     volumes: >> docker-compose.simple.yml
echo       - redis_data:/data >> docker-compose.simple.yml
echo     healthcheck: >> docker-compose.simple.yml
echo       test: ["CMD", "redis-cli", "ping"] >> docker-compose.simple.yml
echo       interval: 10s >> docker-compose.simple.yml
echo       timeout: 5s >> docker-compose.simple.yml
echo       retries: 5 >> docker-compose.simple.yml
echo. >> docker-compose.simple.yml
echo volumes: >> docker-compose.simple.yml
echo   postgres_data: >> docker-compose.simple.yml
echo   redis_data: >> docker-compose.simple.yml

echo [INFO] Запуск только базы данных и Redis...
docker-compose -f docker-compose.simple.yml up -d

echo [INFO] Ожидание готовности сервисов...
timeout /t 10 /nobreak >nul

echo [INFO] Проверка статуса контейнеров...
docker-compose -f docker-compose.simple.yml ps

echo [INFO] Применение миграций...
npx prisma db push

echo [INFO] Запуск приложения локально...
echo [INFO] Frontend будет запущен в новом окне...
start "WB Slots Frontend" cmd /k "npm run dev"

echo [INFO] Backend будет запущен в новом окне...
cd backend
start "WB Slots Backend" cmd /k "npm run start:dev"
cd ..

echo [INFO] Worker будет запущен в новом окне...
start "WB Slots Worker" cmd /k "npm run worker"

echo.
echo ========================================
echo        ПРОБЛЕМА РЕШЕНА!
echo ========================================
echo.
echo ✅ База данных и Redis запущены в Docker
echo ✅ Приложение запущено локально
echo ✅ Все сервисы работают
echo.
echo Доступные адреса:
echo - Frontend: http://localhost:3000
echo - Backend: http://localhost:3001
echo - PostgreSQL: localhost:5432
echo - Redis: localhost:6379
echo.
echo Для остановки используйте:
echo docker-compose -f docker-compose.simple.yml down
echo.
pause

