// ===== ROBUST BROWSER AUTOMATION EXAMPLE =====

import { 
  createBrowserService, 
  createSelectorStrategies, 
  createMultipleStrategies,
  type BrowserServiceConfig 
} from '../lib/browser';

/**
 * Пример использования робастной системы браузерной автоматизации
 */
async function robustBrowserExample() {
  console.log('🚀 Starting Robust Browser Automation Example');

  // Конфигурация сервиса
  const config: BrowserServiceConfig = {
    instanceId: 'example-browser',
    enableAntibot: true,
    enableAdaptiveTimeouts: true,
    enableSelectorResilience: true,
    enableHumanBehavior: true,
    customConfig: {
      headless: false, // Для демонстрации
      enableStealth: true
    }
  };

  // Создаем сервис
  const browserService = await createBrowserService(config);

  try {
    // 1. Навигация к странице
    console.log('📱 Navigating to Wildberries...');
    const navResult = await browserService.navigateTo('https://seller.wildberries.ru');
    
    if (!navResult.success) {
      console.error('❌ Navigation failed:', navResult.error);
      return;
    }
    
    console.log('✅ Navigation successful', {
      duration: navResult.metrics.duration,
      attempts: navResult.metrics.attempts
    });

    // 2. Поиск элемента с множественными стратегиями
    console.log('🔍 Searching for login elements...');
    
    const loginStrategies = createMultipleStrategies([
      {
        name: 'modern-selectors',
        selectors: [
          '[data-testid="login-button"]',
          '[data-testid="auth-button"]',
          '.login-btn',
          '.auth-btn'
        ],
        priority: 100
      },
      {
        name: 'classic-selectors',
        selectors: [
          'button[type="submit"]',
          'input[type="submit"]',
          '.btn-primary',
          '.btn-login'
        ],
        priority: 80
      },
      {
        name: 'text-based-selectors',
        selectors: [
          'text="Войти"',
          'text="Вход"',
          'text="Login"',
          'text="Sign in"'
        ],
        priority: 60
      },
      {
        name: 'fallback-selectors',
        selectors: [
          'button:has-text("Войти")',
          'a:has-text("Вход")',
          'input[value*="Войти"]'
        ],
        priority: 40
      }
    ]);

    const elementResult = await browserService.findElement(
      loginStrategies,
      'login button'
    );

    if (!elementResult.success) {
      console.error('❌ Element not found:', elementResult.error);
      return;
    }

    console.log('✅ Element found successfully', {
      duration: elementResult.metrics.duration,
      attempts: elementResult.metrics.attempts
    });

    // 3. Клик с человеческим поведением
    console.log('🖱️ Clicking element with human behavior...');
    const clickResult = await browserService.clickElement(
      loginStrategies,
      'login button',
      { humanBehavior: true, scrollIntoView: true }
    );

    if (!clickResult.success) {
      console.error('❌ Click failed:', clickResult.error);
      return;
    }

    console.log('✅ Click successful', {
      duration: clickResult.metrics.duration,
      attempts: clickResult.metrics.attempts
    });

    // 4. Ввод текста с человеческим поведением
    console.log('⌨️ Typing text with human behavior...');
    
    const emailStrategies = createSelectorStrategies([
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="email"]',
      'input[placeholder*="почта"]',
      '#email',
      '.email-input'
    ], 'email-input', 100);

    const typeResult = await browserService.typeText(
      emailStrategies,
      'test@example.com',
      'email input',
      { humanBehavior: true }
    );

    if (!typeResult.success) {
      console.error('❌ Text input failed:', typeResult.error);
      return;
    }

    console.log('✅ Text input successful', {
      duration: typeResult.metrics.duration,
      attempts: typeResult.metrics.attempts
    });

    // 5. Скролл страницы
    console.log('📜 Scrolling page...');
    const scrollResult = await browserService.scrollPage('down');
    
    if (scrollResult.success) {
      console.log('✅ Scroll successful');
    } else {
      console.error('❌ Scroll failed:', scrollResult.error);
    }

    // 6. Создание скриншота
    console.log('📸 Taking screenshot...');
    const screenshotResult = await browserService.takeScreenshot();
    
    if (screenshotResult.success) {
      console.log('✅ Screenshot saved:', screenshotResult.data);
    } else {
      console.error('❌ Screenshot failed:', screenshotResult.error);
    }

    // 7. Получение информации о странице
    console.log('📄 Page information:');
    console.log('URL:', browserService.getCurrentUrl());
    console.log('Title:', await browserService.getPageTitle());

    console.log('🎉 Example completed successfully!');

  } catch (error) {
    console.error('❌ Example failed:', error);
  } finally {
    // Закрываем сервис
    await browserService.close();
    console.log('🔒 Browser service closed');
  }
}

