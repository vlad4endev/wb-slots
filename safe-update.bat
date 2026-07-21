@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    БЕЗОПАСНОЕ ОБНОВЛЕНИЕ ПРОЕКТА
echo ========================================
echo.

:: Проверяем, что мы в правильной директории
if not exist "wb-slots" (
    echo [ERROR] Папка 'wb-slots' не найдена!
    echo [INFO] Запустите скрипт из корневой папки проекта
    pause
    exit /b 1
)

echo [INFO] Безопасное обновление проекта с сохранением пользовательских данных
echo.

:: 1. Создаем резервную копию перед обновлением
echo [STEP 1/6] Создание резервной копии данных...
call backup-user-data.bat
if errorlevel 1 (
    echo [ERROR] Не удалось создать резервную копию!
    echo [INFO] Обновление отменено для безопасности данных
    pause
    exit /b 1
)

:: 2. Останавливаем сервисы
echo.
echo [STEP 2/6] Остановка сервисов...
docker-compose down
if errorlevel 1 (
    echo [WARNING] Ошибка остановки сервисов (возможно, они уже остановлены)
)

:: 3. Обновляем код из репозитория
echo.
echo [STEP 3/6] Обновление кода из репозитория...
echo [INFO] Если у вас есть изменения в коде, они будут потеряны!
set /p confirm="Продолжить обновление кода? (yes/no): "

if /i "%confirm%"=="yes" (
    git fetch origin
    if errorlevel 1 (
        echo [WARNING] Ошибка получения обновлений из Git
        echo [INFO] Продолжаем с текущим кодом...
    ) else (
        git reset --hard origin/main
        if errorlevel 1 (
            echo [WARNING] Ошибка обновления кода
            echo [INFO] Продолжаем с текущим кодом...
        ) else (
            echo [OK] Код обновлен
        )
    )
) else (
    echo [INFO] Обновление кода пропущено
)

:: 4. Обновляем зависимости
echo.
echo [STEP 4/6] Обновление зависимостей...
echo [INFO] Обновление зависимостей frontend...
cd wb-slots
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка обновления зависимостей frontend!
    cd ..
    pause
    exit /b 1
)

echo [INFO] Обновление зависимостей backend...
cd backend
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка обновления зависимостей backend!
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

echo [OK] Зависимости обновлены

:: 5. Генерируем Prisma клиент
echo.
echo [STEP 5/6] Генерация Prisma клиента...
cd wb-slots
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Ошибка генерации Prisma клиента!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Prisma клиент сгенерирован

:: 6. Запускаем сервисы с сохранением данных
echo.
echo [STEP 6/6] Запуск сервисов с сохранением данных...

:: Запускаем только базу данных и Redis сначала
docker-compose up -d postgres redis
if errorlevel 1 (
    echo [ERROR] Ошибка запуска базы данных и Redis!
    pause
    exit /b 1
)

:: Ждем готовности базы данных
echo [INFO] Ожидание готовности базы данных...
timeout /t 15 /nobreak >nul

:: Применяем миграции БД (только схему, данные сохраняются)
echo [INFO] Применение миграций базы данных...
cd wb-slots
call npx prisma db push
if errorlevel 1 (
    echo [WARNING] Ошибка применения миграций (возможно, схема уже актуальна)
)
cd ..

:: Запускаем все остальные сервисы
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Ошибка запуска сервисов!
    pause
    exit /b 1
)

echo.
echo ========================================
echo    ОБНОВЛЕНИЕ ЗАВЕРШЕНО!
echo ========================================
echo.
echo [OK] Все сервисы запущены с сохранением пользовательских данных
echo [INFO] Frontend: http://localhost:3000
echo [INFO] Backend API: http://localhost:3001
echo.
echo [INFO] Резервная копия создана в папке 'backups'
echo [INFO] В случае проблем используйте restore-user-data.bat
echo.
pause
