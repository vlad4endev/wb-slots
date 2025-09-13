import { prisma } from './prisma';
import { encrypt, decrypt } from './encryption';

export interface WBSessionData {
  sessionId: string;
  cookies: Record<string, string>;
  userAgent: string;
  ipAddress?: string;
  expiresAt: Date;
}

export interface WBSessionInfo {
  id: string;
  sessionId: string;
  isActive: boolean;
  expiresAt: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

export class WBSessionManager {
  /**
   * Создание новой WB сессии
   */
  static async createSession(
    userId: string,
    sessionData: WBSessionData
  ): Promise<WBSessionInfo> {
    // Шифруем cookies
    const encryptedCookies = encrypt(JSON.stringify(sessionData.cookies));

    // Создаем сессию в базе данных
    const session = await prisma.wBSession.create({
      data: {
        userId,
        sessionId: sessionData.sessionId,
        cookies: { encrypted: encryptedCookies } as any, // Сохраняем как JSON объект
        userAgent: sessionData.userAgent,
        ipAddress: sessionData.ipAddress,
        expiresAt: sessionData.expiresAt,
        isActive: true,
      },
    });

    return {
      id: session.id,
      sessionId: session.sessionId,
      isActive: session.isActive,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
    };
  }

  /**
   * Получение активной сессии пользователя
   */
  static async getActiveSession(userId: string): Promise<WBSessionData | null> {
    const session = await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: {
          gt: new Date(), // Сессия еще не истекла
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      return null;
    }

    // Расшифровываем cookies
    const cookiesData = session.cookies as any;
    const decryptedCookies = JSON.parse(decrypt(cookiesData.encrypted));

    return {
      sessionId: session.sessionId,
      cookies: decryptedCookies,
      userAgent: session.userAgent || '',
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Обновление времени последнего использования сессии
   */
  static async updateLastUsed(sessionId: string): Promise<void> {
    await prisma.wBSession.update({
      where: { sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Деактивация сессии
   */
  static async deactivateSession(sessionId: string): Promise<void> {
    await prisma.wBSession.update({
      where: { sessionId },
      data: { isActive: false },
    });
  }

  /**
   * Деактивация всех сессий пользователя
   */
  static async deactivateAllUserSessions(userId: string): Promise<void> {
    await prisma.wBSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  /**
   * Получение информации о сессиях пользователя
   */
  static async getUserSessions(userId: string): Promise<WBSessionInfo[]> {
    const sessions = await prisma.wBSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(session => ({
      id: session.id,
      sessionId: session.sessionId,
      isActive: session.isActive,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
    }));
  }

  /**
   * Очистка истекших сессий
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.wBSession.updateMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isActive: true,
      },
      data: { isActive: false },
    });

    return result.count;
  }

  /**
   * Проверка валидности сессии
   */
  static async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await prisma.wBSession.findUnique({
      where: { sessionId },
      select: {
        isActive: true,
        expiresAt: true,
      },
    });

    if (!session) {
      return false;
    }

    return session.isActive && session.expiresAt > new Date();
  }

  /**
   * Обновление дополнительных данных сессии
   */
  static async updateSessionData(sessionId: string, additionalData: string): Promise<void> {
    await prisma.wBSession.update({
      where: { sessionId },
      data: { 
        cookies: { encrypted: additionalData } as any,
        lastUsedAt: new Date()
      },
    });
  }

  /**
   * Получение cookies для использования в браузере
   */
  static async getCookiesForBrowser(sessionId: string): Promise<string> {
    const session = await prisma.wBSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      throw new Error('Сессия не найдена');
    }

    const cookiesData = session.cookies as any;
    const decryptedCookies = JSON.parse(decrypt(cookiesData.encrypted));
    
    // Преобразуем cookies в формат для браузера
    return Object.entries(decryptedCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}
