/**
 * Тестовый скрипт для проверки мини-браузера авторизации
 * 
 * Запуск: node test-mini-browser.js
 */

const puppeteer = require('puppeteer');

async function testMiniBrowser() {
  console.log('🚀 Testing mini browser launch...');
  
  let browser;
  try {
    // Тестируем запуск браузера с теми же параметрами
    console.log('🔧 Launching browser with authentication settings...');
    
    browser = await puppeteer.launch({
      headless: false, // Показываем браузер пользователю
      defaultViewport: null,
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
        '--window-size=1200,800',
        '--start-maximized'
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
      timeout: 30000
    });
    
    console.log('✅ Browser launched successfully!');
    
    const page = await browser.newPage();
    console.log('✅ New page created!');
    
    // Тестируем навигацию
    console.log('🌐 Testing navigation to WB login page...');
    await page.goto('https://seller.wildberries.ru/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Navigation successful!');
    console.log('📍 Current URL:', page.url());
    
    // Проверяем заголовок страницы
    const title = await page.title();
    console.log('📄 Page title:', title);
    
    // Проверяем наличие элементов логина
    const loginElements = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="email"], input[type="text"], input[type="password"]');
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      const forms = document.querySelectorAll('form');
      
      return {
        inputCount: inputs.length,
        buttonCount: buttons.length,
        formCount: forms.length,
        hasLoginForm: forms.length > 0 || inputs.length > 0
      };
    });
    
    console.log('🔍 Login elements found:', loginElements);
    
    if (loginElements.hasLoginForm) {
      console.log('✅ Login form detected - browser is ready for authentication!');
    } else {
      console.log('⚠️ No login form detected - may need to wait for page load');
    }
    
    // Ждем 5 секунд для демонстрации
    console.log('⏳ Waiting 5 seconds to demonstrate browser functionality...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Mini browser test completed successfully!');
    
  } catch (error) {
    console.error('❌ Mini browser test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...');
      await browser.close();
      console.log('✅ Browser closed!');
    }
  }
}

// Запускаем тест
testMiniBrowser().catch(console.error);
