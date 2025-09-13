@echo off
chcp 65001 >nul
title WB Slots - Project Manager

:main_menu
cls
echo.
echo ========================================
echo    WB Slots - Менеджер проекта
echo ========================================
echo.
echo 1. 🔧 Первоначальная настройка
echo 2. 🚀 Запуск проекта (полное меню)
echo 3. ⚡ Быстрый запуск сервисов
echo 4. 🛑 Остановка всех сервисов
echo 5. 📊 Проверка статуса системы
echo 6. 📋 Просмотр логов
echo 7. 🔄 Перезапуск проекта
echo 8. 🧹 Очистка и переустановка
echo 9. 🔧 Исправить проблемы Docker
echo 10. 💻 Локальная разработка (без Docker)
echo 11. ⚡ Быстрое исправление Alpine
echo 12. 📖 Открыть документацию
echo 0. ❌ Выход
echo.
echo ========================================
echo.

set /p choice="Выберите действие (0-12): "

if "%choice%"=="1" goto setup
if "%choice%"=="2" goto full_menu
if "%choice%"=="3" goto quick_start
if "%choice%"=="4" goto stop_all
if "%choice%"=="5" goto check_status
if "%choice%"=="6" goto view_logs
if "%choice%"=="7" goto restart
if "%choice%"=="8" goto clean_install
if "%choice%"=="9" goto fix_docker
if "%choice%"=="10" goto local_dev
if "%choice%"=="11" goto quick_fix
if "%choice%"=="12" goto open_docs
if "%choice%"=="0" goto exit
echo [ERROR] Неверный выбор! Попробуйте снова.
timeout /t 2 /nobreak >nul
goto main_menu

:setup
echo.
echo [INFO] Запуск первоначальной настройки...
call setup-project.bat
pause
goto main_menu

:full_menu
echo.
echo [INFO] Запуск основного оркестратора...
call start-project.bat
pause
goto main_menu

:quick_start
echo.
echo [INFO] Быстрый запуск сервисов...
call start-services.bat
pause
goto main_menu

:stop_all
echo.
echo [INFO] Остановка всех сервисов...
call stop-services.bat
pause
goto main_menu

:check_status
echo.
echo [INFO] Проверка статуса системы...
call check-status.bat
pause
goto main_menu

:view_logs
echo.
echo [INFO] Открытие логов...
if exist "wb-slots" (
    cd wb-slots
    start "Docker Logs" cmd /k "docker-compose logs -f"
    cd ..
) else (
    echo [ERROR] Директория wb-slots не найдена!
)
pause
goto main_menu

:restart
echo.
echo [INFO] Перезапуск проекта...
call stop-services.bat
timeout /t 3 /nobreak >nul
call start-services.bat
pause
goto main_menu

:clean_install
echo.
echo [WARNING] Это действие удалит все данные!
set /p confirm="Продолжить? (y/N): "
if /i not "%confirm%"=="y" goto main_menu

echo [INFO] Очистка и переустановка...
call stop-services.bat
timeout /t 2 /nobreak >nul

if exist "wb-slots" (
    cd wb-slots
    docker-compose down -v
    docker system prune -f
    if exist "node_modules" rmdir /s /q "node_modules"
    if exist "backend\node_modules" rmdir /s /q "backend\node_modules"
    if exist ".next" rmdir /s /q ".next"
    cd ..
)

call setup-project.bat
pause
goto main_menu

:fix_docker
echo.
echo [INFO] Исправление проблем Docker...
call fix-docker-issues.bat
pause
goto main_menu

:local_dev
echo.
echo [INFO] Запуск локальной разработки (без Docker для приложения)...
if exist "wb-slots\start-local-dev.bat" (
    cd wb-slots
    call start-local-dev.bat
    cd ..
) else (
    echo [ERROR] Файл start-local-dev.bat не найден!
    echo Сначала запустите исправление проблем Docker (опция 9).
)
pause
goto main_menu

:quick_fix
echo.
echo [INFO] Быстрое исправление проблем с Alpine Linux...
call quick-fix-alpine.bat
pause
goto main_menu

:open_docs
echo.
echo [INFO] Открытие документации...
if exist "README-ORCHESTRATOR.md" (
    start notepad "README-ORCHESTRATOR.md"
) else (
    echo [ERROR] Файл документации не найден!
)
pause
goto main_menu

:exit
echo.
echo [INFO] Выход из менеджера проекта...
echo Спасибо за использование WB Slots!
timeout /t 2 /nobreak >nul
exit /b 0
