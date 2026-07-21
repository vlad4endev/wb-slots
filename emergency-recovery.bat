@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ ДАННЫХ
echo ========================================
echo.

echo [WARNING] ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ ДАННЫХ
echo [WARNING] Используйте только в случае потери данных!
echo.

:: Проверяем наличие папки backups
if not exist "backups" (
    echo [ERROR] Папка 'backups' не найдена!
    echo [INFO] Резервные копии не найдены
    echo [INFO] Попробуйте восстановить данные из других источников
    pause
    exit /b 1
)

:: Показываем доступные резервные копии
echo [INFO] Поиск резервных копий...
echo.

set /a count=0
for %%f in (backups\wb-user-data-backup-*.zip) do (
    set /a count+=1
    set "backup!count!=%%f"
    
    :: Получаем дату создания файла
    for %%d in ("%%f") do (
        set "backup_date!count!=%%~td"
        set "backup_size!count!=%%~zd"
    )
    
    echo !count!. %%~nf
    echo    Дата: !backup_date%count%!
    echo    Размер: !backup_size%count%! байт
    echo.
)

if %count%==0 (
    echo [ERROR] Резервные копии не найдены!
    echo [INFO] Создайте резервную копию с помощью backup-user-data.bat
    pause
    exit /b 1
)

echo [INFO] Найдено %count% резервных копий
echo.

:: Выбор резервной копии
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
echo [WARNING] ВНИМАНИЕ! ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ!
echo [WARNING] Файл: %backup_file%
echo [WARNING] Все текущие данные будут ПОЛНОСТЬЮ ЗАМЕНЕНЫ!
echo.
echo [INFO] Перед восстановлением будет создана дополнительная резервная копия
echo [INFO] текущего состояния (если возможно)
echo.

set /p confirm="Вы уверены, что хотите продолжить? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo [INFO] Восстановление отменено
    pause
    exit /b 0
)

echo.
echo [INFO] Начинаем экстренное восстановление...
echo.

:: 1. Создаем резервную копию текущего состояния (если возможно)
echo [STEP 1/7] Создание резервной копии текущего состояния...

:: Проверяем, запущены ли контейнеры
docker ps | findstr wb-slots >nul 2>&1
if errorlevel 1 (
    echo [INFO] Контейнеры не запущены - пропускаем создание резервной копии
) else (
    echo [INFO] Создаем резервную копию текущего состояния...
    call backup-user-data.bat
    if errorlevel 1 (
        echo [WARNING] Не удалось создать резервную копию текущего состояния
        echo [INFO] Продолжаем восстановление...
    ) else (
        echo [OK] Резервная копия текущего состояния создана
    )
)

:: 2. Полная остановка всех сервисов
echo.
echo [STEP 2/7] Полная остановка всех сервисов...
docker-compose down
if errorlevel 1 (
    echo [WARNING] Ошибка остановки сервисов
)

:: Останавливаем все контейнеры WB Slots
docker stop wb-slots-postgres wb-slots-redis wb-slots-app wb-slots-worker 2>nul
docker rm wb-slots-postgres wb-slots-redis wb-slots-app wb-slots-worker 2>nul

:: 3. Удаляем volumes (ОСТОРОЖНО!)
echo.
echo [STEP 3/7] Удаление поврежденных volumes...
echo [WARNING] Удаляем все volumes WB Slots!

set /p confirm_volumes="Удалить все volumes? Это приведет к потере текущих данных! (yes/no): "
if /i "%confirm_volumes%"=="yes" (
    docker volume rm wb-slots_postgres_data 2>nul
    docker volume rm wb-slots_redis_data 2>nul
    echo [OK] Volumes удалены
) else (
    echo [INFO] Volumes не удалены - попробуем восстановить поверх существующих
)

:: 4. Создаем временную папку для распаковки
echo.
echo [STEP 4/7] Подготовка к восстановлению...
set TEMP_DIR=temp_emergency_restore
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

:: 5. Восстанавливаем volumes
echo.
echo [STEP 5/7] Восстановление volumes...

:: Создаем новые volumes
docker volume create wb-slots_postgres_data
docker volume create wb-slots_redis_data

:: Восстанавливаем postgres volume
if exist "%TEMP_DIR%\postgres-data.tar.gz" (
    echo [INFO] Восстановление postgres volume...
    docker run --rm -v wb-slots_postgres_data:/data -v "%CD%\%TEMP_DIR%":/backup alpine sh -c "cd /data && tar xzf /backup/postgres-data.tar.gz"
    if errorlevel 1 (
        echo [WARNING] Не удалось восстановить postgres volume
    ) else (
        echo [OK] Postgres volume восстановлен
    )
)

