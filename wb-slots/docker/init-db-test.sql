-- ========================================
-- Test Database Initialization Script
-- ========================================

-- Создание тестовой базы данных
CREATE DATABASE wb_slots_test;

-- Подключение к тестовой базе данных
\c wb_slots_test;

-- Включение расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Создание пользователя для тестов (опционально)
-- CREATE USER test_user WITH PASSWORD 'test_password';
-- GRANT ALL PRIVILEGES ON DATABASE wb_slots_test TO test_user;

-- Настройка Row Level Security для тестов
ALTER DATABASE wb_slots_test SET row_security = on;

-- Создание схемы для тестов
CREATE SCHEMA IF NOT EXISTS test_schema;

-- Настройка поиска по тексту
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Создание индексов для производительности (будут созданы Prisma)
-- Эти индексы будут созданы автоматически при применении миграций

-- Логирование инициализации
DO $$
BEGIN
    RAISE NOTICE 'Test database initialized successfully';
END $$;
