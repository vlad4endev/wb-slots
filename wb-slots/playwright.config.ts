import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация Playwright для модуля автобронирования
 * 
 * Этот файл настраивает Playwright для:
 * - Автоматического бронирования слотов
 * - Тестирования функциональности
 * - Отладки и мониторинга
 */

export default defineConfig({
  // Тестовые директории
  testDir: './src/__tests__/e2e',
  
  // Параллельное выполнение тестов
  fullyParallel: true,
  
  // Не завершать тесты при первой ошибке
  forbidOnly: !!process.env.CI,
  
  // Повторные попытки только в CI
  retries: process.env.CI ? 2 : 0,
  
  // Количество воркеров
  workers: process.env.CI ? 1 : undefined,
  
  // Репортеры
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
  
  // Глобальные настройки
  use: {
    // Базовый URL для тестов
    baseURL: 'https://seller.wildberries.ru',
    
    // Увеличенные таймауты для стабильности
    actionTimeout: 60000,
    navigationTimeout: 60000,
    
    // Скриншоты при ошибках
    screenshot: 'only-on-failure',
    
    // Видео при ошибках
    video: 'retain-on-failure',
    
    // Трассировка
    trace: 'retain-on-failure',
    
    // Игнорирование HTTPS ошибок
    ignoreHTTPSErrors: true,
  },

  // Конфигурация проектов для разных браузеров
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Дополнительные настройки для Chromium
        launchOptions: {
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
          ],
        },
      },
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Дополнительные настройки для Firefox
        launchOptions: {
          firefoxUserPrefs: {
            'security.tls.insecure_fallback_hosts': 'seller.wildberries.ru',
            'security.tls.unrestricted_rc4_fallback': true,
          },
        },
      },
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        // Дополнительные настройки для WebKit
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
          ],
        },
      },
    },

    // Мобильные устройства
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Настройки веб-сервера для тестов
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Глобальная настройка
  globalSetup: './src/__tests__/setup/global-setup.ts',
  globalTeardown: './src/__tests__/setup/global-teardown.ts',
});

// Дополнительные настройки для автобронирования
export const bookingConfig = {
  // Таймауты для автобронирования
  timeouts: {
    pageLoad: 60000,
    action: 30000,
    navigation: 60000,
    booking: 120000,
  },
  
  // Настройки браузера для автобронирования
  browser: {
    headless: process.env.NODE_ENV === 'production',
    viewport: { width: 1920, height: 1080 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  
  // Настройки сессий
  session: {
    statePath: './wb-session-state.json',
    maxAge: 24 * 60 * 60 * 1000, // 24 часа
    cleanupInterval: 60 * 60 * 1000, // 1 час
  },
  
  // Настройки повторных попыток
  retry: {
    maxAttempts: 3,
    delay: 5000,
    backoffMultiplier: 2,
  },
  
  // Настройки логирования
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
    enableScreenshots: true,
    enableTraces: true,
    enableVideos: false,
  },
  
  // Настройки уведомлений
  notifications: {
    enableTelegram: true,
    enableEmail: false,
    enableWebhook: false,
  },
};
