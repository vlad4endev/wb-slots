@echo off
REM ========================================
REM WB Slots - Test Environment Management (Windows)
REM ========================================

setlocal enabledelayedexpansion

REM Цвета для вывода
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

REM Функция для вывода сообщений
:log
echo %BLUE%[%date% %time%]%NC% %~1
goto :eof

:success
echo %GREEN%✅ %~1%NC%
goto :eof

:warning
echo %YELLOW%⚠️  %~1%NC%
goto :eof

:error
echo %RED%❌ %~1%NC%
goto :eof

REM Проверка наличия Docker
:check_docker
docker --version >nul 2>&1
if errorlevel 1 (
    call :error "Docker не установлен. Пожалуйста, установите Docker Desktop."
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    call :error "Docker Compose не установлен. Пожалуйста, установите Docker Compose."
    exit /b 1
)

call :success "Docker и Docker Compose найдены"
goto :eof

REM Запуск тестового окружения
:start_test_env
call :log "Запуск тестового окружения..."

REM Создание директорий
if not exist "logs" mkdir logs
if not exist "screenshots" mkdir screenshots

REM Запуск сервисов
docker-compose -f docker-compose.test.yml up -d

REM Ожидание готовности сервисов
call :log "Ожидание готовности сервисов..."
timeout /t 10 /nobreak >nul

REM Проверка статуса
call :check_services_status

call :success "Тестовое окружение запущено!"
call :log "Приложение доступно по адресу: http://localhost:3001"
call :log "Nginx доступен по адресу: http://localhost:8080"
goto :eof

REM Остановка тестового окружения
:stop_test_env
call :log "Остановка тестового окружения..."
docker-compose -f docker-compose.test.yml down
call :success "Тестовое окружение остановлено"
goto :eof

REM Перезапуск тестового окружения
:restart_test_env
call :log "Перезапуск тестового окружения..."
call :stop_test_env
call :start_test_env
goto :eof

REM Проверка статуса сервисов
:check_services_status
call :log "Проверка статуса сервисов..."

REM Проверка PostgreSQL
docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    call :error "PostgreSQL не готов"
) else (
    call :success "PostgreSQL готов"
)

REM Проверка Redis
docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping >nul 2>&1
if errorlevel 1 (
    call :error "Redis не готов"
) else (
    call :success "Redis готов"
)

REM Проверка приложения
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    call :warning "Приложение еще не готово (это нормально при первом запуске)"
) else (
    call :success "Приложение готово"
)
goto :eof

REM Просмотр логов
:view_logs
set "service=%~1"
if "%service%"=="" (
    call :log "Просмотр логов всех сервисов..."
    docker-compose -f docker-compose.test.yml logs -f
) else (
    call :log "Просмотр логов сервиса: %service%"
    docker-compose -f docker-compose.test.yml logs -f "%service%"
)
goto :eof

REM Очистка тестового окружения
:clean_test_env
call :log "Очистка тестового окружения..."
docker-compose -f docker-compose.test.yml down -v
docker system prune -f
call :success "Тестовое окружение очищено"
goto :eof

REM Выполнение команд в контейнере
:exec_in_container
set "service=%~1"
set "command=%~2"
if "%service%"=="" set "service=app-test"
if "%command%"=="" set "command=sh"

call :log "Выполнение команды в контейнере %service%..."
docker-compose -f docker-compose.test.yml exec "%service%" %command%
goto :eof

REM Запуск тестов
:run_tests
call :log "Запуск тестов..."
docker-compose -f docker-compose.test.yml exec app-test npm test
goto :eof

REM Сброс базы данных
:reset_database
call :log "Сброс тестовой базы данных..."
docker-compose -f docker-compose.test.yml exec app-test npx prisma db push --force-reset
docker-compose -f docker-compose.test.yml exec app-test npx prisma db seed
call :success "База данных сброшена"
goto :eof

REM Показать справку
:show_help
echo WB Slots - Test Environment Management
echo.
echo Использование: %~nx0 [команда]
echo.
echo Команды:
echo   start       - Запустить тестовое окружение
echo   stop        - Остановить тестовое окружение
echo   restart     - Перезапустить тестовое окружение
echo   status      - Проверить статус сервисов
echo   logs [сервис] - Просмотр логов (опционально указать сервис)
echo   clean       - Очистить тестовое окружение
echo   exec [сервис] [команда] - Выполнить команду в контейнере
echo   test        - Запустить тесты
echo   reset-db    - Сбросить базу данных
echo   help        - Показать эту справку
echo.
echo Примеры:
echo   %~nx0 start
echo   %~nx0 logs app-test
echo   %~nx0 exec app-test npm run lint
echo   %~nx0 reset-db
goto :eof

REM Основная логика
:main
call :check_docker
if errorlevel 1 exit /b 1

set "command=%~1"
if "%command%"=="" set "command=help"

if "%command%"=="start" (
    call :start_test_env
) else if "%command%"=="stop" (
    call :stop_test_env
) else if "%command%"=="restart" (
    call :restart_test_env
) else if "%command%"=="status" (
    call :check_services_status
) else if "%command%"=="logs" (
    call :view_logs "%~2"
) else if "%command%"=="clean" (
    call :clean_test_env
) else if "%command%"=="exec" (
    call :exec_in_container "%~2" "%~3"
) else if "%command%"=="test" (
    call :run_tests
) else if "%command%"=="reset-db" (
    call :reset_database
) else if "%command%"=="help" (
    call :show_help
) else if "%command%"=="--help" (
    call :show_help
) else if "%command%"=="-h" (
    call :show_help
) else (
    call :error "Неизвестная команда: %command%"
    call :show_help
    exit /b 1
)

goto :eof

REM Запуск основной функции
call :main %*
