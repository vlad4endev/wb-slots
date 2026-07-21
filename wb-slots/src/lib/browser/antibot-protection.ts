// ===== ANTIBOT PROTECTION SYSTEM =====

import { Page, BrowserContext } from 'playwright';
import { Logger } from '../logging/logger';

// ===== TYPES =====

export interface AntibotConfig {
  enableFingerprintMasking: boolean;
  enableBehaviorSimulation: boolean;
  enableResourceBlocking: boolean;
  enableMouseSimulation: boolean;
  enableKeyboardSimulation: boolean;
  enableScrollSimulation: boolean;
  enableViewportRandomization: boolean;
  enableUserAgentRotation: boolean;
  enableProxyRotation: boolean;
}

export interface HumanBehaviorProfile {
  mouseSpeed: number;
  keyboardSpeed: number;
  scrollSpeed: number;
  pauseFrequency: number;
  pauseDuration: number;
  clickDelay: number;
  typingDelay: number;
}

export interface DetectionResult {
  isDetected: boolean;
  confidence: number;
  indicators: string[];
  recommendations: string[];
}

// ===== CONSTANTS =====

const DEFAULT_CONFIG: AntibotConfig = {
  enableFingerprintMasking: true,
  enableBehaviorSimulation: true,
  enableResourceBlocking: true,
  enableMouseSimulation: true,
  enableKeyboardSimulation: true,
  enableScrollSimulation: true,
  enableViewportRandomization: true,
  enableUserAgentRotation: true,
  enableProxyRotation: false
};

