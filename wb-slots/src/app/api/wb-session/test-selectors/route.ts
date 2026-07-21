import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import { decrypt } from '@/lib/encryption';
import { WB_SELECTORS } from '@/lib/utils/wb-auth-selectors';
import { WBSuppliesService } from '@/lib/services/wb-supplies-service';
import { WBCalendarService } from '@/lib/services/wb-calendar-service';

/**
 * API для тестирования новых селекторов WB
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { action, userId } = body;
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
        error: 'Нет активной сессии для тестирования'
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

      // Переходим на страницу поставок
      await page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      let result: any = {};

      switch (action) {
        case 'test-auth-selectors':
          // Тестируем селекторы авторизации
          result = await page.evaluate(() => {
            const foundSelectors: string[] = [];
            
            WB_SELECTORS.AUTH_INDICATORS.forEach(selector => {
              try {
                const element = document.querySelector(selector);
                if (element) {
                  foundSelectors.push(selector);
                }
              } catch (e) {
                // Игнорируем ошибки
              }
            });

            return {
              foundSelectors,
              totalSelectors: WB_SELECTORS.AUTH_INDICATORS.length,
              currentUrl: window.location.href,
              pageTitle: document.title
            };
          });
          break;

        case 'test-supplies':
          // Тестируем работу с поставками
          const suppliesService = new WBSuppliesService();
          const supplies = await suppliesService.getSuppliesList(page);
          result = {
            supplies,
            count: supplies.length,
            availableSupplies: supplies.filter(s => s.canPlan).length
          };
          break;

        case 'test-calendar':
          // Тестируем календарь (если есть активная поставка)
          const calendarService = new WBCalendarService();
          const suppliesService2 = new WBSuppliesService();
          
          // Сначала выбираем поставку
          const selectResult = await suppliesService2.selectAndPlanFirstAvailableSupply(page);
          if (selectResult.success) {
            const slots = await calendarService.getAvailableSlots(page);
            result = {
              calendarOpened: true,
              slots,
              freeSlots: slots.filter(s => s.isFree).length
            };
          } else {
            result = {
              calendarOpened: false,
              error: selectResult.message
            };
          }
          break;

        default:
          return NextResponse.json({
            success: false,
            error: 'Неверное действие. Доступные: test-auth-selectors, test-supplies, test-calendar'
          }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: {
          action,
          sessionId: session.sessionId,
          result
        }
      });

    } catch (error) {
      console.error('❌ Selector test error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка тестирования селекторов'
      }, { status: 500 });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }

  } catch (error) {
    console.error('WB Selector Test API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
