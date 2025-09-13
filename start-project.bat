@echo off
chcp 65001 >nul
title WB Slots - Project Orchestrator

echo.
echo ========================================
echo    WB Slots - Project Orchestrator
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

:: Проверяем наличие Node.js
echo [INFO] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js не установлен!
    echo Пожалуйста, установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

:: Проверяем наличие Docker
echo [INFO] Проверка Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не установлен!
    echo Пожалуйста, установите Docker Desktop с https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

:: Проверяем, что Docker запущен
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не запущен!
    echo Пожалуйста, запустите Docker Desktop и повторите попытку.
    pause
    exit /b 1
)

:: Проверяем наличие .env файла
if not exist ".env" (
    echo [WARNING] Файл .env не найден!
    echo Создаем .env из шаблона...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] Файл .env создан из .env.example
        echo [WARNING] Пожалуйста, отредактируйте .env файл с вашими настройками!
    ) else (
        echo [ERROR] Файл .env.example не найден!
        echo Создайте .env файл вручную.
        pause
        exit /b 1
    )
)

echo [INFO] Все проверки пройдены успешно!
echo.

:: Меню выбора действия
:menu
echo ========================================
echo           МЕНЮ УПРАВЛЕНИЯ
echo ========================================
echo 1. Полная установка и запуск проекта
echo 2. Только запуск проекта (без установки)
echo 3. Остановка всех сервисов
echo 4. Перезапуск проекта
echo 5. Просмотр логов
echo 6. Очистка и переустановка
echo 7. Выход
echo ========================================
echo.

set /p choice="Выберите действие (1-7): "

if "%choice%"=="1" goto full_setup
if "%choice%"=="2" goto start_only
if "%choice%"=="3" goto stop_all
if "%choice%"=="4" goto restart
if "%choice%"=="5" goto view_logs
if "%choice%"=="6" goto clean_install
if "%choice%"=="7" goto exit
echo [ERROR] Неверный выбор! Попробуйте снова.
goto menu

:full_setup
echo.
echo ========================================
echo      ПОЛНАЯ УСТАНОВКА ПРОЕКТА
echo ========================================
echo.

echo [INFO] Остановка существующих контейнеров...
docker-compose down -v >nul 2>&1

echo [INFO] Установка зависимостей frontend...
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка установки зависимостей frontend!
    pause
    exit /b 1
)

echo [INFO] Установка зависимостей backend...
cd backend
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка установки зависимостей backend!
    pause
    exit /b 1
)
cd ..

echo [INFO] Генерация Prisma клиента...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Ошибка генерации Prisma клиента!
    pause
    exit /b 1
)

echo [INFO] Запуск Docker контейнеров...
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Ошибка запуска Docker контейнеров!
    pause
    exit /b 1
)

echo [INFO] Ожидание готовности базы данных...
timeout /t 10 /nobreak >nul

echo [INFO] Применение миграций базы данных...
call npx prisma db push
if errorlevel 1 (
    echo [ERROR] Ошибка применения миграций!
    pause
    exit /b 1


echo [INFO] Заполнение базы данных тестовыми данными...
call npm run db:seed
if errorlevel 1 (
    echo [WARNING] Ошибка заполнения базы данных (не критично)
)

echo [INFO] Запуск frontend приложения...
start "WB Slots Frontend" cmd /k "npm run dev"

echo [INFO] Запуск backend приложения...
cd backend
start "WB Slots Backend" cmd /k "npm run start:dev"
cd ..

echo [INFO] Запуск worker процессов...
start "WB Slots Worker" cmd /k "npm run worker"

echo.
echo ========================================
echo        УСТАНОВКА ЗАВЕРШЕНА!
echo ========================================
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:3001
echo PostgreSQL: localhost:5432
echo Redis: localhost:6379
echo.
echo Все сервисы запущены в отдельных окнах.
echo Для остановки используйте пункт меню "3".
echo.
pause
goto menu

:start_only
echo.
echo ========================================
echo         ЗАПУСК ПРОЕКТА
echo ========================================
echo.

echo [INFO] Запуск Docker контейнеров...
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Ошибка запуска Docker контейнеров!
    pause
    exit /b 1
)

echo [INFO] Ожидание готовности сервисов...
timeout /t 5 /nobreak >nul

echo [INFO] Запуск frontend приложения...
start "WB Slots Frontend" cmd /k "npm run dev"

echo [INFO] Запуск backend приложения...
cd backend
start "WB Slots Backend" cmd /k "npm run start:dev"
cd ..

echo [INFO] Запуск worker процессов...
start "WB Slots Worker" cmd /k "npm run worker"

echo.
echo ========================================
echo        ПРОЕКТ ЗАПУЩЕН!
echo ========================================
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:3001
echo.
pause
goto menu

:stop_all
echo.
echo ========================================
echo      ОСТАНОВКА ВСЕХ СЕРВИСОВ
echo ========================================
echo.

echo [INFO] Остановка Docker контейнеров...
docker-compose down

echo [INFO] Закрытие всех окон приложений...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq WB Slots Frontend*" >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq WB Slots Backend*" >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq WB Slots Worker*" >nul 2>&1

echo [INFO] Все сервисы остановлены!
pause
goto menu

:restart
echo.
echo ========================================
echo       ПЕРЕЗАПУСК ПРОЕКТА
echo ========================================
echo.

call :stop_all
timeout /t 3 /nobreak >nul
call :start_only

:view_logs
echo.
echo ========================================
echo         ПРОСМОТР ЛОГОВ
echo ========================================
echo.

echo [INFO] Открытие логов Docker контейнеров...
start "Docker Logs" cmd /k "docker-compose logs -f"

echo [INFO] Логи открыты в новом окне.
pause
goto menu

:clean_install
echo.
echo ========================================
echo    ОЧИСТКА И ПЕРЕУСТАНОВКА
echo ========================================
echo.

echo [WARNING] Это действие удалит все данные!
set /p confirm="Продолжить? (y/N): "
if /i not "%confirm%"=="y" goto menu

echo [INFO] Остановка всех сервисов...
call :stop_all

echo [INFO] Удаление Docker контейнеров и томов...
docker-compose down -v
docker system prune -f

echo [INFO] Удаление node_modules...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "backend\node_modules" rmdir /s /q "backend\node_modules"

echo [INFO] Удаление .next папки...
if exist ".next" rmdir /s /q ".next"

echo [INFO] Переустановка зависимостей...
call npm install
cd backend
call npm install
cd ..

echo [INFO] Запуск полной установки...
goto full_setup

:exit
echo.
echo [INFO] Выход из оркестратора...
exit /b 0
