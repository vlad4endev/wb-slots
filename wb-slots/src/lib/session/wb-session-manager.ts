// ===== UNIFIED WB SESSION MANAGER =====

import { prisma } from '../prisma';
import { encrypt, decrypt } from '../encryption';
import { Logger } from '../logging/logger';
import { TelegramService } from '../services/telegram-service';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ===== TYPES =====

export interface WBSessionData {
  cookies: string;
  localStorage: string;
  sessionStorage: string;
  userAgent: string;
  timestamp: number;
}

export interface SessionValidationResult {
  isValid: boolean;
  needsRefresh: boolean;
  error?: string;
  sessionAge?: number;
}

export interface SessionRefreshResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  newExpiresAt?: Date;
}

export interface SessionConfig {
  maxSessionAge: number; // в миллисекундах
  refreshThreshold: number; // процент от maxSessionAge для автообновления
  autoRefreshEnabled: boolean;
  notificationEnabled: boolean;
}

// ===== CONSTANTS =====

const DEFAULT_CONFIG: SessionConfig = {
  maxSessionAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
  refreshThreshold: 0.8, // Обновляем при 80% истечения
  autoRefreshEnabled: true,
  notificationEnabled: true
};

const WB_BASE_URL = 'https://seller.wildberries.ru';
const SUPPLIES_URL = `${WB_BASE_URL}/supplies-management/all-supplies`;

// ===== BROWSER CONFIG =====

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-blink-features=AutomationControlled',
  '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// ===== MAIN CLASS =====

