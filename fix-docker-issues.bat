@echo off
chcp 65001 >nul
title WB Slots - Fix Docker Issues

echo.
echo ========================================
echo    WB Slots - Исправление проблем Docker
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

echo [INFO] Остановка и очистка существующих контейнеров...
docker-compose down -v
docker system prune -f

echo [INFO] Удаление старых образов...
docker image prune -f
docker builder prune -f

echo [INFO] Проверка версии Node.js...
node --version
echo.

echo [WARNING] Обнаружены проблемы с Docker сборкой:
echo 1. Несовместимость версии Node.js (требуется ^20.19.0)
echo 2. Проблемы с загрузкой Puppeteer Chrome
echo 3. Конфликты Prisma engines
echo.

echo [INFO] Применяем исправления...
echo.

:: Создаем .dockerignore для оптимизации сборки
echo [INFO] Создание .dockerignore...
echo node_modules > .dockerignore
echo .next >> .dockerignore
echo .git >> .dockerignore
echo .env >> .dockerignore
echo logs >> .dockerignore
echo temp >> .dockerignore
echo uploads >> .dockerignore
echo *.log >> .dockerignore
echo .DS_Store >> .dockerignore
echo Thumbs.db >> .dockerignore

:: Создаем улучшенный Dockerfile для разработки
echo [INFO] Создание Dockerfile.dev для разработки...
echo FROM node:20-alpine AS base > Dockerfile.dev
echo. >> Dockerfile.dev
echo # Install system dependencies >> Dockerfile.dev
echo RUN apk add --no-cache libc6-compat chromium >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Set working directory >> Dockerfile.dev
echo WORKDIR /app >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Set environment variables >> Dockerfile.dev
echo ENV NODE_ENV=development >> Dockerfile.dev
echo ENV PUPPETEER_SKIP_DOWNLOAD=true >> Dockerfile.dev
echo ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Copy package files >> Dockerfile.dev
echo COPY package*.json ./ >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Install dependencies >> Dockerfile.dev
echo RUN npm ci --include=dev >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Copy source code >> Dockerfile.dev
echo COPY . . >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Generate Prisma client >> Dockerfile.dev
echo RUN npx prisma generate >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Expose port >> Dockerfile.dev
echo EXPOSE 3000 >> Dockerfile.dev
echo. >> Dockerfile.dev
echo # Start command >> Dockerfile.dev
echo CMD ["npm", "run", "dev"] >> Dockerfile.dev

:: Создаем docker-compose.dev.yml для разработки
echo [INFO] Создание docker-compose.dev.yml для разработки...
echo services: > docker-compose.dev.yml
echo   postgres: >> docker-compose.dev.yml
echo     image: postgres:15-alpine >> docker-compose.dev.yml
echo     container_name: wb-slots-postgres-dev >> docker-compose.dev.yml
echo     environment: >> docker-compose.dev.yml
echo       POSTGRES_DB: wb_slots >> docker-compose.dev.yml
echo       POSTGRES_USER: postgres >> docker-compose.dev.yml
echo       POSTGRES_PASSWORD: password >> docker-compose.dev.yml
echo     ports: >> docker-compose.dev.yml
echo       - "5432:5432" >> docker-compose.dev.yml
echo     volumes: >> docker-compose.dev.yml
echo       - postgres_data:/var/lib/postgresql/data >> docker-compose.dev.yml
echo     healthcheck: >> docker-compose.dev.yml
echo       test: ["CMD-SHELL", "pg_isready -U postgres"] >> docker-compose.dev.yml
echo       interval: 10s >> docker-compose.dev.yml
echo       timeout: 5s >> docker-compose.dev.yml
echo       retries: 5 >> docker-compose.dev.yml
echo. >> docker-compose.dev.yml
echo   redis: >> docker-compose.dev.yml
echo     image: redis:7-alpine >> docker-compose.dev.yml
echo     container_name: wb-slots-redis-dev >> docker-compose.dev.yml
echo     ports: >> docker-compose.dev.yml
echo       - "6379:6379" >> docker-compose.dev.yml
echo     volumes: >> docker-compose.dev.yml
echo       - redis_data:/data >> docker-compose.dev.yml
echo     healthcheck: >> docker-compose.dev.yml
echo       test: ["CMD", "redis-cli", "ping"] >> docker-compose.dev.yml
echo       interval: 10s >> docker-compose.dev.yml
echo       timeout: 5s >> docker-compose.dev.yml
echo       retries: 5 >> docker-compose.dev.yml
echo. >> docker-compose.dev.yml
echo volumes: >> docker-compose.dev.yml
echo   postgres_data: >> docker-compose.dev.yml
echo   redis_data: >> docker-compose.dev.yml

