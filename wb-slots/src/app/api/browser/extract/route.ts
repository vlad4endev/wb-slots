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
      saveToDatabase = true,
      includeCookies = true,
      includeLocalStorage = true,
      includeSessionStorage = true
    } = body;

    console.info('📤 Browser data extraction request', { 
      userId, 
      options: { saveToDatabase, includeCookies, includeLocalStorage, includeSessionStorage }
    });

    // Обнаруживаем открытый браузер
    const browserInfo = await browserDetectionService.detectOpenBrowser({
      headless: false,
      timeout: 10000,
      retryAttempts: 3
    });

    if (!browserInfo.isOpen) {
      return NextResponse.json({
        success: false,
        error: 'No open browser detected. Please open a browser and navigate to Wildberries.'
      }, { status: 404 });
    }

    // Подготавливаем данные для извлечения
    const extractionData: any = {
      url: browserInfo.url,
      userAgent: browserInfo.userAgent,
      viewport: browserInfo.viewport,
      timestamp: browserInfo.timestamp
    };

    if (includeCookies && browserInfo.cookies) {
      extractionData.cookies = browserInfo.cookies;
    }

    if (includeLocalStorage && browserInfo.localStorage) {
      extractionData.localStorage = browserInfo.localStorage;
    }

    if (includeSessionStorage && browserInfo.sessionStorage) {
      extractionData.sessionStorage = browserInfo.sessionStorage;
    }

    // Если нужно сохранить в базу данных
    if (saveToDatabase) {
      try {
        const sessionManager = getUnifiedSessionManager();
        
        // Создаем временную страницу для сохранения сессии
        const browser = browserDetectionService.getBrowser();
        if (browser) {
          const context = await browser.newContext();
          const page = await context.newPage();
          
          // Применяем данные сессии к странице
          if (extractionData.cookies) {
            await context.addCookies(extractionData.cookies);
          }
          
          if (extractionData.localStorage) {
            await page.evaluate((storage) => {
              for (const [key, value] of Object.entries(storage)) {
                localStorage.setItem(key, value);
              }
            }, extractionData.localStorage);
          }
          
          if (extractionData.sessionStorage) {
            await page.evaluate((storage) => {
              for (const [key, value] of Object.entries(storage)) {
                sessionStorage.setItem(key, value);
              }
            }, extractionData.sessionStorage);
          }

          // Сохраняем сессию
          const sessionId = await sessionManager.createSession(userId, page);
          
          // Закрываем временную страницу
          await page.close();
          await context.close();

          console.info('✅ Session data extracted and saved', { 
            userId, 
            sessionId,
            cookiesCount: extractionData.cookies?.length || 0,
            localStorageKeys: Object.keys(extractionData.localStorage || {}).length,
            sessionStorageKeys: Object.keys(extractionData.sessionStorage || {}).length
          });

          return NextResponse.json({
            success: true,
            message: 'Browser data extracted and saved successfully',
            sessionId,
            data: {
              url: extractionData.url,
              userAgent: extractionData.userAgent,
              viewport: extractionData.viewport,
              timestamp: extractionData.timestamp,
              cookiesCount: extractionData.cookies?.length || 0,
              localStorageKeys: Object.keys(extractionData.localStorage || {}).length,
              sessionStorageKeys: Object.keys(extractionData.sessionStorage || {}).length
            }
          });
        }
      } catch (error) {
        console.error('❌ Failed to save extracted data', { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        return NextResponse.json({
          success: false,
          error: 'Failed to save extracted data to database'
        }, { status: 500 });
      }
    }

    // Возвращаем только извлеченные данные без сохранения
    console.info('✅ Browser data extracted successfully', { 
      userId,
      cookiesCount: extractionData.cookies?.length || 0,
      localStorageKeys: Object.keys(extractionData.localStorage || {}).length,
      sessionStorageKeys: Object.keys(extractionData.sessionStorage || {}).length
    });

    return NextResponse.json({
      success: true,
      message: 'Browser data extracted successfully',
      data: extractionData
    });

  } catch (error) {
    console.error('❌ Browser data extraction error', { 
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

    console.info('🔍 Checking browser data availability', { userId });

    // Проверяем доступность данных браузера
    const browserInfo = await browserDetectionService.detectOpenBrowser({
      headless: false,
      timeout: 5000,
      retryAttempts: 1
    });

    const hasData = browserInfo.isOpen && (
      (browserInfo.cookies && browserInfo.cookies.length > 0) ||
      (browserInfo.localStorage && Object.keys(browserInfo.localStorage).length > 0) ||
      (browserInfo.sessionStorage && Object.keys(browserInfo.sessionStorage).length > 0)
    );

    console.info('📊 Browser data availability check completed', { 
      userId, 
      isOpen: browserInfo.isOpen,
      hasData,
      url: browserInfo.url
    });

    return NextResponse.json({
      success: true,
      isOpen: browserInfo.isOpen,
      hasData,
      url: browserInfo.url,
      userAgent: browserInfo.userAgent,
      timestamp: browserInfo.timestamp,
      dataSummary: {
        cookiesCount: browserInfo.cookies?.length || 0,
        localStorageKeys: Object.keys(browserInfo.localStorage || {}).length,
        sessionStorageKeys: Object.keys(browserInfo.sessionStorage || {}).length
      }
    });

  } catch (error) {
    console.error('❌ Browser data availability check error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
