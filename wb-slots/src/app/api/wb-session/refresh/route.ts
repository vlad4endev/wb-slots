import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '@/lib/logging';
import { getUnifiedSessionManager } from '@/lib/session';
import { waitForWBAuthentication, isWBAuthPage } from '@/lib/utils/wb-auth-helpers';
import { SessionDiagnosticsService } from '@/lib/utils/session-diagnostics';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId } = body;
    const targetUserId = userId || user.id;

    logger.info({ userId: targetUserId }, '🔄 Refreshing WB session');

    // Используем UnifiedWBSessionManager для работы с новой схемой
    const sessionManager = getUnifiedSessionManager();
    
    // Получаем текущую активную сессию
    const currentSession = await sessionManager.getActiveSession(targetUserId);

    if (!currentSession) {
      return NextResponse.json({
        success: false,
        error: 'Нет активной сессии для обновления'
      }, { status: 404 });
    }

    // Запускаем браузер для обновления сессии
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
      // Восстанавливаем сессию через UnifiedWBSessionManager (поддерживает старый и новый формат)
      const restoreResult = await sessionManager.restoreSessionContext(targetUserId, context);
      
      if (!restoreResult.isValid) {
        throw new Error(restoreResult.reason || 'Failed to restore session');
      }
      
      logger.info({ userId: targetUserId }, `🍪 Restored session with ${restoreResult.metadata?.cookieCount || 0} cookies`);

      // Переходим на главную страницу WB
      logger.debug('🌐 Navigating to WB main page');
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Проверяем, не перенаправило ли на страницу входа
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Session expired - redirect to login page');
      }

      // Ждем загрузки страницы и проверяем авторизацию
      logger.debug('⏳ Waiting for page load and checking authentication');
      
      const authResult = await waitForWBAuthentication(page, {
        timeout: 60000, // Увеличиваем timeout для загрузки WB портала
        retries: 6, // Больше попыток для загрузки
        retryDelay: 10000 // Больше времени между попытками
      });
      
      if (!authResult.isAuthenticated) {
        if (authResult.error?.includes('login page')) {
          throw new Error('Session expired - redirect to login page');
        } else {
          // Выполняем детальную диагностику сессии
          const diagnosticsService = new SessionDiagnosticsService();
          const integrity = await diagnosticsService.validateSessionIntegrity(page);
          
          if (!integrity.isValid) {
            logger.warn({ issues: integrity.issues }, '❌ Session integrity validation failed');
            throw new Error(`Session validation failed: ${integrity.issues.join(', ')}`);
          }
          
          logger.warn('⚠️ No auth selectors found, but session integrity is valid - continuing with session refresh');
        }
      }
      
      logger.info({ 
        foundSelectors: authResult.foundSelectors,
        diagnostic: authResult.diagnostic 
      }, '✅ Authentication confirmed');

      logger.info('✅ Session refresh successful');

      // Используем UnifiedWBSessionManager для обновления сессии (использует новый формат sessionData)
      await sessionManager.refreshSession(targetUserId, page, currentSession.id);

      // Получаем обновленную сессию
      const updatedSession = await sessionManager.getActiveSession(targetUserId);
      
      if (!updatedSession) {
        throw new Error('Failed to get updated session');
      }

      logger.info({ userId: targetUserId }, `💾 Session refreshed successfully`);

      return NextResponse.json({
        success: true,
        data: {
          sessionId: updatedSession.id,
          userId: targetUserId,
          expiresAt: updatedSession.expiresAt,
          message: 'Сессия обновлена успешно'
        }
      });

    } catch (error) {
      logger.error({ 
        userId: targetUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, '❌ Session refresh error');
      
      // Детальная диагностика ошибки
      let errorMessage = 'Ошибка обновления сессии';
      let shouldDeactivateSession = true;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Определяем тип ошибки
        if (error.message.includes('Timeout') || error.message.includes('timeout')) {
          logger.warn('🕐 Timeout error detected - session may still be valid');
          errorMessage = 'Таймаут при обновлении сессии. Попробуйте позже.';
          shouldDeactivateSession = false; // Не деактивируем при таймауте
        } else if (error.message.includes('Session expired') || error.message.includes('redirect to login')) {
          logger.warn('🔒 Session expired - deactivating session');
          errorMessage = 'Сессия истекла. Требуется повторная авторизация.';
        } else if (error.message.includes('Authentication not confirmed')) {
          logger.warn('⚠️ Authentication not confirmed - checking if session is still valid');
          errorMessage = 'Авторизация не подтверждена. Возможно, изменились селекторы на сайте.';
          // Не деактивируем сессию при проблемах с селекторами
          shouldDeactivateSession = false;
        }
      }
      
      // Деактивируем сессию только при определенных ошибках
      if (shouldDeactivateSession) {
        try {
          await sessionManager.deactivateSession(currentSession.id, errorMessage);
          logger.info({ sessionId: currentSession.id }, '🔒 Session deactivated due to error');
        } catch (dbError) {
          logger.error({ 
            error: dbError instanceof Error ? dbError.message : 'Unknown error'
          }, '❌ Failed to deactivate session');
        }
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: {
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          shouldDeactivateSession,
          sessionId: currentSession.id
        }
      }, { status: 500 });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'WB Session Refresh API error');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
