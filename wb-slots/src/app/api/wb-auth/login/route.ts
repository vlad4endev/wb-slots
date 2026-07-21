import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maskToken } from '@/lib/encryption';
import { logger } from '@/lib/logging';
import { getUnifiedSessionManager } from '@/lib/session';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { email, password, phone, userId } = body;

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email и пароль обязательны'
      }, { status: 400 });
    }

    logger.info('Starting WB login', { userId: userId || user.id });

    // Запускаем браузер для авторизации
    const browser = await chromium.launch({
      headless: true,
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
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
    });

    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    try {
      // Переходим на страницу входа
      logger.debug('Navigating to WB login page');
      await page.goto('https://seller.wildberries.ru/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Ждем появления формы входа
      logger.debug('Waiting for login form');
      await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { 
        timeout: 30000 
      });

      // Заполняем email
      logger.debug('Filling email');
      await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', email);

      // Ищем и нажимаем кнопку "Далее" или ищем поле пароля
      const nextButton = await page.$('button[type="submit"]:has-text("Далее"), button:has-text("Продолжить"), button:has-text("Next")');
      if (nextButton) {
        logger.debug('Clicking next button');
        await nextButton.click();
        await page.waitForTimeout(2000);
      }

      // Ждем появления поля пароля
      logger.debug('Waiting for password field');
      await page.waitForSelector('input[type="password"], input[name="password"]', { 
        timeout: 30000 
      });

      // Заполняем пароль
      logger.debug('Filling password');
      await page.fill('input[type="password"], input[name="password"]', password);

      // Нажимаем кнопку входа
      logger.debug('Clicking login button');
      const loginButton = await page.$('button[type="submit"]:has-text("Войти"), button:has-text("Вход"), button:has-text("Login")');
      if (loginButton) {
        await loginButton.click();
      } else {
        // Если кнопка не найдена, пробуем нажать Enter
        await page.keyboard.press('Enter');
      }

      // Ждем успешной авторизации
      logger.debug('Waiting for successful login');
      try {
        // Ждем либо появления дашборда, либо перенаправления на главную
        await Promise.race([
          page.waitForLoadState('domcontentloaded', { timeout: 30000 }),
          page.waitForURL('**/supplies-management/**', { timeout: 30000 }),
          page.waitForURL('**/seller.wildberries.ru/**', { timeout: 30000 })
        ]);
      } catch (error) {
        // Проверяем, не появилось ли сообщение об ошибке
        const errorMessage = await page.$('.error-message, .alert-error, [class*="error"]');
        if (errorMessage) {
          const errorText = await errorMessage.textContent();
          throw new Error(`Login failed: ${errorText}`);
        }
        throw new Error('Login timeout - unable to verify successful authentication');
      }

      // Проверяем, что мы действительно авторизованы
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login failed - still on login page');
      }

      logger.info('Login successful');

      // Собираем данные сессии
      const cookies = await page.context().cookies();
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return JSON.stringify(data);
      });

      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return JSON.stringify(data);
      });

      // Сохраняем сессию в базу данных используя UnifiedWBSessionManager
      const targetUserId = userId || user.id;
      const sessionManager = getUnifiedSessionManager();
      
      // Деактивируем старые сессии
      await prisma.wBSession.updateMany({
        where: { userId: targetUserId },
        data: { isActive: false }
      });

      // Создаем структурированные данные сессии
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
      
      // Парсим localStorage и sessionStorage из JSON строк
      const parsedLocalStorage = typeof localStorage === 'string' ? JSON.parse(localStorage) : {};
      const parsedSessionStorage = typeof sessionStorage === 'string' ? JSON.parse(sessionStorage) : {};
      
      const fullSessionData = {
        sessionId,
        cookies,
        localStorage: parsedLocalStorage,
        sessionStorage: parsedSessionStorage,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        expiresAt: expiresAt.toISOString(),
        metadata: {
          createdAt: new Date(),
          lastValidated: new Date(),
          version: '3.0-unified'
        }
      };

      // Шифруем все данные в едином формате
      const encryptedSessionData = (sessionManager as any).encrypt(JSON.stringify(fullSessionData));

      // Создаем новую сессию с единым форматом
      const wbSession = await prisma.wBSession.create({
        data: {
          userId: targetUserId,
          sessionData: encryptedSessionData,
          expiresAt,
          isActive: true,
          lastValidated: new Date(),
        },
      });

      logger.info('Session saved successfully', {
        userId: targetUserId,
        sessionId: maskToken(wbSession.id),
        expiresAt: wbSession.expiresAt,
        cookiesCount: cookies.length
      });

    return NextResponse.json({
      success: true,
      data: {
          sessionId: wbSession.id,
          userId: targetUserId,
          expiresAt: wbSession.expiresAt,
          message: 'Авторизация прошла успешно'
        }
    });

  } catch (error) {
      logger.error('WB login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка авторизации'
      }, { status: 500 });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

  } catch (error) {
    logger.error('WB Auth API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}