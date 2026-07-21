// Продвинутый тест Playwright модуля с реальными сессиями
const { chromium } = require('playwright');

async function testPlaywrightAdvanced() {
  console.log('🧪 Продвинутый тест Playwright модуля...');
  
  try {
    // Список User-Agent для ротации
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];

    // Функция для имитации человеческого поведения
    const humanDelay = (min, max) => {
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      return new Promise(resolve => setTimeout(resolve, delay));
    };

    // Функция для имитации движения мыши
    const simulateMouseMovement = async (page) => {
      try {
        const x = Math.floor(Math.random() * 800) + 100;
        const y = Math.floor(Math.random() * 600) + 100;
        await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
        await humanDelay(100, 500);
      } catch (error) {
        // Игнорируем ошибки движения мыши
      }
    };

    // Тестируем несколько User-Agent
    for (let i = 0; i < 3; i++) {
      console.log(`\n🔄 Тест ${i + 1}/3 с User-Agent ${i + 1}`);
      
      const userAgent = userAgents[i];
      console.log(`📱 User-Agent: ${userAgent.substring(0, 50)}...`);
      
      // Запускаем браузер с ротацией User-Agent
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
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-plugins',
          '--user-agent=' + userAgent
        ],
      });

      // Создаем контекст с продвинутыми настройками
      const context = await browser.newContext({
        userAgent: userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });

      // Создаем страницу
      const page = await context.newPage();

      // Анти-детекция скрипты
      await page.addInitScript(() => {
        // Удаляем признаки автоматизации
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        delete window.chrome;
        delete window.navigator.webdriver;
        
        // Переопределяем permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      // Имитируем человеческое поведение
      await humanDelay(1000, 3000);
      await simulateMouseMovement(page);

      // Переходим на Wildberries
      console.log('🌐 Переход на Wildberries...');
      const response = await page.goto('https://seller.wildberries.ru/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log(`✅ Статус ответа: ${response.status()}`);

      // Имитируем человеческое поведение
      await simulateMouseMovement(page);
      await humanDelay(2000, 4000);

      // Проверяем, загрузился ли JavaScript
      const hasJavaScript = await page.evaluate(() => {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
      });

      console.log(`✅ JavaScript работает: ${hasJavaScript}`);

      // Проверяем, есть ли анти-бот защита
      const bodyText = await page.textContent('body');
      const hasAntiBot = bodyText.includes('You need to enable JavaScript');
      const hasRussianContent = bodyText.includes('Wildberries') || bodyText.includes('Вход');

      console.log(`⚠️ Анти-бот защита: ${hasAntiBot}`);
      console.log(`🇷🇺 Русский контент: ${hasRussianContent}`);

      if (hasAntiBot) {
        console.log('❌ Wildberries блокирует автоматизацию');
      } else if (hasRussianContent) {
        console.log('✅ Wildberries доступен для автоматизации');
      } else {
        console.log('⚠️ Неопределенный статус');
      }

      // Закрываем браузер
      await browser.close();
      console.log('✅ Браузер закрыт');
      
      // Задержка между тестами
      await humanDelay(2000, 5000);
    }

    console.log('\n🎉 Продвинутое тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

testPlaywrightAdvanced();
