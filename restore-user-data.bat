@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    ВОССТАНОВЛЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ
echo ========================================
echo.

:: Проверяем наличие папки backups
if not exist "backups" (
    echo [ERROR] Папка 'backups' не найдена!
    echo [INFO] Сначала создайте резервную копию с помощью backup-user-data.bat
    pause
    exit /b 1
)

:: Показываем доступные резервные копии
echo [INFO] Доступные резервные копии:
echo.
set /a count=0
for %%f in (backups\wb-user-data-backup-*.zip) do (
    set /a count+=1
    set "backup!count!=%%f"
    echo !count!. %%~nf
)

if %count%==0 (
    echo [ERROR] Резервные копии не найдены!
    echo [INFO] Создайте резервную копию с помощью backup-user-data.bat
    pause
    exit /b 1
)

echo.
set /p choice="Выберите номер резервной копии для восстановления (1-%count%): "

:: Проверяем корректность выбора
if "%choice%"=="" (
    echo [ERROR] Не выбрана резервная копия!
    pause
    exit /b 1
)

if %choice% LSS 1 (
    echo [ERROR] Неверный номер!
    pause
    exit /b 1
)

if %choice% GTR %count% (
    echo [ERROR] Неверный номер!
    pause
    exit /b 1
)

:: Получаем путь к выбранной резервной копии
call set "backup_file=%%backup%choice%%%"

echo.
echo [WARNING] ВНИМАНИЕ! Восстановление данных приведет к ПОЛНОЙ ЗАМЕНЕ текущих данных!
echo [WARNING] Убедитесь, что у вас есть актуальная резервная копия!
echo.
set /p confirm="Вы уверены, что хотите продолжить? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo [INFO] Восстановление отменено
    pause
    exit /b 0
)

echo.
echo [INFO] Начинаем восстановление из файла: %backup_file%
echo.

:: Останавливаем сервисы
echo [INFO] Остановка сервисов...
docker-compose down
if errorlevel 1 (
    echo [WARNING] Ошибка остановки сервисов (возможно, они уже остановлены)
)

:: Создаем временную папку для распаковки
set TEMP_DIR=temp_restore
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

:: Распаковываем архив
echo [INFO] Распаковка резервной копии...
powershell -command "Expand-Archive -Path '%backup_file%' -DestinationPath '%TEMP_DIR%' -Force"
if errorlevel 1 (
    echo [ERROR] Ошибка распаковки архива!
    rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)

:: Запускаем только базу данных и Redis
echo [INFO] Запуск базы данных и Redis...
docker-compose up -d postgres redis
if errorlevel 1 (
    echo [ERROR] Ошибка запуска базы данных и Redis!
    rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)

:: Ждем готовности базы данных
echo [INFO] Ожидание готовности базы данных...
timeout /t 15 /nobreak >nul

:: Восстанавливаем базу данных
echo [INFO] Восстановление базы данных...
if exist "%TEMP_DIR%\database.sql" (
    docker exec -i wb-slots-postgres psql -U postgres -d wb_slots < "%TEMP_DIR%\database.sql"
    if errorlevel 1 (
        echo [ERROR] Ошибка восстановления базы данных!
        echo [INFO] Попробуем альтернативный метод...
        docker-compose exec -T postgres psql -U postgres wb_slots < "%TEMP_DIR%\database.sql"
        if errorlevel 1 (
            echo [ERROR] Не удалось восстановить базу данных!
            rmdir /s /q "%TEMP_DIR%"
            pause
            exit /b 1
        )
    )
    echo [OK] База данных восстановлена
) else (
    echo [WARNING] Файл database.sql не найден в резервной копии
)

:: Останавливаем сервисы для восстановления volumes
echo [INFO] Остановка сервисов для восстановления volumes...
docker-compose down

:: Восстанавливаем Docker volumes
echo [INFO] Восстановление Docker volumes...
if exist "%TEMP_DIR%\postgres-data.tar.gz" (
    docker run --rm -v wb-slots_postgres_data:/data -v "%CD%\%TEMP_DIR%":/backup alpine sh -c "cd /data && rm -rf * && tar xzf /backup/postgres-data.tar.gz"
    if errorlevel 1 (
        echo [WARNING] Не удалось восстановить postgres volume
    ) else (
        echo [OK] Postgres volume восстановлен
    )
)

if exist "%TEMP_DIR%\redis-data.tar.gz" (
    docker run --rm -v wb-slots_redis_data:/data -v "%CD%\%TEMP_DIR%":/backup alpine sh -c "cd /data && rm -rf * && tar xzf /backup/redis-data.tar.gz"
    if errorlevel 1 (
        echo [WARNING] Не удалось восстановить redis volume
    ) else (
        echo [OK] Redis volume восстановлен
    )
)

:: Восстанавливаем Redis данные
if exist "%TEMP_DIR%\redis-dump.rdb" (
    echo [INFO] Восстановление данных Redis...
    docker-compose up -d redis
    timeout /t 5 /nobreak >nul
    docker cp "%TEMP_DIR%\redis-dump.rdb" wb-slots-redis:/data/dump.rdb
    docker-compose restart redis
    if errorlevel 1 (
        echo [WARNING] Не удалось восстановить данные Redis
    ) else (
        echo [OK] Данные Redis восстановлены
    )
)

:: Восстанавливаем конфигурационные файлы
echo [INFO] Восстановление конфигурационных файлов...
if exist "%TEMP_DIR%\.env.backup" copy "%TEMP_DIR%\.env.backup" ".env" >nul
if exist "%TEMP_DIR%\.env.local.backup" copy "%TEMP_DIR%\.env.local.backup" ".env.local" >nul
if exist "%TEMP_DIR%\docker-compose.yml.backup" copy "%TEMP_DIR%\docker-compose.yml.backup" "docker-compose.yml" >nul
if exist "%TEMP_DIR%\wb-slots.env.backup" copy "%TEMP_DIR%\wb-slots.env.backup" "wb-slots\.env" >nul
if exist "%TEMP_DIR%\wb-slots.env.local.backup" copy "%TEMP_DIR%\wb-slots.env.local.backup" "wb-slots\.env.local" >nul
if exist "%TEMP_DIR%\wb-slots.docker-compose.yml.backup" copy "%TEMP_DIR%\wb-slots.docker-compose.yml.backup" "wb-slots\docker-compose.yml" >nul
echo [OK] Конфигурационные файлы восстановлены

:: Удаляем временную папку
rmdir /s /q "%TEMP_DIR%"

:: Запускаем все сервисы
echo [INFO] Запуск всех сервисов...
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Ошибка запуска сервисов!
    pause
    exit /b 1
)

echo.
echo ========================================
echo    ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО!
echo ========================================
echo.
echo [INFO] Все сервисы запущены
echo [INFO] Проверьте работоспособность приложения
echo [INFO] Frontend: http://localhost:3000
echo [INFO] Backend API: http://localhost:3001
echo.
pause
