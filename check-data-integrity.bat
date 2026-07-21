@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
echo ========================================
echo.

:: Проверяем, что Docker запущен
docker version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не запущен или не установлен!
    echo [INFO] Запустите Docker Desktop и повторите попытку
    pause
    exit /b 1
)

echo [INFO] Проверка целостности пользовательских данных...
echo.

:: 1. Проверка состояния Docker volumes
echo [STEP 1/5] Проверка Docker volumes...
echo.
docker volume ls | findstr wb-slots
if errorlevel 1 (
    echo [WARNING] Volumes WB Slots не найдены
    echo [INFO] Возможно, проект еще не запускался
) else (
    echo [OK] Volumes найдены
)

:: Проверяем размер volumes
echo.
echo [INFO] Размер volumes:
for /f "tokens=2" %%i in ('docker system df --format "table {{.Size}}" ^| findstr wb-slots') do (
    echo - wb-slots_postgres_data: %%i
    echo - wb-slots_redis_data: %%i
)

:: 2. Проверка состояния контейнеров
echo.
echo [STEP 2/5] Проверка состояния контейнеров...
echo.
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr wb-slots
if errorlevel 1 (
    echo [WARNING] Контейнеры WB Slots не запущены
    echo [INFO] Запустите проект с помощью start-project.bat
) else (
    echo [OK] Контейнеры запущены
)

:: 3. Проверка подключения к базе данных
echo.
echo [STEP 3/5] Проверка подключения к базе данных...
echo.
docker exec wb-slots-postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo [ERROR] База данных PostgreSQL недоступна!
    echo [INFO] Проверьте состояние контейнера postgres
) else (
    echo [OK] База данных PostgreSQL доступна
)

:: 4. Проверка структуры базы данных
echo.
echo [STEP 4/5] Проверка структуры базы данных...
echo.

:: Проверяем основные таблицы
set "tables=users user_tokens user_settings wb_sessions tasks runs found_slots warehouse_prefs"
set "missing_tables="

for %%t in (%tables%) do (
    docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='%%t';" 2>nul | findstr "1" >nul
    if errorlevel 1 (
        echo [WARNING] Таблица %%t не найдена или недоступна
        set "missing_tables=!missing_tables! %%t"
    ) else (
        echo [OK] Таблица %%t существует
    )
)

if not "%missing_tables%"=="" (
    echo.
    echo [WARNING] Отсутствующие таблицы: %missing_tables%
    echo [INFO] Возможно, требуется применение миграций
)

:: 5. Проверка данных пользователей
echo.
echo [STEP 5/5] Проверка данных пользователей...
echo.

:: Проверяем количество пользователей
for /f %%i in ('docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM users;" 2^>nul') do set "user_count=%%i"
if "%user_count%"=="" set "user_count=0"

echo [INFO] Количество пользователей: %user_count%

if %user_count% GTR 0 (
    echo [OK] Пользователи найдены
) else (
    echo [WARNING] Пользователи не найдены
    echo [INFO] Возможно, база данных пуста или не инициализирована
)

:: Проверяем количество токенов
for /f %%i in ('docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM user_tokens;" 2^>nul') do set "token_count=%%i"
if "%token_count%"=="" set "token_count=0"

echo [INFO] Количество токенов WB API: %token_count%

:: Проверяем количество задач
for /f %%i in ('docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM tasks;" 2^>nul') do set "task_count=%%i"
if "%task_count%"=="" set "task_count=0"

echo [INFO] Количество задач: %task_count%

:: Проверяем количество сессий WB
for /f %%i in ('docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM wb_sessions;" 2^>nul') do set "session_count=%%i"
if "%session_count%"=="" set "session_count=0"

echo [INFO] Количество сессий WB: %session_count%

:: 6. Проверка Redis
echo.
echo [INFO] Проверка Redis...
docker exec wb-slots-redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Redis недоступен!
) else (
    echo [OK] Redis доступен
    
    :: Проверяем количество ключей в Redis
    for /f %%i in ('docker exec wb-slots-redis redis-cli dbsize 2^>nul') do set "redis_keys=%%i"
    if "%redis_keys%"=="" set "redis_keys=0"
    echo [INFO] Количество ключей в Redis: %redis_keys%
)

:: 7. Проверка резервных копий
echo.
echo [INFO] Проверка резервных копий...
if exist "backups" (
    echo [OK] Папка резервных копий существует
    
    :: Подсчитываем количество резервных копий
    set /a backup_count=0
    for %%f in (backups\wb-user-data-backup-*.zip) do set /a backup_count+=1
    
    echo [INFO] Количество резервных копий: %backup_count%
    
    if %backup_count% GTR 0 (
        echo [OK] Резервные копии найдены
        
        :: Показываем последнюю резервную копию
        for /f "delims=" %%f in ('dir backups\wb-user-data-backup-*.zip /b /od 2^>nul ^| findstr /r "wb-user-data-backup-.*\.zip$"') do set "last_backup=%%f"
        if not "%last_backup%"=="" (
            echo [INFO] Последняя резервная копия: %last_backup%
        )
    ) else (
        echo [WARNING] Резервные копии не найдены
        echo [INFO] Создайте резервную копию с помощью backup-user-data.bat
    )
) else (
    echo [WARNING] Папка резервных копий не найдена
    echo [INFO] Создайте резервную копию с помощью backup-user-data.bat
)

:: 8. Итоговый отчет
echo.
echo ========================================
echo    ИТОГОВЫЙ ОТЧЕТ
echo ========================================
echo.

if %user_count% GTR 0 (
    echo [OK] Данные пользователей: НАЙДЕНЫ
) else (
    echo [WARNING] Данные пользователей: НЕ НАЙДЕНЫ
)

if %token_count% GTR 0 (
    echo [OK] Токены WB API: НАЙДЕНЫ
) else (
    echo [WARNING] Токены WB API: НЕ НАЙДЕНЫ
)

if %task_count% GTR 0 (
    echo [OK] Задачи: НАЙДЕНЫ
) else (
    echo [INFO] Задачи: НЕ НАЙДЕНЫ (нормально для нового проекта)
)

if %session_count% GTR 0 (
    echo [OK] Сессии WB: НАЙДЕНЫ
) else (
    echo [INFO] Сессии WB: НЕ НАЙДЕНЫ (нормально для нового проекта)
)

if %backup_count% GTR 0 (
    echo [OK] Резервные копии: НАЙДЕНЫ
) else (
    echo [WARNING] Резервные копии: НЕ НАЙДЕНЫ
)

echo.
echo [INFO] Рекомендации:
echo.

if %user_count% EQU 0 (
    echo - Создайте пользователей через интерфейс приложения
)

if %token_count% EQU 0 (
    echo - Добавьте токены WB API в настройках пользователя
)

if %backup_count% EQU 0 (
    echo - Создайте резервную копию: backup-user-data.bat
)

if not "%missing_tables%"=="" (
    echo - Примените миграции базы данных: npx prisma db push
)

echo.
echo [INFO] Для создания резервной копии: backup-user-data.bat
echo [INFO] Для восстановления данных: restore-user-data.bat
echo [INFO] Для безопасного обновления: safe-update.bat
echo.
pause
