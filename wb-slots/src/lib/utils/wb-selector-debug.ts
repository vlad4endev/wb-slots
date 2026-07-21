import { Page } from 'playwright';

/**
 * Утилита для отладки селекторов на странице WB
 */

export interface SelectorDebugResult {
  url: string;
  title: string;
  foundSelectors: string[];
  allSelectors: string[];
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  cookies: any[];
  pageContent: string;
}

/**
 * Получает подробную информацию о странице для отладки селекторов
 */
export async function debugPageSelectors(page: Page): Promise<SelectorDebugResult> {
  try {
    const result = await page.evaluate(() => {
      // Собираем все возможные селекторы
      const allSelectors: string[] = [];
      
      // Селекторы по data-testid
      const testIdElements = document.querySelectorAll('[data-testid]');
      testIdElements.forEach(el => {
        const testId = el.getAttribute('data-testid');
        if (testId) {
          allSelectors.push(`[data-testid="${testId}"]`);
        }
      });
      
      // Селекторы по классам (только те, что содержат ключевые слова)
      const allElements = document.querySelectorAll('*');
      const classSet = new Set<string>();
      const idSet = new Set<string>();
      
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(cls => {
            if (cls && (
              cls.toLowerCase().includes('user') ||
              cls.toLowerCase().includes('profile') ||
              cls.toLowerCase().includes('auth') ||
              cls.toLowerCase().includes('header') ||
              cls.toLowerCase().includes('menu') ||
              cls.toLowerCase().includes('nav') ||
              cls.toLowerCase().includes('login') ||
              cls.toLowerCase().includes('logout')
            )) {
              classSet.add(`.${cls}`);
            }
          });
        }
        
        if (el.id && (
          el.id.toLowerCase().includes('user') ||
          el.id.toLowerCase().includes('profile') ||
          el.id.toLowerCase().includes('auth') ||
          el.id.toLowerCase().includes('header') ||
          el.id.toLowerCase().includes('menu') ||
          el.id.toLowerCase().includes('nav')
        )) {
          idSet.add(`#${el.id}`);
        }
      });
      
      allSelectors.push(...Array.from(classSet));
      allSelectors.push(...Array.from(idSet));
      
      // Проверяем, какие селекторы найдены
      const foundSelectors: string[] = [];
      const testSelectors = [
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
        '[class*="user"]',
        '[class*="profile"]',
        '[class*="header"]',
        '[class*="User"]',
        '[class*="Profile"]',
        '[class*="Header"]',
        '[class*="Menu"]',
        'nav',
        'header',
        '.navigation',
        '.nav-menu'
      ];
      
      testSelectors.forEach(selector => {
        try {
          const element = document.querySelector(selector);
          if (element) {
            foundSelectors.push(selector);
          }
        } catch (e) {
          // Игнорируем ошибки селекторов
        }
      });
      
      // Собираем информацию о storage
      const localStorageKeys = Object.keys(localStorage);
      const sessionStorageKeys = Object.keys(sessionStorage);
      
      // Получаем cookies
      const cookies = document.cookie.split(';').map(cookie => {
        const [name, value] = cookie.trim().split('=');
        return { name, value };
      });
      
      // Получаем часть содержимого страницы
      const pageContent = document.body.innerText.substring(0, 1000);
      
      return {
        url: window.location.href,
        title: document.title,
        foundSelectors,
        allSelectors: allSelectors.slice(0, 50), // Ограничиваем количество
        localStorageKeys,
        sessionStorageKeys,
        cookies,
        pageContent
      };
    });
    
    return result;
  } catch (error) {
    return {
      url: page.url(),
      title: '',
      foundSelectors: [],
      allSelectors: [],
      localStorageKeys: [],
      sessionStorageKeys: [],
      cookies: [],
      pageContent: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Сохраняет отладочную информацию в файл
 */
export async function saveDebugInfo(page: Page, filename?: string): Promise<string> {
  const debugInfo = await debugPageSelectors(page);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const debugFilename = filename || `wb-debug-${timestamp}.json`;
  
  // В реальном приложении здесь можно сохранить в файл или отправить в лог
  console.log('🔍 WB Page Debug Info:', JSON.stringify(debugInfo, null, 2));
  
  return debugFilename;
}
