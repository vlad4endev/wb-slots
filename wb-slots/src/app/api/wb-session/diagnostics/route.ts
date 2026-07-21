import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import { decrypt } from '@/lib/encryption';
import { SessionDiagnosticsService } from '@/lib/utils/session-diagnostics';

/**
 * API для детальной диагностики сессий WB
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId, generateReport } = body;
    const targetUserId = userId || user.id;

    // Проверяем права
    if (user.role !== 'ADMIN' && targetUserId !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен'
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
        error: 'Нет активной сессии для диагностики'
      }, { status: 404 });
    }

    // Запускаем браузер
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
      // Восстанавливаем cookies
      const decryptedCookies = JSON.parse(decrypt(session.cookiesEncrypted));
      await context.addCookies(decryptedCookies);

      // Переходим на главную страницу WB
      console.log('🌐 Navigating to WB main page for diagnostics...');
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Ждем загрузки страницы
      await page.waitForTimeout(5000);

      // Выполняем диагностику
      const diagnosticsService = new SessionDiagnosticsService();
      const diagnostics = await diagnosticsService.diagnoseSession(page);
      const integrity = await diagnosticsService.validateSessionIntegrity(page);

      let report = null;
      if (generateReport) {
        report = await diagnosticsService.generateDiagnosticsReport(page);
      }

      console.log('🔍 Session diagnostics completed', {
        url: diagnostics.url,
        isAuthenticated: diagnostics.isAuthenticated,
        isValid: integrity.isValid,
        issuesCount: integrity.issues.length
      });

      return NextResponse.json({
        success: true,
        data: {
          sessionInfo: {
            sessionId: session.sessionId,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isActive: session.isActive
          },
          diagnostics,
          integrity,
          report
        }
      });

    } catch (error) {
      console.error('❌ Diagnostics error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка диагностики'
      }, { status: 500 });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

  } catch (error) {
    console.error('WB Session Diagnostics API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
