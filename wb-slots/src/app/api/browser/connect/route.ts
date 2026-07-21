import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { browserDetectionService } from '@/lib/services/browser-detection-service';
import { getUnifiedSessionManager } from '@/lib/session';
// import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { 
      headless = false, 
      timeout = 5000, 
      retryAttempts = 3,
      saveSession = true 
    } = body;

    console.info('🔗 Browser connection request', { userId, options: { headless, timeout, retryAttempts, saveSession } });

    // Подключаемся к существующей сессии браузера
    const connectionResult = await browserDetectionService.connectToExistingSession(userId, {
      headless,
      timeout,
      retryAttempts
    });

    if (!connectionResult.success) {
      console.warn('❌ Failed to connect to browser', { userId, error: connectionResult.error });
      return NextResponse.json({
        success: false,
        error: connectionResult.error || 'Failed to connect to browser'
      }, { status: 400 });
    }

    // Если нужно сохранить сессию и есть данные для сохранения
    if (saveSession && connectionResult.sessionData) {
      try {
        const sessionManager = getUnifiedSessionManager();
        
        // Создаем временную страницу для сохранения сессии
        const browser = browserDetectionService.getBrowser();
        if (browser) {
          const context = await browser.newContext();
          const page = await context.newPage();
          
          // Применяем данные сессии к странице
          if (connectionResult.sessionData.cookies) {
            await context.addCookies(connectionResult.sessionData.cookies);
          }
          
          if (connectionResult.sessionData.localStorage) {
            await page.evaluate((storage) => {
              for (const [key, value] of Object.entries(storage)) {
                localStorage.setItem(key, value);
              }
            }, connectionResult.sessionData.localStorage);
          }
          
          if (connectionResult.sessionData.sessionStorage) {
            await page.evaluate((storage) => {
              for (const [key, value] of Object.entries(storage)) {
                sessionStorage.setItem(key, value);
              }
            }, connectionResult.sessionData.sessionStorage);
          }

          // Сохраняем сессию
          const sessionId = await sessionManager.createSession(userId, page);
          
          // Закрываем временную страницу
          await page.close();
          await context.close();

          console.info('✅ Session saved successfully', { userId, sessionId });

          return NextResponse.json({
            success: true,
            message: 'Successfully connected to browser and saved session',
            sessionId,
            sessionData: {
              url: connectionResult.sessionData.url,
              userAgent: connectionResult.sessionData.userAgent,
              viewport: connectionResult.sessionData.viewport,
              timestamp: connectionResult.sessionData.timestamp,
              cookiesCount: connectionResult.sessionData.cookies?.length || 0,
              localStorageKeys: Object.keys(connectionResult.sessionData.localStorage || {}).length,
              sessionStorageKeys: Object.keys(connectionResult.sessionData.sessionStorage || {}).length
            }
          });
        }
      } catch (error) {
        console.error('❌ Failed to save session', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
        // Не возвращаем ошибку, так как подключение к браузеру прошло успешно
      }
    }

    console.info('✅ Browser connection successful', { userId });

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to browser',
      sessionData: {
        url: connectionResult.sessionData?.url,
        userAgent: connectionResult.sessionData?.userAgent,
        viewport: connectionResult.sessionData?.viewport,
        timestamp: connectionResult.sessionData?.timestamp,
        cookiesCount: connectionResult.sessionData?.cookies?.length || 0,
        localStorageKeys: Object.keys(connectionResult.sessionData?.localStorage || {}).length,
        sessionStorageKeys: Object.keys(connectionResult.sessionData?.sessionStorage || {}).length
      }
    });

  } catch (error) {
    console.error('❌ Browser connection error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    console.info('🔍 Checking browser status', { userId });

    // Получаем статус браузера
    const browserStatus = await browserDetectionService.getBrowserStatus();

    // Проверяем, есть ли активная сессия пользователя
    const sessionManager = getUnifiedSessionManager();
    const activeSession = await sessionManager.getActiveSession(userId);

    console.info('📊 Browser status retrieved', { 
      userId, 
      browserStatus,
      hasActiveSession: !!activeSession
    });

    return NextResponse.json({
      success: true,
      browserStatus,
      hasActiveSession: !!activeSession,
      activeSession: activeSession ? {
        id: activeSession.id,
        isActive: activeSession.isActive,
        createdAt: activeSession.createdAt,
        lastUsedAt: activeSession.lastUsedAt,
        lastValidated: activeSession.lastValidated
      } : null
    });

  } catch (error) {
    console.error('❌ Browser status check error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
