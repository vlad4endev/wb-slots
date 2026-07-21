import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { advancedAuthManager } from './advanced-auth-manager';
import { Logger } from '../logging/logger';
import { prisma } from '../prisma';
import { encrypt, decrypt } from '../encryption';

// ===== TYPES & INTERFACES =====

export interface WBAuthConfig {
  userId: string;
  headless?: boolean;
  timeout?: number;
  enableAntiDetection?: boolean;
  enableSessionMonitoring?: boolean;
  enableAutoRefresh?: boolean;
  onProgress?: (message: string) => void;
  onSuccess?: (sessionData: any) => void;
  onError?: (error: string) => void;
  onSecurityAlert?: (alert: SecurityAlert) => void;
}

export interface SecurityAlert {
  type: 'SUSPICIOUS_ACTIVITY' | 'CAPTCHA_DETECTED' | 'SESSION_EXPIRED' | 'LOGIN_FAILED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface WBAuthResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  securityAlerts?: SecurityAlert[];
  sessionData?: {
    cookies: Record<string, string>;
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    userAgent: string;
    timestamp: number;
  };
}

export interface SessionMonitor {
  isActive: boolean;
  lastCheck: Date;
  checkInterval: number;
  maxRetries: number;
  currentRetries: number;
}

// ===== ADVANCED WB AUTH SERVICE =====

