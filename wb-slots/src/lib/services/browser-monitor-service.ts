import { EventEmitter } from 'events';
import { browserDetectionService, BrowserSessionInfo } from './browser-detection-service';
import { getUnifiedSessionManager } from '@/lib/session';
// import { logger } from '@/lib/logger';

export interface BrowserMonitorConfig {
  checkInterval: number; // Интервал проверки в миллисекундах
  autoSave: boolean; // Автоматическое сохранение при обнаружении изменений
  userId?: string; // ID пользователя для автоматического сохранения
  enabled: boolean; // Включен ли мониторинг
}

export interface BrowserChangeEvent {
  type: 'browser_opened' | 'browser_closed' | 'session_changed' | 'data_updated';
  timestamp: Date;
  data?: any;
  previousData?: any;
}

export class BrowserMonitorService extends EventEmitter {
  private static instance: BrowserMonitorService;
  private config: BrowserMonitorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private lastBrowserState: BrowserSessionInfo | null = null;
  private isRunning = false;

  private constructor(config: Partial<BrowserMonitorConfig> = {}) {
    super();
    this.config = {
      checkInterval: 5000, // 5 секунд по умолчанию
      autoSave: false,
      enabled: false,
      ...config
    };
  }

  static getInstance(config?: Partial<BrowserMonitorConfig>): BrowserMonitorService {
    if (!BrowserMonitorService.instance) {
      BrowserMonitorService.instance = new BrowserMonitorService(config);
    }
    return BrowserMonitorService.instance;
  }

  /**
   * Запуск мониторинга браузера
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Browser monitor is already running');
      return;
    }

    if (!this.config.enabled) {
      console.info('📊 Browser monitor is disabled');
      return;
    }

    this.isRunning = true;
    console.info('🚀 Starting browser monitor', { 
      checkInterval: this.config.checkInterval,
      autoSave: this.config.autoSave,
      userId: this.config.userId
    });

    // Первоначальная проверка
    await this.checkBrowserState();

    // Запуск периодической проверки
    this.intervalId = setInterval(async () => {
      await this.checkBrowserState();
    }, this.config.checkInterval);

    this.emit('monitor_started', { timestamp: new Date() });
  }

  /**
   * Остановка мониторинга браузера
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️ Browser monitor is not running');
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.info('🛑 Browser monitor stopped');
    this.emit('monitor_stopped', { timestamp: new Date() });
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig: Partial<BrowserMonitorConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    console.info('⚙️ Browser monitor config updated', { 
      oldConfig, 
      newConfig: this.config 
    });

    this.emit('config_updated', { 
      oldConfig, 
      newConfig: this.config,
      timestamp: new Date()
    });

    // Если изменился интервал и мониторинг запущен, перезапускаем
    if (this.isRunning && oldConfig.checkInterval !== this.config.checkInterval) {
      this.restart();
    }
  }

  /**
   * Перезапуск мониторинга
   */
  async restart(): Promise<void> {
    console.info('🔄 Restarting browser monitor');
    await this.stop();
    await this.start();
  }

