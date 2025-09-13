@echo off
chcp 65001 >nul
title WB Slots - Start Services

echo.
echo ========================================
echo    WB Slots - Запуск сервисов
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

:: Проверяем наличие .env файла
if not exist ".env" (
    echo [ERROR] Файл .env не найден!
    echo Сначала запустите setup-project.bat для первоначальной настройки.
    pause
    exit /b 1
)

:: Проверяем Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не запущен!
    echo Пожалуйста, запустите Docker Desktop и повторите попытку.
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
echo        СЕРВИСЫ ЗАПУЩЕНЫ!
echo ========================================
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:3001
echo PostgreSQL: localhost:5432
echo Redis: localhost:6379
echo.
echo Все сервисы запущены в отдельных окнах.
echo Для остановки используйте stop-services.bat
echo.
pause