const DEFAULT_BEHAVIOR_PROFILE: HumanBehaviorProfile = {
  mouseSpeed: 0.8,
  keyboardSpeed: 0.6,
  scrollSpeed: 0.7,
  pauseFrequency: 0.3,
  pauseDuration: 1000,
  clickDelay: 150,
  typingDelay: 100
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

// ===== MAIN CLASS =====

export class AntibotProtection {
  private static instance: AntibotProtection;
  private logger: Logger;
  private config: AntibotConfig;
  private behaviorProfile: HumanBehaviorProfile;
  private detectionHistory: DetectionResult[] = [];

  private constructor(config?: Partial<AntibotConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.behaviorProfile = { ...DEFAULT_BEHAVIOR_PROFILE };
    this.logger = new Logger('INFO', { service: 'AntibotProtection' });
  }

  public static getInstance(config?: Partial<AntibotConfig>): AntibotProtection {
    if (!AntibotProtection.instance) {
      AntibotProtection.instance = new AntibotProtection(config);
    }
    return AntibotProtection.instance;
  }

  /**
   * Применение полной защиты к странице
   */
  async applyProtection(page: Page, context?: BrowserContext): Promise<void> {
    try {
      this.logger.info('Applying antibot protection');

      if (this.config.enableFingerprintMasking) {
        await this.maskFingerprint(page);
      }

      if (this.config.enableResourceBlocking) {
        await this.blockResources(page);
      }

      if (this.config.enableBehaviorSimulation) {
        await this.setupBehaviorSimulation(page);
      }

      if (this.config.enableViewportRandomization) {
        await this.randomizeViewport(page);
      }

      if (this.config.enableUserAgentRotation) {
        await this.rotateUserAgent(page);
      }

      this.logger.info('Antibot protection applied successfully');
    } catch (error) {
      this.logger.error('Failed to apply antibot protection', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Маскировка отпечатка браузера
   */
  private async maskFingerprint(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Удаляем webdriver флаги
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Маскируем automation флаги
      delete (window as any).chrome;
      delete (window as any).__nightmare;
      delete (window as any).__phantomas;
      delete (window as any).callPhantom;
      delete (window as any)._phantom;
      delete (window as any).phantom;
      delete (window as any).__webdriver_evaluate;
      delete (window as any).__selenium_evaluate;
      delete (window as any).__webdriver_script_function;
      delete (window as any).__webdriver_script_func;
      delete (window as any).__webdriver_script_fn;
      delete (window as any).__fxdriver_evaluate;
      delete (window as any).__driver_unwrapped;
      delete (window as any).__webdriver_unwrapped;
      delete (window as any).__driver_evaluate;
      delete (window as any).__selenium_unwrapped;
      delete (window as any).__fxdriver_unwrapped;

      // Переопределяем permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Маскируем плагины
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ],
      });

      // Маскируем языки
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      });

      // Маскируем hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // Маскируем device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });

      // Маскируем screen properties
      Object.defineProperty(screen, 'availHeight', {
        get: () => 1040,
      });
      Object.defineProperty(screen, 'availWidth', {
        get: () => 1920,
      });

      // Маскируем timezone
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return -180; // UTC+3 (Moscow)
      };

      // Маскируем canvas fingerprint
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        const context = this.getContext('2d');
        if (context) {
          context.fillStyle = 'rgba(255, 255, 255, 0.1)';
          context.fillRect(0, 0, this.width, this.height);
        }
        if (originalToDataURL && typeof originalToDataURL.apply === 'function') {
          return originalToDataURL.apply(this, arguments);
        }
        return '';
      };

      // Маскируем WebGL fingerprint
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Intel Inc.';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'Intel Iris OpenGL Engine';
        }
        if (originalGetParameter && typeof originalGetParameter.apply === 'function') {
          return originalGetParameter.apply(this, arguments);
        }
        return null;
      };
    });

    this.logger.info('Fingerprint masking applied');
  }

  /**
   * Блокировка ресурсов
   */
  private async blockResources(page: Page): Promise<void> {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();

      // Блокируем ненужные ресурсы
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
        return;
      }

      // Блокируем аналитику и трекинг
      if (url.includes('google-analytics') || 
          url.includes('googletagmanager') ||
          url.includes('facebook.com/tr') ||
          url.includes('yandex.ru/metrika') ||
          url.includes('hotjar') ||
          url.includes('mixpanel')) {
        route.abort();
        return;
      }

      route.continue();
    });

    this.logger.info('Resource blocking applied');
  }

  /**
   * Настройка симуляции поведения
   */
  private async setupBehaviorSimulation(page: Page): Promise<void> {
    // Симуляция человеческих задержек
    await page.addInitScript((profile) => {
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = (callback: Function, delay: number) => {
        const jitter = Math.random() * 100;
        const humanDelay = delay + jitter;
        return originalSetTimeout(callback, humanDelay);
      };

      // Симуляция случайных пауз
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      if (originalAddEventListener && typeof originalAddEventListener === 'function') {
        EventTarget.prototype.addEventListener = function(type, listener, options) {
          if (type === 'click' && Math.random() < profile.pauseFrequency) {
            setTimeout(() => {
              if (originalAddEventListener && typeof originalAddEventListener.call === 'function') {
                originalAddEventListener.call(this, type, listener, options);
              }
            }, profile.pauseDuration);
          } else {
            if (originalAddEventListener && typeof originalAddEventListener.call === 'function') {
              originalAddEventListener.call(this, type, listener, options);
            }
          }
        };
      }
    }, this.behaviorProfile);

    this.logger.info('Behavior simulation applied');
  }

  /**
   * Рандомизация viewport
   */
  private async randomizeViewport(page: Page): Promise<void> {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 }
    ];

    const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewportSize(randomViewport);

    this.logger.info('Viewport randomized', randomViewport);
  }

  /**
   * Ротация User-Agent
   */
  private async rotateUserAgent(page: Page): Promise<void> {
    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(randomUA);

    this.logger.info('User-Agent rotated', { userAgent: randomUA });
  }

  /**
   * Симуляция человеческих движений мыши
   */
  async simulateHumanMouse(page: Page, x: number, y: number): Promise<void> {
    if (!this.config.enableMouseSimulation) return;

    const steps = Math.floor(Math.random() * 5) + 3;
    const stepX = (x - 0) / steps;
    const stepY = (y - 0) / steps;

    for (let i = 0; i <= steps; i++) {
      const currentX = Math.round(stepX * i);
      const currentY = Math.round(stepY * i);
      
      await page.mouse.move(currentX, currentY);
      await this.delay(Math.random() * 50 + 10);
    }
  }

  /**
   * Симуляция человеческого набора текста
   */
  async simulateHumanTyping(page: Page, selector: string, text: string): Promise<void> {
    if (!this.config.enableKeyboardSimulation) {
      await page.fill(selector, text);
      return;
    }

    await page.click(selector);
    await this.delay(this.behaviorProfile.clickDelay);

    for (const char of text) {
      await page.keyboard.type(char);
      await this.delay(
        this.behaviorProfile.typingDelay + Math.random() * 50
      );
    }
  }

  /**
   * Симуляция человеческого скролла
   */
  async simulateHumanScroll(page: Page, direction: 'up' | 'down' = 'down'): Promise<void> {
    if (!this.config.enableScrollSimulation) return;

    const scrollAmount = Math.floor(Math.random() * 300) + 100;
    const steps = Math.floor(Math.random() * 3) + 2;
    const stepSize = scrollAmount / steps;

    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, direction === 'down' ? stepSize : -stepSize);
      await this.delay(Math.random() * 200 + 100);
    }
  }

  /**
   * Проверка на обнаружение ботов
   */
  async checkDetection(page: Page): Promise<DetectionResult> {
    try {
      const indicators: string[] = [];
      let confidence = 0;

      // Проверяем наличие антибот скриптов
      const antibotScripts = await page.evaluate(() => {
        const scripts = Array.from(document.scripts);
        return scripts.some(script => 
          script.src.includes('captcha') ||
          script.src.includes('recaptcha') ||
          script.src.includes('hcaptcha') ||
          script.innerHTML.includes('bot detection')
        );
      });

      if (antibotScripts) {
        indicators.push('Antibot scripts detected');
        confidence += 0.3;
      }

      // Проверяем наличие капчи
      const captchaElements = await page.locator('iframe[src*="captcha"], .captcha, [data-captcha]').count();
      if (captchaElements > 0) {
        indicators.push('Captcha detected');
        confidence += 0.4;
      }

      // Проверяем редирект на страницу блокировки
      const currentUrl = page.url();
      if (currentUrl.includes('blocked') || currentUrl.includes('access-denied')) {
        indicators.push('Access blocked');
        confidence += 0.5;
      }

      // Проверяем наличие сообщений об ошибке
      const errorMessages = await page.evaluate(() => {
        const errorTexts = [
          'access denied',
          'blocked',
          'suspicious activity',
          'bot detected',
          'automated requests'
        ];
        
        const bodyText = document.body.textContent?.toLowerCase() || '';
        return errorTexts.some(text => bodyText.includes(text));
      });

      if (errorMessages) {
        indicators.push('Error messages detected');
        confidence += 0.2;
      }

      const result: DetectionResult = {
        isDetected: confidence > 0.5,
        confidence,
        indicators,
        recommendations: this.generateRecommendations(indicators)
      };

      this.detectionHistory.push(result);
      if (this.detectionHistory.length > 50) {
        this.detectionHistory = this.detectionHistory.slice(-50);
      }

      this.logger.info('Detection check completed', result);
      return result;

    } catch (error) {
      this.logger.error('Detection check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        isDetected: false,
        confidence: 0,
        indicators: ['Detection check failed'],
        recommendations: ['Retry detection check']
      };
    }
  }

  /**
   * Генерация рекомендаций
   */
  private generateRecommendations(indicators: string[]): string[] {
    const recommendations: string[] = [];

    if (indicators.includes('Antibot scripts detected')) {
      recommendations.push('Enable stealth mode');
      recommendations.push('Use residential proxy');
    }

    if (indicators.includes('Captcha detected')) {
      recommendations.push('Implement captcha solving');
      recommendations.push('Reduce automation speed');
    }

    if (indicators.includes('Access blocked')) {
      recommendations.push('Change IP address');
      recommendations.push('Wait before retry');
    }

    if (indicators.includes('Error messages detected')) {
      recommendations.push('Improve human behavior simulation');
      recommendations.push('Check user agent');
    }

    return recommendations;
  }

  /**
   * Получение истории обнаружений
   */
  getDetectionHistory(): DetectionResult[] {
    return [...this.detectionHistory];
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig: Partial<AntibotConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Antibot configuration updated', this.config);
  }

  /**
   * Обновление профиля поведения
   */
  updateBehaviorProfile(newProfile: Partial<HumanBehaviorProfile>): void {
    this.behaviorProfile = { ...this.behaviorProfile, ...newProfile };
    this.logger.info('Behavior profile updated', this.behaviorProfile);
  }

  /**
   * Задержка
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== SINGLETON INSTANCE =====

export const antibotProtection = AntibotProtection.getInstance();
