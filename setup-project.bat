@echo off
chcp 65001 >nul
title WB Slots - Project Setup

echo.
echo ========================================
echo    WB Slots - Первоначальная настройка
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

echo [INFO] Проверка системных требований...
echo.

:: Проверяем Node.js
echo [1/6] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js не установлен!
    echo.
    echo Пожалуйста, установите Node.js LTS версию:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js %%i установлен
)

:: Проверяем npm
echo [2/6] Проверка npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm не найден!
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo [OK] npm %%i установлен
)

:: Проверяем Docker
echo [3/6] Проверка Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не установлен!
    echo.
    echo Пожалуйста, установите Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('docker --version') do echo [OK] Docker %%i установлен
)

:: Проверяем, что Docker запущен
echo [4/6] Проверка статуса Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не запущен!
    echo.
    echo Пожалуйста, запустите Docker Desktop и повторите попытку.
    echo.
    pause
    exit /b 1
) else (
    echo [OK] Docker запущен и готов к работе
)

:: Проверяем Git
echo [5/6] Проверка Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Git не установлен (не критично)
) else (
    for /f "tokens=*" %%i in ('git --version') do echo [OK] Git %%i установлен
)

:: Проверяем доступность портов
echo [6/6] Проверка доступности портов...
netstat -an | find "3000" >nul
if not errorlevel 1 (
    echo [WARNING] Порт 3000 уже используется
)

netstat -an | find "3001" >nul
if not errorlevel 1 (
    echo [WARNING] Порт 3001 уже используется
)

netstat -an | find "5432" >nul
if not errorlevel 1 (
    echo [WARNING] Порт 5432 уже используется
)

netstat -an | find "6379" >nul
if not errorlevel 1 (
    echo [WARNING] Порт 6379 уже используется
)

echo.
echo [INFO] Все проверки завершены!
echo.

:: Создаем .env файл если его нет
if not exist ".env" (
    echo [INFO] Создание .env файла...
    if exist "..\env.example" (
        copy "..\env.example" ".env" >nul
        echo [OK] .env файл создан из шаблона
    ) else (
        echo [WARNING] Шаблон .env не найден, создаем базовый...
        echo # WB Slots Environment Configuration > .env
        echo DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public" >> .env
        echo REDIS_URL="redis://localhost:6379" >> .env
        echo JWT_SECRET="your-super-secret-jwt-key-here-change-in-production" >> .env
        echo ENCRYPTION_KEY="your-32-byte-base64-encryption-key-here" >> .env
        echo APP_BASE_URL="http://localhost:3000" >> .env
        echo NODE_ENV="development" >> .env
        echo [OK] Базовый .env файл создан
    )
) else (
    echo [OK] .env файл уже существует
)

:: Создаем необходимые директории
echo [INFO] Создание необходимых директорий...
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads
if not exist "temp" mkdir temp
echo [OK] Директории созданы

:: Устанавливаем зависимости frontend
echo.
echo [INFO] Установка зависимостей frontend...
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка установки зависимостей frontend!
    echo.
    echo Попробуйте выполнить команды вручную:
    echo cd wb-slots
    echo npm install
    echo.
    pause
    exit /b 1
)
echo [OK] Зависимости frontend установлены

:: Устанавливаем зависимости backend
echo [INFO] Установка зависимостей backend...
cd backend
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка установки зависимостей backend!
    echo.
    echo Попробуйте выполнить команды вручную:
    echo cd wb-slots\backend
    echo npm install
    echo.
    pause
    exit /b 1
)
cd ..
echo [OK] Зависимости backend установлены

:: Генерируем Prisma клиент
echo [INFO] Генерация Prisma клиента...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Ошибка генерации Prisma клиента!
    echo.
    echo Попробуйте выполнить команды вручную:
    echo npx prisma generate
    echo.
    pause
    exit /b 1
)
echo [OK] Prisma клиент сгенерирован

:: Запускаем Docker контейнеры
echo [INFO] Запуск Docker контейнеров...
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Ошибка запуска Docker контейнеров!
    echo.
    echo Попробуйте выполнить команды вручную:
    echo docker-compose up -d
    echo.
    pause
    exit /b 1
)
echo [OK] Docker контейнеры запущены

:: Ждем готовности базы данных
echo [INFO] Ожидание готовности базы данных...
timeout /t 15 /nobreak >nul

:: Применяем миграции
echo [INFO] Применение миграций базы данных...
call npx prisma db push
if errorlevel 1 (
    echo [WARNING] Ошибка применения миграций (возможно, база данных еще не готова)
    echo Попробуйте выполнить команду вручную:
    echo npx prisma db push
)

:: Заполняем базу данных
echo [INFO] Заполнение базы данных тестовыми данными...
call npm run db:seed
if errorlevel 1 (
    echo [WARNING] Ошибка заполнения базы данных (не критично)
    echo Вы можете выполнить это позже:
    echo npm run db:seed
)

echo.
echo ========================================
echo        НАСТРОЙКА ЗАВЕРШЕНА!
echo ========================================
echo.
echo Проект готов к работе!
echo.
echo Следующие шаги:
echo 1. Отредактируйте .env файл с вашими настройками
echo 2. Запустите start-project.bat для запуска всех сервисов
echo.
echo Доступные команды:
echo - start-project.bat    - Запуск всех сервисов
echo - npm run dev         - Только frontend
echo - npm run start:dev   - Только backend (из папки backend)
echo - npm run worker      - Worker процессы
echo.
echo Порты:
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:3001
echo - Database: localhost:5432
echo - Redis:    localhost:6379
echo.
pause

