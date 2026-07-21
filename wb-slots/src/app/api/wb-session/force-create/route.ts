import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import { encrypt } from '@/lib/encryption';
import { WBPhoneAuthService } from '@/lib/services/wb-phone-auth-service';
import { Logger } from '@/lib/logging/logger';

/**
 * API для принудительного создания новой сессии WB
 */

const logger = new Logger();

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId, phoneNumber, smsCode } = body;
    const targetUserId = userId || user.id;

    // Проверяем права
    if (user.role !== 'ADMIN' && targetUserId !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен'
      }, { status: 403 });
    }

    // Проверяем наличие номера телефона
    if (!phoneNumber) {
      return NextResponse.json({
        success: false,
        error: 'Номер телефона обязателен для создания сессии'
      }, { status: 400 });
    }

    logger.info('🔄 Starting forced session creation', { userId: targetUserId, phone: phoneNumber });

    // Запускаем браузер
    const browser = await chromium.launch({
      headless: false, // Видимый браузер для пользователя
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
      viewport: { width: 1200, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
    });

    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    try {
      // Переходим на страницу авторизации WB
      logger.info('🌐 Navigating to WB login page...');
      await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(3000);

      // Используем сервис авторизации по телефону
      const phoneAuthService = new WBPhoneAuthService();
      
      // Выполняем авторизацию
      const authResult = await phoneAuthService.authenticateWithPhone(page, {
        phoneNumber,
        smsCode,
        timeout: 300000 // 5 минут на ввод SMS кода
      });

      if (!authResult.success) {
        return NextResponse.json({
          success: false,
          error: authResult.error || 'Ошибка авторизации',
          step: authResult.step
        }, { status: 400 });
      }

      // Если авторизация успешна, собираем данные сессии
      if (authResult.step === 'authenticated') {
        logger.info('✅ Authentication successful, collecting session data...');

        // Собираем cookies
        const cookies = await page.context().cookies();
        
        // Собираем localStorage
        const localStorage = await page.evaluate(() => {
          const data: Record<string, string> = {};
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) {
              data[key] = window.localStorage.getItem(key) || '';
            }
          }
          return data;
        });

        // Собираем sessionStorage
        const sessionStorage = await page.evaluate(() => {
          const data: Record<string, string> = {};
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key) {
              data[key] = window.sessionStorage.getItem(key) || '';
            }
          }
          return data;
        });

        // Деактивируем старые сессии пользователя
        await prisma.wBSession.updateMany({
          where: { userId: targetUserId },
          data: { isActive: false }
        });

        // Создаем новую сессию
        const sessionId = `wb_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const wbSession = await prisma.wBSession.create({
          data: {
            sessionId: sessionId,
            userId: targetUserId,
            cookiesEncrypted: encrypt(JSON.stringify(cookies)),
            localStorageEncrypted: encrypt(JSON.stringify(localStorage)),
            sessionStorageEncrypted: encrypt(JSON.stringify(sessionStorage)),
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
          },
        });

        logger.info('✅ New session created successfully', { sessionId: wbSession.sessionId });

        return NextResponse.json({
          success: true,
          data: {
            sessionId: wbSession.sessionId,
            userId: targetUserId,
            expiresAt: wbSession.expiresAt,
            message: 'Новая сессия создана успешно',
            cookies: cookies.length,
            localStorage: Object.keys(localStorage).length,
            sessionStorage: Object.keys(sessionStorage).length,
          }
        });

      } else if (authResult.step === 'sms_sent') {
        // Если SMS отправлен, ждем код от пользователя
        logger.info('📱 SMS sent, waiting for user input...');
        
        return NextResponse.json({
          success: true,
          data: {
            step: 'sms_sent',
            message: 'SMS код отправлен. Введите код в браузере и повторите запрос с параметром smsCode.',
            browserOpen: true
          }
        });

      } else {
        return NextResponse.json({
          success: false,
          error: 'Неожиданный результат авторизации',
          step: authResult.step
        }, { status: 400 });
      }

    } catch (error) {
      logger.error('❌ Force session creation error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка создания сессии'
      }, { status: 500 });
    } finally {
      // Не закрываем браузер сразу, чтобы пользователь мог ввести SMS код
      // Браузер будет закрыт в основном блоке try-catch
    }

  } catch (error) {
    logger.error('WB Force Session Creation API error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
