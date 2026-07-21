import { Page } from 'playwright';
import { Logger } from '../logging/logger';

/**
 * Утилиты для диагностики проблем с сессиями WB
 */

export interface SessionDiagnostics {
  url: string;
  pageTitle: string;
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  redirects: string[];
  errors: string[];
  authIndicators: string[];
  pageLoadTime: number;
  isAuthenticated: boolean;
}

export class SessionDiagnosticsService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Выполняет полную диагностику сессии
   */
  async diagnoseSession(page: Page): Promise<SessionDiagnostics> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🔍 Starting session diagnostics');

      // Собираем информацию о странице
      const pageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage },
          userAgent: navigator.userAgent,
          referrer: document.referrer
        };
      });

      // Получаем cookies
      const cookies = await page.context().cookies();

      // Проверяем индикаторы авторизации
      const authIndicators = await this.checkAuthIndicators(page);

      // Проверяем наличие ошибок на странице
      const errors = await this.checkPageErrors(page);

      const diagnostics: SessionDiagnostics = {
        url: pageInfo.url,
        pageTitle: pageInfo.title,
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
          value: cookie.value ? cookie.value.substring(0, 20) + '...' : 'empty'
        })),
        localStorage: pageInfo.localStorage,
        sessionStorage: pageInfo.sessionStorage,
        redirects: [], // Будет заполнено при необходимости
        errors,
        authIndicators,
        pageLoadTime: Date.now() - startTime,
        isAuthenticated: authIndicators.length > 0
      };

      this.logger.info('✅ Session diagnostics completed', {
        url: diagnostics.url,
        title: diagnostics.pageTitle,
        cookiesCount: diagnostics.cookies.length,
        localStorageKeys: Object.keys(diagnostics.localStorage).length,
        sessionStorageKeys: Object.keys(diagnostics.sessionStorage).length,
        authIndicators: diagnostics.authIndicators.length,
        isAuthenticated: diagnostics.isAuthenticated
      });

      return diagnostics;

    } catch (error) {
      this.logger.error('❌ Session diagnostics failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Проверяет индикаторы авторизации на странице
   */
  private async checkAuthIndicators(page: Page): Promise<string[]> {
    try {
      const indicators = await page.evaluate(() => {
        const authSelectors = [
          '#app-content-id',
          '.app_Content__children__2mrvJ',
          '.Main-layout__QrWWjB8D-d',
          '.Main-layout__content-block__FKdy15MrbO',
          '.Page__T92U2hfQ0I',
          '.All-supplies-inner',
          '.All-supplies-inner__table__nJF8PMIHkQ',
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
          '.logout-button'
        ];

        const foundIndicators: string[] = [];
        
        authSelectors.forEach(selector => {
          try {
            const element = document.querySelector(selector);
            if (element) {
              foundIndicators.push(selector);
            }
          } catch (e) {
            // Игнорируем ошибки селекторов
          }
        });

        return foundIndicators;
      });

      return indicators;
    } catch (error) {
      this.logger.error('❌ Failed to check auth indicators', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  /**
   * Проверяет наличие ошибок на странице
   */
  private async checkPageErrors(page: Page): Promise<string[]> {
    try {
      const errors = await page.evaluate(() => {
        const errorMessages: string[] = [];
        
        // Проверяем консольные ошибки
        // Это не сработает в evaluate, но оставляем для будущего использования

        // Проверяем наличие элементов ошибок
        const errorElements = document.querySelectorAll('.error, .alert-danger, .error-message, [class*="error"]');
        errorElements.forEach(element => {
          const text = element.textContent?.trim();
          if (text) {
            errorMessages.push(text);
          }
        });

        return errorMessages;
      });

      return errors;
    } catch (error) {
      this.logger.error('❌ Failed to check page errors', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  /**
   * Проверяет, является ли сессия действительно валидной
   */
  async validateSessionIntegrity(page: Page): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const diagnostics = await this.diagnoseSession(page);
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Проверка 1: URL
      if (!diagnostics.url.includes('seller.wildberries.ru')) {
        issues.push('Не на странице WB');
        recommendations.push('Перейти на seller.wildberries.ru');
      }

      // Проверка 2: Заголовок страницы
      if (!diagnostics.pageTitle || diagnostics.pageTitle.trim() === '') {
        issues.push('Пустой заголовок страницы');
        recommendations.push('Страница может быть не загружена полностью');
      }

      // Проверка 3: Cookies
      if (diagnostics.cookies.length === 0) {
        issues.push('Нет cookies');
        recommendations.push('Сессия не восстановлена, требуется повторная авторизация');
      }

      // Проверка 4: Storage
      if (Object.keys(diagnostics.localStorage).length === 0 && 
          Object.keys(diagnostics.sessionStorage).length === 0) {
        issues.push('Нет данных в localStorage/sessionStorage');
        recommendations.push('Возможно, сессия истекла');
      }

      // Проверка 5: Индикаторы авторизации
      if (diagnostics.authIndicators.length === 0) {
        issues.push('Нет индикаторов авторизации');
        recommendations.push('Проверить, действительно ли пользователь авторизован');
      }

      // Проверка 6: Ошибки на странице
      if (diagnostics.errors.length > 0) {
        issues.push(`Найдены ошибки на странице: ${diagnostics.errors.join(', ')}`);
        recommendations.push('Исправить ошибки на странице');
      }

      const isValid = issues.length === 0;

      this.logger.info('🔍 Session integrity validation completed', {
        isValid,
        issuesCount: issues.length,
        recommendationsCount: recommendations.length
      });

      return {
        isValid,
        issues,
        recommendations
      };

    } catch (error) {
      this.logger.error('❌ Session integrity validation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        isValid: false,
        issues: ['Ошибка валидации сессии'],
        recommendations: ['Повторить попытку валидации']
      };
    }
  }

  /**
   * Создает отчет о диагностике сессии
   */
  async generateDiagnosticsReport(page: Page): Promise<string> {
    try {
      const diagnostics = await this.diagnoseSession(page);
      const integrity = await this.validateSessionIntegrity(page);

      const report = `
🔍 ОТЧЕТ ДИАГНОСТИКИ СЕССИИ WB
================================

📄 Информация о странице:
- URL: ${diagnostics.url}
- Заголовок: ${diagnostics.pageTitle}
- Время загрузки: ${diagnostics.pageLoadTime}ms

🍪 Cookies (${diagnostics.cookies.length}):
${diagnostics.cookies.map(cookie => `- ${cookie.name}: ${cookie.value} (${cookie.domain})`).join('\n')}

💾 LocalStorage (${Object.keys(diagnostics.localStorage).length} ключей):
${Object.keys(diagnostics.localStorage).slice(0, 10).map(key => `- ${key}: ${diagnostics.localStorage[key]?.substring(0, 50)}...`).join('\n')}

🗂️ SessionStorage (${Object.keys(diagnostics.sessionStorage).length} ключей):
${Object.keys(diagnostics.sessionStorage).slice(0, 10).map(key => `- ${key}: ${diagnostics.sessionStorage[key]?.substring(0, 50)}...`).join('\n')}

🔐 Индикаторы авторизации (${diagnostics.authIndicators.length}):
${diagnostics.authIndicators.map(indicator => `- ${indicator}`).join('\n')}

❌ Ошибки (${diagnostics.errors.length}):
${diagnostics.errors.map(error => `- ${error}`).join('\n')}

✅ Валидность сессии: ${integrity.isValid ? 'ДА' : 'НЕТ'}

⚠️ Проблемы:
${integrity.issues.map(issue => `- ${issue}`).join('\n')}

💡 Рекомендации:
${integrity.recommendations.map(rec => `- ${rec}`).join('\n')}
      `;

      return report.trim();

    } catch (error) {
      this.logger.error('❌ Failed to generate diagnostics report', { error: error instanceof Error ? error.message : 'Unknown error' });
      return `Ошибка создания отчета: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