:: Восстанавливаем redis volume
if exist "%TEMP_DIR%\redis-data.tar.gz" (
    echo [INFO] Восстановление redis volume...
    docker run --rm -v wb-slots_redis_data:/data -v "%CD%\%TEMP_DIR%":/backup alpine sh -c "cd /data && tar xzf /backup/redis-data.tar.gz"
    if errorlevel 1 (
        echo [WARNING] Не удалось восстановить redis volume
    ) else (
        echo [OK] Redis volume восстановлен
    )
)

:: 6. Запускаем сервисы
echo.
echo [STEP 6/7] Запуск сервисов...

:: Запускаем только базу данных и Redis сначала
docker-compose up -d postgres redis
if errorlevel 1 (
    echo [ERROR] Ошибка запуска базы данных и Redis!
    rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)

:: Ждем готовности базы данных
echo [INFO] Ожидание готовности базы данных...
timeout /t 20 /nobreak >nul

:: Восстанавливаем базу данных из SQL дампа
if exist "%TEMP_DIR%\database.sql" (
    echo [INFO] Восстановление базы данных из SQL дампа...
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
    echo [OK] База данных восстановлена из SQL дампа
)

:: Восстанавливаем Redis данные
if exist "%TEMP_DIR%\redis-dump.rdb" (
    echo [INFO] Восстановление данных Redis...
    docker cp "%TEMP_DIR%\redis-dump.rdb" wb-slots-redis:/data/dump.rdb
    docker-compose restart redis
    if errorlevel 1 (
        echo [WARNING] Не удалось восстановить данные Redis
    ) else (
        echo [OK] Данные Redis восстановлены
    )
)

:: Запускаем все остальные сервисы
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Ошибка запуска сервисов!
    rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)

:: 7. Восстанавливаем конфигурационные файлы
echo.
echo [STEP 7/7] Восстановление конфигурационных файлов...
if exist "%TEMP_DIR%\.env.backup" copy "%TEMP_DIR%\.env.backup" ".env" >nul
if exist "%TEMP_DIR%\.env.local.backup" copy "%TEMP_DIR%\.env.local.backup" ".env.local" >nul
if exist "%TEMP_DIR%\docker-compose.yml.backup" copy "%TEMP_DIR%\docker-compose.yml.backup" "docker-compose.yml" >nul
if exist "%TEMP_DIR%\wb-slots.env.backup" copy "%TEMP_DIR%\wb-slots.env.backup" "wb-slots\.env" >nul
if exist "%TEMP_DIR%\wb-slots.env.local.backup" copy "%TEMP_DIR%\wb-slots.env.local.backup" "wb-slots\.env.local" >nul
if exist "%TEMP_DIR%\wb-slots.docker-compose.yml.backup" copy "%TEMP_DIR%\wb-slots.docker-compose.yml.backup" "wb-slots\docker-compose.yml" >nul
echo [OK] Конфигурационные файлы восстановлены

:: Удаляем временную папку
rmdir /s /q "%TEMP_DIR%"

:: Проверяем восстановление
echo.
echo [INFO] Проверка восстановления данных...

:: Ждем полной готовности сервисов
timeout /t 10 /nobreak >nul

:: Проверяем количество пользователей
for /f %%i in ('docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM users;" 2^>nul') do set "user_count=%%i"
if "%user_count%"=="" set "user_count=0"

echo [INFO] Восстановлено пользователей: %user_count%

if %user_count% GTR 0 (
    echo [OK] Данные пользователей восстановлены успешно
) else (
    echo [WARNING] Пользователи не найдены - возможно, восстановление неполное
)

echo.
echo ========================================
echo    ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО!
echo ========================================
echo.
echo [INFO] Все сервисы запущены
echo [INFO] Frontend: http://localhost:3000
echo [INFO] Backend API: http://localhost:3001
echo.
echo [INFO] Рекомендации:
echo - Проверьте работоспособность приложения
echo - Проверьте авторизацию пользователей
echo - Проверьте настройки и токены WB API
echo - Создайте новую резервную копию: backup-user-data.bat
echo.
echo [INFO] Если что-то работает неправильно:
echo - Проверьте логи: docker-compose logs
echo - Попробуйте другую резервную копию
echo - Обратитесь за помощью с описанием проблемы
echo.
pause
