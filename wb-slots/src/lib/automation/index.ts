// ===== AUTOMATION MODULE EXPORTS =====

// Core components
export * from './robust-browser-manager';
export * from './selector-strategies';
export * from './fallback-manager';
export * from './automation-monitor';

// Convenience functions
export { createSelectorStrategies, createCommonSelectors } from './selector-strategies';

// Factory functions
export async function createBrowserService(config: {
  instanceId: string;
  enableAntibot?: boolean;
  enableAdaptiveTimeouts?: boolean;
  enableSelectorResilience?: boolean;
  enableHumanBehavior?: boolean;
  headless?: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}) {
  const { RobustBrowserManager } = await import('./robust-browser-manager');
  const { SelectorStrategiesManager } = await import('./selector-strategies');
  const { FallbackManager } = await import('./fallback-manager');
  const { AutomationMonitor } = await import('./automation-monitor');

  // Default configurations
  const browserConfig = {
    headless: config.headless ?? true,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    enableAntibot: config.enableAntibot ?? true,
    enableHumanBehavior: config.enableHumanBehavior ?? true,
    enableAdaptiveTimeouts: config.enableAdaptiveTimeouts ?? true,
    enableSelectorResilience: config.enableSelectorResilience ?? true,
    proxy: config.proxy
  };

  const adaptiveTimeoutConfig = {
    baseTimeout: 30000,
    maxTimeout: 120000,
    minTimeout: 5000,
    adaptationFactor: 0.5,
    networkQualityThreshold: 0.7
  };

  const retryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    retryableErrors: ['timeout', 'network', 'element not found']
  };

  const selectorConfig = {
    enableFallback: true,
    enableValidation: true,
    maxRetries: 3,
    retryDelay: 500,
    timeout: 30000,
    enableSmartSelectors: true
  };

  const fallbackConfig = {
    enableFallbacks: true,
    maxFallbackAttempts: 5,
    fallbackTimeout: 30000,
    enableSmartFallbacks: true,
    enableAlternativePaths: true,
    enableManualIntervention: true
  };

  const monitoringConfig = {
    enableRealTimeMonitoring: true,
    enablePerformanceTracking: true,
    enableErrorTracking: true,
    enableScreenshotCapture: true,
    enableNetworkMonitoring: true,
    enableMemoryMonitoring: true,
    screenshotOnError: true,
    screenshotOnSuccess: false,
    screenshotInterval: 30000,
    alertThresholds: {
      errorRate: 20,
      responseTime: 60000,
      memoryUsage: 100 * 1024 * 1024, // 100MB
      networkLatency: 5000
    },
    retentionPeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  // Create instances
  const browserManager = new RobustBrowserManager(browserConfig, adaptiveTimeoutConfig, retryConfig);
  const selectorManager = new SelectorStrategiesManager(selectorConfig);
  const fallbackManager = new FallbackManager(fallbackConfig);
  const monitor = new AutomationMonitor(monitoringConfig);

  // Register common selectors
  const { createCommonSelectors } = await import('./selector-strategies');
  const commonSelectors = createCommonSelectors();
  Object.values(commonSelectors).forEach((strategy: any) => {
    selectorManager.registerStrategy(strategy);
  });

  return {
    browserManager,
    selectorManager,
    fallbackManager,
    monitor,
    instanceId: config.instanceId
  };
}

// Enhanced browser service with all features
export class EnhancedBrowserService {
  private browserManager: any;
  private selectorManager: any;
  private fallbackManager: any;
  private monitor: any;
  private instanceId: string;

  constructor(
    browserManager: any,
    selectorManager: any,
    fallbackManager: any,
    monitor: any,
    instanceId: string
  ) {
    this.browserManager = browserManager;
    this.selectorManager = selectorManager;
    this.fallbackManager = fallbackManager;
    this.monitor = monitor;
    this.instanceId = instanceId;
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
  }

  async navigateTo(url: string, options?: any): Promise<void> {
    const sessionId = this.monitor.startSession('navigate', { url });
    const stepId = this.monitor.startStep(sessionId, 'navigate-to-page');

    try {
      await this.browserManager.navigateTo(url, options);
      this.monitor.endStep(stepId, 'completed');
      this.monitor.endSession(sessionId, 'completed');
    } catch (error) {
      this.monitor.endStep(stepId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      this.monitor.endSession(sessionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async findElement(selectors: string[], options?: any): Promise<any> {
    const sessionId = this.monitor.startSession('find-element', { selectors });
    const stepId = this.monitor.startStep(sessionId, 'find-element');

    try {
      const element = await this.browserManager.findElement(selectors, options);
      this.monitor.endStep(stepId, 'completed');
      this.monitor.endSession(sessionId, 'completed');
      return element;
    } catch (error) {
      this.monitor.endStep(stepId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      this.monitor.endSession(sessionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async clickElement(selectors: string[], description: string, options?: any): Promise<void> {
    const sessionId = this.monitor.startSession('click-element', { selectors, description });
    const stepId = this.monitor.startStep(sessionId, 'click-element');

    try {
      await this.browserManager.clickElement(selectors, description, options);
      this.monitor.endStep(stepId, 'completed');
      this.monitor.endSession(sessionId, 'completed');
    } catch (error) {
      this.monitor.endStep(stepId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      this.monitor.endSession(sessionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async fillInput(selectors: string[], text: string, options?: any): Promise<void> {
    const sessionId = this.monitor.startSession('fill-input', { selectors, textLength: text.length });
    const stepId = this.monitor.startStep(sessionId, 'fill-input');

    try {
      await this.browserManager.fillInput(selectors, text, options);
      this.monitor.endStep(stepId, 'completed');
      this.monitor.endSession(sessionId, 'completed');
    } catch (error) {
      this.monitor.endStep(stepId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      this.monitor.endSession(sessionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async takeScreenshot(options?: any): Promise<Buffer> {
    return await this.browserManager.takeScreenshot(options);
  }

  getHealthStatus(): any {
    return this.browserManager.getHealthStatus();
  }

  getMetrics(): any {
    return {
      browser: this.browserManager.getMetrics(),
      automation: this.monitor.getMetrics(),
      selectors: this.selectorManager.exportStats(),
      fallbacks: this.fallbackManager.exportStats()
    };
  }

  async cleanup(): Promise<void> {
    await this.browserManager.cleanup();
    this.monitor.cleanup();
  }
}
