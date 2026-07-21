@echo off
chcp 65001 >nul
title WB Slots - Полное резервное копирование

echo.
echo ========================================
echo    WB Slots - Полное резервное копирование
echo ========================================
echo.

:: Создаем имя backup с датой и временем
set backup_name=wb-slots-backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set backup_name=%backup_name: =0%
set backup_dir=backups\%backup_name%

echo [INFO] Создание директории для backup: %backup_dir%
if not exist "backups" mkdir backups
mkdir "%backup_dir%"

echo [INFO] Начинаем полное резервное копирование...
echo.

:: 1. Backup базы данных PostgreSQL
echo [1/6] Создание backup базы данных PostgreSQL...
if exist "wb-slots" (
    cd wb-slots
    docker exec wb-slots-postgres pg_dump -U postgres wb_slots > "..\%backup_dir%\database.sql" 2>nul
    if errorlevel 1 (
        echo [WARNING] Не удалось создать backup базы данных (контейнер может быть не запущен)
    ) else (
        echo [OK] Backup базы данных создан: %backup_dir%\database.sql
    )
    cd ..
) else (
    echo [WARNING] Директория wb-slots не найдена, пропускаем backup БД
)

:: 2. Backup Redis
echo [2/6] Создание backup Redis...
if exist "wb-slots" (
    cd wb-slots
    docker exec wb-slots-redis redis-cli BGSAVE >nul 2>&1
    timeout /t 2 /nobreak >nul
    docker cp wb-slots-redis:/data/dump.rdb "..\%backup_dir%\redis.rdb" 2>nul
    if errorlevel 1 (
        echo [WARNING] Не удалось создать backup Redis (контейнер может быть не запущен)
    ) else (
        echo [OK] Backup Redis создан: %backup_dir%\redis.rdb
    )
    cd ..
) else (
    echo [WARNING] Директория wb-slots не найдена, пропускаем backup Redis
)

:: 3. Backup исходного кода проекта
echo [3/6] Создание backup исходного кода...
if exist "wb-slots" (
    echo [INFO] Архивирование исходного кода...
    powershell -command "Compress-Archive -Path 'wb-slots' -DestinationPath '%backup_dir%\source-code.zip' -Force" >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Не удалось создать архив исходного кода
    ) else (
        echo [OK] Архив исходного кода создан: %backup_dir%\source-code.zip
    )
) else (
    echo [WARNING] Директория wb-slots не найдена, пропускаем backup исходного кода
)

:: 4. Backup конфигурационных файлов
echo [4/6] Создание backup конфигурационных файлов...
copy "env.example" "%backup_dir%\env.example" >nul 2>&1
if exist "wb-slots\.env" copy "wb-slots\.env" "%backup_dir%\.env" >nul 2>&1
if exist "wb-slots\docker-compose.yml" copy "wb-slots\docker-compose.yml" "%backup_dir%\docker-compose.yml" >nul 2>&1
if exist "wb-slots\package.json" copy "wb-slots\package.json" "%backup_dir%\package.json" >nul 2>&1
echo [OK] Конфигурационные файлы скопированы

:: 5. Backup скриптов управления
echo [5/6] Создание backup скриптов управления...
copy "*.bat" "%backup_dir%\" >nul 2>&1
copy "*.md" "%backup_dir%\" >nul 2>&1
echo [OK] Скрипты управления скопированы

:: 6. Создание архива всего backup
echo [6/6] Создание финального архива...
powershell -command "Compress-Archive -Path '%backup_dir%' -DestinationPath 'backups\%backup_name%.zip' -Force" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Не удалось создать финальный архив
) else (
    echo [OK] Финальный архив создан: backups\%backup_name%.zip
    :: Удаляем временную директорию
    rmdir /s /q "%backup_dir%" >nul 2>&1
)

echo.
echo ========================================
echo        РЕЗЕРВНОЕ КОПИРОВАНИЕ ЗАВЕРШЕНО!
echo ========================================
echo.
echo 📁 Backup создан: backups\%backup_name%.zip
echo.
echo 📋 Что включено в backup:
echo    ✅ База данных PostgreSQL (database.sql)
echo    ✅ Данные Redis (redis.rdb)
echo    ✅ Исходный код проекта (source-code.zip)
echo    ✅ Конфигурационные файлы
echo    ✅ Скрипты управления
echo.
echo 💡 Для восстановления:
echo    1. Распакуйте архив в нужную директорию
echo    2. Запустите setup-project.bat для настройки
echo    3. Восстановите данные из database.sql и redis.rdb
echo.
pause
