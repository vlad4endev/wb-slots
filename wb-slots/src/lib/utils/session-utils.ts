import { prisma } from '../prisma';
import { getUnifiedSessionManager } from '../session';

/**
 * Утилиты для работы с сессиями WB
 */

export interface SessionStatus {
  isActive: boolean;
  sessionId?: string;
  expiresAt?: Date;
  lastLogin?: Date;
  message?: string;
}

/**
 * Единообразная проверка статуса сессии WB
 * Используется во всех компонентах системы
 */
export async function checkWBSessionStatus(userId: string): Promise<SessionStatus> {
  try {
    // Используем UnifiedWBSessionManager для корректной работы с новой схемой
    const sessionManager = getUnifiedSessionManager();
    
    console.log('[checkWBSessionStatus] Checking session for userId:', userId);
    
    // Получаем активную сессию (с поддержкой старых сессий без expiresAt)
    const session = await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('[checkWBSessionStatus] Session found:', {
      found: !!session,
      sessionId: session?.id,
      isActive: session?.isActive,
      expiresAt: session?.expiresAt,
      createdAt: session?.createdAt
    });

    if (!session) {
      console.log('[checkWBSessionStatus] No active session found');
      return {
        isActive: false,
        message: 'Нет активной сессии'
      };
    }

    // Проверяем, не истекла ли сессия (с поддержкой старых сессий)
    const now = new Date();
    const expiresAt = session.expiresAt;
    
    // Если нет expiresAt (старая сессия), устанавливаем его
    if (!expiresAt) {
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.wBSession.update({
        where: { id: session.id },
        data: { expiresAt: newExpiresAt }
      }).catch(() => {});
    }
    
    const isExpired = expiresAt && expiresAt < now;

    if (isExpired) {
      // Деактивируем истекшую сессию
      await sessionManager.deactivateSession(session.id, 'Session expired');

      return {
        isActive: false,
        message: 'Сессия истекла'
      };
    }

    // Извлекаем sessionId из расшифрованных данных
    let sessionIdFromData: string = session.id;
    try {
      const sessionData = await (sessionManager as any).decryptSessionData(session);
      sessionIdFromData = sessionData.sessionId || session.id;
    } catch (error) {
      // Используем id как fallback
      console.warn('Failed to decrypt session data for sessionId, using id:', error);
    }

    return {
      isActive: true,
      sessionId: sessionIdFromData,
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastLogin: session.createdAt,
      message: 'Сессия активна'
    };
  } catch (error) {
    console.error('Error checking WB session status:', error);
    return {
      isActive: false,
      message: 'Ошибка проверки сессии'
    };
  }
}

/**
 * Получение активной сессии для использования в сервисах
 */
export async function getActiveWBSession(userId: string) {
  try {
    const sessionManager = getUnifiedSessionManager();
    
    const session = await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true,
        // Поддержка старых сессий без expiresAt
        OR: [
          { expiresAt: { gt: new Date() } },
          { expiresAt: null }
        ]
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      return null;
    }

    // Проверяем, не истекла ли сессия
    const now = new Date();
    const expiresAt = session.expiresAt;
    
    // Если нет expiresAt, устанавливаем его
    if (!expiresAt) {
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.wBSession.update({
        where: { id: session.id },
        data: { expiresAt: newExpiresAt }
      }).catch(() => {});
    }
    
    const isExpired = expiresAt && expiresAt < now;

    if (isExpired) {
      // Деактивируем истекшую сессию
      await sessionManager.deactivateSession(session.id, 'Session expired');
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error getting active WB session:', error);
    return null;
  }
}

/**
 * Деактивация сессии
 */
export async function deactivateWBSession(sessionId: string, reason?: string): Promise<void> {
  try {
    const sessionManager = getUnifiedSessionManager();
    await sessionManager.deactivateSession(sessionId, reason || 'Manual deactivation');
  } catch (error) {
    console.error('Error deactivating WB session:', error);
  }
}

/**
 * Обновление времени последнего использования сессии
 */
export async function updateSessionLastUsed(sessionId: string): Promise<void> {
  try {
    await prisma.wBSession.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() }
    });
  } catch (error) {
    console.error('Error updating session last used:', error);
  }
}