/**
 * Пример работы с адаптивными таймаутами
 */
async function adaptiveTimeoutExample() {
  console.log('⏱️ Starting Adaptive Timeout Example');

  const config: BrowserServiceConfig = {
    instanceId: 'timeout-example',
    enableAdaptiveTimeouts: true,
    enableAntibot: false,
    enableSelectorResilience: false,
    enableHumanBehavior: false
  };

  const browserService = await createBrowserService(config);

  try {
    // Первая навигация - будет использован базовый таймаут
    console.log('📱 First navigation (base timeout)...');
    const nav1 = await browserService.navigateTo('https://example.com');
    console.log('Navigation 1:', {
      success: nav1.success,
      duration: nav1.metrics.duration
    });

    // Вторая навигация - таймаут будет адаптирован
    console.log('📱 Second navigation (adaptive timeout)...');
    const nav2 = await browserService.navigateTo('https://httpbin.org/delay/2');
    console.log('Navigation 2:', {
      success: nav2.success,
      duration: nav2.metrics.duration
    });

    // Третья навигация - таймаут будет еще больше адаптирован
    console.log('📱 Third navigation (further adapted timeout)...');
    const nav3 = await browserService.navigateTo('https://httpbin.org/delay/5');
    console.log('Navigation 3:', {
      success: nav3.success,
      duration: nav3.metrics.duration
    });

  } catch (error) {
    console.error('❌ Timeout example failed:', error);
  } finally {
    await browserService.close();
  }
}

/**
 * Пример работы с антибот защитой
 */
async function antibotExample() {
  console.log('🛡️ Starting Antibot Protection Example');

  const config: BrowserServiceConfig = {
    instanceId: 'antibot-example',
    enableAntibot: true,
    enableAdaptiveTimeouts: false,
    enableSelectorResilience: false,
    enableHumanBehavior: true
  };

  const browserService = await createBrowserService(config);

  try {
    // Навигация к странице с антибот защитой
    console.log('📱 Navigating to protected page...');
    const navResult = await browserService.navigateTo('https://bot.sannysoft.com/');
    
    if (navResult.success && navResult.metrics.detectionResult) {
      const detection = navResult.metrics.detectionResult;
      console.log('🔍 Detection result:', {
        isDetected: detection.isDetected,
        confidence: detection.confidence,
        indicators: detection.indicators,
        recommendations: detection.recommendations
      });
    }

    // Создание скриншота для анализа
    const screenshotResult = await browserService.takeScreenshot('antibot-test.png');
    if (screenshotResult.success) {
      console.log('📸 Screenshot saved for analysis:', screenshotResult.data);
    }

  } catch (error) {
    console.error('❌ Antibot example failed:', error);
  } finally {
    await browserService.close();
  }
}

// Экспорт функций для использования
export {
  robustBrowserExample,
  adaptiveTimeoutExample,
  antibotExample
};

// Запуск примера, если файл выполняется напрямую
if (require.main === module) {
  robustBrowserExample()
    .then(() => console.log('✅ Example completed'))
    .catch(error => console.error('❌ Example failed:', error));
}
