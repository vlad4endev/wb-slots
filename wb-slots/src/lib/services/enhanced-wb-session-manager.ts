import { Page, Browser } from 'playwright';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/logging/logger';
import { EnhancedWBAuthChecker } from '@/lib/utils/enhanced-wb-auth-checker';
import crypto from 'crypto';

/**
 * Улучшенный менеджер сессий WB с полной поддержкой
 * localStorage, sessionStorage и защитой от состояний гонки
 */

export interface EnhancedSessionData {
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
  metadata: {
    fingerprint: string;
    createdAt: Date;
    lastValidated: Date;
    version: string;
  };
}

export interface SessionValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
  details?: {
    urlCheck: boolean;
    domCheck: boolean;
    storageCheck: boolean;
    cookiesCheck: boolean;
    authCheck: boolean;
  };
}

export interface SessionLock {
  release: () => void;
}

export interface SessionRestoreResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  warnings?: string[];
}

export class EnhancedWBSessionManager {
  private logger: Logger;
  private encryptionKey: Buffer;
  private locks = new Map<string, Promise<SessionLock>>();
  private authChecker: EnhancedWBAuthChecker;
  private readonly VERSION = '2.0.0';

  constructor(encryptionKey: string) {
    this.logger = new Logger();
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

  /**
   * Создание новой сессии после успешной авторизации
   */
  async createSession(userId: string, page: Page): Promise<string> {
    this.logger.info('🔧 Creating enhanced WB session', { userId });

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
      
      // 4. Сохраняем в БД с новой схемой
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
      
      await prisma.wBSession.upsert({
        where: { userId },
        update: {
          sessionId,
          cookiesEncrypted,
          localStorageEncrypted,
          sessionStorageEncrypted,
          userAgent: sessionData.userAgent,
          isActive: true,
          expiresAt,
          fingerprint,
          metadata: sessionData.metadata,
          updatedAt: new Date(),
        },
        create: {
          userId,
          sessionId,
          cookiesEncrypted,
          localStorageEncrypted,
          sessionStorageEncrypted,
          userAgent: sessionData.userAgent,
          isActive: true,
          expiresAt,
          fingerprint,
          metadata: sessionData.metadata,
        },
      });

      this.logger.info('✅ Enhanced session created successfully', { 
        userId, 
        sessionId,
        fingerprint: fingerprint.substring(0, 8) + '...',
        cookiesCount: sessionData.cookies.length,
        localStorageKeys: Object.keys(sessionData.localStorage).length,
        sessionStorageKeys: Object.keys(sessionData.sessionStorage).length
      });

      return sessionId;
    } catch (error) {
      this.logger.error('❌ Failed to create enhanced session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Восстановление сессии с защитой от состояний гонки
   */
  async restoreSession(userId: string, page: Page): Promise<SessionRestoreResult> {
    const lockKey = `restore_${userId}`;
    
    try {
      // Получаем блокировку для предотвращения состояний гонки
      const lock = await this.acquireLock(lockKey);
      
      try {
        this.logger.info('🔄 Restoring enhanced session', { userId });

        // 1. Получаем активную сессию
        const session = await this.getActiveSession(userId);
        if (!session) {
          return {
            success: false,
            error: 'No active session found'
          };
        }

        // 2. Проверяем срок действия
        if (session.expiresAt < new Date()) {
          await this.deactivateSession(session.id);
          return {
            success: false,
            error: 'Session expired'
          };
        }

        // 3. Расшифровываем данные
        const sessionData = await this.decryptSessionData(session);
        
        // 4. Восстанавливаем сессию в браузере
        await this.applySessionToPage(page, sessionData);
        
        // 5. Валидируем восстановленную сессию
        const validation = await this.validateSession(page);
        
        if (!validation.isValid) {
          this.logger.warn('⚠️ Session validation failed after restore', {
            userId,
            reason: validation.reason,
            suggestions: validation.suggestions
          });
          
          return {
            success: false,
            error: `Session validation failed: ${validation.reason}`,
            warnings: validation.suggestions
          };
        }

        // 6. Обновляем время последнего использования
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { lastUsedAt: new Date() }
        });

        this.logger.info('✅ Enhanced session restored successfully', { 
          userId, 
          sessionId: session.sessionId 
        });

        return {
          success: true,
          sessionId: session.sessionId
        };

      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error('❌ Failed to restore enhanced session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Обновление данных сессии
   */
  async refreshSession(userId: string, page: Page): Promise<SessionRestoreResult> {
    this.logger.info('🔄 Refreshing enhanced session', { userId });

    try {
      // 1. Получаем текущую сессию
      const session = await this.getActiveSession(userId);
      if (!session) {
        return {
          success: false,
          error: 'No active session to refresh'
        };
      }

      // 2. Собираем обновленные данные
      const sessionData = await this.collectSessionData(userId, page);
      const fingerprint = this.createFingerprint(sessionData);
      
      // 3. Шифруем обновленные данные
      const cookiesEncrypted = this.encrypt(JSON.stringify(sessionData.cookies));
      const localStorageEncrypted = this.encrypt(JSON.stringify(sessionData.localStorage));
      const sessionStorageEncrypted = this.encrypt(JSON.stringify(sessionData.sessionStorage));
      
      // 4. Обновляем сессию в БД
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const updatedSession = await prisma.wBSession.update({
        where: { id: session.id },
        data: {
          cookiesEncrypted,
          localStorageEncrypted,
          sessionStorageEncrypted,
          fingerprint,
          metadata: {
            ...sessionData.metadata,
            fingerprint,
            lastValidated: new Date(),
            version: this.VERSION
          },
          expiresAt: newExpiresAt,
          lastUsedAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info('✅ Enhanced session refreshed successfully', { 
        userId, 
        sessionId: updatedSession.sessionId 
      });

      return {
        success: true,
        sessionId: updatedSession.sessionId
      };

    } catch (error) {
      this.logger.error('❌ Failed to refresh enhanced session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Валидация сессии с использованием улучшенного проверщика
   */
  async validateSession(page: Page): Promise<SessionValidationResult> {
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
      this.logger.error('Session validation error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        isValid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestions: ['Session validation failed due to technical error']
      };
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

  // ===== PRIVATE METHODS =====

  /**
   * Сбор данных сессии из страницы
   */
  private async collectSessionData(userId: string, page: Page): Promise<EnhancedSessionData> {
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
          fingerprint: '',
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
  private async applySessionToPage(page: Page, sessionData: EnhancedSessionData): Promise<void> {
    try {
      // 1. Активируем предотвращение редиректов
      await this.authChecker.preventLoginRedirects(page);

      // 2. Переход на целевой домен
      await page.goto('https://seller.wildberries.ru', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // 3. Установка viewport
      await page.setViewportSize(sessionData.viewport);

      // 4. Применение cookies для ВСЕХ доменов
      for (const cookie of sessionData.cookies) {
        try {
          await page.context().addCookies([{
            ...cookie,
            domain: cookie.domain.startsWith('.') 
              ? cookie.domain 
              : `.${cookie.domain}`
          }]);
        } catch (cookieError) {
          this.logger.warn('Failed to set cookie', { 
            cookie: cookie.name, 
            error: cookieError instanceof Error ? cookieError.message : 'Unknown error' 
          });
        }
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
            console.warn('Failed to set localStorage item:', key);
          }
        });

        // Применяем sessionStorage
        Object.entries(data.sessionStorage).forEach(([key, value]) => {
          try {
            sessionStorage.setItem(key, value);
          } catch (e) {
            console.warn('Failed to set sessionStorage item:', key);
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

    } catch (error) {
      this.logger.error('Failed to apply session to page', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Получение активной сессии
   */
  private async getActiveSession(userId: string) {
    return await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Деактивация сессии
   */
  private async deactivateSession(sessionId: string): Promise<void> {
    await prisma.wBSession.update({
      where: { id: sessionId },
      data: { isActive: false }
    });
  }

  /**
   * Расшифровка данных сессии
   */
  private async decryptSessionData(session: any): Promise<EnhancedSessionData> {
    try {
      const cookies = JSON.parse(this.decrypt(session.cookiesEncrypted));
      const localStorage = JSON.parse(this.decrypt(session.localStorageEncrypted || '{}'));
      const sessionStorage = JSON.parse(this.decrypt(session.sessionStorageEncrypted || '{}'));

      return {
        cookies,
        localStorage,
        sessionStorage,
        userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
        metadata: session.metadata || {
          fingerprint: session.fingerprint || '',
          createdAt: session.createdAt,
          lastValidated: new Date(),
          version: this.VERSION
        }
      };
    } catch (error) {
      this.logger.error('Failed to decrypt session data', { 
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Создание отпечатка целостности
   */
  private createFingerprint(sessionData: EnhancedSessionData): string {
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

      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
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
}
