#!/bin/bash

# ========================================
# WB Slots - Test Environment Management
# ========================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Проверка наличия Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker не установлен. Пожалуйста, установите Docker."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose не установлен. Пожалуйста, установите Docker Compose."
        exit 1
    fi

    success "Docker и Docker Compose найдены"
}

# Запуск тестового окружения
start_test_env() {
    log "Запуск тестового окружения..."
    
    # Создание директорий
    mkdir -p logs screenshots
    
    # Запуск сервисов
    docker-compose -f docker-compose.test.yml up -d
    
    # Ожидание готовности сервисов
    log "Ожидание готовности сервисов..."
    sleep 10
    
    # Проверка статуса
    check_services_status
    
    success "Тестовое окружение запущено!"
    log "Приложение доступно по адресу: http://localhost:3001"
    log "Nginx доступен по адресу: http://localhost:8080"
}

# Остановка тестового окружения
stop_test_env() {
    log "Остановка тестового окружения..."
    docker-compose -f docker-compose.test.yml down
    success "Тестовое окружение остановлено"
}

# Перезапуск тестового окружения
restart_test_env() {
    log "Перезапуск тестового окружения..."
    stop_test_env
    start_test_env
}

# Проверка статуса сервисов
check_services_status() {
    log "Проверка статуса сервисов..."
    
    # Проверка PostgreSQL
    if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres > /dev/null 2>&1; then
        success "PostgreSQL готов"
    else
        error "PostgreSQL не готов"
    fi
    
    # Проверка Redis
    if docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping > /dev/null 2>&1; then
        success "Redis готов"
    else
        error "Redis не готов"
    fi
    
    # Проверка приложения
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        success "Приложение готово"
    else
        warning "Приложение еще не готово (это нормально при первом запуске)"
    fi
}

# Просмотр логов
view_logs() {
    local service=${1:-""}
    
    if [ -z "$service" ]; then
        log "Просмотр логов всех сервисов..."
        docker-compose -f docker-compose.test.yml logs -f
    else
        log "Просмотр логов сервиса: $service"
        docker-compose -f docker-compose.test.yml logs -f "$service"
    fi
}

# Очистка тестового окружения
clean_test_env() {
    log "Очистка тестового окружения..."
    docker-compose -f docker-compose.test.yml down -v
    docker system prune -f
    success "Тестовое окружение очищено"
}

# Выполнение команд в контейнере
exec_in_container() {
    local service=${1:-"app-test"}
    local command=${2:-"sh"}
    
    log "Выполнение команды в контейнере $service..."
    docker-compose -f docker-compose.test.yml exec "$service" "$command"
}

# Запуск тестов
run_tests() {
    log "Запуск тестов..."
    docker-compose -f docker-compose.test.yml exec app-test npm test
}

# Сброс базы данных
reset_database() {
    log "Сброс тестовой базы данных..."
    docker-compose -f docker-compose.test.yml exec app-test npx prisma db push --force-reset
    docker-compose -f docker-compose.test.yml exec app-test npx prisma db seed
    success "База данных сброшена"
}

# Показать справку
show_help() {
    echo "WB Slots - Test Environment Management"
    echo ""
    echo "Использование: $0 [команда]"
    echo ""
    echo "Команды:"
    echo "  start       - Запустить тестовое окружение"
    echo "  stop        - Остановить тестовое окружение"
    echo "  restart     - Перезапустить тестовое окружение"
    echo "  status      - Проверить статус сервисов"
    echo "  logs [сервис] - Просмотр логов (опционально указать сервис)"
    echo "  clean       - Очистить тестовое окружение"
    echo "  exec [сервис] [команда] - Выполнить команду в контейнере"
    echo "  test        - Запустить тесты"
    echo "  reset-db    - Сбросить базу данных"
    echo "  help        - Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 start"
    echo "  $0 logs app-test"
    echo "  $0 exec app-test npm run lint"
    echo "  $0 reset-db"
}

# Основная логика
main() {
    check_docker
    
    case "${1:-help}" in
        start)
            start_test_env
            ;;
        stop)
            stop_test_env
            ;;
        restart)
            restart_test_env
            ;;
        status)
            check_services_status
            ;;
        logs)
            view_logs "$2"
            ;;
        clean)
            clean_test_env
            ;;
        exec)
            exec_in_container "$2" "$3"
            ;;
        test)
            run_tests
            ;;
        reset-db)
            reset_database
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Неизвестная команда: $1"
            show_help
            exit 1
            ;;
    esac
}

# Запуск основной функции
main "$@"
