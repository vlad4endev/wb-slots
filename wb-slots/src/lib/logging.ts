import pino from 'pino';

// Создаем логгер с минимальной конфигурацией для совместимости с Next.js
// В Next.js webpack транспорты pino могут вызывать проблемы при сборке
const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
};

// Инициализируем логгер безопасно
let logger: pino.Logger;

try {
  logger = pino(loggerConfig);
} catch (error) {
  // Fallback на базовый логгер при ошибке
  console.warn('Failed to initialize pino logger, using fallback:', error);
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });
}

export { logger };