  /**
   * Проверка состояния браузера
   */
  private async checkBrowserState(): Promise<void> {
    try {
      const currentState = await browserDetectionService.detectOpenBrowser({
        headless: false,
        timeout: 3000,
        retryAttempts: 1
      });

      // Сравниваем с предыдущим состоянием
      const changes = this.detectChanges(this.lastBrowserState, currentState);

      if (changes.length > 0) {
        console.info('📊 Browser state changes detected', { 
          changes: changes.map(c => c.type),
          currentState: {
            isOpen: currentState.isOpen,
            url: currentState.url,
            hasData: !!(currentState.cookies || currentState.localStorage || currentState.sessionStorage)
          }
        });

        // Отправляем события об изменениях
        for (const change of changes) {
          this.emit('browser_change', change);
        }

        // Автоматическое сохранение при необходимости
        if (this.config.autoSave && this.config.userId && currentState.isOpen) {
          await this.autoSaveSession(currentState);
        }
      }

      this.lastBrowserState = currentState;

    } catch (error) {
      console.error('❌ Error checking browser state', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      this.emit('monitor_error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  }

  /**
   * Обнаружение изменений в состоянии браузера
   */
  private detectChanges(
    previous: BrowserSessionInfo | null, 
    current: BrowserSessionInfo
  ): BrowserChangeEvent[] {
    const changes: BrowserChangeEvent[] = [];

    // Браузер открылся
    if (!previous?.isOpen && current.isOpen) {
      changes.push({
        type: 'browser_opened',
        timestamp: new Date(),
        data: current
      });
    }

    // Браузер закрылся
    if (previous?.isOpen && !current.isOpen) {
      changes.push({
        type: 'browser_closed',
        timestamp: new Date(),
        previousData: previous
      });
    }

    // URL изменился
    if (previous?.isOpen && current.isOpen && previous.url !== current.url) {
      changes.push({
        type: 'session_changed',
        timestamp: new Date(),
        data: current,
        previousData: previous
      });
    }

    // Данные сессии изменились
    if (previous?.isOpen && current.isOpen) {
      const previousDataHash = this.getDataHash(previous);
      const currentDataHash = this.getDataHash(current);
      
      if (previousDataHash !== currentDataHash) {
        changes.push({
          type: 'data_updated',
          timestamp: new Date(),
          data: current,
          previousData: previous
        });
      }
    }

    return changes;
  }

  /**
   * Получение хеша данных для сравнения
   */
  private getDataHash(state: BrowserSessionInfo): string {
    const data = {
      cookies: state.cookies?.length || 0,
      localStorage: Object.keys(state.localStorage || {}).length,
      sessionStorage: Object.keys(state.sessionStorage || {}).length,
      url: state.url
    };
    
    return JSON.stringify(data);
  }

  /**
   * Автоматическое сохранение сессии
   */
  private async autoSaveSession(browserState: BrowserSessionInfo): Promise<void> {
    if (!this.config.userId) {
      return;
    }

    try {
      console.info('💾 Auto-saving browser session', { userId: this.config.userId });

      const sessionManager = getUnifiedSessionManager();
      
      // Создаем временную страницу для сохранения сессии
      const browser = browserDetectionService.getBrowser();
      if (browser) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Применяем данные сессии к странице
        if (browserState.cookies) {
          await context.addCookies(browserState.cookies);
        }
        
        if (browserState.localStorage) {
          await page.evaluate((storage) => {
            for (const [key, value] of Object.entries(storage)) {
              localStorage.setItem(key, value);
            }
          }, browserState.localStorage);
        }
        
        if (browserState.sessionStorage) {
          await page.evaluate((storage) => {
            for (const [key, value] of Object.entries(storage)) {
              sessionStorage.setItem(key, value);
            }
          }, browserState.sessionStorage);
        }

        // Сохраняем сессию
        const sessionId = await sessionManager.createSession(this.config.userId, page);
        
        // Закрываем временную страницу
        await page.close();
        await context.close();

        console.info('✅ Auto-save completed', { 
          userId: this.config.userId, 
          sessionId 
        });

        this.emit('session_auto_saved', { 
          userId: this.config.userId,
          sessionId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('❌ Auto-save failed', { 
        userId: this.config.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      this.emit('auto_save_error', { 
        userId: this.config.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  }

  /**
   * Получение текущего состояния
   */
  getState(): {
    isRunning: boolean;
    config: BrowserMonitorConfig;
    lastBrowserState: BrowserSessionInfo | null;
  } {
    return {
      isRunning: this.isRunning,
      config: { ...this.config },
      lastBrowserState: this.lastBrowserState ? { ...this.lastBrowserState } : null
    };
  }

  /**
   * Принудительная проверка состояния
   */
  async forceCheck(): Promise<BrowserSessionInfo> {
    console.info('🔍 Force checking browser state');
    await this.checkBrowserState();
    return this.lastBrowserState!;
  }
}

// Экспорт синглтона
export const browserMonitorService = BrowserMonitorService.getInstance();
