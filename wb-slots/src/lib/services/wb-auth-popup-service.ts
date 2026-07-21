import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { prisma } from '../prisma';
import { encrypt } from '../encryption';
import { Logger } from '../logging/logger';
import { checkWBAuthentication } from '../utils/wb-auth-utils';
import { WB_SELECTORS } from '../utils/wb-auth-selectors';
import { getUnifiedSessionManager } from '../session';
import { requireEnv } from '../env';

export interface WBAuthPopupConfig {
  userId: string;
  onSuccess?: (sessionData: any) => void;
  onError?: (error: string) => void;
  onProgress?: (message: string) => void;
}

export interface SessionData {
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  userAgent: string;
  timestamp: number;
}

export class WBAuthPopupService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private isActive = false;
  private config: WBAuthPopupConfig | null = null;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Запуск popup браузера для авторизации
   */
  async startAuthPopup(config: WBAuthPopupConfig): Promise<void> {
    if (this.isActive) {
      throw new Error('Auth popup is already active');
    }

    this.isActive = true;
    this.config = config;

    try {
      this.logger.info('🚀 Starting WB auth popup', { userId: config.userId });
      config.onProgress?.('Запуск браузера...');

      // Запускаем браузер в видимом режиме
      await this.launchBrowser();

      // Создаем контекст и страницу
      this.context = await this.browser!.newContext({
        viewport: { width: 1200, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
      });

      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(30000);

      // Настраиваем отслеживание навигации
      await this.setupNavigationTracking();

      // ПРОВЕРЯЕМ И ВОССТАНАВЛИВАЕМ СУЩЕСТВУЮЩУЮ СЕССИЮ
      config.onProgress?.('Проверка существующей сессии...');
      const sessionManager = getUnifiedSessionManager();
      
      try {
        // Пытаемся восстановить существующую сессию
        const restoreResult = await sessionManager.restoreSessionContext(config.userId, this.context);
        
        if (restoreResult.isValid && restoreResult.metadata?.cookieCount && restoreResult.metadata.cookieCount > 0) {
          this.logger.info('✅ Existing session restored', { 
            userId: config.userId,
            cookieCount: restoreResult.metadata.cookieCount 
          });
          config.onProgress?.('Существующая сессия восстановлена. Открытие страницы поставок...');
          
          // Переходим на страницу поставок с восстановленной сессией
          await this.page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Ждем загрузки страницы
          await this.page.waitForTimeout(3000);
          
          // Проверяем, авторизованы ли мы
          const currentUrl = this.page.url();
          this.logger.info('Current URL after restoration:', { url: currentUrl });
          
          if (currentUrl.includes('/login') || currentUrl.includes('seller-auth.wildberries.ru')) {
            // Сессия истекла - запрашиваем новую авторизацию
            this.logger.warn('⚠️ Session expired after restoration, redirecting to login');
            config.onProgress?.('Сессия истекла. Требуется повторная авторизация. Переход на страницу входа...');
            
            // Очищаем старую сессию
            const activeSession = await sessionManager.getActiveSession(config.userId);
            if (activeSession) {
              await sessionManager.deactivateSession(activeSession.id, 'Session expired - redirect to login');
            }
            
            // Переходим на страницу логина
            await this.page.goto('https://seller-auth.wildberries.ru/', {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });
            config.onProgress?.('Войдите в личный кабинет Wildberries для создания новой сессии...');
          } else if (currentUrl.includes('/supplies-management/')) {
            // Успешно восстановили сессию и попали на страницу поставок
            this.logger.info('✅ Session restored successfully, on supplies page');
            config.onProgress?.('Сессия восстановлена! Вы на странице поставок.');
            
            // Проверяем авторизацию для подтверждения
            try {
              if (!this.context) {
                this.logger.warn('⚠️ Browser context is not available during post-restore auth verification');
              } else {
                const authResult = await checkWBAuthentication(this.page, this.context);
                if (authResult.success) {
                  this.logger.info('✅ Authentication confirmed after restoration', { 
                    cookies: authResult.cookiesFound,
                    storageFound: authResult.storageFound,
                    url: authResult.currentUrl
                  });
                  // Обновляем сессию, если нужно
                  await sessionManager.refreshSession(config.userId, this.page);
                  config.onProgress?.('Сессия активна и работает корректно.');
                } else {
                  this.logger.warn('⚠️ Authentication not confirmed after restoration', { 
                    reason: authResult.reason,
                    cookies: authResult.cookiesFound,
                    redirect: authResult.redirectDetected,
                    url: authResult.currentUrl
                  });
                }
              }
            } catch (error) {
              this.logger.warn('⚠️ Could not verify authentication after restoration', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
            }
          } else {
            // Неожиданная страница, но сессия восстановлена
            this.logger.warn('⚠️ Unexpected page after restoration', { url: currentUrl });
            config.onProgress?.(`Страница: ${currentUrl}. Проверьте авторизацию...`);
          }
        } else {
          // Нет активной сессии или сессия невалидна - запрашиваем новую авторизацию
          this.logger.info('ℹ️ No valid session found, starting new authentication');
          config.onProgress?.('Активная сессия не найдена. Переход на страницу авторизации...');
          
          // Переходим на страницу логина для новой авторизации
          await this.page.goto('https://seller-auth.wildberries.ru/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          config.onProgress?.('Войдите в личный кабинет Wildberries для создания новой сессии...');
        }
      } catch (restoreError) {
        // Ошибка при восстановлении - запрашиваем новую авторизацию
        this.logger.warn('⚠️ Failed to restore session, starting new authentication', { 
          error: restoreError instanceof Error ? restoreError.message : 'Unknown error' 
        });
        config.onProgress?.('Ошибка восстановления сессии. Переход на страницу авторизации...');
        
        await this.page.goto('https://seller-auth.wildberries.ru/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        config.onProgress?.('Войдите в личный кабинет Wildberries для создания новой сессии...');
      }

      this.logger.info('✅ Auth popup started successfully');

    } catch (error) {
      this.logger.error('❌ Failed to start auth popup', { error: error instanceof Error ? error.message : 'Unknown error' });
      config.onError?.(error instanceof Error ? error.message : 'Unknown error');
      await this.cleanup();
    }
  }

  /**
   * Запуск браузера
   */
  private async launchBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false, // Видимый браузер для пользователя
      args: [
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
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--disable-sync-preferences',
        '--disable-translate',
        '--disable-ipc-flooding-protection',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=TranslateUI',
        '--window-size=1200,800',
        '--window-position=100,100'
      ],
    });
  }

  /**
   * Настройка отслеживания навигации
   */
  private async setupNavigationTracking(): Promise<void> {
    if (!this.page) return;

    // Отслеживаем изменения URL
    this.page.on('framenavigated', async (frame) => {
      if (frame === this.page!.mainFrame()) {
        const url = frame.url();
        this.logger.info('🌐 Navigation detected', { url });

        // Проверяем, перешли ли в раздел поставок
        if (url.includes('/supplies-management/') || url.includes('/supplies-management/all-supplies')) {
          // Проверяем, что мы не на странице авторизации
          if (url.includes('seller-auth.wildberries.ru') || url.includes('/login')) {
            this.logger.warn('⚠️ Redirected to auth page, skipping session save', { url });
            this.config?.onProgress?.('Обнаружен переход на страницу авторизации. Завершите вход...');
            return;
          }
          
          this.logger.info('✅ User navigated to supplies section');
          this.config?.onProgress?.('Обнаружен переход в раздел поставок. Проверка авторизации...');
          
          // Ждем загрузки страницы с таймаутом
          try {
            await this.page!.waitForLoadState('domcontentloaded', { timeout: 10000 });
            await this.page!.waitForTimeout(3000);
          } catch (error) {
            this.logger.warn('⚠️ Page load timeout, continuing anyway', { error: error instanceof Error ? error.message : 'Unknown error' });
            await this.page!.waitForTimeout(2000);
          }
          
          // Проверяем авторизацию перед сохранением
          try {
            if (!this.context) {
              this.logger.warn('⚠️ Browser context unavailable for authentication check, skipping save');
              return;
            }

            const authResult = await checkWBAuthentication(this.page!, this.context);
            if (authResult.success) {
              this.logger.info('✅ Authentication confirmed, saving session', { 
                cookies: authResult.cookiesFound,
                storageFound: authResult.storageFound,
                url: authResult.currentUrl
              });
              this.config?.onProgress?.('Авторизация подтверждена. Сохранение сессии...');
              await this.saveSession();
            } else {
              this.logger.warn('⚠️ Authentication not confirmed, skipping session save', { 
                reason: authResult.reason,
                cookies: authResult.cookiesFound,
                redirect: authResult.redirectDetected,
                url: authResult.currentUrl
              });
              this.config?.onProgress?.('Авторизация не подтверждена. Завершите вход в личный кабинет...');
            }
          } catch (error) {
            this.logger.warn('⚠️ Could not verify authentication, checking URL before saving', { error: error instanceof Error ? error.message : 'Unknown error' });
            // Проверяем, не на странице авторизации
            const currentUrl = this.page!.url();
            if (!currentUrl.includes('seller-auth.wildberries.ru') && !currentUrl.includes('/login')) {
              this.config?.onProgress?.('Сохранение сессии...');
              await this.saveSession();
            } else {
              this.logger.warn('⚠️ On auth page, skipping session save');
              this.config?.onProgress?.('Требуется авторизация. Войдите в личный кабинет...');
            }
          }
        }
        // Проверяем, авторизовался ли пользователь
        else if (url.includes('/seller.wildberries.ru/') && !url.includes('/login')) {
          this.logger.info('✅ User appears to be authenticated');
          this.config?.onProgress?.('Авторизация успешна! Переход на страницу поставок...');
          
          // Ждем немного, чтобы убедиться, что страница полностью загрузилась
          await this.page!.waitForTimeout(2000);
          
          // Проверяем, есть ли признаки успешной авторизации на странице
          try {
            if (!this.context) {
              this.logger.warn('⚠️ Browser context unavailable for authentication check');
              return;
            }

            const authResult = await checkWBAuthentication(this.page!, this.context);

            if (authResult.success) {
              this.logger.info('✅ Authentication confirmed by enhanced check', {
                cookies: authResult.cookiesFound,
                storageFound: authResult.storageFound,
                url: authResult.currentUrl
              });
              this.config?.onProgress?.('Авторизация подтверждена. Переход на страницу поставок...');

              const authenticatedUrl = authResult.currentUrl || this.page!.url();

              // Автоматически переходим на страницу поставок, если мы ещё не там
              if (!authenticatedUrl.includes('/supplies-management/')) {
                try {
                  await this.page!.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                  });
                } catch (navigationError) {
                  this.logger.warn('⚠️ Failed to navigate to supplies page', {
                    error: navigationError instanceof Error ? navigationError.message : 'Unknown error'
                  });
                }
              }

              // Ждем загрузки раздела поставок перед сохранением
              try {
                await this.page!.waitForLoadState('domcontentloaded', { timeout: 10000 });
                await this.page!.waitForTimeout(3000);
              } catch (waitError) {
                this.logger.warn('⚠️ Page load timeout after auth, continuing anyway', {
                  error: waitError instanceof Error ? waitError.message : 'Unknown error'
                });
                await this.page!.waitForTimeout(2000);
              }

              const finalUrl = this.page!.url();
              if (finalUrl.includes('seller-auth.wildberries.ru') || finalUrl.includes('/login')) {
                this.logger.warn('⚠️ Redirected to auth page before saving session', { url: finalUrl });
                this.config?.onProgress?.('Требуется повторный вход. Завершите авторизацию...');
              } else {
                await this.saveSession();
              }
            } else {
              this.logger.info('⚠️ Authentication not fully confirmed yet', {
                reason: authResult.reason,
                cookies: authResult.cookiesFound,
                redirect: authResult.redirectDetected,
                url: authResult.currentUrl
              });
              this.config?.onProgress?.('Авторизация в процессе. Завершите вход в личный кабинет...');
            }
          } catch (error) {
            this.logger.warn('⚠️ Could not verify authentication status', {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.config?.onProgress?.('Проверка авторизации... Завершите вход в личный кабинет...');
          }
        }
      }
    });

    // Отслеживаем закрытие браузера
    this.page.on('close', async () => {
      this.logger.info('🔒 Browser closed by user');
      await this.cleanup();
    });

    // Отслеживаем ошибки
    this.page.on('pageerror', (error) => {
      this.logger.error('❌ Page error', { error: error.message });
    });

    // Отслеживаем изменения DOM для определения авторизации
    this.page.on('domcontentloaded', async () => {
      try {
        const currentUrl = this.page!.url();
        
        // Если мы на странице WB и не на странице логина, проверяем авторизацию
        if (currentUrl.includes('seller.wildberries.ru') && !currentUrl.includes('/login')) {
          await this.page!.waitForTimeout(1000); // Даем время на загрузку элементов

          if (!this.context) {
            this.logger.warn('⚠️ Browser context missing during DOMContentLoaded auth check');
            return;
          }

          const authResult = await checkWBAuthentication(this.page!, this.context);

          if (authResult.success) {
            const latestUrl = authResult.currentUrl || this.page!.url();

            // Проверяем, что мы не на странице авторизации
            if (latestUrl.includes('seller-auth.wildberries.ru') || latestUrl.includes('/login')) {
              this.logger.warn('⚠️ On auth page despite positive auth check, skipping session save', { url: latestUrl });
              return;
            }

            this.logger.info('✅ Authentication detected on page load', {
              cookies: authResult.cookiesFound,
              storageFound: authResult.storageFound,
              url: authResult.currentUrl
            });
            this.config?.onProgress?.('Авторизация обнаружена! Сохранение сессии...');

            // Если не на странице поставок, переходим туда
            if (!latestUrl.includes('/supplies-management/')) {
              try {
                await this.page!.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
                  waitUntil: 'domcontentloaded',
                  timeout: 30000
                });
                await this.page!.waitForTimeout(2000);
              } catch (navigationError) {
                this.logger.warn('⚠️ Failed to navigate to supplies page', {
                  error: navigationError instanceof Error ? navigationError.message : 'Unknown error'
                });
              }
            }

            const finalUrl = this.page!.url();
            if (finalUrl.includes('seller-auth.wildberries.ru') || finalUrl.includes('/login')) {
              this.logger.warn('⚠️ Redirected to auth page after navigation, skipping session save');
              this.config?.onProgress?.('Требуется авторизация. Войдите в личный кабинет...');
              return;
            }

            await this.saveSession();
          } else {
            this.logger.debug('ℹ️ Authentication not confirmed on domcontentloaded', {
              reason: authResult.reason,
              cookies: authResult.cookiesFound,
              redirect: authResult.redirectDetected,
              url: authResult.currentUrl
            });
          }
        }
      } catch (error) {
        this.logger.warn('⚠️ Error in DOM content loaded handler', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Сохранение сессии в базу данных
   */
  private async saveSession(): Promise<void> {
    if (!this.page || !this.config) return;

    try {
      this.logger.info('💾 Saving WB session to database using WBSessionManager');

      // Используем новый WBSessionManager для создания сессии
      // requireEnv бросает исключение в production, если ENCRYPTION_KEY не задан —
      // раньше здесь был захардкоженный публичный ключ, которым в проде могли
      // незаметно шифроваться сессии WB при отсутствии переменной окружения.
      const encryptionKey = requireEnv(
        'ENCRYPTION_KEY',
        'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n'
      );
      const sessionManager = getUnifiedSessionManager();
      const context = this.page.context();

      try {
        const snapshotCookies = await context.cookies('https://seller.wildberries.ru');
        const importantCookies = snapshotCookies.filter(cookie =>
          ['WBToken', 'wbx_session_id', 'x-supplier-id'].includes(cookie.name)
        );

        if (importantCookies.length === 0) {
          this.logger.warn('⚠️ Important WB cookies missing before session save', {
            userId: this.config.userId,
            cookieNames: snapshotCookies.map((cookie) => cookie.name)
          });
        } else {
          this.logger.info('✅ WB cookies found before session save', {
            userId: this.config.userId,
            important: importantCookies.map(cookie => ({ name: cookie.name, domain: cookie.domain }))
          });
        }
      } catch (cookieSnapshotError) {
        this.logger.warn('⚠️ Failed to read WB cookies before session save', {
          error: cookieSnapshotError instanceof Error ? cookieSnapshotError.message : 'Unknown error'
        });
      }
      
      // Создаем сессию с помощью нового менеджера
      const sessionFingerprint = await sessionManager.createSession(
        this.config.userId,
        this.page
      );

      this.logger.info('✅ Session saved successfully', { 
        sessionFingerprint: sessionFingerprint.substring(0, 8) + '...',
        userId: this.config.userId 
      });

      // Получаем статистику данных сессии
      const sessionStats = await sessionManager.getSessionDataStats(this.config.userId);
      const sessionInfo = await sessionManager.getActiveSession(this.config.userId);

      // Уведомляем об успехе с реальными данными
      this.config.onSuccess?.({
        sessionId: sessionFingerprint,
        userId: this.config.userId,
        expiresAt: sessionInfo?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        cookies: sessionStats.cookies,
        localStorage: sessionStats.localStorage,
        sessionStorage: sessionStats.sessionStorage,
      });

      // НЕ закрываем popup автоматически - ждем действий пользователя
      this.config?.onProgress?.('Сессия сохранена! Браузер останется открытым для завершения авторизации.');

    } catch (error) {
      this.logger.error('❌ Failed to save session', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      this.config?.onError?.(`Ошибка сохранения сессии: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Очистка ресурсов
   */
  private async cleanup(): Promise<void> {
    this.isActive = false;
    this.config = null;

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

      this.logger.info('🧹 Auth popup cleanup completed');
    } catch (error) {
      this.logger.error('❌ Error during cleanup', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Проверка активности popup
   */
  isPopupActive(): boolean {
    return this.isActive;
  }

  /**
   * Принудительное закрытие popup
   */
  async closePopup(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Принудительное сохранение сессии (если пользователь уже на нужной странице)
   */
  async forceSaveSession(): Promise<void> {
    if (!this.page || !this.config) {
      throw new Error('Popup not active');
    }

    try {
      const currentUrl = this.page.url();
      this.logger.info('🔍 Checking current URL for session save', { url: currentUrl });

      // Проверяем, находимся ли мы на странице поставок или любой странице WB
      if (currentUrl.includes('/supplies-management/') || 
          currentUrl.includes('/supplies-management/all-supplies') ||
          currentUrl.includes('seller.wildberries.ru')) {
        
        this.logger.info('✅ Current page is WB page, saving session');
        this.config.onProgress?.('Принудительное сохранение сессии...');
        
        // Если не на странице поставок, переходим туда
        if (!currentUrl.includes('/supplies-management/')) {
          this.logger.info('🔄 Navigating to supplies page');
          this.config.onProgress?.('Переход на страницу поставок...');
          
          await this.page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Ждем загрузки с обработкой таймаута
          try {
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            await this.page.waitForTimeout(3000);
          } catch (error) {
            this.logger.warn('⚠️ Page load timeout in forceSaveSession, continuing anyway', { error: error instanceof Error ? error.message : 'Unknown error' });
            await this.page.waitForTimeout(2000);
          }
        }
        
        await this.saveSession();
      } else {
        this.logger.warn('⚠️ Current page is not WB page', { url: currentUrl });
        throw new Error('Текущая страница не является страницей Wildberries. Перейдите на seller.wildberries.ru');
      }
    } catch (error) {
      this.logger.error('❌ Failed to force save session', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}
