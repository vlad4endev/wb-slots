import { Page, Browser, BrowserContext } from 'playwright';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logging';
import { EnhancedWBAuthChecker } from '@/lib/utils/enhanced-wb-auth-checker';
import crypto from 'crypto';

/**
 * ЕДИНЫЙ УНИФИЦИРОВАННЫЙ МЕНЕДЖЕР СЕССИЙ WB
 * 
 * Решает проблему множественных менеджеров сессий:
 * - Объединяет всю функциональность в одном классе
 * - Использует единую схему БД
 * - Обеспечивает совместимость с существующим кодом
 * - Предотвращает конфликты и дублирование
 */

export interface UnifiedSessionData {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  ipAddress?: string;
  metadata: {
    fingerprint: string;
    createdAt: Date;
    lastValidated: Date;
    version: string;
  };
}

export interface UnifiedValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
  needsReauth?: boolean;
  details?: {
    urlCheck: boolean;
    domCheck: boolean;
    storageCheck: boolean;
    cookiesCheck: boolean;
    authCheck: boolean;
    redirectCheck: boolean;
  };
  needsRefresh?: boolean;
  metadata?: {
    sessionId?: string;
    expiresAt?: Date;
    cookieCount?: number;
    lastValidated?: Date;
  };
}

export interface UnifiedSessionInfo {
  id: string;
  sessionId: string;
  isActive: boolean;
  expiresAt?: Date | null;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface SessionLock {
  release: () => void;
}

export class UnifiedWBSessionManager {
  private logger = logger;
  private encryptionKey: Buffer;
  private locks = new Map<string, Promise<SessionLock>>();
  private authChecker: EnhancedWBAuthChecker;
  private readonly VERSION = '3.0.0-unified';
  private readonly IMPORTANT_COOKIE_NAMES = ['WBToken', 'wbx_session_id', 'x-supplier-id'];

  constructor(encryptionKey: string) {
    // logger уже инициализирован
    this.authChecker = new EnhancedWBAuthChecker();
    
    // Поддержка разных форматов ключа
    if (encryptionKey.length === 64) {
      // Hex формат
      this.encryptionKey = Buffer.from(encryptionKey, 'hex');
    } else if (encryptionKey.length === 44) {
      // Base64 формат
      this.encryptionKey = Buffer.from(encryptionKey, 'base64');
    } else {
      // Прямой ключ (32 байта)
      this.encryptionKey = Buffer.from(encryptionKey.padEnd(32, '0').substring(0, 32));
    }
    
    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be 32 bytes');
    }
  }

  // ===== ОСНОВНЫЕ МЕТОДЫ =====

