/**
 * Тестовый скрипт для проверки обнаружения API endpoints WB
 * 
 * Запуск: node test-endpoint-discovery.js
 */

const puppeteer = require('puppeteer');

async function testEndpointDiscovery() {
  console.log('🚀 Starting endpoint discovery test...');
  
  let browser;
  try {
    // Запускаем браузер
    browser = await puppeteer.launch({
      headless: false, // Показываем браузер для отладки
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    
    // Настраиваем перехватчики для мониторинга запросов
    const requests = [];
    const responses = [];
    
    const requestHandler = (request) => {
      const url = request.url();
      const method = request.method();
      
      if (url.includes('seller.wildberries.ru') && 
          (url.includes('api') || url.includes('slot') || url.includes('booking') || url.includes('supply'))) {
        requests.push({
          url,
          method,
          headers: request.headers(),
          postData: request.postData()
        });
        console.log(`📤 Request: ${method} ${url}`);
      }
    };
    
    const responseHandler = (response) => {
      const url = response.url();
      const method = response.request().method();
      const status = response.status();
      
      if (url.includes('seller.wildberries.ru') && 
          (url.includes('api') || url.includes('slot') || url.includes('booking') || url.includes('supply'))) {
        responses.push({
          url,
          method,
          status,
          headers: response.headers()
        });
        console.log(`📥 Response: ${method} ${url} - ${status}`);
      }
    };
    
    page.on('request', requestHandler);
    page.on('response', responseHandler);
    
    // Переходим на страницу WB
    console.log('🌐 Navigating to WB supplies page...');
    await page.goto('https://seller.wildberries.ru/ns/sm/supply-manager/supplies', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Ждем некоторое время для сбора запросов
    console.log('⏳ Monitoring network requests for 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Убираем обработчики
    page.off('request', requestHandler);
    page.off('response', responseHandler);
    
    console.log(`\n📊 Discovery Results:`);
    console.log(`📤 Total requests: ${requests.length}`);
    console.log(`📥 Total responses: ${responses.length}`);
    
    // Анализируем найденные endpoints
    const uniqueEndpoints = new Map();
    
    responses.forEach(response => {
      if (response.status === 200 || response.status === 201) {
        const key = `${response.method}:${response.url}`;
        if (!uniqueEndpoints.has(key)) {
          uniqueEndpoints.set(key, {
            url: response.url,
            method: response.method,
            status: response.status,
            headers: response.headers
          });
        }
      }
    });
    
    const potentialBookingEndpoints = Array.from(uniqueEndpoints.values()).filter(endpoint => 
      endpoint.url.includes('slot') || 
      endpoint.url.includes('booking') || 
      endpoint.url.includes('supply') ||
      endpoint.url.includes('book')
    );
    
    console.log(`\n🎯 Potential booking endpoints (${potentialBookingEndpoints.length}):`);
    potentialBookingEndpoints.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.method} ${endpoint.url} (${endpoint.status})`);
    });
    
    // Пробуем найти endpoints через анализ страницы
    console.log('\n🔍 Analyzing page for API endpoints...');
    const pageEndpoints = await page.evaluate(() => {
      const endpoints = [];
      
      // Ищем формы с action
      const forms = document.querySelectorAll('form[action]');
      forms.forEach(form => {
        const action = form.getAttribute('action');
        const method = form.getAttribute('method') || 'POST';
        if (action && action.includes('api')) {
          endpoints.push({
            url: action.startsWith('http') ? action : `https://seller.wildberries.ru${action}`,
            method: method.toUpperCase(),
            source: 'form'
          });
        }
      });
      
      // Ищем ссылки на API
      const links = document.querySelectorAll('a[href*="api"]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          endpoints.push({
            url: href.startsWith('http') ? href : `https://seller.wildberries.ru${href}`,
            method: 'GET',
            source: 'link'
          });
        }
      });
      
      return endpoints;
    });
    
    console.log(`\n📄 Page endpoints (${pageEndpoints.length}):`);
    pageEndpoints.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.method} ${endpoint.url} (${endpoint.source})`);
    });
    
    // Объединяем все найденные endpoints
    const allEndpoints = [...potentialBookingEndpoints, ...pageEndpoints];
    const uniqueEndpointsMap = new Map();
    allEndpoints.forEach(endpoint => {
      const key = `${endpoint.method}:${endpoint.url}`;
      if (!uniqueEndpointsMap.has(key)) {
        uniqueEndpointsMap.set(key, endpoint);
      }
    });
    
    const finalEndpoints = Array.from(uniqueEndpointsMap.values());
    
    console.log(`\n✅ Final unique endpoints (${finalEndpoints.length}):`);
    finalEndpoints.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.method} ${endpoint.url}`);
    });
    
    // Тестируем endpoints
    console.log('\n🧪 Testing endpoints...');
    for (const endpoint of finalEndpoints.slice(0, 5)) { // Тестируем только первые 5
      try {
        console.log(`🔍 Testing ${endpoint.method} ${endpoint.url}`);
        
        const testResult = await page.evaluate(async (endpointData) => {
          try {
            const response = await fetch(endpointData.url, {
              method: endpointData.method,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              credentials: 'include'
            });
            
            return {
              url: endpointData.url,
              method: endpointData.method,
              status: response.status,
              statusText: response.statusText,
              ok: response.ok
            };
          } catch (error) {
            return {
              url: endpointData.url,
              method: endpointData.method,
              error: error.message,
              ok: false
            };
          }
        }, endpoint);
        
        if (testResult.ok) {
          console.log(`✅ Working: ${testResult.method} ${testResult.url} (${testResult.status})`);
        } else {
          console.log(`❌ Failed: ${testResult.method} ${testResult.url} (${testResult.status} ${testResult.statusText})`);
        }
        
        // Задержка между тестами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ Error testing ${endpoint.method} ${endpoint.url}:`, error.message);
      }
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
testEndpointDiscovery().catch(console.error);
