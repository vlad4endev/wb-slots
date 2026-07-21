import { Page } from 'playwright';
import { Logger } from '@/lib/logging/logger';

/**
 * Улучшенный проверщик авторизации WB с предотвращением редиректов
 */

export interface WBAuthCheckResult {
  isAuthenticated: boolean;
  reason?: string;
  suggestions?: string[];
  details?: {
    urlCheck: boolean;
    domCheck: boolean;
    storageCheck: boolean;
    cookiesCheck: boolean;
    authCheck: boolean;
    redirectCheck: boolean;
  };
}

export class EnhancedWBAuthChecker {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Комплексная проверка авторизации WB
   */
  async checkWBAuthentication(page: Page): Promise<WBAuthCheckResult> {
    try {
      this.logger.info('🔍 Performing enhanced WB authentication check');

      const result = await page.evaluate(() => {
        const details = {
          urlCheck: false,
          domCheck: false,
          storageCheck: false,
          cookiesCheck: false,
          authCheck: false,
          redirectCheck: false
        };

        // 1. Проверка URL - не на странице логина
        const currentUrl = window.location.href;
        const isNotOnLoginPage = !currentUrl.includes('/login') &&
                                !currentUrl.includes('/auth') &&
                                !currentUrl.includes('/signin') &&
                                !currentUrl.includes('/signup');
        details.urlCheck = isNotOnLoginPage;

        // 2. Проверка DOM элементов - отсутствие элементов логина
        const loginElements = document.querySelectorAll(`
          [data-testid*="login"],
          [class*="login"],
          [id*="login"],
          [data-testid*="auth"],
          [class*="auth"],
          [id*="auth"],
          [data-testid*="signin"],
          [class*="signin"],
          [id*="signin"],
          input[type="password"],
          button[class*="login"],
          button[class*="auth"],
          a[href*="login"],
          a[href*="auth"]
        `);
        details.domCheck = loginElements.length === 0;

        // 3. Проверка localStorage на наличие данных авторизации
        try {
          const hasWbData = Object.keys(localStorage).some(key => {
            const lowerKey = key.toLowerCase();
            return lowerKey.includes('wb') ||
                   lowerKey.includes('wildberries') ||
                   lowerKey.includes('token') ||
                   lowerKey.includes('auth') ||
                   lowerKey.includes('session') ||
                   lowerKey.includes('user');
          });
          details.storageCheck = hasWbData;
        } catch (e) {
          details.storageCheck = false;
        }

        // 4. Проверка cookies на наличие токенов авторизации
        const cookies = document.cookie;
        const hasAuthCookies = cookies.includes('WBToken') ||
                              cookies.includes('wb_') ||
                              cookies.includes('wildberries') ||
                              cookies.includes('auth') ||
                              cookies.includes('session') ||
                              cookies.includes('token');
        details.cookiesCheck = hasAuthCookies;

        // 5. Проверка авторизации - отсутствие редиректа на логин
        const title = document.title.toLowerCase();
        const hasAuthIndicators = !title.includes('войти') &&
                                 !title.includes('login') &&
                                 !title.includes('signin') &&
                                 !title.includes('авторизация') &&
                                 !title.includes('authorization');
        details.authCheck = hasAuthIndicators;

        // 6. Проверка на редиректы - отсутствие автоматических редиректов
        const hasRedirectIndicators = !currentUrl.includes('redirect') &&
                                     !currentUrl.includes('return') &&
                                     !currentUrl.includes('callback');
        details.redirectCheck = hasRedirectIndicators;

        // Общий результат
        const isAuthenticated = Object.values(details).every(check => check === true);

        return {
          isAuthenticated,
          details
        };
      });

      // Анализируем результат
      const failedChecks = Object.entries(result.details)
        .filter(([_, passed]) => !passed)
        .map(([check, _]) => check);

      if (result.isAuthenticated) {
        this.logger.info('✅ WB authentication check passed');
        return {
          isAuthenticated: true,
          details: result.details
        };
      } else {
        const suggestions = this.generateSuggestions(failedChecks);
        
        this.logger.warn('⚠️ WB authentication check failed', {
          failedChecks,
          suggestions
        });

        return {
          isAuthenticated: false,
          reason: `Failed checks: ${failedChecks.join(', ')}`,
          suggestions,
          details: result.details
        };
      }

    } catch (error) {
      this.logger.error('❌ WB authentication check error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isAuthenticated: false,
        reason: `Authentication check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestions: ['Try refreshing the page', 'Check browser console for errors']
      };
    }
  }

  /**
   * Проверка на наличие редиректов на страницу входа
   */
  async checkForLoginRedirects(page: Page): Promise<boolean> {
    try {
      const hasRedirects = await page.evaluate(() => {
        // Проверяем текущий URL
        const currentUrl = window.location.href;
        const isOnLoginPage = currentUrl.includes('/login') ||
                             currentUrl.includes('/auth') ||
                             currentUrl.includes('/signin');

        // Проверяем наличие элементов редиректа
        const redirectElements = document.querySelectorAll(`
          [data-testid*="redirect"],
          [class*="redirect"],
          [id*="redirect"],
          meta[http-equiv="refresh"],
          script[src*="redirect"]
        `);

        // Проверяем наличие JavaScript редиректов
        const hasJsRedirects = document.scripts && Array.from(document.scripts).some(script => {
          const content = script.textContent || '';
          return content.includes('window.location') ||
                 content.includes('location.href') ||
                 content.includes('location.replace');
        });

        return isOnLoginPage || redirectElements.length > 0 || hasJsRedirects;
      });

      if (hasRedirects) {
        this.logger.warn('⚠️ Login redirects detected');
      }

      return hasRedirects;
    } catch (error) {
      this.logger.error('❌ Error checking for login redirects', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Предотвращение редиректов на страницу входа
   */
  async preventLoginRedirects(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        const isLoginUrl = (url: string) => {
          if (!url) return false;
          const lower = url.toLowerCase();
          return lower.includes('/login') || lower.includes('/auth') || lower.includes('/signin');
        };

        const wrapLocationMethod = (method: 'assign' | 'replace') => {
          const original = window.location[method];
          window.location[method] = function urlInterceptor(this: Location, url: string) {
            if (typeof url === 'string' && isLoginUrl(url)) {
              console.warn('Blocked redirect to login page:', url);
              return;
            }
            return original.call(this, url);
          };
        };

        wrapLocationMethod('assign');
        wrapLocationMethod('replace');

        const originalHref = window.location.href;
        window.addEventListener(
          'beforeunload',
          (event) => {
            if (!isLoginUrl(originalHref) && isLoginUrl(window.location.href)) {
              event.preventDefault();
              event.returnValue = '';
            }
          },
          { passive: false }
        );

        window.addEventListener('popstate', () => {
          if (isLoginUrl(window.location.href) && !isLoginUrl(originalHref)) {
            history.pushState(null, document.title, originalHref);
          }
        });

        // Блокируем meta refresh редиректы
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh) {
          metaRefresh.remove();
        }

        // Блокируем JavaScript редиректы
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
          if (script.textContent) {
            const content = script.textContent;
            if (content.includes('window.location') || content.includes('location.href')) {
              // Заменяем редиректы на логин на пустые функции
              script.textContent = content
                .replace(/window\.location\.href\s*=\s*['"][^'"]*\/login[^'"]*['"]/g, '// Blocked login redirect')
                .replace(/window\.location\.replace\s*\(\s*['"][^'"]*\/login[^'"]*['"]\s*\)/g, '// Blocked login redirect')
                .replace(/window\.location\.assign\s*\(\s*['"][^'"]*\/login[^'"]*['"]\s*\)/g, '// Blocked login redirect');
            }
          }
        });
      });

      this.logger.info('🛡️ Login redirect prevention activated');
    } catch (error) {
      this.logger.error('❌ Error preventing login redirects', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Генерация предложений по исправлению проблем
   */
  private generateSuggestions(failedChecks: string[]): string[] {
    const suggestions: string[] = [];

    if (failedChecks.includes('urlCheck')) {
      suggestions.push('Redirect to the main WB page instead of login page');
    }

    if (failedChecks.includes('domCheck')) {
      suggestions.push('Check if login elements are properly hidden after authentication');
    }

    if (failedChecks.includes('storageCheck')) {
      suggestions.push('Ensure localStorage data is properly restored');
    }

    if (failedChecks.includes('cookiesCheck')) {
      suggestions.push('Verify that authentication cookies are set correctly');
    }

    if (failedChecks.includes('authCheck')) {
      suggestions.push('Check page title and content for authentication indicators');
    }

    if (failedChecks.includes('redirectCheck')) {
      suggestions.push('Remove or fix redirect parameters in URL');
    }

    if (suggestions.length === 0) {
      suggestions.push('Try refreshing the session or re-authenticating');
    }

    return suggestions;
  }
}
