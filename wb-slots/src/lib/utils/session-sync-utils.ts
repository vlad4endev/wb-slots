import { prisma } from '../prisma';
import { Logger } from '../logging/logger';

/**
 * Утилиты для синхронизации сессий WB
 */

const logger = new Logger();

/**
 * Принудительная синхронизация всех сессий пользователя
 * Деактивирует истекшие сессии и оставляет только одну активную
 */
export async function syncUserSessions(userId: string): Promise<{
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  deactivatedSessions: number;
}> {
  try {
    logger.info('🔄 Starting session sync for user', { userId });

    // Получаем все сессии пользователя
    const allSessions = await prisma.wBSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    let activeSessions = 0;
    let expiredSessions = 0;
    let deactivatedSessions = 0;

    // Обрабатываем каждую сессию
    for (const session of allSessions) {
      if (!session.isActive) {
        continue; // Уже неактивная
      }

      // Проверяем, истекла ли сессия
      if (session.expiresAt && session.expiresAt < now) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
        expiredSessions++;
        deactivatedSessions++;
        logger.info('⏰ Deactivated expired session', { sessionId: session.id });
      } else {
        activeSessions++;
      }
    }

    // Если есть несколько активных сессий, оставляем только самую новую
    if (activeSessions > 1) {
      const activeSessionsList = allSessions.filter(s => 
        s.isActive && (!s.expiresAt || s.expiresAt >= now)
      );

      // Сортируем по дате создания (самая новая первая)
      activeSessionsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Деактивируем все кроме первой (самой новой)
      for (let i = 1; i < activeSessionsList.length; i++) {
        await prisma.wBSession.update({
          where: { id: activeSessionsList[i].id },
          data: { isActive: false }
        });
        deactivatedSessions++;
        logger.info('🔄 Deactivated duplicate session', { sessionId: activeSessionsList[i].id });
      }

      activeSessions = 1; // Остается только одна активная
    }

    const result = {
      totalSessions: allSessions.length,
      activeSessions,
      expiredSessions,
      deactivatedSessions
    };

    logger.info('✅ Session sync completed', { userId, ...result });
    return result;

  } catch (error) {
    logger.error('❌ Session sync failed', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Проверка и исправление несоответствий в сессиях
 */
export async function validateAndFixSessions(userId: string): Promise<{
  issuesFound: string[];
  issuesFixed: string[];
}> {
  const issuesFound: string[] = [];
  const issuesFixed: string[] = [];

  try {
    // Получаем все сессии пользователя
    const sessions = await prisma.wBSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();

    // Проверка 1: Активные сессии с истекшим сроком
    const expiredActiveSessions = sessions.filter(s => 
      s.isActive && s.expiresAt && s.expiresAt < now
    );

    if (expiredActiveSessions.length > 0) {
      issuesFound.push(`${expiredActiveSessions.length} активных сессий с истекшим сроком`);
      
      for (const session of expiredActiveSessions) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
      }
      
      issuesFixed.push(`Деактивированы ${expiredActiveSessions.length} истекших сессий`);
    }

    // Проверка 2: Множественные активные сессии
    const activeSessions = sessions.filter(s => 
      s.isActive && (!s.expiresAt || s.expiresAt >= now)
    );

    if (activeSessions.length > 1) {
      issuesFound.push(`${activeSessions.length} активных сессий (должна быть только одна)`);
      
      // Оставляем только самую новую
      const sortedActive = activeSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      for (let i = 1; i < sortedActive.length; i++) {
        await prisma.wBSession.update({
          where: { id: sortedActive[i].id },
          data: { isActive: false }
        });
      }
      
      issuesFixed.push(`Деактивированы ${sortedActive.length - 1} дублирующих сессий`);
    }

    // Проверка 3: Сессии без cookies
    const sessionsWithoutCookies = sessions.filter(s => 
      s.isActive && !s.cookiesEncrypted
    );

    if (sessionsWithoutCookies.length > 0) {
      issuesFound.push(`${sessionsWithoutCookies.length} активных сессий без cookies`);
      
      for (const session of sessionsWithoutCookies) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
      }
      
      issuesFixed.push(`Деактивированы ${sessionsWithoutCookies.length} сессий без cookies`);
    }

    logger.info('🔍 Session validation completed', { 
      userId, 
      issuesFound: issuesFound.length, 
      issuesFixed: issuesFixed.length 
    });

    return { issuesFound, issuesFixed };

  } catch (error) {
    logger.error('❌ Session validation failed', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Получение статистики сессий пользователя
 */
export async function getSessionStats(userId: string): Promise<{
  total: number;
  active: number;
  expired: number;
  lastCreated?: Date;
  lastUsed?: Date;
}> {
  try {
    const sessions = await prisma.wBSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    const active = sessions.filter(s => 
      s.isActive && (!s.expiresAt || s.expiresAt >= now)
    ).length;
    
    const expired = sessions.filter(s => 
      s.expiresAt && s.expiresAt < now
    ).length;

    const lastCreated = sessions.length > 0 ? sessions[0].createdAt : undefined;
    const lastUsed = sessions.length > 0 ? sessions[0].lastUsedAt || undefined : undefined;

    return {
      total: sessions.length,
      active,
      expired,
      lastCreated,
      lastUsed
    };

  } catch (error) {
    logger.error('❌ Failed to get session stats', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}
