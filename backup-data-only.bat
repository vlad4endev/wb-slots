@echo off
chcp 65001 >nul
title WB Slots - Backup только данных

echo.
echo ========================================
echo    WB Slots - Backup данных
echo ========================================
echo.

:: Создаем имя backup с датой и временем
set backup_name=wb-slots-data-%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set backup_name=%backup_name: =0%

echo [INFO] Создание backup данных: %backup_name%
echo.

:: Проверяем, что мы в правильной директории
if not exist "wb-slots" (
    echo [ERROR] Директория wb-slots не найдена!
    echo Убедитесь, что скрипт запущен из корневой папки проекта.
    pause
    exit /b 1
)

cd wb-slots

:: 1. Backup базы данных PostgreSQL
echo [1/2] Создание backup базы данных PostgreSQL...
docker exec wb-slots-postgres pg_dump -U postgres wb_slots > "..\%backup_name%-database.sql" 2>nul
if errorlevel 1 (
    echo [ERROR] Не удалось создать backup базы данных!
    echo Убедитесь, что контейнер wb-slots-postgres запущен.
    pause
    exit /b 1
) else (
    echo [OK] Backup базы данных создан: %backup_name%-database.sql
)

:: 2. Backup Redis
echo [2/2] Создание backup Redis...
docker exec wb-slots-redis redis-cli BGSAVE >nul 2>&1
timeout /t 2 /nobreak >nul
docker cp wb-slots-redis:/data/dump.rdb "..\%backup_name%-redis.rdb" 2>nul
if errorlevel 1 (
    echo [ERROR] Не удалось создать backup Redis!
    echo Убедитесь, что контейнер wb-slots-redis запущен.
    pause
    exit /b 1
) else (
    echo [OK] Backup Redis создан: %backup_name%-redis.rdb
)

cd ..

echo.
echo ========================================
echo        BACKUP ДАННЫХ ЗАВЕРШЕН!
echo ========================================
echo.
echo 📁 Файлы backup:
echo    ✅ %backup_name%-database.sql
echo    ✅ %backup_name%-redis.rdb
echo.
echo 💡 Для восстановления данных:
echo    1. Остановите сервисы: stop-services.bat
echo    2. Восстановите БД: docker exec -i wb-slots-postgres psql -U postgres wb_slots < %backup_name%-database.sql
echo    3. Восстановите Redis: docker cp %backup_name%-redis.rdb wb-slots-redis:/data/dump.rdb
echo    4. Перезапустите сервисы: start-services.bat
echo.
pause
