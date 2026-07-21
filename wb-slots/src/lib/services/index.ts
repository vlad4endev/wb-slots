/**
 * 🏗️ Единая точка входа для всех сервисов
 * Централизованная инициализация и управление сервисами
 */

// ============================================================================
// ЭКСПОРТ ВСЕХ УНИФИЦИРОВАННЫХ СЕРВИСОВ
// ============================================================================
export * from './unified-wb-api-client';
export * from './unified-slot-search-service';
export * from './unified-auto-booking-service';
export * from './unified-notification-service';
export * from './session-mirror-service';

// ============================================================================
// ИМПОРТЫ ДЛЯ ИНИЦИАЛИЗАЦИИ
// ============================================================================
import { 
  getServiceManager, 
  initializeServiceManager,
  ServiceRegistry 
} from '../architecture';
import { UnifiedWBAPIClient, WBAPIClientFactory } from './unified-wb-api-client';
import { UnifiedSlotSearchService } from './unified-slot-search-service';
import { UnifiedAutoBookingService } from './unified-auto-booking-service';
import { UnifiedNotificationService } from './unified-notification-service';

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ СЕРВИСОВ
// ============================================================================

/**
 * Инициализация всех сервисов системы
 */
export async function initializeAllServices(): Promise<ServiceRegistry> {
  console.log('🏗️ Initializing all unified services...');
  
  // Инициализируем менеджер сервисов
  const manager = await initializeServiceManager();
  
  // Создаем и регистрируем все сервисы
  const services = await createAndRegisterServices(manager);
  
  // Запускаем все сервисы
  await manager.startAllServices();
  
  console.log('✅ All unified services initialized and started successfully');
  return services;
}

/**
 * Создание и регистрация всех сервисов
 */
async function createAndRegisterServices(manager: any): Promise<ServiceRegistry> {
  // Создаем сервисы
  const slotSearchService = new UnifiedSlotSearchService();
  const autoBookingService = new UnifiedAutoBookingService();
  const notificationService = new UnifiedNotificationService();
  
  // Инициализируем сервисы
  await slotSearchService.initialize();
  await autoBookingService.initialize();
  await notificationService.initialize();
  
  // Регистрируем сервисы в менеджере
  manager.registerService('slotSearch', slotSearchService);
  manager.registerService('autoBooking', autoBookingService);
  manager.registerService('notifications', notificationService);
  
  // WB API клиент будет создаваться динамически для каждого пользователя
  // Регистрируем фабрику для создания клиентов
  manager.registerService('wbAPIFactory', WBAPIClientFactory);
  
  return {
    slotSearch: slotSearchService,
    autoBooking: autoBookingService,
    notifications: notificationService,
    wbAPI: null as any // Будет создаваться динамически
  };
}

/**
 * Получение сервиса по имени
 */
export function getService<T extends keyof ServiceRegistry>(name: T): ServiceRegistry[T] {
  const manager = getServiceManager();
  return manager.getService(name);
}

/**
 * Создание WB API клиента для пользователя
 */
export async function createWBAPIClientForUser(
  userId: string, 
  token: string, 
  category: 'SUPPLIES' | 'MARKETPLACE' = 'SUPPLIES'
): Promise<UnifiedWBAPIClient> {
  const client = WBAPIClientFactory.createClient({
    token,
    category,
    baseURL: category === 'SUPPLIES' 
      ? 'https://suppliers-api.wildberries.ru'
      : 'https://marketplace-api.wildberries.ru',
    timeout: 30000,
    retryAttempts: 3,
    rateLimit: {
      requests: 100,
      window: 60
    }
  });
  
  await client.initialize();
  await client.start();
  
  return client;
}

/**
 * Проверка состояния всех сервисов
 */
export async function checkServicesHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, any>;
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
  };
}> {
  const manager = getServiceManager();
  const health = await manager.getAllServicesHealth();
  
  const services = Object.keys(health);
  const healthyServices = Object.values(health).filter(h => h.status === 'healthy').length;
  const degradedServices = Object.values(health).filter(h => h.status === 'degraded').length;
  const unhealthyServices = Object.values(health).filter(h => h.status === 'unhealthy').length;
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyServices > 0) {
    overallStatus = 'unhealthy';
  } else if (degradedServices > 0) {
    overallStatus = 'degraded';
  }
  
  return {
    status: overallStatus,
    services: health,
    summary: {
      totalServices: services.length,
      healthyServices,
      degradedServices,
      unhealthyServices
    }
  };
}

/**
 * Остановка всех сервисов
 */
export async function stopAllServices(): Promise<void> {
  const manager = getServiceManager();
  await manager.stopAllServices();
  console.log('🛑 All services stopped');
}

/**
 * Перезапуск всех сервисов
 */
export async function restartAllServices(): Promise<void> {
  const manager = getServiceManager();
  await manager.restartAllServices();
  console.log('🔄 All services restarted');
}

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С СЕРВИСАМИ
// ============================================================================

/**
 * Выполнение операции с автоматическим получением сервиса
 */
export async function withService<T extends keyof ServiceRegistry, R>(
  serviceName: T,
  operation: (service: ServiceRegistry[T]) => Promise<R>
): Promise<R> {
  const service = getService(serviceName);
  return operation(service);
}

/**
 * Безопасное выполнение операции с обработкой ошибок
 */
export async function safeServiceOperation<T extends keyof ServiceRegistry, R>(
  serviceName: T,
  operation: (service: ServiceRegistry[T]) => Promise<R>,
  fallback?: R
): Promise<R | undefined> {
  try {
    const service = getService(serviceName);
    return await operation(service);
  } catch (error) {
    console.error(`Service operation failed for ${serviceName}:`, error);
    return fallback;
  }
}

/**
 * Получение метрик всех сервисов
 */
export async function getAllServicesMetrics(): Promise<Record<string, any>> {
  const manager = getServiceManager();
  return await manager.getAllServicesMetrics();
}

/**
 * Получение статуса всех сервисов
 */
export async function getAllServicesStatus(): Promise<Record<string, string>> {
  const manager = getServiceManager();
  return await manager.getServicesStatus();
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

export const SERVICES_VERSION = '1.0.0';
export const SERVICES_NAME = 'WB Slots Unified Services';

// ============================================================================
// ТИПЫ ДЛЯ ЭКСПОРТА
// ============================================================================

export type {
  ServiceRegistry
} from '../architecture';

export type {
  UnifiedWBAPIClient,
  WBAPIClientFactory
} from './unified-wb-api-client';

export type {
  UnifiedSlotSearchService
} from './unified-slot-search-service';

export type {
  UnifiedAutoBookingService
} from './unified-auto-booking-service';

export type {
  UnifiedNotificationService
} from './unified-notification-service';
