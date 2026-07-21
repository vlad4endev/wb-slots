// Тест восстановления WB сессии
const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');

const prisma = new PrismaClient();

async function testSessionRestoration() {
  let browser = null;
  let page = null;
  
  try {
    console.log('🧪 Тестирование восстановления WB сессии...');
    
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    
    // Получаем активную сессию
    const session = await prisma.wBSession.findFirst({
      where: {
        userId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!session) {
      console.log('❌ Активная WB сессия не найдена');
      return;
    }
    
    console.log('📋 Найдена WB сессия:', {
      sessionId: session.sessionId,
      isActive: session.isActive,
      expiresAt: session.expiresAt,
      hasCookies: !!session.cookiesEncrypted,
      hasLocalStorage: !!session.localStorageEncrypted,
      hasSessionStorage: !!session.sessionStorageEncrypted
    });
    
    // Запускаем браузер
    console.log('🚀 Запуск браузера...');
    browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    page = await context.newPage();
    
    // Простая функция расшифровки (для тестирования)
    function decrypt(encryptedData) {
      // Для тестирования просто возвращаем данные как есть
      // В реальной системе здесь должна быть настоящая расшифровка
      return encryptedData;
    }
    
    // Расшифровываем и восстанавливаем cookies
    console.log('🔓 Расшифровка cookies...');
    const decryptedCookies = session.cookiesEncrypted ? decrypt(session.cookiesEncrypted) : '[]';
    const cookies = JSON.parse(decryptedCookies);
    
    console.log(`📋 Восстановление ${cookies.length} cookies...`);
    await context.addCookies(cookies);
    
    // Переходим на главную страницу WB
    console.log('🌐 Переход на главную страницу WB...');
    await page.goto('https://seller.wildberries.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Проверяем URL
    const currentUrl = page.url();
    console.log('📍 Текущий URL:', currentUrl);
    
    if (currentUrl.includes('/login') || currentUrl.includes('seller-auth.wildberries.ru')) {
      console.log('❌ Перенаправление на страницу авторизации - сессия недействительна');
      return;
    }
    
    // Восстанавливаем localStorage и sessionStorage
    console.log('💾 Восстановление localStorage и sessionStorage...');
    const decryptedLocalStorage = session.localStorageEncrypted ? decrypt(session.localStorageEncrypted) : '{}';
    const decryptedSessionStorage = session.sessionStorageEncrypted ? decrypt(session.sessionStorageEncrypted) : '{}';
    
    await page.evaluate(({ localStorage, sessionStorage }) => {
      try {
        if (localStorage) {
          const localData = JSON.parse(localStorage);
          Object.keys(localData).forEach(key => {
            window.localStorage.setItem(key, localData[key]);
          });
          console.log(`Restored ${Object.keys(localData).length} localStorage items`);
        }
        if (sessionStorage) {
          const sessionData = JSON.parse(sessionStorage);
          Object.keys(sessionData).forEach(key => {
            window.sessionStorage.setItem(key, sessionData[key]);
          });
          console.log(`Restored ${Object.keys(sessionData).length} sessionStorage items`);
        }
      } catch (error) {
        console.warn('Failed to restore storage:', error);
      }
    }, { localStorage: decryptedLocalStorage, sessionStorage: decryptedSessionStorage });
    
    // Проверяем авторизацию
    console.log('🔍 Проверка авторизации...');
    const isAuthenticated = await page.evaluate(() => {
      const authIndicators = [
        '[data-testid="user-menu"]',
        '.user-info',
        '.profile-menu',
        '[data-testid="profile"]',
        '.header-user',
        '.user-dropdown',
        '.seller-header'
      ];
      
      return authIndicators.some(selector => document.querySelector(selector) !== null);
    });
    
    if (isAuthenticated) {
      console.log('✅ Пользователь авторизован!');
      
      // Пробуем перейти на страницу поставок
      console.log('🌐 Переход на страницу поставок...');
      await page.goto('https://seller.wildberries.ru/supplies-management/all-supplies', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await page.waitForTimeout(3000);
      
      const suppliesUrl = page.url();
      console.log('📍 URL страницы поставок:', suppliesUrl);
      
      if (suppliesUrl.includes('/login') || suppliesUrl.includes('seller-auth.wildberries.ru')) {
        console.log('❌ Перенаправление на страницу авторизации при переходе на поставки');
      } else {
        console.log('✅ Успешно перешли на страницу поставок!');
      }
      
    } else {
      console.log('❌ Пользователь не авторизован');
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    await prisma.$disconnect();
  }
}

testSessionRestoration();