export class WBSessionManager {
  private logger: Logger;
  private telegramService: TelegramService;
  private config: SessionConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger('INFO', { service: 'WBSessionManager' });
    this.telegramService = new TelegramService();
  }

  /**
   * Получение активной сессии пользователя
   */
  async getActiveSession(userId: string): Promise<WBSessionData | null> {
    try {
      const session = await prisma.wBSession.findFirst({
        where: {
          userId,
          isActive: true,
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!session) {
        this.logger.warn('No active WB session found', { userId });
        return null;
      }

      // Проверяем возраст сессии
      const sessionAge = Date.now() - session.createdAt.getTime();
      if (sessionAge > this.config.maxSessionAge) {
        this.logger.warn('Session too old, marking as expired', { 
          userId, 
          sessionAge: Math.round(sessionAge / (24 * 60 * 60 * 1000)) + ' days',
          maxAge: Math.round(this.config.maxSessionAge / (24 * 60 * 60 * 1000)) + ' days'
        });
        
        await this.deactivateSession(session.id);
        return null;
      }

      // Расшифровываем данные сессии
      const sessionData: WBSessionData = {
        cookies: this.safeDecrypt(session.cookiesEncrypted),
        localStorage: this.safeDecrypt(session.localStorageEncrypted),
        sessionStorage: this.safeDecrypt(session.sessionStorageEncrypted),
        userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: session.createdAt.getTime()
      };

      this.logger.info('Active session retrieved', { 
        userId,
        sessionAge: Math.round(sessionAge / (60 * 60 * 1000)) + ' hours'
      });

      return sessionData;
    } catch (error) {
      this.logger.error('Failed to get active session', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId 
      });
      return null;
    }
  }

  /**
   * Валидация сессии
   */
  async validateSession(userId: string): Promise<SessionValidationResult> {
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
          isValid: false,
          needsRefresh: false,
          error: 'No active session found'
        };
      }

      const now = new Date();
      const sessionAge = now.getTime() - session.createdAt.getTime();
      const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
      const refreshThreshold = this.config.maxSessionAge * this.config.refreshThreshold;

      // Проверяем, истекла ли сессия
      if (session.expiresAt < now) {
        await this.deactivateSession(session.id);
        return {
          isValid: false,
          needsRefresh: false,
          error: 'Session expired'
        };
      }

      // Проверяем, нужно ли обновление
      const needsRefresh = sessionAge > refreshThreshold;

      return {
        isValid: true,
        needsRefresh,
        sessionAge
      };
    } catch (error) {
      this.logger.error('Session validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId 
      });
      return {
        isValid: false,
        needsRefresh: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Автоматическое обновление сессии
   */
  async autoRefreshSession(userId: string): Promise<SessionRefreshResult> {
    try {
      this.logger.info('Starting automatic session refresh', { userId });

      const validation = await this.validateSession(userId);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error || 'Session is not valid'
        };
      }

      if (!validation.needsRefresh) {
        this.logger.info('Session does not need refresh', { userId });
        return {
          success: true,
          error: 'Session is still valid'
        };
      }

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
          error: 'Current session not found'
        };
      }

      // Обновляем сессию
      const refreshResult = await this.refreshSessionData(currentSession.id, userId);
      
      if (refreshResult.success) {
        this.logger.info('Session refreshed successfully', { userId });
        
        // Отправляем уведомление
        if (this.config.notificationEnabled) {
          await this.sendRefreshNotification(userId, refreshResult.newExpiresAt!);
        }
      }

      return refreshResult;
    } catch (error) {
      this.logger.error('Auto refresh failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId 
      });
      return {
        success: false,
        error: 'Auto refresh failed'
      };
    }
  }

  /**
   * Обновление данных сессии
   */
  private async refreshSessionData(sessionId: string, userId: string): Promise<SessionRefreshResult> {
    let page: Page | null = null;

    try {
      // Запускаем браузер
      await this.launchBrowser();
      page = await this.createPage();

      // Получаем текущую сессию
      const currentSession = await prisma.wBSession.findUnique({
        where: { id: sessionId }
      });

      if (!currentSession) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      // Восстанавливаем сессию
      await this.restoreSession(page, {
        cookies: this.safeDecrypt(currentSession.cookiesEncrypted),
        localStorage: this.safeDecrypt(currentSession.localStorageEncrypted),
        sessionStorage: this.safeDecrypt(currentSession.sessionStorageEncrypted),
        userAgent: currentSession.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: currentSession.createdAt.getTime()
      });

      // Переходим на страницу поставок для обновления сессии
      await page.goto(SUPPLIES_URL, { waitUntil: 'domcontentloaded' });
      await this.delay(3000);

      // Проверяем, не перенаправило ли на авторизацию
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('seller-auth.wildberries.ru')) {
        await this.deactivateSession(sessionId);
        return {
          success: false,
          error: 'Session expired, redirect to auth page'
        };
      }

      // Собираем обновленные данные
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
      const newExpiresAt = new Date(Date.now() + this.config.maxSessionAge);
      const updatedSession = await prisma.wBSession.update({
        where: { id: sessionId },
        data: {
          cookiesEncrypted: encrypt(JSON.stringify(cookies)),
          localStorageEncrypted: encrypt(localStorage),
          sessionStorageEncrypted: encrypt(sessionStorage),
          updatedAt: new Date(),
          expiresAt: newExpiresAt,
          lastUsedAt: new Date()
        }
      });

      return {
        success: true,
        sessionId: updatedSession.id,
        newExpiresAt
      };

    } catch (error) {
      this.logger.error('Session refresh failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        sessionId, 
        userId 
      });
      return {
        success: false,
        error: 'Session refresh failed'
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Восстановление сессии в браузере
   */
  private async restoreSession(page: Page, sessionData: WBSessionData): Promise<void> {
    try {
      // Устанавливаем cookies
      const cookies = JSON.parse(sessionData.cookies);
      await page.context().addCookies(cookies);

      // Переходим на главную страницу
      await page.goto(WB_BASE_URL, { waitUntil: 'domcontentloaded' });
      await this.delay(2000);

      // Восстанавливаем localStorage и sessionStorage
      await page.evaluate(({ localStorage, sessionStorage }) => {
        try {
          if (localStorage) {
            const localData = JSON.parse(localStorage);
            Object.keys(localData).forEach(key => {
              window.localStorage.setItem(key, localData[key]);
            });
          }
          if (sessionStorage) {
            const sessionData = JSON.parse(sessionStorage);
            Object.keys(sessionData).forEach(key => {
              window.sessionStorage.setItem(key, sessionData[key]);
            });
          }
        } catch (error) {
          console.warn('Failed to restore storage:', error);
        }
      }, { localStorage: sessionData.localStorage, sessionStorage: sessionData.sessionStorage });

      this.logger.info('Session restored successfully');
    } catch (error) {
      this.logger.error('Session restoration failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Деактивация сессии
   */
  async deactivateSession(sessionId: string): Promise<void> {
    try {
      await prisma.wBSession.update({
        where: { id: sessionId },
        data: { isActive: false }
      });
      this.logger.info('Session deactivated', { sessionId });
    } catch (error) {
      this.logger.error('Failed to deactivate session', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        sessionId 
      });
    }
  }

  /**
   * Очистка истекших сессий
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.wBSession.updateMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { 
              AND: [
                { isActive: true },
                { 
                  createdAt: { 
                    lt: new Date(Date.now() - this.config.maxSessionAge) 
                  } 
                }
              ]
            }
          ]
        },
        data: { isActive: false }
      });

      this.logger.info('Expired sessions cleaned up', { count: result.count });
      return result.count;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }

  /**
   * Отправка уведомления об обновлении сессии
   */
  private async sendRefreshNotification(userId: string, expiresAt: Date): Promise<void> {
    try {
      const message = `🔄 Сессия WB автоматически обновлена\n\n` +
        `📅 Новая дата истечения: ${expiresAt.toLocaleString('ru-RU')}\n` +
        `⏰ Время до истечения: ${Math.round((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))} дней`;

      await this.telegramService.sendNotification(userId, message);
    } catch (error) {
      this.logger.warn('Failed to send refresh notification', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId 
      });
    }
  }

  /**
   * Безопасная расшифровка
   */
  private safeDecrypt(encryptedData: string | null | undefined): string {
    if (!encryptedData) {
      return '';
    }
    try {
      return decrypt(encryptedData);
    } catch (error) {
      this.logger.warn('Decryption failed, returning empty string', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return '';
    }
  }

  /**
   * Запуск браузера
   */
  private async launchBrowser(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless: true,
      args: BROWSER_ARGS
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow'
    });
  }

  /**
   * Создание страницы
   */
  private async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    return page;
  }

  /**
   * Задержка
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Остановка сервиса
   */
  async stop(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.logger.info('WBSessionManager stopped');
  }
}

// ===== SINGLETON INSTANCE =====

export const wbSessionManager = getUnifiedSessionManager();
