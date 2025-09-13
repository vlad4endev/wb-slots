@echo off
chcp 65001 >nul
title WB Slots - Stop Services

echo.
echo ========================================
echo    WB Slots - Остановка сервисов
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

echo [INFO] Остановка Docker контейнеров...
docker-compose down
if errorlevel 1 (
    echo [WARNING] Ошибка остановки Docker контейнеров (возможно, они уже остановлены)
)

echo [INFO] Закрытие окон приложений...
taskkill /f /im node.exe >nul 2>&1
if errorlevel 1 (
    echo [INFO] Node.js процессы не найдены
) else (
    echo [OK] Node.js процессы остановлены
)

:: Закрываем конкретные окна по заголовку
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq WB Slots Frontend*" >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq WB Slots Backend*" >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq WB Slots Worker*" >nul 2>&1

echo [INFO] Очистка временных файлов...
if exist ".next" rmdir /s /q ".next" >nul 2>&1
if exist "backend\dist" rmdir /s /q "backend\dist" >nul 2>&1

echo.
echo ========================================
echo      ВСЕ СЕРВИСЫ ОСТАНОВЛЕНЫ!
echo ========================================
echo.
echo Все сервисы и процессы остановлены.
echo Временные файлы очищены.
echo.
pause

