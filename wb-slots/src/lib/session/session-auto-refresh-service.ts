// ===== SESSION AUTO REFRESH SERVICE =====

import { Logger } from '@/lib/logging/logger';
import { prisma } from '@/lib/prisma';
import { wbSessionManager } from './wb-session-manager';
// import { encrypt, decrypt } from '@/lib/security/encryption';
import { Browser, BrowserContext, Page, chromium } from 'playwright';

export interface SessionRefreshConfig {
  maxRetries: number;
  retryDelay: number;
  sessionValidationThreshold: number; // в миллисекундах
  enableAutoRefresh: boolean;
  notificationEnabled: boolean;
}

export interface SessionRefreshResult {
  success: boolean;
  sessionId?: string;
  newExpiresAt?: Date;
  error?: string;
  refreshMethod?: 'automatic' | 'manual' | 'scheduled';
}

export interface SessionHealthCheck {
  isHealthy: boolean;
  needsRefresh: boolean;
  expiresIn: number; // в миллисекундах
  lastUsedAt?: Date;
  error?: string;
}

export class SessionAutoRefreshService {
  private logger: Logger;
  private config: SessionRefreshConfig;
  private refreshInProgress = new Set<string>(); // userId -> boolean

  constructor(config?: Partial<SessionRefreshConfig>) {
    this.logger = new Logger('INFO', { service: 'INFO' });
    this.config = {
      maxRetries: 3,
      retryDelay: 5000,
      sessionValidationThreshold: 30 * 60 * 1000, // 30 минут
      enableAutoRefresh: true,
      notificationEnabled: true,
      ...config
    };
  }

