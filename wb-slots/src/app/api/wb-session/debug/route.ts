import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import { decrypt } from '@/lib/encryption';
import { debugPageSelectors } from '@/lib/utils/wb-selector-debug';

/**
 * API для отладки селекторов на странице WB
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId } = body;
    const targetUserId = userId || user.id;

    // Проверяем права (пользователь может отлаживать только свою сессию, админ - любую)
    if (user.role !== 'ADMIN' && targetUserId !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен. Вы можете отлаживать только свои сессии.'
      }, { status: 403 });
    }

    // Получаем активную сессию
    const session = await prisma.wBSession.findFirst({
      where: {
        userId: targetUserId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Нет активной сессии для отладки'
      }, { status: 404 });
    }

    // Запускаем браузер для отладки
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
      // Восстанавливаем cookies из сессии
      const decryptedCookies = JSON.parse(decrypt(session.cookiesEncrypted));
      await context.addCookies(decryptedCookies);

      // Переходим на главную страницу WB
      console.log('🌐 Navigating to WB main page for debugging...');
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Ждем загрузки страницы
      await page.waitForTimeout(5000);

      // Получаем отладочную информацию
      const debugInfo = await debugPageSelectors(page);

      console.log('🔍 Debug info collected:', {
        url: debugInfo.url,
        title: debugInfo.title,
        foundSelectors: debugInfo.foundSelectors.length,
        allSelectors: debugInfo.allSelectors.length,
        localStorageKeys: debugInfo.localStorageKeys.length,
        sessionStorageKeys: debugInfo.sessionStorageKeys.length,
        cookies: debugInfo.cookies.length
      });

      return NextResponse.json({
        success: true,
        data: {
          message: 'Отладочная информация собрана',
          sessionInfo: {
            sessionId: session.sessionId,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isActive: session.isActive
          },
          pageInfo: debugInfo
        }
      });

    } catch (error) {
      console.error('❌ Debug error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка отладки'
      }, { status: 500 });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

  } catch (error) {
    console.error('WB Session Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
