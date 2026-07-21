import { Browser, Page, chromium } from 'playwright';
import { EnhancedWBSessionManager } from './enhanced-wb-session-manager';
import { getUnifiedSessionManager } from '../session';
import { Logger } from '@/lib/logging/logger';

/**
 * Улучшенный сервис авторизации WB с интеграцией новой системы сессий
 */

export interface AuthResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  warnings?: string[];
}

export interface AuthOptions {
  userId: string;
  timeout?: number;
  headless?: boolean;
  retries?: number;
}

export class EnhancedWBAuthService {
  private logger: Logger;
  private sessionManager: EnhancedWBSessionManager;
  private browser: Browser | null = null;

  constructor(encryptionKey: string) {
    this.logger = new Logger();
    this.sessionManager = getUnifiedSessionManager();
  }

  /**
   * Авторизация через браузер с созданием сессии
   */
  async authenticate(options: AuthOptions): Promise<AuthResult> {
    const { userId, timeout = 60000, headless = true, retries = 3 } = options;
    
    this.logger.info('🚀 Starting enhanced WB authentication', { userId });

    let page: Page | null = null;
    let attempt = 0;

    while (attempt < retries) {
      try {
        attempt++;
        this.logger.info(`🔄 Authentication attempt ${attempt}/${retries}`, { userId });

        // 1. Запускаем браузер
        await this.initializeBrowser(headless);
        
        // 2. Создаем новую страницу
        page = await this.browser!.newPage();
        
        // 3. Переходим на страницу авторизации
        await page.goto('https://seller.wildberries.ru/login', {
          waitUntil: 'domcontentloaded',
          timeout
        });

        // 4. Ждем авторизации пользователя
        const authResult = await this.waitForAuthentication(page, timeout);
        
        if (!authResult.success) {
          throw new Error(authResult.error || 'Authentication failed');
        }

        // 5. Создаем сессию
        const sessionId = await this.sessionManager.createSession(userId, page);
        
        this.logger.info('✅ Enhanced WB authentication successful', { 
          userId, 
          sessionId,
          attempt 
        });

        return {
          success: true,
          sessionId,
          warnings: authResult.warnings
        };

      } catch (error) {
        this.logger.error(`❌ Authentication attempt ${attempt} failed`, { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });

        if (attempt === retries) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Authentication failed after all retries'
          };
        }

        // Очищаем ресурсы перед следующей попыткой
        if (page) {
          await page.close();
          page = null;
        }
        await this.closeBrowser();
        
        // Пауза перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return {
      success: false,
      error: 'Authentication failed after all retries'
    };
  }

  /**
   * Восстановление сессии
   */
  async restoreSession(userId: string): Promise<AuthResult> {
    this.logger.info('🔄 Restoring enhanced WB session', { userId });

    try {
      // 1. Запускаем браузер
      await this.initializeBrowser(true);
      
      // 2. Создаем новую страницу
      const page = await this.browser!.newPage();
      
      // 3. Восстанавливаем сессию
      const restoreResult = await this.sessionManager.restoreSession(userId, page);
      
      if (!restoreResult.success) {
        await page.close();
        return {
          success: false,
          error: restoreResult.error,
          warnings: restoreResult.warnings
        };
      }

      // 4. Валидируем восстановленную сессию
      const validation = await this.sessionManager.validateSession(page);
      
      if (!validation.isValid) {
        await page.close();
        return {
          success: false,
          error: `Session validation failed: ${validation.reason}`,
          warnings: validation.suggestions
        };
      }

      await page.close();
      
      this.logger.info('✅ Enhanced WB session restored successfully', { 
        userId, 
        sessionId: restoreResult.sessionId 
      });

      return {
        success: true,
        sessionId: restoreResult.sessionId
      };

    } catch (error) {
      this.logger.error('❌ Failed to restore enhanced WB session', { 
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
   * Обновление сессии
   */
  async refreshSession(userId: string): Promise<AuthResult> {
    this.logger.info('🔄 Refreshing enhanced WB session', { userId });

    try {
      // 1. Запускаем браузер
      await this.initializeBrowser(true);
      
      // 2. Создаем новую страницу
      const page = await this.browser!.newPage();
      
      // 3. Восстанавливаем текущую сессию
      const restoreResult = await this.sessionManager.restoreSession(userId, page);
      
      if (!restoreResult.success) {
        await page.close();
        return {
          success: false,
          error: restoreResult.error,
          warnings: restoreResult.warnings
        };
      }

      // 4. Обновляем данные сессии
      const refreshResult = await this.sessionManager.refreshSession(userId, page);
      
      await page.close();
      
      if (!refreshResult.success) {
        return {
          success: false,
          error: refreshResult.error,
          warnings: refreshResult.warnings
        };
      }

      this.logger.info('✅ Enhanced WB session refreshed successfully', { 
        userId, 
        sessionId: refreshResult.sessionId 
      });

      return {
        success: true,
        sessionId: refreshResult.sessionId
      };

    } catch (error) {
      this.logger.error('❌ Failed to refresh enhanced WB session', { 
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
   * Получение статистики сессий
   */
  async getSessionStats(userId: string) {
    return await this.sessionManager.getSessionStats(userId);
  }

  /**
   * Закрытие браузера
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // ===== PRIVATE METHODS =====

  /**
   * Инициализация браузера
   */
  private async initializeBrowser(headless: boolean = true): Promise<void> {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }

  /**
   * Ожидание авторизации пользователя
   */
  private async waitForAuthentication(page: Page, timeout: number): Promise<AuthResult> {
    try {
      // Ждем, пока пользователь авторизуется
      await page.waitForFunction(() => {
        // Проверяем, что мы не на странице логина
        const isNotOnLoginPage = !window.location.pathname.includes('/login') &&
                                !window.location.pathname.includes('/auth');
        
        // Проверяем наличие данных авторизации
        const hasAuthData = document.cookie.includes('WBToken') ||
                           document.cookie.includes('wb_') ||
                           Object.keys(localStorage).some(key => 
                             key.toLowerCase().includes('wb') ||
                             key.toLowerCase().includes('token') ||
                             key.toLowerCase().includes('auth')
                           );
        
        return isNotOnLoginPage && hasAuthData;
      }, { timeout });

      // Дополнительная проверка авторизации
      const isAuthenticated = await page.evaluate(() => {
        // Проверяем отсутствие элементов логина
        const loginElements = document.querySelectorAll('[data-testid*="login"], [class*="login"], [id*="login"]');
        const authElements = document.querySelectorAll('[data-testid*="auth"], [class*="auth"], [id*="auth"]');
        
        // Проверяем наличие данных сессии
        const hasSessionData = document.cookie.includes('WBToken') ||
                              document.cookie.includes('wb_') ||
                              Object.keys(localStorage).some(key => 
                                key.toLowerCase().includes('wb') ||
                                key.toLowerCase().includes('token') ||
                                key.toLowerCase().includes('auth')
                              );
        
        return loginElements.length === 0 && 
               authElements.length === 0 && 
               hasSessionData &&
               !window.location.pathname.includes('/login') &&
               !window.location.pathname.includes('/auth');
      });

      if (!isAuthenticated) {
        return {
          success: false,
          error: 'Authentication validation failed'
        };
      }

      return {
        success: true
      };

    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          success: false,
          error: 'Authentication timeout - user did not complete login in time'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication wait failed'
      };
    }
  }
}