  /**
   * Создание новой сессии (совместимость с WBSessionManager.createSession)
   */
  async createSession(userId: string, page: Page): Promise<string> {
    this.logger.info({ userId }, '🔧 Creating unified WB session');

    try {
      // 1. Собираем все данные сессии
      const sessionData = await this.collectSessionData(userId, page);
      
      // 2. Создаем отпечаток целостности
      const fingerprint = this.createFingerprint(sessionData);
      sessionData.metadata.fingerprint = fingerprint;
      sessionData.metadata.version = this.VERSION;
      
      // 3. Шифруем данные
      const cookiesEncrypted = this.encrypt(JSON.stringify(sessionData.cookies));
      const localStorageEncrypted = this.encrypt(JSON.stringify(sessionData.localStorage));
      const sessionStorageEncrypted = this.encrypt(JSON.stringify(sessionData.sessionStorage));
      
      // 4. Сохраняем в БД с правильной схемой
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
      
      // Получаем IP адрес из запроса (если доступен)
      const ipAddress = sessionData.ipAddress || await this.getIpAddress();
      
      // Создаем объект с данными сессии
      const fullSessionData = {
        sessionId,
        cookies: sessionData.cookies,
        localStorage: sessionData.localStorage,
        sessionStorage: sessionData.sessionStorage,
        userAgent: sessionData.userAgent,
        ipAddress,
        expiresAt: expiresAt.toISOString(),
        metadata: sessionData.metadata,
      };
      
      const encryptedSessionData = this.encrypt(JSON.stringify(fullSessionData));
      
      await prisma.wBSession.upsert({
        where: { userId },
        update: {
          sessionData: encryptedSessionData,
          expiresAt, // Сохраняем expiresAt в БД
          isActive: true,
          lastValidated: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          sessionData: encryptedSessionData,
          expiresAt, // Сохраняем expiresAt в БД
          isActive: true,
          lastValidated: new Date(),
          ipAddress,
        },
      });

      this.logger.info('✅ Unified session created successfully', { 
        userId, 
        sessionId,
        fingerprint: fingerprint.substring(0, 8) + '...',
        cookiesCount: sessionData.cookies.length,
        localStorageKeys: Object.keys(sessionData.localStorage).length,
        sessionStorageKeys: Object.keys(sessionData.sessionStorage).length
      });

      return sessionId;
    } catch (error) {
      this.logger.error({ 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, '❌ Failed to create unified session');
      throw error;
    }
  }

  /**
   * Восстановление сессии (совместимость с WBSessionManager.restoreSession)
   */
  async restoreSession(userId: string, page: Page): Promise<UnifiedValidationResult> {
    const lockKey = `restore_${userId}`;
    
    try {
      // Получаем блокировку для предотвращения состояний гонки
      const lock = await this.acquireLock(lockKey);
      
      try {
        this.logger.info({ userId }, '🔄 Restoring unified WB session');

        // 1. Получаем активную сессию
        let session = await this.getActiveSession(userId);
        if (!session) {
          return {
            isValid: false,
            reason: 'No active session found',
            suggestions: ['Create new session through authentication']
          };
        }

        // 2. Проверяем срок действия (с поддержкой старых сессий без expiresAt)
        const now = new Date();
        let expiresAt = session.expiresAt;
        
        // Если нет expiresAt (старая сессия), устанавливаем его автоматически
        if (!expiresAt) {
          expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней с момента обновления
          // Обновляем сессию в фоне, не блокируя операцию
          prisma.wBSession.update({
            where: { id: session.id },
            data: { expiresAt }
          }).catch(error => {
            this.logger.warn({ 
              sessionId: session.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to update expiresAt for old session');
          });
        }
        
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const refreshThreshold = 24 * 60 * 60 * 1000; // 24 часа до истечения
        
        if (expiresAt < now) {
          // Сессия истекла - требуется новая авторизация
          await this.deactivateSession(session.id);
          return {
            isValid: false,
            reason: 'Session expired',
            needsReauth: true,
            suggestions: ['Create new session through authentication']
          };
        }

        // 3. Автоматическое обновление при близком истечении
        if (timeUntilExpiry < refreshThreshold && timeUntilExpiry > 0) {
          this.logger.info({ 
            userId,
            timeUntilExpiry: Math.floor(timeUntilExpiry / (60 * 60 * 1000)) + ' hours'
          }, '🔄 Session expiring soon, refreshing automatically');
          
          try {
            // Попытка обновить сессию автоматически
            await this.refreshSession(userId, page, session.id);
            // После обновления получаем обновленную сессию
            const updatedSession = await this.getActiveSession(userId);
            if (updatedSession) {
              // Используем обновленную сессию
              session = updatedSession;
            }
          } catch (refreshError) {
            this.logger.warn({
              userId,
              error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
            }, '⚠️ Auto-refresh failed, continuing with existing session');
          }
        }

        // 4. Расшифровываем данные
        const sessionData = await this.decryptSessionData(session);
        
        // 5. Валидируем cookies перед применением
        const validationResult = this.validateCookies(sessionData.cookies);
        if (!validationResult.isValid) {
          this.logger.warn({
            userId,
            reason: validationResult.reason,
            validCookies: validationResult.validCookies?.length || 0,
            totalCookies: sessionData.cookies.length
          }, '⚠️ Invalid cookies detected');
          
          if (validationResult.validCookies && validationResult.validCookies.length > 0) {
            sessionData.cookies = validationResult.validCookies;
          } else {
            await this.deactivateSession(session.id);
            return {
              isValid: false,
              reason: 'No valid cookies found',
              needsReauth: true,
              suggestions: ['Create new session through authentication']
            };
          }
        }
        
        if (sessionData.cookies?.length) {
          const adjustedCookies = sessionData.cookies.map(cookie => ({
            ...cookie,
            domain: cookie.domain?.includes('wildberries.ru') ? cookie.domain : '.wildberries.ru',
            sameSite: 'Lax' as const,
            secure: true,
            path: cookie.path || '/',
          }));

          try {
            await page.context().addCookies(adjustedCookies);
            this.logger.info('🍪 WB cookies successfully restored (restoreSession)', {
              userId,
              count: adjustedCookies.length,
              domains: [...new Set(adjustedCookies.map(c => c.domain))],
            });
          } catch (cookieError) {
            this.logger.error('❌ Failed to apply cookies in restoreSession', {
              userId,
              error: cookieError instanceof Error ? cookieError.message : 'Unknown error',
            });
          }
        } else {
          this.logger.warn('⚠️ No cookies found in saved session (restoreSession)', { userId });
        }

        const cookiesBeforeNav = await page.context().cookies('https://seller.wildberries.ru');
        this.logger.info('🔍 Cookies before navigation (restoreSession)', {
          count: cookiesBeforeNav.length,
          names: cookiesBeforeNav.map(cookie => cookie.name),
          domains: [...new Set(cookiesBeforeNav.map(cookie => cookie.domain))],
        });

        // 6. Восстанавливаем сессию в браузере
        const cookiesApplied = await this.applySessionToPage(page, sessionData);
        if (!cookiesApplied) {
          return {
            isValid: false,
            reason: 'cookies_not_applied',
            needsRefresh: true,
            suggestions: ['Re-authenticate to refresh WB cookies', 'Verify session cookies in storage']
          };
        }
        
        // 7. Валидируем восстановленную сессию
        const validation = await this.validateSession(page);
        
        if (!validation.isValid) {
          this.logger.warn({
            userId,
            reason: validation.reason,
            suggestions: validation.suggestions
          }, '⚠️ Session validation failed after restore');
          
          return {
            isValid: false,
            reason: validation.reason,
            suggestions: validation.suggestions,
            details: validation.details
          };
        }

        // 8. Обновляем время последнего использования
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { lastUsedAt: new Date() }
        });

        this.logger.info({ 
          userId, 
          sessionId: session.id 
        }, '✅ Unified session restored successfully');

        return {
          isValid: true,
          metadata: {
            sessionId: session.id,
            lastValidated: session.lastValidated
          }
        };

      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error({ 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, '❌ Failed to restore unified session');
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Восстановление сессии через BrowserContext (совместимость с EnhancedSessionManager)
   */
  async restoreSessionContext(userId: string, context: BrowserContext): Promise<UnifiedValidationResult> {
    try {
      this.logger.info({ userId }, '🔄 Restoring unified session via context');

      // 1. Получаем активную сессию
      const session = await this.getActiveSession(userId);
      
      if (!session) {
        return {
          isValid: false,
          needsRefresh: true,
          reason: 'No active session found'
        };
      }

      // 2. Проверяем валидность сессии
      const validationResult = await this.validateSessionData(session);
      
      if (!validationResult.isValid) {
        return validationResult;
      }

      // 3. Расшифровываем данные
      const sessionData = await this.decryptSessionData(session);
      
      // 4. Валидируем cookies перед применением
      const cookieValidation = this.validateCookies(sessionData.cookies);
      if (!cookieValidation.isValid && (!cookieValidation.validCookies || cookieValidation.validCookies.length === 0)) {
        this.logger.warn({
          userId,
          reason: cookieValidation.reason
        }, '⚠️ No valid cookies to restore');
        return {
          isValid: false,
          needsRefresh: true,
          reason: cookieValidation.reason || 'No valid cookies found'
        };
      }

      // 5. Нормализуем cookies, добавляя недостающие поля
      const validCookies = (cookieValidation.validCookies || sessionData.cookies).map(c => ({
        ...c,
        path: c.path || '/',
        httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
        secure: c.secure !== undefined ? c.secure : true,
        sameSite: (c.sameSite || 'Lax') as 'Strict' | 'Lax' | 'None',
        domain: this.normalizeCookieDomain(c.domain)
      }));
      
      // 6. Восстанавливаем cookies
      if (validCookies.length) {
        const adjustedCookies = validCookies.map(cookie => ({
          ...cookie,
          domain: '.wildberries.ru',
          sameSite: 'Lax' as const,
          secure: true,
        }));

        try {
          await context.addCookies(adjustedCookies);
          this.logger.info('🍪 WB cookies successfully restored (context)', {
            userId,
            count: adjustedCookies.length,
            domains: [...new Set(adjustedCookies.map(c => c.domain))],
          });
        } catch (cookieError) {
          this.logger.error('❌ Failed to apply cookies to context', {
            userId,
            error: cookieError instanceof Error ? cookieError.message : 'Unknown error',
          });

          let applied = 0;
          for (const cookie of adjustedCookies) {
            try {
              await context.addCookies([cookie]);
              applied++;
            } catch {
              // игнорируем, продолжим со следующими
            }
          }

          if (!applied) {
            throw new Error('Failed to add any cookies to context');
          }

          this.logger.info('✅ Applied cookies partially to context', {
            userId,
            applied,
            total: adjustedCookies.length,
          });
        }
      } else {
        this.logger.warn('⚠️ No cookies found in saved session (context restore)', { userId });
      }

      const cookiesAfter = await context.cookies('https://seller.wildberries.ru');
      const hasWB = cookiesAfter.some(cookie =>
        this.IMPORTANT_COOKIE_NAMES.includes(cookie.name)
      );

      if (!hasWB) {
        this.logger.warn({
          userId,
          cookieCount: cookiesAfter.length
        }, 'No WB cookies applied after context restore');

        return {
          isValid: false,
          needsRefresh: true,
          reason: 'cookies_not_applied',
          suggestions: ['Re-authenticate in WB popup', 'Verify WB cookies are saved to database']
        };
      }
      
      // 7. Восстанавливаем localStorage и sessionStorage через первую страницу контекста
      // Это нужно сделать после перехода на страницу, так что создаем временную страницу
      const tempPage = await context.newPage();
      try {
        // Переходим на целевой домен для установки cookies и storage
        await tempPage.goto('https://seller.wildberries.ru', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Восстанавливаем localStorage
        if (Object.keys(sessionData.localStorage || {}).length > 0) {
          await tempPage.evaluate((localStorageData) => {
            try {
              Object.keys(localStorageData).forEach(key => {
                window.localStorage.setItem(key, localStorageData[key]);
              });
            } catch (error) {
              console.warn('Failed to restore localStorage:', error);
            }
          }, sessionData.localStorage);
        }
        
        // Восстанавливаем sessionStorage
        if (Object.keys(sessionData.sessionStorage || {}).length > 0) {
          await tempPage.evaluate((sessionStorageData) => {
            try {
              Object.keys(sessionStorageData).forEach(key => {
                window.sessionStorage.setItem(key, sessionStorageData[key]);
              });
            } catch (error) {
              console.warn('Failed to restore sessionStorage:', error);
            }
          }, sessionData.sessionStorage);
        }
        
        await tempPage.close();
      } catch (storageError) {
        this.logger.warn({
          userId,
          error: storageError instanceof Error ? storageError.message : 'Unknown error'
        }, '⚠️ Failed to restore storage, cookies may be sufficient');
        await tempPage.close().catch(() => {});
      }
      
      // 8. Обновляем время последнего использования
      await this.updateSessionUsage(session.id);

      this.logger.info({ 
        userId, 
        sessionId: session.id,
        cookiesRestored: validCookies.length,
        localStorageKeys: Object.keys(sessionData.localStorage || {}).length,
        sessionStorageKeys: Object.keys(sessionData.sessionStorage || {}).length
      }, '✅ Unified session restored via context successfully');

      return {
        isValid: true,
        needsRefresh: false,
        metadata: {
          sessionId: session.id,
          lastValidated: session.lastValidated,
          cookieCount: validCookies.length
        }
      };

    } catch (error) {
      this.logger.error({ 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, '❌ Failed to restore session via context');
      
      return {
        isValid: false,
        needsRefresh: true,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Валидация сессии (совместимость с WBSessionManager.validateSession)
   */
  async validateSession(page: Page): Promise<UnifiedValidationResult> {
    try {
      // Используем улучшенный проверщик авторизации
      const authResult = await this.authChecker.checkWBAuthentication(page);
      
      // Проверяем на редиректы
      const hasRedirects = await this.authChecker.checkForLoginRedirects(page);
      
      if (hasRedirects) {
        // Предотвращаем редиректы
        await this.authChecker.preventLoginRedirects(page);
      }

      return {
        isValid: authResult.isAuthenticated && !hasRedirects,
        reason: authResult.isAuthenticated ? undefined : authResult.reason,
        suggestions: authResult.suggestions,
        details: authResult.details
      };

    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Session validation error');
      
      return {
        isValid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestions: ['Session validation failed due to technical error']
      };
    }
  }

  /**
   * Проверка статуса авторизации (совместимость с AutoBookingService)
   */
  async checkAuthenticationStatus(page: Page): Promise<{ isAuthenticated: boolean; details?: any }> {
    try {
      const validation = await this.validateSession(page);
      return {
        isAuthenticated: validation.isValid,
        details: validation.details
      };
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Authentication status check error');
      return { isAuthenticated: false };
    }
  }

  /**
   * Обновление сессии (совместимость с WBSessionManager.refreshSession)
   */
  async refreshSession(userId: string, page: Page, sessionId?: string): Promise<void> {
    this.logger.info({ userId, sessionId }, '🔄 Refreshing unified session');

    try {
      // 1. Получаем текущую сессию
      const session = await this.getActiveSession(userId);
      if (!session) {
        throw new Error('No active session to refresh');
      }

      // 2. Собираем обновленные данные
      const sessionData = await this.collectSessionData(userId, page);
      const fingerprint = this.createFingerprint(sessionData);
      
      // 3. Шифруем обновленные данные
      const cookiesEncrypted = this.encrypt(JSON.stringify(sessionData.cookies));
      const localStorageEncrypted = this.encrypt(JSON.stringify(sessionData.localStorage));
      const sessionStorageEncrypted = this.encrypt(JSON.stringify(sessionData.sessionStorage));
      
      // 4. Обновляем сессию в БД
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
      await prisma.wBSession.update({
        where: { id: session.id },
        data: {
          sessionData: this.encrypt(JSON.stringify({
            sessionId: session.id,
            cookies: sessionData.cookies,
            localStorage: sessionData.localStorage,
            sessionStorage: sessionData.sessionStorage,
            userAgent: sessionData.userAgent,
            ipAddress: sessionData.ipAddress,
            expiresAt: expiresAt.toISOString(),
            metadata: {
              ...sessionData.metadata,
              fingerprint,
              lastValidated: new Date(),
              version: this.VERSION
            }
          })),
          expiresAt, // Обновляем expiresAt в БД
          lastUsedAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info({ 
        userId, 
        sessionId: session.id 
      }, '✅ Unified session refreshed successfully');

    } catch (error) {
      this.logger.error('❌ Failed to refresh unified session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Деактивация сессии (совместимость с WBSessionManager.deactivateSession)
   */
  async deactivateSession(sessionId: string, reason?: string): Promise<void> {
    try {
      await prisma.wBSession.update({
        where: { id: sessionId },
        data: { 
          isActive: false,
          deactivationReason: reason || 'Manual deactivation',
          deactivatedAt: new Date()
        }
      });

      this.logger.info({ sessionId, reason }, '🔒 Session deactivated');
    } catch (error) {
      this.logger.error({ 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, '❌ Failed to deactivate session');
      throw error;
    }
  }

  /**
   * Получение активной сессии (совместимость с WBSessionManager.getActiveSession)
   */
  async getActiveSession(userId: string): Promise<any> {
    return await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Получение информации о сессии (совместимость с WBSessionManager.getSessionInfo)
   */
  async getSessionInfo(userId: string): Promise<UnifiedSessionInfo | null> {
    const session = await this.getActiveSession(userId);
    if (!session) return null;

    return {
      id: session.id,
      sessionId: session.id, // Используем id как sessionId
      isActive: session.isActive,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt
    };
  }

  /**
   * Получение статистики данных сессии (количество cookies, localStorage, sessionStorage)
   */
  async getSessionDataStats(userId: string): Promise<{
    cookies: number;
    localStorage: number;
    sessionStorage: number;
  }> {
    const session = await this.getActiveSession(userId);
    if (!session) {
      return { cookies: 0, localStorage: 0, sessionStorage: 0 };
    }

    try {
      const sessionData = await this.decryptSessionData(session);
      return {
        cookies: sessionData.cookies?.length || 0,
        localStorage: Object.keys(sessionData.localStorage || {}).length,
        sessionStorage: Object.keys(sessionData.sessionStorage || {}).length
      };
    } catch (error) {
      this.logger.warn({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get session data stats');
      return { cookies: 0, localStorage: 0, sessionStorage: 0 };
    }
  }

  /**
   * Получение статистики сессий
   */
  async getSessionStats(userId: string): Promise<{
    activeSessions: number;
    totalSessions: number;
    lastLoginAt?: Date;
    averageSessionDuration?: number;
  }> {
    try {
      const [activeSessions, totalSessions, lastSession] = await Promise.all([
        prisma.wBSession.count({
          where: { userId, isActive: true }
        }),
        prisma.wBSession.count({
          where: { userId }
        }),
        prisma.wBSession.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        })
      ]);

      let averageSessionDuration: number | undefined;
      if (lastSession) {
        const duration = lastSession.lastUsedAt 
          ? lastSession.lastUsedAt.getTime() - lastSession.createdAt.getTime()
          : Date.now() - lastSession.createdAt.getTime();
        averageSessionDuration = duration / (1000 * 60 * 60); // в часах
      }

      return {
        activeSessions,
        totalSessions,
        lastLoginAt: lastSession?.createdAt,
        averageSessionDuration
      };
    } catch (error) {
      this.logger.error('Failed to get session stats', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  // ===== СТАТИЧЕСКИЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ =====

  /**
   * Статический метод создания сессии (совместимость с WBSessionManager.createSession)
   */
  static async createSession(userId: string, sessionData: any): Promise<UnifiedSessionInfo> {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    const manager = new UnifiedWBSessionManager(process.env.ENCRYPTION_KEY);
    
    // Шифруем cookies
    const encryptedCookies = manager.encrypt(JSON.stringify(sessionData.cookies));

    // Создаем сессию в базе данных
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    const session = await prisma.wBSession.create({
      data: {
        userId,
        sessionData: encryptedCookies,
        expiresAt, // Сохраняем expiresAt в БД
        ipAddress: sessionData.ipAddress,
        isActive: true,
        lastValidated: new Date(),
      },
    });

    return {
      id: session.id,
      sessionId: sessionData.sessionId || session.id,
      isActive: session.isActive,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
    };
  }

  // ===== ПРИВАТНЫЕ МЕТОДЫ =====

  /**
   * Валидация cookies перед применением
   */
  private validateCookies(cookies: Array<{
    name: string;
    value: string;
    domain: string;
    expires?: number;
    [key: string]: any;
  }>): { isValid: boolean; reason?: string; validCookies?: typeof cookies } {
    const now = Date.now();
    const validCookies: typeof cookies = [];
    let invalidCount = 0;
    let expiredCount = 0;
    let missingFieldsCount = 0;

    for (const cookie of cookies) {
      // Проверяем срок действия
      if (cookie.expires && cookie.expires * 1000 <= now) {
        expiredCount++;
        continue;
      }

      // Проверяем обязательные поля
      if (!cookie.name || !cookie.value || !cookie.domain) {
        missingFieldsCount++;
        continue;
      }

      validCookies.push(cookie);
    }

    if (validCookies.length === 0) {
      return {
        isValid: false,
        reason: `No valid cookies found. Expired: ${expiredCount}, Invalid format: ${missingFieldsCount}, Total: ${cookies.length}`,
        validCookies: []
      };
    }

    if (validCookies.length < cookies.length) {
      return {
        isValid: true,
        reason: `Some cookies invalid. Valid: ${validCookies.length}, Invalid: ${invalidCount + expiredCount + missingFieldsCount}, Total: ${cookies.length}`,
        validCookies
      };
    }

    return {
      isValid: true,
      validCookies
    };
  }

  /**
   * Получение IP адреса (заглушка для будущей реализации)
   */
  private async getIpAddress(): Promise<string | undefined> {
    // В будущем можно добавить получение IP из request headers
    // Для сейчас возвращаем undefined
    return undefined;
  }

  /**
   * Сбор данных сессии из страницы
   */
  private async collectSessionData(userId: string, page: Page): Promise<UnifiedSessionData & { ipAddress?: string }> {
    try {
      // Собираем cookies
      const cookies = await page.context().cookies();
      
      // Собираем localStorage
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      // Собираем sessionStorage
      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return data;
      });

      // Получаем viewport
      const viewport = page.viewportSize() || { width: 1920, height: 1080 };

      return {
        cookies,
        localStorage,
        sessionStorage,
        userAgent: await page.evaluate(() => navigator.userAgent),
        viewport,
        metadata: {
          createdAt: new Date(),
          lastValidated: new Date(),
          version: this.VERSION
        }
      };
    } catch (error) {
      this.logger.error('Failed to collect session data', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Применение сессии к странице с предотвращением редиректов
   */
  private async applySessionToPage(page: Page, sessionData: UnifiedSessionData): Promise<boolean> {
    try {
      // ИСПРАВЛЕНО: Сначала переходим на домен, ПОТОМ вызываем evaluate()
      
      // 1. Установка viewport (до навигации)
      await page.setViewportSize(sessionData.viewport);
      
      // 2. КРИТИЧНО: Переход на целевой домен ПЕРЕД любыми evaluate()
      await page.goto('https://seller.wildberries.ru', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // 3. ТОЛЬКО ПОСЛЕ успешной навигации активируем предотвращение редиректов
      try {
        await this.authChecker.preventLoginRedirects(page);
      } catch (preventError) {
        this.logger.warn('Failed to setup login redirect prevention (continuing)', {
          error: preventError instanceof Error ? preventError.message : 'Unknown'
        });
      }

      // 4. Валидация и применение cookies
      const now = Date.now();
      const validCookies = sessionData.cookies.filter(cookie => {
        // Проверяем срок действия
        if (cookie.expires && cookie.expires * 1000 <= now) {
          this.logger.debug('Cookie expired, skipping', { 
            name: cookie.name,
            domain: cookie.domain 
          });
          return false;
        }
        
        // Проверяем обязательные поля
        if (!cookie.name || !cookie.value || !cookie.domain) {
          this.logger.debug('Invalid cookie format, skipping', { 
            name: cookie.name,
            hasValue: !!cookie.value,
            hasDomain: !!cookie.domain
          });
          return false;
        }
        
        return true;
      });

      if (validCookies.length === 0) {
        throw new Error('No valid cookies to restore');
      }

      const normalizedCookies = validCookies.map(cookie => ({
        ...cookie,
        domain: '.wildberries.ru',
        sameSite: 'Lax' as const,
        secure: true,
      }));

      if (normalizedCookies.length) {
        try {
          await page.context().addCookies(normalizedCookies);
          this.logger.info('🍪 WB cookies successfully restored (page)', {
            total: normalizedCookies.length,
            domains: [...new Set(normalizedCookies.map(c => c.domain))],
          });
        } catch (cookieError) {
          this.logger.error('❌ Failed to apply cookies to page', {
            error: cookieError instanceof Error ? cookieError.message : 'Unknown error',
          });

          for (const cookie of normalizedCookies) {
            try {
              await page.context().addCookies([cookie]);
            } catch (singleCookieError) {
              this.logger.warn('Failed to set individual cookie during page restore', {
                name: cookie.name,
                error: singleCookieError instanceof Error ? singleCookieError.message : 'Unknown error',
              });
            }
          }
        }
      } else {
        this.logger.warn('⚠️ No cookies found in saved session (page restore)');
      }

      const cookiesAfter = await page.context().cookies('https://seller.wildberries.ru');
      this.logger.info('🔍 Current cookies before navigation', {
        count: cookiesAfter.length,
        names: cookiesAfter.map(cookie => cookie.name),
      });

      const hasWB = cookiesAfter.some(cookie => this.IMPORTANT_COOKIE_NAMES.includes(cookie.name));

      if (!hasWB) {
        this.logger.warn('No WB cookies applied after restore', {
          count: cookiesAfter.length
        });
        return false;
      }

      // 5. Применение localStorage и sessionStorage
      await page.evaluate((data) => {
        // Очищаем существующие данные
        localStorage.clear();
        sessionStorage.clear();

        // Применяем localStorage
        Object.entries(data.localStorage).forEach(([key, value]) => {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            // Логируем ошибки, но не прерываем выполнение
            // console.warn удален для безопасности
          }
        });

        // Применяем sessionStorage
        Object.entries(data.sessionStorage).forEach(([key, value]) => {
          try {
            sessionStorage.setItem(key, value);
          } catch (e) {
            // Логируем ошибки, но не прерываем выполнение
            // console.warn удален для безопасности
          }
        });
      }, sessionData);

      // 6. Перезагружаем страницу для применения всех изменений
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

      // 7. Проверяем на редиректы после перезагрузки
      const hasRedirects = await this.authChecker.checkForLoginRedirects(page);
      if (hasRedirects) {
        this.logger.warn('⚠️ Login redirects detected after session application, preventing them');
        await this.authChecker.preventLoginRedirects(page);
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to apply session to page', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Валидация данных сессии
   */
  private async validateSessionData(session: any): Promise<UnifiedValidationResult> {
    try {
      // Проверяем срок действия (с поддержкой старых сессий без expiresAt)
      const expiresAt = session.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      if (expiresAt < new Date()) {
        return {
          isValid: false,
          reason: 'Session expired',
          suggestions: ['Create new session through authentication']
        };
      }

      // Проверяем отпечаток целостности
      // if (session.fingerprint) {
      //   // Здесь можно добавить дополнительную проверку целостности
      // }

      return {
        isValid: true
      };
    } catch (error) {
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private normalizeCookieDomain(domain?: string | null): string {
    if (!domain || domain.trim().length === 0) {
      return '.wildberries.ru';
    }

    const trimmed = domain.trim();
    if (trimmed === 'wildberries.ru') {
      return '.wildberries.ru';
    }

    if (!trimmed.startsWith('.')) {
      return `.${trimmed}`;
    }

    return trimmed;
  }

  /**
   * Расшифровка данных сессии с поддержкой обратной совместимости
   * Поддерживает старый формат (cookiesEncrypted, localStorageEncrypted, sessionStorageEncrypted)
   * и новый формат (sessionData)
   */
  private async decryptSessionData(session: any): Promise<UnifiedSessionData> {
    try {
      // Проверяем, какой формат данных используется
      const hasOldFormat = (session as any).cookiesEncrypted || (session as any).localStorageEncrypted;
      const hasNewFormat = session.sessionData && session.sessionData.trim() !== '';
      
      if (hasOldFormat && !hasNewFormat) {
        // Старый формат - мигрируем в новый формат автоматически
        this.logger.info('🔄 Detected old session format, migrating to new format', {
          sessionId: session.id,
          userId: session.userId
        });
        
        return await this.migrateOldFormatToNew(session);
      }
      
      if (!hasNewFormat) {
        throw new Error('No session data found in old or new format');
      }

      // Новый формат - стандартная расшифровка
      const sessionData = JSON.parse(this.decrypt(session.sessionData));

      return {
        cookies: sessionData.cookies || [],
        localStorage: sessionData.localStorage || {},
        sessionStorage: sessionData.sessionStorage || {},
        userAgent: sessionData.userAgent || session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: sessionData.viewport || { width: 1920, height: 1080 },
        ipAddress: sessionData.ipAddress,
        metadata: sessionData.metadata || {
          createdAt: session.createdAt,
          lastValidated: session.lastValidated || new Date(),
          version: sessionData.metadata?.version || this.VERSION,
          fingerprint: sessionData.metadata?.fingerprint || ''
        }
      };
    } catch (error) {
      this.logger.error('Failed to decrypt session data', { 
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      // Пытаемся восстановить из старого формата как fallback
      try {
        if ((session as any).cookiesEncrypted) {
          this.logger.warn('Attempting fallback to old format', { sessionId: session.id });
          return await this.migrateOldFormatToNew(session);
        }
      } catch (fallbackError) {
        // Если и fallback не сработал, пробрасываем исходную ошибку
      }
      
      throw error;
    }
  }

  /**
   * Миграция данных из старого формата в новый
   * Безопасно преобразует cookiesEncrypted/localStorageEncrypted/sessionStorageEncrypted в sessionData
   */
  private async migrateOldFormatToNew(session: any): Promise<UnifiedSessionData> {
    try {
      // Импортируем decrypt из encryption для старого формата
      const { decrypt: decryptOld } = await import('@/lib/encryption');
      
      // Расшифровываем старые данные
      let cookies: any[] = [];
      let localStorage: Record<string, string> = {};
      let sessionStorage: Record<string, string> = {};

      try {
        if ((session as any).cookiesEncrypted) {
          const cookiesStr = decryptOld((session as any).cookiesEncrypted);
          cookies = cookiesStr ? JSON.parse(cookiesStr) : [];
        }
      } catch (error) {
        this.logger.warn('Failed to decrypt old cookies format', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      try {
        if ((session as any).localStorageEncrypted) {
          const localStorageStr = decryptOld((session as any).localStorageEncrypted);
          localStorage = localStorageStr ? JSON.parse(localStorageStr) : {};
        }
      } catch (error) {
        this.logger.warn('Failed to decrypt old localStorage format', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      try {
        if ((session as any).sessionStorageEncrypted) {
          const sessionStorageStr = decryptOld((session as any).sessionStorageEncrypted);
          sessionStorage = sessionStorageStr ? JSON.parse(sessionStorageStr) : {};
        }
      } catch (error) {
        this.logger.warn('Failed to decrypt old sessionStorage format', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Создаем структурированные данные в новом формате
      const sessionId = (session as any).sessionId || session.id || crypto.randomUUID();
      const expiresAt = session.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      // Создаем fingerprint для мигрированных данных
      const fingerprint = (session as any).fingerprint || this.createFingerprint({
        cookies,
        localStorage,
        sessionStorage,
        userAgent: session.userAgent || ''
      });
      
      const migratedSessionData: UnifiedSessionData = {
        cookies: cookies.map(c => ({
          ...c,
          path: c.path || '/',
          httpOnly: c.httpOnly || false,
          secure: c.secure !== undefined ? c.secure : true,
          sameSite: c.sameSite || 'Lax' as 'Strict' | 'Lax' | 'None'
        })),
        localStorage,
        sessionStorage,
        userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
        ipAddress: session.ipAddress,
        metadata: {
          fingerprint,
          createdAt: session.createdAt || new Date(),
          lastValidated: session.lastValidated || new Date(),
          version: this.VERSION
        }
      };

      // Сохраняем в новом формате (в фоне, не блокируем текущую операцию)
      this.migrateSessionToNewFormat(session.id, migratedSessionData, expiresAt).catch(error => {
        this.logger.error('Background migration failed', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });

      return migratedSessionData;
    } catch (error) {
      this.logger.error('Failed to migrate old format', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Сохранение мигрированных данных в новый формат (асинхронно, в фоне)
   */
  private async migrateSessionToNewFormat(
    sessionId: string,
    sessionData: UnifiedSessionData,
    expiresAt: Date
  ): Promise<void> {
    try {
      const fullSessionData = {
        sessionId,
        cookies: sessionData.cookies,
        localStorage: sessionData.localStorage,
        sessionStorage: sessionData.sessionStorage,
        userAgent: sessionData.userAgent,
        ipAddress: sessionData.ipAddress,
        expiresAt: expiresAt.toISOString(),
        metadata: sessionData.metadata
      };

      const encryptedSessionData = this.encrypt(JSON.stringify(fullSessionData));

      await prisma.wBSession.update({
        where: { id: sessionId },
        data: {
          sessionData: encryptedSessionData,
          expiresAt,
          lastValidated: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info('✅ Session migrated to new format', {
        sessionId,
        cookiesCount: sessionData.cookies.length
      });
    } catch (error) {
      // Не пробрасываем ошибку, чтобы не блокировать основную операцию
      this.logger.warn('Failed to save migrated session (will retry on next access)', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Обновление времени использования сессии
   */
  private async updateSessionUsage(sessionId: string): Promise<void> {
    await prisma.wBSession.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() }
    });
  }

  /**
   * Создание отпечатка целостности
   */
  private createFingerprint(sessionData: UnifiedSessionData): string {
    const data = {
      cookies: sessionData.cookies.map(c => `${c.name}=${c.value}`).sort(),
      localStorage: Object.keys(sessionData.localStorage).sort(),
      sessionStorage: Object.keys(sessionData.sessionStorage).sort(),
      userAgent: sessionData.userAgent
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Получение блокировки
   */
  private async acquireLock(key: string): Promise<SessionLock> {
    if (this.locks.has(key)) {
      return await this.locks.get(key)!;
    }

    const lockPromise = new Promise<SessionLock>((resolve) => {
      let released = false;
      
      const lock: SessionLock = {
        release: () => {
          if (!released) {
            released = true;
            this.locks.delete(key);
          }
        }
      };

      // Имитируем асинхронную блокировку
      setTimeout(() => resolve(lock), 0);
    });

    this.locks.set(key, lockPromise);
    return await lockPromise;
  }

  /**
   * Шифрование данных
   */
  private encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error('Encryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Расшифровка данных
   */
  private decrypt(encryptedData: string): string {
    try {
      if (!encryptedData || encryptedData === '{}') {
        return '{}';
      }

      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Получение всех сессий пользователя
   */
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      const sessions = await prisma.wBSession.findMany({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
        // Используем все поля, включая expiresAt (колонка уже добавлена через db push)
      });

      // Преобразуем сессии, гарантируя наличие sessionId
      const formattedSessions = sessions.map(session => {
        // Пытаемся извлечь sessionId из зашифрованных данных
        let sessionId: string | undefined;
        
        try {
          if (session.sessionData) {
            const decrypted = this.decrypt(session.sessionData);
            const data = JSON.parse(decrypted);
            sessionId = data.sessionId;
          }
        } catch (error) {
          // Если не удалось расшифровать, игнорируем ошибку
          this.logger.debug({ 
            sessionId: session.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Failed to extract sessionId from sessionData');
        }

        return {
          id: session.id,
          sessionId: sessionId || session.id, // Используем id как fallback
          isActive: session.isActive,
          expiresAt: (session as any).expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Дефолтное значение если отсутствует
          createdAt: session.createdAt,
          lastUsedAt: session.lastUsedAt,
          lastValidated: session.lastValidated,
          deactivatedAt: session.deactivatedAt,
          deactivationReason: session.deactivationReason,
          ipAddress: session.ipAddress,
          useCount: session.useCount,
        };
      });

      this.logger.info({ 
        userId, 
        sessionCount: formattedSessions.length 
      }, '📋 Retrieved user sessions');

      return formattedSessions;
    } catch (error) {
      this.logger.error({ 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, '❌ Failed to get user sessions');
      throw error;
    }
  }

  /**
   * Статический метод для получения сессий пользователя
   */
  static async getUserSessions(userId: string): Promise<any[]> {
    const manager = getUnifiedSessionManager();
    return manager.getUserSessions(userId);
  }
}
