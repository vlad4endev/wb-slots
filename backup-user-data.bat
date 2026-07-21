@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    РЕЗЕРВНОЕ КОПИРОВАНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ
echo ========================================
echo.

:: Создаем папку для бэкапов
set BACKUP_DIR=backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Генерируем имя файла с датой и временем
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%-%MM%-%DD%-%HH%-%Min%-%Sec%"

set BACKUP_NAME=wb-user-data-backup-%timestamp%
set BACKUP_PATH=%BACKUP_DIR%\%BACKUP_NAME%

echo [INFO] Создание резервной копии: %BACKUP_NAME%
echo.

:: Создаем папку для текущего бэкапа
mkdir "%BACKUP_PATH%"

:: 1. Бэкап базы данных PostgreSQL
echo [INFO] Создание резервной копии базы данных PostgreSQL...
docker exec wb-slots-postgres pg_dump -U postgres -d wb_slots --no-owner --no-privileges > "%BACKUP_PATH%\database.sql"
if errorlevel 1 (
    echo [ERROR] Ошибка создания резервной копии базы данных!
    echo [INFO] Попробуем альтернативный метод...
    docker-compose exec postgres pg_dump -U postgres wb_slots > "%BACKUP_PATH%\database.sql"
    if errorlevel 1 (
        echo [ERROR] Не удалось создать резервную копию базы данных!
        pause
        exit /b 1
    )
)
echo [OK] Резервная копия базы данных создана

:: 2. Бэкап Redis данных
echo [INFO] Создание резервной копии Redis...
docker exec wb-slots-redis redis-cli BGSAVE
timeout /t 3 /nobreak >nul
docker cp wb-slots-redis:/data/dump.rdb "%BACKUP_PATH%\redis-dump.rdb"
if errorlevel 1 (
    echo [WARNING] Не удалось скопировать данные Redis (не критично)
) else (
    echo [OK] Резервная копия Redis создана
)

:: 3. Бэкап Docker volumes
echo [INFO] Создание резервной копии Docker volumes...
docker run --rm -v wb-slots_postgres_data:/data -v "%CD%\%BACKUP_PATH%":/backup alpine tar czf /backup/postgres-data.tar.gz -C /data .
if errorlevel 1 (
    echo [WARNING] Не удалось создать резервную копию postgres volume
) else (
    echo [OK] Резервная копия postgres volume создана
)

docker run --rm -v wb-slots_redis_data:/data -v "%CD%\%BACKUP_PATH%":/backup alpine tar czf /backup/redis-data.tar.gz -C /data .
if errorlevel 1 (
    echo [WARNING] Не удалось создать резервную копию redis volume
) else (
    echo [OK] Резервная копия redis volume создана
)

:: 4. Бэкап конфигурационных файлов
echo [INFO] Создание резервной копии конфигурационных файлов...
if exist ".env" copy ".env" "%BACKUP_PATH%\.env.backup" >nul
if exist ".env.local" copy ".env.local" "%BACKUP_PATH%\.env.local.backup" >nul
if exist "docker-compose.yml" copy "docker-compose.yml" "%BACKUP_PATH%\docker-compose.yml.backup" >nul
if exist "wb-slots\.env" copy "wb-slots\.env" "%BACKUP_PATH%\wb-slots.env.backup" >nul
if exist "wb-slots\.env.local" copy "wb-slots\.env.local" "%BACKUP_PATH%\wb-slots.env.local.backup" >nul
if exist "wb-slots\docker-compose.yml" copy "wb-slots\docker-compose.yml" "%BACKUP_PATH%\wb-slots.docker-compose.yml.backup" >nul
echo [OK] Резервная копия конфигурационных файлов создана

:: 5. Создаем архив
echo [INFO] Создание архива резервной копии...
cd "%BACKUP_PATH%"
powershell -command "Compress-Archive -Path * -DestinationPath ..\%BACKUP_NAME%.zip -Force"
cd ..
if errorlevel 1 (
    echo [ERROR] Ошибка создания архива!
    pause
    exit /b 1
)

:: Удаляем временную папку
rmdir /s /q "%BACKUP_PATH%"

echo.
echo ========================================
echo    РЕЗЕРВНОЕ КОПИРОВАНИЕ ЗАВЕРШЕНО!
echo ========================================
echo.
echo Файл резервной копии: %BACKUP_DIR%\%BACKUP_NAME%.zip
echo Размер файла:
for %%I in ("%BACKUP_DIR%\%BACKUP_NAME%.zip") do echo %%~zI байт
echo.
echo [INFO] Резервная копия сохранена в папке: %BACKUP_DIR%
echo [INFO] Для восстановления используйте: restore-user-data.bat
echo.
pause
