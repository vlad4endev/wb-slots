/**
 * 🏗️ Единая точка входа для архитектуры
 * Экспорт всех компонентов унифицированной архитектуры
 */

// ============================================================================
// ИНТЕРФЕЙСЫ И ТИПЫ
// ============================================================================
export * from './unified-interfaces';

// ============================================================================
// БАЗОВЫЕ КЛАССЫ
// ============================================================================
export * from './base-service';

// ============================================================================
// МЕНЕДЖЕР СЕРВИСОВ
// ============================================================================
export * from './service-manager';

// ============================================================================
// УТИЛИТЫ ДЛЯ ИНИЦИАЛИЗАЦИИ
// ============================================================================

import { 
  getServiceManager, 
  initializeServiceManager,
  UnifiedServiceManager 
} from './service-manager';

/**
 * Инициализация всей архитектуры
 */
export async function initializeArchitecture(): Promise<UnifiedServiceManager> {
  console.log('🏗️ Initializing unified architecture...');
  
  const manager = await initializeServiceManager();
  
  console.log('✅ Unified architecture initialized successfully');
  return manager;
}

/**
 * Получение глобального менеджера сервисов
 */
export function getArchitectureManager(): UnifiedServiceManager {
  return getServiceManager();
}

/**
 * Проверка состояния архитектуры
 */
export async function checkArchitectureHealth(): Promise<{
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
 * Глобальная функция для регистрации сервисов
 */
export function registerService<T extends keyof import('./unified-interfaces').ServiceRegistry>(
  name: T, 
  service: import('./unified-interfaces').ServiceRegistry[T]
): void {
  const manager = getServiceManager();
  manager.registerService(name, service);
}

/**
 * Глобальная функция для получения сервисов
 */
export function getService<T extends keyof import('./unified-interfaces').ServiceRegistry>(
  name: T
): import('./unified-interfaces').ServiceRegistry[T] {
  const manager = getServiceManager();
  return manager.getService(name);
}

// ============================================================================
// КОНСТАНТЫ АРХИТЕКТУРЫ
// ============================================================================

export const ARCHITECTURE_VERSION = '1.0.0';
export const ARCHITECTURE_NAME = 'WB Slots Unified Architecture';

// ============================================================================
// ТИПЫ ДЛЯ ЭКСПОРТА
// ============================================================================

export type {
  ServiceRegistry,
  IServiceManager,
  IBaseService,
  ISlotSearchService,
  IAutoBookingService,
  INotificationService,
  IWBAPIClient
} from './unified-interfaces';

export type {
  UnifiedServiceManager
} from './service-manager';