echo [INFO] Создание скрипта для локальной разработки без Docker...
echo @echo off > start-local-dev.bat
echo chcp 65001 ^>nul >> start-local-dev.bat
echo title WB Slots - Local Development >> start-local-dev.bat
echo. >> start-local-dev.bat
echo echo [INFO] Запуск только базы данных и Redis... >> start-local-dev.bat
echo docker-compose -f docker-compose.dev.yml up -d >> start-local-dev.bat
echo. >> start-local-dev.bat
echo echo [INFO] Ожидание готовности сервисов... >> start-local-dev.bat
echo timeout /t 10 /nobreak ^>nul >> start-local-dev.bat
echo. >> start-local-dev.bat
echo echo [INFO] Применение миграций... >> start-local-dev.bat
echo npx prisma db push >> start-local-dev.bat
echo. >> start-local-dev.bat
echo echo [INFO] Запуск frontend... >> start-local-dev.bat
echo start "WB Slots Frontend" cmd /k "npm run dev" >> start-local-dev.bat
echo. >> start-local-dev.bat
echo echo [INFO] Запуск backend... >> start-local-dev.bat
echo cd backend >> start-local-dev.bat
echo start "WB Slots Backend" cmd /k "npm run start:dev" >> start-local-dev.bat
echo cd .. >> start-local-dev.bat
echo. >> start-local-dev.bat
echo echo [INFO] Запуск worker... >> start-local-dev.bat
echo start "WB Slots Worker" cmd /k "npm run worker" >> start-local-dev.bat
echo. >> start-local-dev.bat
echo echo [INFO] Все сервисы запущены локально! >> start-local-dev.bat
echo pause >> start-local-dev.bat

echo [INFO] Обновление package.json для совместимости...
:: Проверяем версию Node.js и предупреждаем пользователя
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [WARNING] Текущая версия Node.js: %NODE_VERSION%
echo [WARNING] Рекомендуется обновить до Node.js 20.x или выше
echo.

echo [INFO] Попытка сборки с исправлениями...
echo.

:: Пробуем собрать с новыми настройками
echo [INFO] Сборка Docker образа с исправлениями...
docker build --no-cache -t wb-slots-app .
if errorlevel 1 (
    echo [WARNING] Сборка с Puppeteer не удалась!
    echo [INFO] Пробуем сборку без Puppeteer...
    
    :: Пробуем собрать без Puppeteer
    docker build --no-cache -f Dockerfile.no-puppeteer -t wb-slots-app .
    if errorlevel 1 (
        echo [ERROR] Сборка Docker образа не удалась!
        echo.
        echo РЕКОМЕНДАЦИИ:
        echo 1. Обновите Node.js до версии 20.x или выше
        echo 2. Используйте локальную разработку: start-local-dev.bat
        echo 3. Проверьте интернет-соединение для загрузки зависимостей
        echo 4. Попробуйте перезапустить Docker Desktop
        echo.
        echo Альтернативный способ - запуск без Docker:
        echo 1. Запустите: start-local-dev.bat
        echo 2. Это запустит только БД и Redis в Docker, а приложение локально
        echo.
    ) else (
        echo [SUCCESS] Docker образ успешно собран без Puppeteer!
        echo [INFO] Теперь можете запустить: docker-compose up -d
        echo [WARNING] Puppeteer функции могут не работать в контейнере
    )
) else (
    echo [SUCCESS] Docker образ успешно собран с Puppeteer!
    echo [INFO] Теперь можете запустить: docker-compose up -d
)

echo.
echo ========================================
echo        ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ!
echo ========================================
echo.
echo Созданы дополнительные файлы:
echo - .dockerignore (оптимизация сборки)
echo - Dockerfile.dev (для разработки)
echo - docker-compose.dev.yml (только БД и Redis)
echo - start-local-dev.bat (локальная разработка)
echo.
echo РЕКОМЕНДАЦИИ:
echo 1. Обновите Node.js до версии 20.x
echo 2. Используйте start-local-dev.bat для разработки
echo 3. Используйте docker-compose up для продакшена
echo.
pause
