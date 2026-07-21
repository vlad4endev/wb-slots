import { Page, Browser } from 'playwright';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/logging/logger';
import crypto from 'crypto';

/**
 * Критически важный менеджер сессий WB с полной поддержкой
 * localStorage, sessionStorage и защитой от состояний гонки
 */

export interface SessionData {
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
  };
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
  details?: {
    urlCheck: boolean;
    domCheck: boolean;
    storageCheck: boolean;
    cookiesCheck: boolean;
  };
}

export interface SessionLock {
  release: () => void;
}

export class WBSessionManager {
  private logger: Logger;
  private encryptionKey: Buffer;
  private locks = new Map<string, Promise<SessionLock>>();

  constructor(encryptionKey: string) {
    this.logger = new Logger();
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
    
    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }
  }

  /**
   * Создание новой сессии после успешной авторизации
   */
  async createSession(userId: string, page: Page): Promise<string> {
    this.logger.info('🔧 Creating new WB session', { userId });

    try {
      // 1. Собираем все данные сессии
      const sessionData = await this.collectSessionData(userId, page);
      
      // 2. Создаем отпечаток целостности
      const fingerprint = this.createFingerprint(sessionData);
      sessionData.metadata.fingerprint = fingerprint;
      
      // 3. Шифруем данные
      const encryptedData = this.encrypt(JSON.stringify(sessionData));
      
      // 4. Сохраняем в БД
      await prisma.wBSession.upsert({
        where: { userId },
        update: {
          sessionData: encryptedData,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          sessionData: encryptedData,
          isActive: true,
        },
      });

      this.logger.info('✅ Session created successfully', { 
        userId, 
        fingerprint: fingerprint.substring(0, 8) + '...',
        cookiesCount: sessionData.cookies.length,
        localStorageKeys: Object.keys(sessionData.localStorage).length,
        sessionStorageKeys: Object.keys(sessionData.sessionStorage).length
      });

      return fingerprint;
    } catch (error) {
      this.logger.error('❌ Failed to create session', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Восстановление сессии с защитой от состояний гонки
   */
  async restoreSession(userId: string, page: Page): Promise<ValidationResult> {
    const lock = await this.acquireLock(userId);
    
    try {
      this.logger.info('🔄 Restoring WB session', { userId });

      // 1. Загружаем сессию из БД
      const dbSession = await prisma.wBSession.findFirst({
        where: { userId, isActive: true }
      });

      if (!dbSession) {
        return {
          isValid: false,
          reason: 'No active session found in database',
          suggestions: ['Create new session through authentication']
        };
      }

      // 2. Расшифровываем данные
      let sessionData: SessionData;
      try {
        const decrypted = this.decrypt(dbSession.sessionData);
        sessionData = JSON.parse(decrypted);
      } catch (error) {
        this.logger.error('❌ Failed to decrypt session data', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
        return {
          isValid: false,
          reason: 'Session data corrupted or encryption key mismatch',
          suggestions: ['Create new session through authentication']
        };
      }

      // 3. Проверяем отпечаток целостности
      const currentFingerprint = this.createFingerprint(sessionData);
      if (currentFingerprint !== sessionData.metadata.fingerprint) {
        this.logger.warn('⚠️ Session fingerprint mismatch', { userId });
        return {
          isValid: false,
          reason: 'Session data integrity check failed',
          suggestions: ['Create new session through authentication']
        };
      }

      // 4. Применяем данные в правильном порядке
      await this.applySessionData(page, sessionData);

      // 5. Валидируем авторизацию
      const validation = await this.validateAuthentication(page);
      
      if (validation.isValid) {
        // Обновляем время последней валидации
        await prisma.wBSession.update({
          where: { id: dbSession.id },
          data: { updatedAt: new Date() }
        });
        
        this.logger.info('✅ Session restored and validated successfully', { userId });
      } else {
        this.logger.warn('⚠️ Session restored but validation failed', { 
          userId, 
          reason: validation.reason 
        });
      }

      return validation;
    } finally {
      lock.release();
    }
  }

  /**
   * Получение или создание сессии (для авто бронирования)
   */
  async getOrCreateSession(userId: string, browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    
    try {
      // Пытаемся восстановить существующую сессию
      const restoration = await this.restoreSession(userId, page);
      
      if (restoration.isValid) {
        this.logger.info('✅ Using existing session', { userId });
        return page;
      } else {
        this.logger.warn('⚠️ Existing session invalid, requiring re-authentication', { 
          userId, 
          reason: restoration.reason 
        });
        
        // Деактивируем недействительную сессию
        await this.deactivateSession(userId, restoration.reason || 'Invalid session');
        
        throw new Error(`Session invalid: ${restoration.reason}. Re-authentication required.`);
      }
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Сбор всех данных сессии
   */
  private async collectSessionData(userId: string, page: Page): Promise<SessionData> {
    this.logger.info('📊 Collecting session data', { userId });

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

    // Получаем User Agent
    const userAgent = await page.evaluate(() => navigator.userAgent);

    // Получаем размеры viewport
    const viewport = await page.viewportSize() || { width: 1920, height: 1080 };

    return {
      cookies,
      localStorage,
      sessionStorage,
      userAgent,
      viewport,
      metadata: {
        fingerprint: '', // Будет установлен позже
        createdAt: new Date(),
        lastValidated: new Date()
      }
    };
  }

  /**
   * Применение данных сессии в правильном порядке
   */
  private async applySessionData(page: Page, sessionData: SessionData): Promise<void> {
    this.logger.info('🔧 Applying session data in correct order');

    // 1. КРИТИЧНО: сначала переход на домен
    await page.goto('https://seller.wildberries.ru', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 2. User Agent (устанавливается через context)
    // await page.setUserAgent(sessionData.userAgent);

    // 3. Viewport
    await page.setViewportSize(sessionData.viewport);

    // 4. Cookies для ВСЕХ доменов с правильным форматом
    for (const cookie of sessionData.cookies) {
      try {
        await page.context().addCookies([{
          ...cookie,
          domain: cookie.domain.startsWith('.') 
            ? cookie.domain 
            : `.${cookie.domain}`
        }]);
      } catch (error) {
        this.logger.warn('⚠️ Failed to set cookie', { 
          name: cookie.name, 
          domain: cookie.domain,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 5. localStorage и sessionStorage
    await page.evaluate((data) => {
      // Очищаем существующие данные
      localStorage.clear();
      sessionStorage.clear();
      
      // Устанавливаем новые данные
      Object.entries(data.localStorage).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      Object.entries(data.sessionStorage).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    }, sessionData);

    // 6. ЖДЕМ применения (критично!)
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.logger.info('✅ Session data applied successfully');
  }

  /**
   * Множественная валидация авторизации (4 проверки)
   */
  async validateAuthentication(page: Page): Promise<ValidationResult> {
    this.logger.info('🔍 Validating authentication with 4-level check');

    const checks = {
      urlCheck: await this.checkAuthenticationByURL(page),
      domCheck: await this.checkAuthenticationByDOM(page),
      storageCheck: await this.checkAuthenticationByStorage(page),
      cookiesCheck: await this.checkAuthenticationByCookies(page)
    };

    const passedChecks = Object.values(checks).filter(check => check.isValid).length;
    const isValid = passedChecks >= 3; // Требуется 75% проверок

    this.logger.info('📊 Authentication validation results', {
      passedChecks,
      totalChecks: 4,
      isValid,
      details: {
        urlCheck: checks.urlCheck.isValid,
        domCheck: checks.domCheck.isValid,
        storageCheck: checks.storageCheck.isValid,
        cookiesCheck: checks.cookiesCheck.isValid
      }
    });

    if (!isValid) {
      const failedChecks = Object.entries(checks)
        .filter(([_, check]) => !check.isValid)
        .map(([name, check]) => `${name}: ${check.reason}`)
        .join(', ');

      return {
        isValid: false,
        reason: `Authentication failed: ${failedChecks}`,
        suggestions: [
          'Check if cookies are set for correct domains',
          'Verify localStorage contains authentication data',
          'Ensure user is not on login page',
          'Create new session through authentication'
        ],
        details: {
          urlCheck: checks.urlCheck.isValid,
          domCheck: checks.domCheck.isValid,
          storageCheck: checks.storageCheck.isValid,
          cookiesCheck: checks.cookiesCheck.isValid
        }
      };
    }

    return {
      isValid: true,
      details: {
        urlCheck: checks.urlCheck.isValid,
        domCheck: checks.domCheck.isValid,
        storageCheck: checks.storageCheck.isValid,
        cookiesCheck: checks.cookiesCheck.isValid
      }
    };
  }

  /**
   * Проверка 1: URL - не находимся ли на странице входа
   */
  private async checkAuthenticationByURL(page: Page): Promise<{ isValid: boolean; reason?: string }> {
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login') || 
        currentUrl.includes('seller-auth.wildberries.ru') ||
        currentUrl.includes('/about-portal/ru/ru')) {
      return {
        isValid: false,
        reason: 'On login or landing page'
      };
    }

    if (currentUrl.includes('seller.wildberries.ru')) {
      return { isValid: true };
    }

    return {
      isValid: false,
      reason: 'Not on WB seller domain'
    };
  }

  /**
   * Проверка 2: DOM - есть ли элементы авторизованного пользователя
   */
  private async checkAuthenticationByDOM(page: Page): Promise<{ isValid: boolean; reason?: string }> {
    const selectors = [
      '#app-content-id',
      '.app_Content__children__2mrvJ',
      '.Main-layout__QrWWjB8D-d',
      '.Main-layout__content-block__FKdy15MrbO',
      '.Page__T92U2hfQ0I',
      '.All-supplies-inner',
      '[data-testid="user-menu"]',
      '.user-info',
      '.profile-menu',
      '.header-user',
      '.user-dropdown',
      '.supplies-management',
      '.seller-header'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          return { isValid: true };
        }
      } catch (error) {
        // Игнорируем ошибки поиска элементов
      }
    }

    return {
      isValid: false,
      reason: 'No authenticated user elements found'
    };
  }

  /**
   * Проверка 3: Storage - есть ли данные авторизации
   */
  private async checkAuthenticationByStorage(page: Page): Promise<{ isValid: boolean; reason?: string }> {
    const storageData = await page.evaluate(() => {
      const localStorageKeys = Object.keys(localStorage);
      const sessionStorageKeys = Object.keys(sessionStorage);
      
      return {
        localStorageKeys,
        sessionStorageKeys,
        hasLocalStorage: localStorageKeys.length > 0,
        hasSessionStorage: sessionStorageKeys.length > 0
      };
    });

    if (storageData.hasLocalStorage || storageData.hasSessionStorage) {
      return { isValid: true };
    }

    return {
      isValid: false,
      reason: 'No authentication data in storage'
    };
  }

  /**
   * Проверка 4: Cookies - есть ли cookies авторизации
   */
  private async checkAuthenticationByCookies(page: Page): Promise<{ isValid: boolean; reason?: string }> {
    const cookies = await page.context().cookies();
    
    // Ищем важные cookies для авторизации
    const authCookies = cookies.filter(cookie => 
      cookie.name.includes('auth') ||
      cookie.name.includes('token') ||
      cookie.name.includes('session') ||
      cookie.name.includes('user') ||
      cookie.name.includes('supplier')
    );

    if (authCookies.length > 0) {
      return { isValid: true };
    }

    return {
      isValid: false,
      reason: 'No authentication cookies found'
    };
  }

  /**
   * Создание отпечатка целостности
   */
  private createFingerprint(sessionData: SessionData): string {
    const data = JSON.stringify({
      userId: sessionData.metadata.createdAt, // Используем время создания как уникальный идентификатор
      cookieCount: sessionData.cookies.length,
      localStorageKeys: Object.keys(sessionData.localStorage).sort(),
      sessionStorageKeys: Object.keys(sessionData.sessionStorage).sort(),
      userAgent: sessionData.userAgent,
      createdAt: sessionData.metadata.createdAt
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Шифрование данных AES-256-GCM
   */
  private encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    
    // Формат: IV:encrypted:authTag
    return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
  }

  /**
   * Расшифровка данных AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    const [ivHex, encrypted, tagHex] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Защита от состояний гонки - получение блокировки
   */
  private async acquireLock(userId: string): Promise<SessionLock> {
    // Ждем освобождения существующей блокировки
    while (this.locks.has(userId)) {
      await this.locks.get(userId);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Создаем новую блокировку
    let releaseLock: () => void;
    const lockPromise = new Promise<SessionLock>(resolve => {
      releaseLock = () => {
        this.locks.delete(userId);
        resolve({ release: () => {} });
      };
    });
    
    this.locks.set(userId, lockPromise);
    
    return {
      release: () => {
        releaseLock();
      }
    };
  }

  /**
   * Деактивация сессии
   */
  async deactivateSession(userId: string, reason: string): Promise<void> {
    this.logger.info('🔒 Deactivating session', { userId, reason });

    await prisma.wBSession.updateMany({
      where: { userId, isActive: true },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });

    // Очищаем кэш блокировок
    this.locks.delete(userId);
  }

  /**
   * Получение статистики сессий
   */
  async getSessionStats(userId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    lastValidated?: Date;
    lastUsed?: Date;
  }> {
    const stats = await prisma.wBSession.aggregate({
      where: { userId },
      _count: { id: true }
    });

    const activeStats = await prisma.wBSession.aggregate({
      where: { userId, isActive: true },
      _count: { id: true },
      _max: { lastUsedAt: true }
    });

    return {
      totalSessions: stats._count.id,
      activeSessions: activeStats._count?.id || 0,
      lastUsed: activeStats._max?.lastUsedAt || undefined
    };
  }
}
