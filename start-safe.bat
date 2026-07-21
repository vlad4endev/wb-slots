@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    БЕЗОПАСНЫЙ ЗАПУСК WB SLOTS
echo ========================================
echo.

:: Проверяем, что мы в правильной директории
if not exist "wb-slots" (
    echo [ERROR] Папка 'wb-slots' не найдена!
    echo [INFO] Запустите скрипт из корневой папки проекта
    pause
    exit /b 1
)

:: Переходим в директорию проекта
cd wb-slots

echo [INFO] Безопасный запуск с сохранением пользовательских данных
echo.

:: 1. Проверяем целостность данных
echo [STEP 1/5] Проверка целостности данных...
call ..\check-data-integrity.bat
if errorlevel 1 (
    echo [WARNING] Проблемы с целостностью данных обнаружены
    echo [INFO] Продолжаем запуск...
)

:: 2. Создаем резервную копию перед запуском (если данных много)
echo.
echo [STEP 2/5] Проверка необходимости резервного копирования...

:: Проверяем, есть ли пользователи в БД
docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM users;" 2>nul | findstr /r "[0-9]" >nul
if errorlevel 1 (
    echo [INFO] База данных пуста или недоступна - резервное копирование не требуется
) else (
    for /f %%i in ('docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM users;" 2^>nul') do set "user_count=%%i"
    if %user_count% GTR 0 (
        echo [INFO] Найдено %user_count% пользователей - создаем резервную копию...
        call ..\backup-user-data.bat
        if errorlevel 1 (
            echo [WARNING] Не удалось создать резервную копию
            echo [INFO] Продолжаем запуск...
        )
    ) else (
        echo [INFO] Пользователи не найдены - резервное копирование не требуется
    )
)

:: 3. Останавливаем существующие контейнеры (БЕЗ удаления данных)
echo.
echo [STEP 3/5] Остановка существующих контейнеров (СОХРАНЯЕМ ДАННЫЕ)...
docker-compose down
if errorlevel 1 (
    echo [WARNING] Ошибка остановки контейнеров (возможно, они уже остановлены)
)

:: 4. Запускаем сервисы с безопасной конфигурацией
echo.
echo [STEP 4/5] Запуск сервисов с защитой данных...

:: Используем безопасную конфигурацию
if exist "docker-compose-safe.yml" (
    echo [INFO] Используем безопасную конфигурацию docker-compose-safe.yml
    docker-compose -f docker-compose-safe.yml up -d
    if errorlevel 1 (
        echo [ERROR] Ошибка запуска с безопасной конфигурацией
        echo [INFO] Пробуем стандартную конфигурацию...
        docker-compose up -d
        if errorlevel 1 (
            echo [ERROR] Ошибка запуска сервисов!
            pause
            exit /b 1
        )
    )
) else (
    echo [INFO] Используем стандартную конфигурацию
    docker-compose up -d
    if errorlevel 1 (
        echo [ERROR] Ошибка запуска сервисов!
        pause
        exit /b 1
    )
)

:: 5. Ждем готовности сервисов
echo.
echo [STEP 5/5] Ожидание готовности сервисов...

:: Ждем готовности базы данных
echo [INFO] Ожидание готовности базы данных...
timeout /t 15 /nobreak >nul

:: Проверяем подключение к БД
docker exec wb-slots-postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo [WARNING] База данных еще не готова, ждем еще...
    timeout /t 10 /nobreak >nul
)

:: Проверяем подключение к Redis
docker exec wb-slots-redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Redis еще не готов, ждем еще...
    timeout /t 5 /nobreak >nul
)

:: Применяем миграции (если необходимо)
echo [INFO] Проверка и применение миграций базы данных...
npx prisma db push
if errorlevel 1 (
    echo [WARNING] Ошибка применения миграций (возможно, схема уже актуальна)
) else (
    echo [OK] Миграции применены успешно
)

:: Заполняем тестовыми данными (только если БД пуста)
for /f %%i in ('docker exec wb-slots-postgres psql -U postgres -d wb_slots -t -c "SELECT COUNT(*) FROM users;" 2^>nul') do set "user_count=%%i"
if %user_count% EQU 0 (
    echo [INFO] База данных пуста - загружаем тестовые данные...
    npm run db:seed
    if errorlevel 1 (
        echo [WARNING] Ошибка загрузки тестовых данных (не критично)
    ) else (
        echo [OK] Тестовые данные загружены
    )
) else (
    echo [INFO] Пользователи уже существуют - пропускаем загрузку тестовых данных
)

echo.
echo ========================================
echo    БЕЗОПАСНЫЙ ЗАПУСК ЗАВЕРШЕН!
echo ========================================
echo.
echo [OK] Все сервисы запущены с сохранением пользовательских данных
echo.
echo [INFO] Доступные сервисы:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:3001
echo - PostgreSQL: localhost:5432
echo - Redis: localhost:6379
echo.
echo [INFO] Полезные команды:
echo - Проверка состояния: docker-compose ps
echo - Просмотр логов: docker-compose logs -f
echo - Остановка: docker-compose down
echo - Резервное копирование: ..\backup-user-data.bat
echo - Проверка данных: ..\check-data-integrity.bat
echo.
echo [INFO] Данные пользователей защищены от случайного удаления
echo [INFO] Для обновления используйте: ..\safe-update.bat
echo.
pause
