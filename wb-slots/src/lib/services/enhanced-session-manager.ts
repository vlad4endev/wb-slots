import { BrowserContext, Page } from 'playwright';
import { prisma } from '../prisma';
import { encrypt, decrypt } from '../encryption';
import { Logger } from '../logging/logger';

// ===== SESSION TYPES =====
export interface SessionData {
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  userAgent: string;
  viewport: { width: number; height: number };
}

export interface SessionMetadata {
  userId: string;
  sessionId: string;
  isActive: boolean;
  expiresAt: Date;
  lastUsedAt: Date;
  loginAttempts: number;
  successfulLogins: number;
  failedLogins: number;
  userAgent: string;
  ipAddress: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  needsRefresh: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// ===== SESSION MANAGER =====
export class EnhancedSessionManager {
  private logger: Logger;
  private maxSessionAge = 24 * 60 * 60 * 1000; // 24 часа
  private sessionRefreshThreshold = 2 * 60 * 60 * 1000; // 2 часа до истечения
  private maxLoginAttempts = 3;

  constructor() {
    this.logger = new Logger('INFO', { context: 'EnhancedSessionManager' });
  }

  /**
   * Сохранение сессии браузера
   */
  async saveSession(userId: string, page: Page): Promise<string> {
    try {
      // Извлекаем данные сессии
      const sessionData = await this.extractSessionData(page);
      
      // Генерируем ID сессии
      const sessionId = `sess_${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Шифруем данные сессии
      const encryptedData = encrypt(JSON.stringify({
        cookies: sessionData.cookies,
        localStorage: sessionData.localStorage,
        sessionStorage: sessionData.sessionStorage,
        viewport: sessionData.viewport
      }));
      
      // Сохраняем в базу данных
      await prisma.wBSession.create({
        data: {
          userId,
          sessionId,
          cookies: encryptedData,
          userAgent: sessionData.userAgent,
          isActive: true,
          expiresAt: new Date(Date.now() + this.maxSessionAge),
          lastUsedAt: new Date(),
        },
      });

      this.logger.info('✅ Session saved successfully', { 
        userId, 
        sessionId,
        cookieCount: sessionData.cookies.length,
        localStorageItems: Object.keys(sessionData.localStorage).length
      });

      return sessionId;

    } catch (error) {
      this.logger.error('❌ Failed to save session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error(`Failed to save session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Восстановление сессии браузера
   */
  async restoreSession(userId: string, context: BrowserContext): Promise<SessionValidationResult> {
    try {
      // Получаем активную сессию
      const session = await this.getActiveSession(userId);
      
      if (!session) {
        return {
          isValid: false,
          needsRefresh: true,
          error: 'No active session found'
        };
      }

      // Проверяем валидность сессии
      const validationResult = await this.validateSession(session);
      
      if (!validationResult.isValid) {
        return validationResult;
      }

      // Расшифровываем данные
      const sessionData = await this.decryptSessionData(session);
      
      // Восстанавливаем cookies
      await context.addCookies(sessionData.cookies);
      
      // Обновляем время последнего использования
      await this.updateSessionUsage(session.sessionId);

      this.logger.info('✅ Session restored successfully', { 
        userId, 
        sessionId: session.sessionId,
        cookiesRestored: sessionData.cookies.length
      });

      return {
        isValid: true,
        needsRefresh: false,
        metadata: {
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
          cookieCount: sessionData.cookies.length
        }
      };

    } catch (error) {
      this.logger.error('❌ Failed to restore session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        isValid: false,
        needsRefresh: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Валидация существующей сессии
   */
  async validateSession(session: any): Promise<SessionValidationResult> {
    try {
      const now = new Date();
      
      // Проверяем срок действия
      if (session.expiresAt < now) {
        await this.markSessionInactive(session.sessionId);
        
        return {
          isValid: false,
          needsRefresh: true,
          error: 'Session expired'
        };
      }

      // Проверяем, нужно ли обновление
      const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
      const needsRefresh = timeUntilExpiry < this.sessionRefreshThreshold;

      this.logger.info('🔍 Session validation completed', {
        sessionId: session.sessionId,
        isValid: true,
        needsRefresh,
        timeUntilExpiry
      });

      return {
        isValid: true,
        needsRefresh,
        metadata: {
          timeUntilExpiry,
          lastUsedAt: session.lastUsedAt,
          expiresAt: session.expiresAt
        }
      };

    } catch (error) {
      this.logger.error('❌ Session validation failed', { 
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        isValid: false,
        needsRefresh: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Проверка авторизации на странице
   */
  async checkAuthenticationStatus(page: Page): Promise<{
    isAuthenticated: boolean;
    needsLogin: boolean;
    userInfo?: Record<string, any>;
    error?: string;
  }> {
    try {
      // Проверяем URL на редирект на страницу входа
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
        return {
          isAuthenticated: false,
          needsLogin: true,
          error: 'Redirected to login page'
        };
      }

      // Проверяем наличие элементов аутентифицированного пользователя
      const authStatus = await page.evaluate(() => {
        // Ищем признаки авторизованного пользователя
        const authSelectors = [
          '[data-testid="user-menu"]',
          '.user-info',
          '.profile-menu',
          '[data-testid="profile"]',
          '.header-user',
          '.user-dropdown'
        ];

        let isAuthenticated = false;
        let userInfo: Record<string, any> = {};

        for (const selector of authSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            isAuthenticated = true;
            userInfo.foundSelector = selector;
            userInfo.elementText = element.textContent?.trim().substring(0, 100);
            break;
          }
        }

        // Дополнительные проверки
        if (!isAuthenticated) {
          // Проверяем наличие токенов в localStorage
          const hasTokens = localStorage.getItem('auth-token') || 
                           localStorage.getItem('access_token') ||
                           localStorage.getItem('session_id');
          
          if (hasTokens) {
            isAuthenticated = true;
            userInfo.hasLocalTokens = true;
          }
        }

        return {
          isAuthenticated,
          currentUrl: window.location.href,
          title: document.title,
          userInfo
        };
      });

      this.logger.info('🔐 Authentication status checked', authStatus);

      return {
        isAuthenticated: authStatus.isAuthenticated,
        needsLogin: !authStatus.isAuthenticated,
        userInfo: authStatus.userInfo
      };

    } catch (error) {
      this.logger.error('❌ Failed to check authentication status', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        isAuthenticated: false,
        needsLogin: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Обновление сессии с новыми данными
   */
  async refreshSession(userId: string, page: Page, sessionId?: string): Promise<string> {
    try {
      // Если есть существующая сессия, деактивируем её
      if (sessionId) {
        await this.markSessionInactive(sessionId);
      }

      // Создаём новую сессию
      const newSessionId = await this.saveSession(userId, page);
      
      this.logger.info('🔄 Session refreshed successfully', { 
        userId, 
        oldSessionId: sessionId,
        newSessionId 
      });

      return newSessionId;

    } catch (error) {
      this.logger.error('❌ Failed to refresh session', { 
        userId, 
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Очистка просроченных сессий
   */
  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    try {
      const result = await prisma.wBSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isActive: false }
          ]
        }
      });

      this.logger.info('🧹 Expired sessions cleaned up', { deletedCount: result.count });
      
      return { deletedCount: result.count };

    } catch (error) {
      this.logger.error('❌ Failed to cleanup expired sessions', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Получение статистики сессий пользователя
   */
  async getSessionStats(userId: string): Promise<{
    activeSessions: number;
    totalSessions: number;
    lastLoginAt?: Date;
    averageSessionDuration?: number;
  }> {
    try {
      const stats = await prisma.wBSession.aggregate({
        where: { userId },
        _count: { id: true }
      });

      const activeSessions = await prisma.wBSession.count({
        where: { 
          userId, 
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });

      const lastSession = await prisma.wBSession.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      this.logger.info('📊 Session stats retrieved', { 
        userId, 
        activeSessions, 
        totalSessions: stats._count.id 
      });

      return {
        activeSessions,
        totalSessions: stats._count.id,
        lastLoginAt: lastSession?.createdAt
      };

    } catch (error) {
      this.logger.error('❌ Failed to get session stats', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  // ===== PRIVATE METHODS =====

  /**
   * Извлечение данных сессии из страницы
   */
  private async extractSessionData(page: Page): Promise<SessionData> {
    const sessionData = await page.evaluate(() => {
      // Извлекаем localStorage
      const localStorage: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          localStorage[key] = window.localStorage.getItem(key) || '';
        }
      }

      // Извлекаем sessionStorage
      const sessionStorage: Record<string, string> = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          sessionStorage[key] = window.sessionStorage.getItem(key) || '';
        }
      }

      return {
        localStorage,
        sessionStorage,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    // Извлекаем cookies
    const cookies = await page.context().cookies();

    return {
      cookies,
      localStorage: sessionData.localStorage,
      sessionStorage: sessionData.sessionStorage,
      userAgent: sessionData.userAgent,
      viewport: sessionData.viewport
    };
  }

  /**
   * Получение активной сессии пользователя
   */
  private async getActiveSession(userId: string) {
    return await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastUsedAt: 'desc' }
    });
  }

  /**
   * Расшифровка данных сессии
   */
  private async decryptSessionData(session: any): Promise<SessionData> {
    try {
      const encryptedData = session.cookies as string;
      
      if (!encryptedData || encryptedData.trim() === '') {
        this.logger.warn('⚠️ Encrypted session data is empty or null', { sessionId: session.sessionId });
        throw new Error('Encrypted session data is empty');
      }
      
      const decryptedString = decrypt(encryptedData);
      
      if (!decryptedString || decryptedString.trim() === '') {
        this.logger.warn('⚠️ Decrypted session data is empty', { sessionId: session.sessionId });
        throw new Error('Decrypted session data is empty');
      }
      
      const decryptedData = JSON.parse(decryptedString);
      
      return {
        cookies: decryptedData.cookies || [],
        localStorage: decryptedData.localStorage || {},
        sessionStorage: decryptedData.sessionStorage || {},
        userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: decryptedData.viewport || { width: 1920, height: 1080 }
      };
    } catch (error) {
      this.logger.error('❌ Failed to decrypt session data', { 
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to decrypt session data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Обновление времени использования сессии
   */
  private async updateSessionUsage(sessionId: string): Promise<void> {
    await prisma.wBSession.update({
      where: { sessionId },
      data: { lastUsedAt: new Date() }
    });
  }

  /**
   * Деактивация сессии
   */
  private async markSessionInactive(sessionId: string): Promise<void> {
    await prisma.wBSession.update({
      where: { sessionId },
      data: { isActive: false }
    });
  }
}

export default EnhancedSessionManager;