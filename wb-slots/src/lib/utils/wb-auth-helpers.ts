import { Page } from 'playwright';

/**
 * Утилиты для работы с авторизацией Wildberries
 */

export interface AuthCheckResult {
  isAuthenticated: boolean;
  foundSelectors: string[];
  currentUrl: string;
  pageTitle: string;
  error?: string;
  diagnostic?: {
    totalElements: number;
    userClasses: string[];
    userIds: string[];
    hasLocalStorage: boolean;
    hasSessionStorage: boolean;
  };
}

/**
 * Проверяет авторизацию на странице WB
 */
export async function checkWBAuthentication(page: Page): Promise<AuthCheckResult> {
  try {
    const result = await page.evaluate(() => {
      // Проверяем, не находимся ли мы на странице загрузки
      const isLoaderPage = document.querySelector('#icon-layout') || 
                          document.querySelector('.icon-layout') ||
                          document.querySelector('.loading-icon') ||
                          document.querySelector('.circular') ||
                          document.querySelector('#loading-icon') ||
                          document.querySelector('#circular');
      
      if (isLoaderPage) {
        return {
          isAuthenticated: false,
          foundSelectors: ['loading-page'],
          currentUrl: window.location.href,
          pageTitle: document.title,
          error: 'Page is still loading - WB portal loader detected',
          diagnostic: {
            totalElements: document.querySelectorAll('*').length,
            userClasses: [],
            userIds: [],
            hasLocalStorage: Object.keys(localStorage).length > 0,
            hasSessionStorage: Object.keys(sessionStorage).length > 0
          }
        };
      }

      const authIndicators = [
        // Актуальные селекторы WB (обновлены)
        '#app-content-id',
        '.app_Content__children__2mrvJ',
        '.Main-layout__QrWWjB8D-d',
        '.Main-layout__content-block__FKdy15MrbO',
        '.Page__T92U2hfQ0I',
        '.All-supplies-inner',
        '.All-supplies-inner__table__nJF8PMIHkQ',
        // Старые селекторы (для совместимости)
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
        // Дополнительные селекторы для WB
        '[class*="user"]',
        '[class*="profile"]',
        '[class*="header"]',
        // Селекторы для новых версий WB
        '[data-testid="user-avatar"]',
        '[data-testid="profile-button"]',
        '.seller-profile',
        '.user-menu',
        '.profile-dropdown',
        // Более общие селекторы
        '[class*="User"]',
        '[class*="Profile"]',
        '[class*="Header"]',
        '[class*="Menu"]',
        // Селекторы для навигации
        'nav',
        'header',
        '.navigation',
        '.nav-menu'
      ];
      
      const foundSelectors: string[] = [];
      let isAuthenticated = false;
      
      // Проверяем селекторы
      for (const selector of authIndicators) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            foundSelectors.push(selector);
            isAuthenticated = true;
          }
        } catch (e) {
          // Игнорируем ошибки селекторов
        }
      }
      
      // Дополнительная проверка через localStorage
      if (!isAuthenticated) {
        const hasTokens = localStorage.getItem('auth-token') || 
                         localStorage.getItem('access_token') ||
                         localStorage.getItem('session_id') ||
                         localStorage.getItem('wb_token') ||
                         localStorage.getItem('token') ||
                         localStorage.getItem('auth');
        
        if (hasTokens) {
          isAuthenticated = true;
          foundSelectors.push('localStorage-token');
        }
      }
      
      // Проверка через sessionStorage
      if (!isAuthenticated) {
        const hasSessionTokens = sessionStorage.getItem('auth-token') || 
                                sessionStorage.getItem('access_token') ||
                                sessionStorage.getItem('session_id') ||
                                sessionStorage.getItem('wb_token');
        
        if (hasSessionTokens) {
          isAuthenticated = true;
          foundSelectors.push('sessionStorage-token');
        }
      }
      
      // Проверка по URL - если мы не на странице логина, возможно авторизованы
      const currentUrl = window.location.href;
      const isNotLoginPage = !currentUrl.includes('/login') && 
                            !currentUrl.includes('seller-auth.wildberries.ru') &&
                            !currentUrl.includes('/auth') &&
                            !currentUrl.includes('/signin');
      
      // Проверка по заголовку страницы
      const pageTitle = document.title;
      const isNotLoginTitle = !pageTitle.toLowerCase().includes('вход') &&
                             !pageTitle.toLowerCase().includes('login') &&
                             !pageTitle.toLowerCase().includes('авторизация');
      
      // Дополнительная проверка - если мы на странице WB и не на странице логина,
      // но при этом есть данные в localStorage/sessionStorage, считаем авторизованными
      if (!isAuthenticated && currentUrl.includes('seller.wildberries.ru') && isNotLoginPage && isNotLoginTitle) {
        // Проверяем, есть ли хотя бы какие-то данные в storage
        const hasAnyStorageData = Object.keys(localStorage).length > 0 || Object.keys(sessionStorage).length > 0;
        
        if (hasAnyStorageData) {
          isAuthenticated = true;
          foundSelectors.push('url-based-auth-with-storage');
        } else {
          // Если нет данных в storage, возможно сессия недействительна
          console.log('⚠️ No storage data found - session may be invalid');
        }
      }
      
      // Дополнительная диагностика
      const allElements = document.querySelectorAll('*');
      const elementClasses = Array.from(allElements)
        .slice(0, 100) // Берем первые 100 элементов для анализа
        .map(el => {
          // Безопасно получаем className - может быть строка, DOMTokenList или SVGAnimatedString
          try {
            const className = el.className;
            if (typeof className === 'string') {
              return className;
            } else if (className && typeof className === 'object' && 'baseVal' in className) {
              // SVGAnimatedString
              return className.baseVal || '';
            } else if (className && typeof className === 'object' && 'toString' in className) {
              // DOMTokenList или другой объект
              return className.toString();
            }
            return '';
          } catch {
            return '';
          }
        })
        .filter(className => className && typeof className === 'string' && className.includes('user'))
        .slice(0, 10); // Берем первые 10 классов с 'user'
      
      const elementIds = Array.from(allElements)
        .slice(0, 100)
        .map(el => el.id || '')
        .filter(id => id && typeof id === 'string' && (id.includes('user') || id.includes('profile') || id.includes('auth')))
        .slice(0, 10);
      
      return {
        isAuthenticated,
        foundSelectors,
        currentUrl,
        pageTitle,
        isNotLoginPage,
        isNotLoginTitle,
        diagnostic: {
          totalElements: allElements.length,
          userClasses: elementClasses,
          userIds: elementIds,
          hasLocalStorage: Object.keys(localStorage).length > 0,
          hasSessionStorage: Object.keys(sessionStorage).length > 0
        }
      };
    });
    
    return result;
  } catch (error) {
    return {
      isAuthenticated: false,
      foundSelectors: [],
      currentUrl: page.url(),
      pageTitle: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Ждет загрузки страницы и проверяет авторизацию с повторными попытками
 */
export async function waitForWBAuthentication(
  page: Page, 
  options: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  } = {}
): Promise<AuthCheckResult> {
  const { timeout = 30000, retries = 3, retryDelay = 3000 } = options;
  
  // Ждем загрузки DOM
  await page.waitForLoadState('domcontentloaded', { timeout });
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`🔍 Authentication check attempt ${attempt}/${retries}`);
    
    // Даем время на загрузку динамических элементов
    if (attempt > 1) {
      await page.waitForTimeout(retryDelay);
    }
    
    const authResult = await checkWBAuthentication(page);
    
    // Проверяем, не перенаправило ли на страницу входа
    if (authResult.currentUrl.includes('/login') || 
        authResult.currentUrl.includes('seller-auth.wildberries.ru')) {
      console.log('🔒 Redirected to login page - session expired');
      return {
        ...authResult,
        error: 'Redirected to login page - session expired'
      };
    }
    
    // Проверяем, не находимся ли мы на странице загрузки
    if (authResult.error && authResult.error.includes('Page is still loading')) {
      console.log(`⏳ Page is still loading on attempt ${attempt}, waiting...`);
      if (attempt < retries) {
        continue; // Продолжаем ждать
      } else {
        console.log('⏰ Page loading timeout - giving up');
        return {
          ...authResult,
          error: 'Page loading timeout - WB portal did not load in time'
        };
      }
    }
    
    if (authResult.isAuthenticated) {
      console.log(`✅ Authentication confirmed on attempt ${attempt}, found selectors:`, authResult.foundSelectors);
      return authResult;
    }
    
    console.log(`⚠️ Authentication not confirmed on attempt ${attempt}, found selectors:`, authResult.foundSelectors);
    console.log(`📄 Current URL: ${authResult.currentUrl}`);
    console.log(`📄 Page title: ${authResult.pageTitle}`);
  }
  
  // Если все попытки неудачны, проверяем финальное состояние
  const finalResult = await checkWBAuthentication(page);
  
  // Более строгая проверка - сессия валидна только если:
  // 1. Мы на странице WB
  // 2. Не на странице логина
  // 3. Есть данные в storage
  // 4. Страница загрузилась корректно (есть заголовок)
  if (finalResult.currentUrl.includes('seller.wildberries.ru') && 
      !finalResult.currentUrl.includes('/login') &&
      !finalResult.currentUrl.includes('seller-auth.wildberries.ru') &&
      finalResult.diagnostic?.hasLocalStorage &&
      finalResult.pageTitle && finalResult.pageTitle.trim() !== '') {
    
    console.log('⚠️ No auth selectors found, but session appears valid based on storage and page state');
    return {
      ...finalResult,
      isAuthenticated: true,
      foundSelectors: ['fallback-strict-check'],
      error: undefined
    };
  }
  
  return {
    ...finalResult,
    error: `Authentication not confirmed after ${retries} attempts`
  };
}

/**
 * Проверяет, является ли URL страницей авторизации WB
 */
export function isWBAuthPage(url: string): boolean {
  return url.includes('/login') || 
         url.includes('seller-auth.wildberries.ru') ||
         url.includes('/auth') ||
         url.includes('/signin');
}

/**
 * Проверяет, является ли URL страницей WB продавца
 */
export function isWBSellerPage(url: string): boolean {
  return url.includes('seller.wildberries.ru') && !isWBAuthPage(url);
}
