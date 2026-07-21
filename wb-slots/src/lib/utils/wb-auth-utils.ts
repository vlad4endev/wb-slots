import { BrowserContext, Page } from 'playwright';

export interface AuthCheckResult {
  success: boolean;
  reason?: string;
  cookiesFound?: string[];
  redirectDetected?: boolean;
  storageFound?: boolean;
  currentUrl?: string;
}

const WB_PORTAL_URL = 'https://seller.wildberries.ru';
const IMPORTANT_COOKIES = ['WBToken', 'wbx_session_id', 'x-supplier-id'];
const LOGIN_PATH_MARKERS = ['/security/login', 'auth/signin', '/login', '/auth'];

/**
 * Проверяет действительность сессии WB без зависимости от DOM.
 * Использует cookies, localStorage, sessionStorage и URL для надёжной диагностики.
 */
export async function checkWBAuthentication(page: Page, context: BrowserContext): Promise<AuthCheckResult> {
  const result: AuthCheckResult = {
    success: false,
    cookiesFound: [],
    storageFound: false,
    redirectDetected: false,
  };

  try {
    // 1️⃣ Проверяем активные cookies WB
    let cookies = await context.cookies(WB_PORTAL_URL);
    result.cookiesFound = cookies.map((cookie) => cookie.name);

    let hasImportantCookies = cookies.some((cookie) => IMPORTANT_COOKIES.includes(cookie.name));

    if (!hasImportantCookies) {
      const currentUrl = page.url();
      result.currentUrl = currentUrl;
      const redirectToLogin = LOGIN_PATH_MARKERS.some((marker) => currentUrl.includes(marker));

      result.reason = 'Missing WB session cookies';

      if (!redirectToLogin) {
        try {
          await page.goto(WB_PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(3000);
          cookies = await context.cookies(WB_PORTAL_URL);
          result.cookiesFound = cookies.map((cookie) => cookie.name);
          hasImportantCookies = cookies.some((cookie) => IMPORTANT_COOKIES.includes(cookie.name));

          if (hasImportantCookies) {
            result.reason = undefined;
          }
        } catch (refreshError) {
          result.reason = `Missing WB session cookies (refresh failed: ${
            refreshError instanceof Error ? refreshError.message : 'unknown'
          })`;
        }
      }

      if (!hasImportantCookies) {
        return result;
      }
    }

    // 2️⃣ Проверяем localStorage / sessionStorage
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage || {}),
      session: Object.keys(sessionStorage || {}),
    }));
    const hasStorage = storage.local.length > 0 || storage.session.length > 0;
    result.storageFound = hasStorage;

    // 3️⃣ Проверяем URL — WB редиректит на страницу логина при истёкшей сессии
    const currentUrl = page.url();
    result.currentUrl = currentUrl;
    if (LOGIN_PATH_MARKERS.some((marker) => currentUrl.includes(marker))) {
      result.redirectDetected = true;
      result.reason = 'Redirected to login page';
      return result;
    }

    // 4️⃣ Проверяем глобальные объекты WB в JS-контексте
    const wbGlobals = await page.evaluate(() => {
      try {
        const keys = Object.keys(window);
        return keys.filter((key) => key.includes('WB') || key.includes('Seller'));
      } catch {
        return [];
      }
    });

    if (wbGlobals.length > 0 || hasStorage) {
      result.success = true;
      return result;
    }

    result.reason = 'WB globals not detected';
    return result;
  } catch (error) {
    result.reason = `Error during auth check: ${(error as Error).message}`;
    return result;
  }
}

