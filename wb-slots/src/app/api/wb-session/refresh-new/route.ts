import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { chromium } from 'playwright';
import { WBSessionManager, getUnifiedSessionManager } from '@/lib/session';
import { Logger } from '@/lib/logging/logger';

const logger = new Logger();

/**
 * API для обновления сессии WB с новой архитектурой
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId } = body;
    const targetUserId = userId || user.id;

    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Encryption key not configured'
      }, { status: 500 });
    }

    logger.info('🔄 Refreshing WB session with new architecture', { userId: targetUserId });

    const sessionManager = getUnifiedSessionManager();

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
      // Восстанавливаем сессию с новой архитектурой
      const restoration = await sessionManager.restoreSession(targetUserId, page);

      if (restoration.isValid) {
        logger.info('✅ Session restored and validated successfully', { userId: targetUserId });

        // Собираем обновленные данные сессии
        const updatedFingerprint = await sessionManager.createSession(targetUserId, page);

        return NextResponse.json({
          success: true,
          data: {
            message: 'Session refreshed successfully',
            fingerprint: updatedFingerprint.substring(0, 8) + '...',
            validation: restoration.details,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        logger.warn('⚠️ Session restoration failed', { 
          userId: targetUserId, 
          reason: restoration.reason,
          suggestions: restoration.suggestions 
        });

        // Деактивируем недействительную сессию
        await sessionManager.deactivateSession(targetUserId, restoration.reason || 'Validation failed');

        return NextResponse.json({
          success: false,
          error: restoration.reason || 'Session validation failed',
          suggestions: restoration.suggestions || ['Create new session through authentication'],
          details: restoration.details
        }, { status: 400 });
      }

    } catch (error) {
      logger.error('❌ Session refresh error', { userId: targetUserId, error: error instanceof Error ? error.message : 'Unknown error' });
      
      // Деактивируем сессию при ошибке
      await sessionManager.deactivateSession(targetUserId, `Refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: ['Create new session through authentication']
      }, { status: 500 });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

  } catch (error) {
    logger.error('WBSession Refresh API error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