  /**
   * Проверка здоровья сессии
   */
  async checkSessionHealth(userId: string): Promise<SessionHealthCheck> {
    try {
      const session = await prisma.wBSession.findFirst({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!session) {
        return {
          isHealthy: false,
          needsRefresh: false,
          expiresIn: 0,
          error: 'No active session found'
        };
      }

      const now = new Date();
      const expiresIn = session.expiresAt.getTime() - now.getTime();
      const timeSinceLastUsed = session.lastUsedAt 
        ? now.getTime() - session.lastUsedAt.getTime()
        : now.getTime() - session.createdAt.getTime();

      // Сессия истекла
      if (expiresIn <= 0) {
        await this.deactivateSession(session.id);
        return {
          isHealthy: false,
          needsRefresh: false,
          expiresIn: 0,
          error: 'Session expired'
        };
      }

      // Проверяем, нужно ли обновление
      const needsRefresh = expiresIn < this.config.sessionValidationThreshold;

      return {
        isHealthy: true,
        needsRefresh,
        expiresIn,
        lastUsedAt: session.lastUsedAt || session.createdAt
      };

    } catch (error) {
      this.logger.error('Session health check failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isHealthy: false,
        needsRefresh: false,
        expiresIn: 0,
        error: 'Health check failed'
      };
    }
  }

  /**
   * Автоматическое обновление сессии при ошибке SESSION_EXPIRED
   */
  async handleSessionExpired(userId: string, context?: any): Promise<SessionRefreshResult> {
    if (!this.config.enableAutoRefresh) {
      return {
        success: false,
        error: 'Auto refresh disabled'
      };
    }

    // Предотвращаем множественные одновременные обновления
    if (this.refreshInProgress.has(userId)) {
      this.logger.warn('Session refresh already in progress', { userId });
      return {
        success: false,
        error: 'Refresh already in progress'
      };
    }

    this.refreshInProgress.add(userId);

    try {
      this.logger.info('🔄 Handling SESSION_EXPIRED - starting auto refresh', { userId });

      // Проверяем текущее состояние сессии
      const healthCheck = await this.checkSessionHealth(userId);
      
      if (healthCheck.isHealthy && !healthCheck.needsRefresh) {
        this.logger.info('Session is actually healthy, no refresh needed', { userId });
        return {
          success: true,
          refreshMethod: 'automatic'
        };
      }

      // Пытаемся обновить сессию
      const refreshResult = await this.refreshSessionWithRetry(userId, context);

      if (refreshResult.success) {
        this.logger.info('✅ Session auto-refresh successful', {
          userId,
          sessionId: refreshResult.sessionId,
          newExpiresAt: refreshResult.newExpiresAt
        });

        // Отправляем уведомление об успешном обновлении
        if (this.config.notificationEnabled) {
          await this.sendRefreshNotification(userId, refreshResult.newExpiresAt!, 'success');
        }
      } else {
        this.logger.error('❌ Session auto-refresh failed', {
          userId,
          error: refreshResult.error
        });

        // Отправляем уведомление о неудаче
        if (this.config.notificationEnabled) {
          await this.sendRefreshNotification(userId, null, 'failure', refreshResult.error);
        }
      }

      return refreshResult;

    } catch (error) {
      this.logger.error('Session expired handling failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.refreshInProgress.delete(userId);
    }
  }

  /**
   * Обновление сессии с повторными попытками
   */
  private async refreshSessionWithRetry(
    userId: string, 
    context?: any
  ): Promise<SessionRefreshResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.logger.info(`Attempting session refresh (${attempt}/${this.config.maxRetries})`, { userId });

        // Пытаемся использовать существующий контекст браузера, если доступен
        if (context && context.page) {
          const result = await this.refreshSessionInContext(userId, context.page);
          if (result.success) {
            return result;
          }
          lastError = new Error(result.error || 'Context refresh failed');
        }

        // Если контекст недоступен или не сработал, создаем новый браузер
        const result = await this.refreshSessionWithNewBrowser(userId);
        if (result.success) {
          return result;
        }
        lastError = new Error(result.error || 'New browser refresh failed');

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        this.logger.warn(`Session refresh attempt ${attempt} failed`, {
          userId,
          error: lastError.message
        });
      }

      // Задержка перед следующей попыткой
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelay * attempt;
        this.logger.info(`Waiting ${delay}ms before next attempt`, { userId });
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: `All refresh attempts failed. Last error: ${lastError?.message || 'Unknown'}`
    };
  }

  /**
   * Обновление сессии в существующем контексте браузера
   */
  private async refreshSessionInContext(
    userId: string, 
    page: Page
  ): Promise<SessionRefreshResult> {
    try {
      // Получаем текущую сессию
      const currentSession = await prisma.wBSession.findFirst({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!currentSession) {
        return {
          success: false,
          error: 'No active session found'
        };
      }

      // Переходим на главную страницу WB
      await page.goto('https://seller.wildberries.ru', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Проверяем, не перенаправило ли на страницу входа
      if (page.url().includes('/login') || page.url().includes('/auth')) {
        return {
          success: false,
          error: 'Redirected to login page - session truly expired'
        };
      }

      // Собираем новые данные сессии
      const cookies = await page.context().cookies();
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return JSON.stringify(data);
      });

      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return JSON.stringify(data);
      });

      // Обновляем сессию в базе данных
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
      
      const updatedSession = await prisma.wBSession.update({
        where: { id: currentSession.id },
        data: {
          cookiesEncrypted: JSON.stringify(cookies), // TODO: Add encryption
          localStorageEncrypted: localStorage, // TODO: Add encryption
          sessionStorageEncrypted: sessionStorage, // TODO: Add encryption
          expiresAt: newExpiresAt,
          lastUsedAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info('Session refreshed in existing context', {
        userId,
        sessionId: updatedSession.id,
        newExpiresAt
      });

      return {
        success: true,
        sessionId: updatedSession.id,
        newExpiresAt,
        refreshMethod: 'automatic'
      };

    } catch (error) {
      this.logger.error('Context refresh failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Context refresh failed'
      };
    }
  }

  /**
   * Обновление сессии с новым браузером
   */
  private async refreshSessionWithNewBrowser(userId: string): Promise<SessionRefreshResult> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // Получаем текущую сессию
      const currentSession = await prisma.wBSession.findFirst({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!currentSession) {
        return {
          success: false,
          error: 'No active session found'
        };
      }

      // Запускаем новый браузер
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const context = await browser.newContext({
        userAgent: currentSession.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      page = await context.newPage();

      // Восстанавливаем cookies
      const cookiesData = this.safeDecrypt(currentSession.cookiesEncrypted);
      if (cookiesData) {
        const cookies = JSON.parse(cookiesData);
        await context.addCookies(cookies);
      }

      // Переходим на главную страницу
      await page.goto('https://seller.wildberries.ru', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Проверяем авторизацию
      if (page.url().includes('/login') || page.url().includes('/auth')) {
        return {
          success: false,
          error: 'Session truly expired - redirected to login'
        };
      }

      // Собираем обновленные данные
      const newCookies = await context.cookies();
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return JSON.stringify(data);
      });

      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return JSON.stringify(data);
      });

      // Обновляем сессию
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const updatedSession = await prisma.wBSession.update({
        where: { id: currentSession.id },
        data: {
          cookiesEncrypted: JSON.stringify(newCookies), // TODO: Add encryption
          localStorageEncrypted: localStorage, // TODO: Add encryption
          sessionStorageEncrypted: sessionStorage, // TODO: Add encryption
          expiresAt: newExpiresAt,
          lastUsedAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info('Session refreshed with new browser', {
        userId,
        sessionId: updatedSession.id,
        newExpiresAt
      });

      return {
        success: true,
        sessionId: updatedSession.id,
        newExpiresAt,
        refreshMethod: 'automatic'
      };

    } catch (error) {
      this.logger.error('New browser refresh failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'New browser refresh failed'
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }

  /**
   * Деактивация сессии
   */
  private async deactivateSession(sessionId: string): Promise<void> {
    try {
      await prisma.wBSession.update({
        where: { id: sessionId },
        data: { isActive: false }
      });
    } catch (error) {
      this.logger.error('Failed to deactivate session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Безопасная расшифровка данных
   */
  private safeDecrypt(encryptedData: string | null): string | null {
    if (!encryptedData) return null;
    try {
      return encryptedData; // TODO: Add decryption
    } catch (error) {
      this.logger.warn('Failed to decrypt session data', { error });
      return null;
    }
  }

  /**
   * Отправка уведомления о состоянии обновления сессии
   */
  private async sendRefreshNotification(
    userId: string, 
    newExpiresAt: Date | null, 
    status: 'success' | 'failure',
    error?: string
  ): Promise<void> {
    try {
      // Здесь можно добавить интеграцию с Telegram или другими сервисами уведомлений
      this.logger.info('Session refresh notification', {
        userId,
        status,
        newExpiresAt,
        error
      });

      // Пример интеграции с Telegram (если доступен)
      // await telegramService.sendNotification(userId, message);
      
    } catch (error) {
      this.logger.warn('Failed to send refresh notification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Экспортируем singleton instance
export const sessionAutoRefreshService = new SessionAutoRefreshService();
