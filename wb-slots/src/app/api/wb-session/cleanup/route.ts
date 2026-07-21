import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionDiagnosticsService } from '@/lib/utils/session-diagnostics';
import { chromium } from 'playwright';
import { decrypt } from '@/lib/encryption';
import { Logger } from '@/lib/logging/logger';

/**
 * API для очистки недействительных сессий WB
 */

const logger = new Logger();

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId, action } = body;
    const targetUserId = userId || user.id;

    // Проверяем права
    if (user.role !== 'ADMIN' && targetUserId !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен'
      }, { status: 403 });
    }

    logger.info('🧹 Starting session cleanup', { userId: targetUserId, action });

    let result: any = {};

    switch (action) {
      case 'deactivate-invalid':
        // Деактивируем недействительные сессии
        result = await deactivateInvalidSessions(targetUserId);
        break;

      case 'deactivate-all':
        // Деактивируем все сессии пользователя
        result = await deactivateAllUserSessions(targetUserId);
        break;

      case 'validate-and-cleanup':
        // Валидируем и очищаем сессии
        result = await validateAndCleanupSessions(targetUserId);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Неверное действие. Доступные: deactivate-invalid, deactivate-all, validate-and-cleanup'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        userId: targetUserId,
        ...result
      }
    });

  } catch (error) {
    logger.error('WB Session Cleanup API error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Деактивирует недействительные сессии
 */
async function deactivateInvalidSessions(userId: string): Promise<any> {
  try {
    logger.info('🔍 Checking sessions for validity...');

    // Получаем все активные сессии пользователя
    const sessions = await prisma.wBSession.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (sessions.length === 0) {
      return {
        message: 'Нет активных сессий для проверки',
        deactivatedCount: 0,
        totalSessions: 0
      };
    }

    let deactivatedCount = 0;
    const invalidSessions: string[] = [];

    // Проверяем каждую сессию
    for (const session of sessions) {
      try {
        // Проверяем, истекла ли сессия
        if (session.expiresAt && session.expiresAt < new Date()) {
          await prisma.wBSession.update({
            where: { id: session.id },
            data: { isActive: false }
          });
          deactivatedCount++;
          invalidSessions.push(session.sessionId);
          logger.info('⏰ Deactivated expired session', { sessionId: session.sessionId });
          continue;
        }

        // Проверяем валидность cookies
        if (!session.cookiesEncrypted) {
          await prisma.wBSession.update({
            where: { id: session.id },
            data: { isActive: false }
          });
          deactivatedCount++;
          invalidSessions.push(session.sessionId);
          logger.info('🍪 Deactivated session without cookies', { sessionId: session.sessionId });
          continue;
        }

        // Проверяем, можно ли расшифровать cookies
        try {
          const decryptedCookies = JSON.parse(decrypt(session.cookiesEncrypted));
          if (!Array.isArray(decryptedCookies) || decryptedCookies.length === 0) {
            await prisma.wBSession.update({
              where: { id: session.id },
              data: { isActive: false }
            });
            deactivatedCount++;
            invalidSessions.push(session.sessionId);
            logger.info('🔓 Deactivated session with invalid cookies', { sessionId: session.sessionId });
            continue;
          }
        } catch (error) {
          await prisma.wBSession.update({
            where: { id: session.id },
            data: { isActive: false }
          });
          deactivatedCount++;
          invalidSessions.push(session.sessionId);
          logger.info('🔓 Deactivated session with corrupted cookies', { sessionId: session.sessionId });
          continue;
        }

      } catch (error) {
        logger.error('❌ Error checking session', { sessionId: session.sessionId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    logger.info('✅ Session cleanup completed', { 
      totalSessions: sessions.length, 
      deactivatedCount 
    });

    return {
      message: `Проверено ${sessions.length} сессий, деактивировано ${deactivatedCount}`,
      deactivatedCount,
      totalSessions: sessions.length,
      invalidSessions
    };

  } catch (error) {
    logger.error('❌ Failed to deactivate invalid sessions', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Деактивирует все сессии пользователя
 */
async function deactivateAllUserSessions(userId: string): Promise<any> {
  try {
    logger.info('🧹 Deactivating all user sessions...');

    const result = await prisma.wBSession.updateMany({
      where: { userId },
      data: { isActive: false }
    });

    logger.info('✅ All sessions deactivated', { count: result.count });

    return {
      message: `Деактивировано ${result.count} сессий`,
      deactivatedCount: result.count
    };

  } catch (error) {
    logger.error('❌ Failed to deactivate all sessions', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Валидирует сессии через браузер и очищает недействительные
 */
async function validateAndCleanupSessions(userId: string): Promise<any> {
  try {
    logger.info('🔍 Validating sessions through browser...');

    // Получаем самую новую активную сессию
    const session = await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      return {
        message: 'Нет активных сессий для валидации',
        validated: false
      };
    }

    // Запускаем браузер для валидации
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

      // Переходим на страницу WB
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      // Выполняем диагностику
      const diagnosticsService = new SessionDiagnosticsService();
      const integrity = await diagnosticsService.validateSessionIntegrity(page);

      // Если сессия недействительна, деактивируем её
      if (!integrity.isValid) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });

        logger.info('❌ Session invalid, deactivated', { sessionId: session.sessionId });

        return {
          message: 'Сессия недействительна и деактивирована',
          validated: false,
          issues: integrity.issues,
          recommendations: integrity.recommendations
        };
      } else {
        logger.info('✅ Session valid', { sessionId: session.sessionId });

        return {
          message: 'Сессия действительна',
          validated: true,
          sessionId: session.sessionId
        };
      }

    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

  } catch (error) {
    logger.error('❌ Failed to validate sessions', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}
