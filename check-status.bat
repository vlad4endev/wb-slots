@echo off
chcp 65001 >nul
title WB Slots - System Status Check

echo.
echo ========================================
echo    WB Slots - Проверка статуса системы
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
echo [1/8] Node.js:
node --version >nul 2>&1
if errorlevel 1 (
    echo    ❌ НЕ УСТАНОВЛЕН
) else (
    for /f "tokens=*" %%i in ('node --version') do echo    ✅ %%i
)

:: Проверяем npm
echo [2/8] npm:
npm --version >nul 2>&1
if errorlevel 1 (
    echo    ❌ НЕ НАЙДЕН
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo    ✅ %%i
)

:: Проверяем Docker
echo [3/8] Docker:
docker --version >nul 2>&1
if errorlevel 1 (
    echo    ❌ НЕ УСТАНОВЛЕН
) else (
    for /f "tokens=*" %%i in ('docker --version') do echo    ✅ %%i
)

:: Проверяем статус Docker
echo [4/8] Docker статус:
docker info >nul 2>&1
if errorlevel 1 (
    echo    ❌ НЕ ЗАПУЩЕН
) else (
    echo    ✅ ЗАПУЩЕН И ГОТОВ
)

:: Проверяем .env файл
echo [5/8] Конфигурация:
if exist ".env" (
    echo    ✅ .env файл найден
) else (
    echo    ❌ .env файл не найден
)

:: Проверяем зависимости frontend
echo [6/8] Зависимости frontend:
if exist "node_modules" (
    echo    ✅ Установлены
) else (
    echo    ❌ НЕ УСТАНОВЛЕНЫ
)

:: Проверяем зависимости backend
echo [7/8] Зависимости backend:
if exist "backend\node_modules" (
    echo    ✅ Установлены
) else (
    echo    ❌ НЕ УСТАНОВЛЕНЫ
)

:: Проверяем Docker контейнеры
echo [8/8] Docker контейнеры:
docker-compose ps >nul 2>&1
if errorlevel 1 (
    echo    ❌ НЕ ЗАПУЩЕНЫ
) else (
    echo    ✅ Статус контейнеров:
    docker-compose ps
)

echo.
echo ========================================
echo         ПРОВЕРКА ПОРТОВ
echo ========================================

:: Проверяем порты
echo [INFO] Проверка доступности портов...

netstat -an | find "3000" >nul
if errorlevel 1 (
    echo    ✅ Порт 3000 свободен
) else (
    echo    ⚠️  Порт 3000 занят
)

netstat -an | find "3001" >nul
if errorlevel 1 (
    echo    ✅ Порт 3001 свободен
) else (
    echo    ⚠️  Порт 3001 занят
)

netstat -an | find "5432" >nul
if errorlevel 1 (
    echo    ✅ Порт 5432 свободен
) else (
    echo    ⚠️  Порт 5432 занят
)

netstat -an | find "6379" >nul
if errorlevel 1 (
    echo    ✅ Порт 6379 свободен
) else (
    echo    ⚠️  Порт 6379 занят
)

echo.
echo ========================================
echo         СТАТУС ПРОЦЕССОВ
echo ========================================

:: Проверяем Node.js процессы
echo [INFO] Node.js процессы:
tasklist /fi "imagename eq node.exe" 2>nul | find "node.exe" >nul
if errorlevel 1 (
    echo    ❌ НЕ ЗАПУЩЕНЫ
) else (
    echo    ✅ Запущены:
    tasklist /fi "imagename eq node.exe" 2>nul | find "node.exe"
)

echo.
echo ========================================
echo         РЕКОМЕНДАЦИИ
echo ========================================

:: Анализируем состояние и даем рекомендации
set recommendations=0

if not exist ".env" (
    echo ❌ Запустите setup-project.bat для создания .env файла
    set /a recommendations+=1
)

if not exist "node_modules" (
    echo ❌ Запустите setup-project.bat для установки зависимостей
    set /a recommendations+=1
)

if not exist "backend\node_modules" (
    echo ❌ Запустите setup-project.bat для установки зависимостей backend
    set /a recommendations+=1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Запустите Docker Desktop
    set /a recommendations+=1
)

if %recommendations%==0 (
    echo ✅ Система готова к работе!
    echo    Можете запустить start-project.bat
) else (
    echo.
    echo Найдено %recommendations% проблем, требующих внимания.
)

echo.
pause

