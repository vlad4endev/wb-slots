// Простой тест Playwright модуля
const { chromium } = require('playwright');

async function testPlaywrightDirect() {
  console.log('🧪 Тестирование Playwright модуля напрямую...');
  
  try {
    // Запускаем браузер
    console.log('1. Запуск браузера...');
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('✅ Браузер запущен');
    
    // Создаем контекст
    console.log('2. Создание контекста...');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    console.log('✅ Контекст создан');
    
    // Создаем страницу
    console.log('3. Создание страницы...');
    const page = await context.newPage();
    
    console.log('✅ Страница создана');
    
    // Переходим на Wildberries
    console.log('4. Переход на Wildberries...');
    const response = await page.goto('https://seller.wildberries.ru/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('✅ Переход выполнен, статус:', response.status());
    
    // Проверяем, загрузился ли JavaScript
    console.log('5. Проверка JavaScript...');
    const hasJavaScript = await page.evaluate(() => {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    });
    
    console.log('✅ JavaScript работает:', hasJavaScript);
    
    // Проверяем, есть ли анти-бот защита
    console.log('6. Проверка анти-бот защиты...');
    const bodyText = await page.textContent('body');
    const hasAntiBot = bodyText.includes('You need to enable JavaScript');
    
    console.log('⚠️ Анти-бот защита обнаружена:', hasAntiBot);
    
    if (hasAntiBot) {
      console.log('❌ Wildberries блокирует автоматизацию');
    } else {
      console.log('✅ Wildberries доступен для автоматизации');
    }
    
    // Закрываем браузер
    await browser.close();
    console.log('✅ Браузер закрыт');
    
    console.log('\n🎉 Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

testPlaywrightDirect();
