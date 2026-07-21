/**
 * ЕДИНЫЙ ЭКСПОРТ ДЛЯ ВСЕХ МЕНЕДЖЕРОВ СЕССИЙ WB
 * 
 * Решает проблему множественных менеджеров сессий:
 * - Предоставляет единую точку входа
 * - Обеспечивает обратную совместимость
 * - Упрощает миграцию существующего кода
 */

import { UnifiedWBSessionManager } from '@/lib/services/unified-wb-session-manager';

// Создаем единый экземпляр менеджера сессий
let unifiedSessionManager: UnifiedWBSessionManager | null = null;

/**
 * Получение единого экземпляра менеджера сессий
 */
export function getUnifiedSessionManager(): UnifiedWBSessionManager {
  if (!unifiedSessionManager) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY not configured');
    }
    unifiedSessionManager = new UnifiedWBSessionManager(process.env.ENCRYPTION_KEY);
  }
  return unifiedSessionManager;
}

/**
 * Создание нового экземпляра менеджера сессий
 */
export function createSessionManager(encryptionKey?: string): UnifiedWBSessionManager {
  const key = encryptionKey || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('Encryption key not provided');
  }
  return new UnifiedWBSessionManager(key);
}

// ===== СОВМЕСТИМОСТЬ С СУЩЕСТВУЮЩИМ КОДОМ =====

/**
 * Экспорт для совместимости с WBSessionManager
 */
export { UnifiedWBSessionManager as WBSessionManager } from '@/lib/services/unified-wb-session-manager';

/**
 * Экспорт для совместимости с EnhancedSessionManager
 */
export { UnifiedWBSessionManager as EnhancedSessionManager } from '@/lib/services/unified-wb-session-manager';

/**
 * Экспорт для совместимости с EnhancedWBSessionManager
 */
export { UnifiedWBSessionManager as EnhancedWBSessionManager } from '@/lib/services/unified-wb-session-manager';

// ===== ТИПЫ ДЛЯ СОВМЕСТИМОСТИ =====

export type {
  UnifiedSessionData as SessionData,
  UnifiedValidationResult as ValidationResult,
  UnifiedSessionInfo as WBSessionInfo,
  SessionLock
} from '@/lib/services/unified-wb-session-manager';

// ===== УДОБНЫЕ ФУНКЦИИ =====

/**
 * Быстрое получение активной сессии
 */
export async function getActiveSession(userId: string) {
  const manager = getUnifiedSessionManager();
  return await manager.getActiveSession(userId);
}

/**
 * Быстрая валидация сессии
 */
export async function validateSession(userId: string, page: any) {
  const manager = getUnifiedSessionManager();
  return await manager.validateSession(page);
}

/**
 * Быстрое создание сессии
 */
export async function createSession(userId: string, page: any) {
  const manager = getUnifiedSessionManager();
  return await manager.createSession(userId, page);
}

/**
 * Быстрое восстановление сессии
 */
export async function restoreSession(userId: string, page: any) {
  const manager = getUnifiedSessionManager();
  return await manager.restoreSession(userId, page);
}

/**
 * Быстрое восстановление сессии через контекст
 */
export async function restoreSessionContext(userId: string, context: any) {
  const manager = getUnifiedSessionManager();
  return await manager.restoreSessionContext(userId, context);
}

/**
 * Быстрая проверка статуса авторизации
 */
export async function checkAuthenticationStatus(page: any) {
  const manager = getUnifiedSessionManager();
  return await manager.checkAuthenticationStatus(page);
}

/**
 * Быстрое обновление сессии
 */
export async function refreshSession(userId: string, page: any, sessionId?: string) {
  const manager = getUnifiedSessionManager();
  return await manager.refreshSession(userId, page, sessionId);
}

/**
 * Быстрая деактивация сессии
 */
export async function deactivateSession(sessionId: string, reason?: string) {
  const manager = getUnifiedSessionManager();
  return await manager.deactivateSession(sessionId, reason);
}

/**
 * Быстрое получение информации о сессии
 */
export async function getSessionInfo(userId: string) {
  const manager = getUnifiedSessionManager();
  return await manager.getSessionInfo(userId);
}

/**
 * Быстрое получение статистики сессий
 */
export async function getSessionStats(userId: string) {
  const manager = getUnifiedSessionManager();
  return await manager.getSessionStats(userId);
}

/**
 * Быстрое получение всех сессий пользователя
 */
export async function getUserSessions(userId: string) {
  const manager = getUnifiedSessionManager();
  return await manager.getUserSessions(userId);
}

/**
 * Быстрое получение статистики данных сессии
 */
export async function getSessionDataStats(userId: string) {
  const manager = getUnifiedSessionManager();
  return await manager.getSessionDataStats(userId);
}

// ===== ЭКСПОРТ ПО УМОЛЧАНИЮ =====

const sessionModule = {
  getUnifiedSessionManager,
  createSessionManager,
  getActiveSession,
  validateSession,
  createSession,
  restoreSession,
  restoreSessionContext,
  checkAuthenticationStatus,
  refreshSession,
  deactivateSession,
  getSessionInfo,
  getSessionStats,
  getUserSessions
};

export default sessionModule;