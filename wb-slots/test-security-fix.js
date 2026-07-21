/**
 * Тестовый скрипт для проверки исправления SecurityError
 * 
 * Запуск: node test-security-fix.js
 */

const puppeteer = require('puppeteer');

async function testSecurityFix() {
  console.log('🚀 Testing SecurityError fix...');
  
  let browser;
  try {
    // Запускаем браузер
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    
    // Переходим на страницу WB
    console.log('🌐 Navigating to WB page...');
    await page.goto('https://seller.wildberries.ru/ns/sm/supply-manager/supplies', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('✅ Page loaded successfully');
    
    // Тестируем безопасный доступ к localStorage
    console.log('🔍 Testing safe localStorage access...');
    
    const result = await page.evaluate(async () => {
      try {
        // Тестируем безопасный доступ к localStorage
        let authToken = null;
        let sessionId = null;
        let csrfToken = null;
        
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            authToken = window.localStorage.getItem('token') || window.localStorage.getItem('authToken');
            sessionId = window.localStorage.getItem('sessionId') || window.localStorage.getItem('session_id');
            csrfToken = window.localStorage.getItem('csrfToken') || window.localStorage.getItem('_csrf');
          }
        } catch (e) {
          console.log('localStorage access failed:', e.message);
        }
        
        // Fallback к cookies
        let cookies = {};
        try {
          if (typeof document !== 'undefined' && document.cookie) {
            cookies = document.cookie.split(';').reduce((acc, cookie) => {
              const [key, value] = cookie.trim().split('=');
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            }, {});
          }
        } catch (e) {
          console.log('Cookie access failed:', e.message);
        }
        
        return {
          success: true,
          authToken: authToken || 'Not found',
          sessionId: sessionId || 'Not found',
          csrfToken: csrfToken || 'Not found',
          cookies: Object.keys(cookies).length > 0 ? 'Found' : 'Not found',
          cookieCount: Object.keys(cookies).length,
          error: null
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('📊 Test result:', result);
    
    if (result.success) {
      console.log('✅ SecurityError fix successful!');
      console.log('🔑 Auth token:', result.authToken ? 'Found' : 'Not found');
      console.log('🆔 Session ID:', result.sessionId ? 'Found' : 'Not found');
      console.log('🛡️ CSRF token:', result.csrfToken ? 'Found' : 'Not found');
      console.log('🍪 Cookies:', result.cookies, `(${result.cookieCount} total)`);
    } else {
      console.log('❌ SecurityError fix failed:', result.error);
    }
    
    // Тестируем тестирование endpoints
    console.log('\n🧪 Testing endpoint testing...');
    
    const endpointTestResult = await page.evaluate(async () => {
      try {
        const testEndpoints = [
          'https://seller.wildberries.ru/ns/sm/supply-manager/api/v1/supply/booking',
          'https://seller.wildberries.ru/ns/sm/supply-manager/api/v1/slots/book',
          'https://seller.wildberries.ru/api/supply-manager/slots/book'
        ];
        
        const results = [];
        
        for (const url of testEndpoints) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              credentials: 'include'
            });
            
            results.push({
              url,
              status: response.status,
              ok: response.ok,
              note: response.status === 401 ? 'Endpoint exists but requires auth' : 
                    response.status === 405 ? 'Endpoint exists but wrong method' : 
                    response.ok ? 'Success' : 'Other error'
            });
            
          } catch (error) {
            results.push({
              url,
              status: 'Error',
              ok: false,
              note: error.message
            });
          }
        }
        
        return {
          success: true,
          results
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Endpoint test result:', endpointTestResult);
    
    if (endpointTestResult.success) {
      console.log('✅ Endpoint testing successful!');
      endpointTestResult.results.forEach((result, index) => {
        const status = result.ok ? '✅' : '❌';
        console.log(`${status} ${index + 1}. ${result.url} - ${result.status} (${result.note})`);
      });
    } else {
      console.log('❌ Endpoint testing failed:', endpointTestResult.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Запускаем тест
testSecurityFix().catch(console.error);