export class AdvancedWBAuthService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private isActive = false;
  private config: WBAuthConfig | null = null;
  private sessionMonitor: SessionMonitor | null = null;
  private securityAlerts: SecurityAlert[] = [];

  constructor() {
    this.logger = new Logger('INFO', { service: 'AdvancedWBAuthService' });
  }

  // ===== MAIN AUTH METHODS =====

  /**
   * Запуск продвинутой WB авторизации
   */
  async startAdvancedAuth(config: WBAuthConfig): Promise<WBAuthResult> {
    if (this.isActive) {
      throw new Error('WB Auth service is already active');
    }

    this.isActive = true;
    this.config = config;
    this.securityAlerts = [];

    try {
      this.logger.info('🚀 Starting advanced WB auth', { userId: config.userId });
      config.onProgress?.('Инициализация продвинутой авторизации...');

      // 1. Проверяем существующие сессии
      const existingSession = await this.checkExistingSession(config.userId);
      if (existingSession) {
        config.onProgress?.('Найдена активная сессия. Проверка валидности...');
        const isValid = await this.validateExistingSession(existingSession);
        if (isValid) {
          config.onSuccess?.(existingSession);
          return {
            success: true,
            sessionId: existingSession.sessionId,
            sessionData: existingSession,
          };
        }
      }

      // 2. Запускаем браузер с продвинутыми настройками
      await this.launchAdvancedBrowser(config);

      // 3. Настраиваем мониторинг безопасности
      await this.setupSecurityMonitoring();

      // 4. Переходим на страницу авторизации
      config.onProgress?.('Переход на страницу авторизации Wildberries...');
      await this.navigateToAuthPage();

      // 5. Ждем авторизации пользователя
      config.onProgress?.('Ожидание авторизации пользователя...');
      const authResult = await this.waitForUserAuth();

      if (authResult.success) {
        // 6. Сохраняем сессию
        config.onProgress?.('Сохранение сессии...');
        const sessionId = await this.saveAdvancedSession(authResult.sessionData!);

        // 7. Запускаем мониторинг сессии
        if (config.enableSessionMonitoring) {
          await this.startSessionMonitoring(sessionId);
        }

        config.onSuccess?.(authResult.sessionData);
        return {
          success: true,
          sessionId,
          sessionData: authResult.sessionData,
          securityAlerts: this.securityAlerts,
        };
      } else {
        return {
          success: false,
          error: authResult.error,
          securityAlerts: this.securityAlerts,
        };
      }

    } catch (error) {
      this.logger.error('❌ Advanced WB auth failed', { error: error.message, userId: config.userId });
      config.onError?.(error.message);
      return {
        success: false,
        error: error.message,
        securityAlerts: this.securityAlerts,
      };
    } finally {
      // НЕ закрываем браузер автоматически - ждем действий пользователя
      this.logger.info('✅ Advanced WB auth process completed');
    }
  }

  /**
   * Принудительное сохранение сессии
   */
  async forceSaveSession(): Promise<WBAuthResult> {
    if (!this.page || !this.config) {
      throw new Error('No active session to save');
    }

    try {
      this.logger.info('💾 Force saving session', { userId: this.config.userId });
      this.config.onProgress?.('Принудительное сохранение сессии...');

      // Собираем данные сессии
      const sessionData = await this.collectSessionData();

      // Сохраняем сессию
      const sessionId = await this.saveAdvancedSession(sessionData);

      this.config.onSuccess?.(sessionData);
      return {
        success: true,
        sessionId,
        sessionData,
        securityAlerts: this.securityAlerts,
      };

    } catch (error) {
      this.logger.error('❌ Failed to force save session', { error: error.message });
      this.config?.onError?.(error.message);
      return {
        success: false,
        error: error.message,
        securityAlerts: this.securityAlerts,
      };
    }
  }

  /**
   * Закрытие сервиса
   */
  async close(): Promise<void> {
    try {
      this.logger.info('🔒 Closing advanced WB auth service');

      // Останавливаем мониторинг
      if (this.sessionMonitor) {
        this.sessionMonitor.isActive = false;
      }

      // Закрываем браузер
      await this.cleanup();

      this.isActive = false;
      this.config = null;
      this.sessionMonitor = null;
      this.securityAlerts = [];

      this.logger.info('✅ Advanced WB auth service closed');

    } catch (error) {
      this.logger.error('❌ Error closing service', { error: error.message });
    }
  }

  // ===== PRIVATE METHODS =====

  private async checkExistingSession(userId: string): Promise<any> {
    try {
      return await advancedAuthManager.getActiveWBSession(userId);
    } catch (error) {
      this.logger.warn('⚠️ Failed to check existing session', { error: error.message });
      return null;
    }
  }

  private async validateExistingSession(session: any): Promise<boolean> {
    try {
      // Проверяем срок действия
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        this.logger.info('📅 Session expired', { sessionId: session.sessionId });
        return false;
      }

      // Проверяем валидность cookies
      if (!session.cookies || Object.keys(session.cookies).length === 0) {
        this.logger.info('🍪 No cookies in session', { sessionId: session.sessionId });
        return false;
      }

      // Проверяем наличие ключевых cookies WB
      const requiredCookies = ['WBToken', 'x-supplier-id', 'SessionId'];
      const hasRequiredCookies = requiredCookies.some(cookie => session.cookies[cookie]);

      if (!hasRequiredCookies) {
        this.logger.info('🍪 Missing required WB cookies', { sessionId: session.sessionId });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('❌ Session validation error', { error: error.message });
      return false;
    }
  }

  private async launchAdvancedBrowser(config: WBAuthConfig): Promise<void> {
    try {
      this.logger.info('🌐 Launching advanced browser');

      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ];

      if (config.enableAntiDetection) {
        browserArgs.push(
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
      }

      this.browser = await chromium.launch({
        headless: config.headless ?? false,
        args: browserArgs,
        timeout: config.timeout ?? 30000,
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
        permissions: ['geolocation'],
        geolocation: { latitude: 55.7558, longitude: 37.6176 }, // Moscow
        extraHTTPHeaders: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
      });

      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(config.timeout ?? 30000);

      // Настраиваем антидетект
      if (config.enableAntiDetection) {
        await this.setupAntiDetection();
      }

      this.logger.info('✅ Advanced browser launched successfully');

    } catch (error) {
      this.logger.error('❌ Failed to launch browser', { error: error.message });
      throw error;
    }
  }

  private async setupAntiDetection(): Promise<void> {
    if (!this.page) return;

    try {
      // Удаляем признаки автоматизации
      await this.page.addInitScript(() => {
        // Удаляем webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Переопределяем plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Переопределяем languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ru-RU', 'ru', 'en-US', 'en'],
        });

        // Переопределяем permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      this.logger.info('✅ Anti-detection setup completed');

    } catch (error) {
      this.logger.warn('⚠️ Anti-detection setup failed', { error: error.message });
    }
  }

  private async setupSecurityMonitoring(): Promise<void> {
    if (!this.page) return;

    try {
      // Мониторинг капчи
      this.page.on('response', async (response) => {
        if (response.url().includes('captcha') || response.url().includes('recaptcha')) {
          await this.handleSecurityAlert({
            type: 'CAPTCHA_DETECTED',
            severity: 'HIGH',
            message: 'Обнаружена капча',
            details: { url: response.url(), status: response.status() },
            timestamp: new Date(),
          });
        }
      });

      // Мониторинг ошибок авторизации
      this.page.on('response', async (response) => {
        if (response.url().includes('login') && response.status() === 401) {
          await this.handleSecurityAlert({
            type: 'LOGIN_FAILED',
            severity: 'MEDIUM',
            message: 'Ошибка авторизации',
            details: { url: response.url(), status: response.status() },
            timestamp: new Date(),
          });
        }
      });

      // Мониторинг подозрительной активности
      this.page.on('console', async (msg) => {
        if (msg.type() === 'error' && msg.text().includes('security')) {
          await this.handleSecurityAlert({
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'MEDIUM',
            message: 'Подозрительная активность в консоли',
            details: { message: msg.text() },
            timestamp: new Date(),
          });
        }
      });

      this.logger.info('✅ Security monitoring setup completed');

    } catch (error) {
      this.logger.warn('⚠️ Security monitoring setup failed', { error: error.message });
    }
  }

  private async navigateToAuthPage(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      // Переходим на главную страницу WB
      await this.page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Ждем загрузки
      await this.page.waitForTimeout(3000);

      // Проверяем, нужна ли авторизация
      const currentUrl = this.page.url();
      this.logger.info('📍 Current URL after navigation', { url: currentUrl });

      if (currentUrl.includes('/login')) {
        this.config?.onProgress?.('Требуется авторизация. Войдите в личный кабинет...');
      } else if (currentUrl.includes('seller.wildberries.ru')) {
        this.config?.onProgress?.('Авторизация не требуется. Переход на страницу поставок...');
        await this.page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      }

    } catch (error) {
      this.logger.error('❌ Failed to navigate to auth page', { error: error.message });
      throw error;
    }
  }

  private async waitForUserAuth(): Promise<{ success: boolean; sessionData?: any; error?: string }> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      // Ждем успешной авторизации
      let attempts = 0;
      const maxAttempts = 60; // 5 минут с интервалом 5 секунд

      while (attempts < maxAttempts) {
        const currentUrl = this.page.url();
        
        // Проверяем, авторизован ли пользователь
        if (currentUrl.includes('seller.wildberries.ru') && !currentUrl.includes('/login')) {
          const isAuthenticated = await this.checkAuthenticationStatus();
          
          if (isAuthenticated) {
            this.config?.onProgress?.('Авторизация успешна! Сбор данных сессии...');
            
            // Переходим на страницу поставок для сбора данных
            await this.page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });
            
            await this.page.waitForTimeout(2000);
            
            // Собираем данные сессии
            const sessionData = await this.collectSessionData();
            
            return { success: true, sessionData };
          }
        }

        // Ждем 5 секунд перед следующей проверкой
        await this.page.waitForTimeout(5000);
        attempts++;
        
        this.config?.onProgress?.(`Ожидание авторизации... (${attempts}/${maxAttempts})`);
      }

      return { success: false, error: 'Timeout waiting for user authentication' };

    } catch (error) {
      this.logger.error('❌ Error waiting for user auth', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  private async checkAuthenticationStatus(): Promise<boolean> {
    if (!this.page) return false;

    try {
      return await this.page.evaluate(() => {
        // Ищем элементы, указывающие на авторизацию
        const authIndicators = [
          '[data-testid="user-menu"]',
          '.user-info',
          '.profile-menu',
          '[data-testid="profile"]',
          '.header-user',
          '.user-dropdown',
          '.supplies-management',
          '.supply-list',
          '.seller-header',
          '.user-avatar',
          '.user-name',
          '.logout-button',
        ];

        return authIndicators.some(selector => document.querySelector(selector) !== null);
      });
    } catch (error) {
      this.logger.warn('⚠️ Failed to check authentication status', { error: error.message });
      return false;
    }
  }

  private async collectSessionData(): Promise<any> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      this.logger.info('📊 Collecting session data');

      // Собираем cookies
      const cookies = await this.page.context().cookies();
      const cookiesObj: Record<string, string> = {};
      cookies.forEach(cookie => {
        cookiesObj[cookie.name] = cookie.value;
      });

      // Собираем localStorage
      const localStorage = await this.page.evaluate(() => {
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
      const sessionStorage = await this.page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return data;
      });

      const sessionData = {
        cookies: cookiesObj,
        localStorage,
        sessionStorage,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timestamp: Date.now(),
      };

      this.logger.info('✅ Session data collected', {
        cookies: Object.keys(cookiesObj).length,
        localStorage: Object.keys(localStorage).length,
        sessionStorage: Object.keys(sessionStorage).length,
      });

      return sessionData;

    } catch (error) {
      this.logger.error('❌ Failed to collect session data', { error: error.message });
      throw error;
    }
  }

  private async saveAdvancedSession(sessionData: any): Promise<string> {
    try {
      this.logger.info('💾 Saving advanced session');

      const sessionId = await advancedAuthManager.createWBSession(
        this.config!.userId,
        {
          cookies: sessionData.cookies,
          localStorage: sessionData.localStorage,
          sessionStorage: sessionData.sessionStorage,
          userAgent: sessionData.userAgent,
          ipAddress: this.getClientIP(),
          deviceFingerprint: await this.generateDeviceFingerprint(),
        }
      );

      this.logger.info('✅ Advanced session saved', { sessionId });
      return sessionId;

    } catch (error) {
      this.logger.error('❌ Failed to save advanced session', { error: error.message });
      throw error;
    }
  }

  private async startSessionMonitoring(sessionId: string): Promise<void> {
    this.sessionMonitor = {
      isActive: true,
      lastCheck: new Date(),
      checkInterval: 5 * 60 * 1000, // 5 минут
      maxRetries: 3,
      currentRetries: 0,
    };

    // Запускаем мониторинг в фоне
    this.monitorSessionHealth(sessionId);
  }

  private async monitorSessionHealth(sessionId: string): Promise<void> {
    while (this.sessionMonitor?.isActive) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.sessionMonitor!.checkInterval));

        if (!this.sessionMonitor.isActive) break;

        const session = await advancedAuthManager.getActiveWBSession(this.config!.userId);
        
        if (!session) {
          await this.handleSecurityAlert({
            type: 'SESSION_EXPIRED',
            severity: 'HIGH',
            message: 'Сессия истекла',
            details: { sessionId },
            timestamp: new Date(),
          });
          
          this.sessionMonitor.currentRetries++;
          
          if (this.sessionMonitor.currentRetries >= this.sessionMonitor.maxRetries) {
            this.sessionMonitor.isActive = false;
            this.config?.onError?.('Сессия истекла и не может быть восстановлена');
          }
        } else {
          this.sessionMonitor.currentRetries = 0;
          this.sessionMonitor.lastCheck = new Date();
        }

      } catch (error) {
        this.logger.error('❌ Session monitoring error', { error: error.message });
      }
    }
  }

  private async handleSecurityAlert(alert: SecurityAlert): Promise<void> {
    this.securityAlerts.push(alert);
    this.config?.onSecurityAlert?.(alert);
    
    this.logger.warn('🚨 Security alert', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      details: alert.details,
    });
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.logger.info('🧹 Cleanup completed');

    } catch (error) {
      this.logger.error('❌ Cleanup error', { error: error.message });
    }
  }

  private getClientIP(): string {
    // В реальном приложении здесь должна быть логика получения IP
    return '127.0.0.1';
  }

  private async generateDeviceFingerprint(): Promise<string> {
    // Генерируем отпечаток устройства
    const components = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'ru-RU,ru;q=0.9,en;q=0.8',
      'gzip, deflate, br',
      'Europe/Moscow',
    ];

    return encrypt(components.join('|'));
  }

  // ===== PUBLIC UTILITY METHODS =====

  isServiceActive(): boolean {
    return this.isActive;
  }

  getSecurityAlerts(): SecurityAlert[] {
    return [...this.securityAlerts];
  }

  getSessionMonitor(): SessionMonitor | null {
    return this.sessionMonitor;
  }
}

// ===== SINGLETON INSTANCE =====

export const advancedWBAuthService = new AdvancedWBAuthService();
