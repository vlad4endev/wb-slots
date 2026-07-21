import { Page } from 'playwright';
import { Logger } from '../logging/logger';
import path from 'path';
import fs from 'fs/promises';

// ===== MONITORING TYPES =====
export interface BookingStep {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'success' | 'failed';
  error?: string;
  screenshot?: string;
  metadata?: Record<string, any>;
}

export interface BookingSession {
  sessionId: string;
  taskId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  steps: BookingStep[];
  screenshots: string[];
  logs: string[];
  status: 'running' | 'success' | 'failed' | 'cancelled';
}

export interface MonitoringConfig {
  screenshotOnError: boolean;
  screenshotOnSuccess: boolean;
  screenshotInterval?: number; // в миллисекундах
  detailedLogging: boolean;
  performanceTracking: boolean;
  memoryMonitoring: boolean;
}

// ===== ENHANCED BOOKING MONITOR =====
export class EnhancedBookingMonitor {
  private logger: Logger;
  private screenshotDir: string;
  private session: BookingSession | null = null;
  private config: MonitoringConfig;
  private screenshotCounter = 0;
  private currentStep: BookingStep | null = null;
  private isShuttingDown = false;
  private activeIntervals: Set<NodeJS.Timeout> = new Set();

  constructor(config: MonitoringConfig = {
    screenshotOnError: true,
    screenshotOnSuccess: true,
    detailedLogging: true,
    performanceTracking: true,
    memoryMonitoring: true
  }) {
    this.logger = new Logger('INFO', { context: 'EnhancedBookingMonitor' });
    this.config = config;
    this.screenshotDir = path.join(process.cwd(), 'screenshots', 'booking-monitor');
    this.initMonitoring();
  }

  /**
   * Инициализация мониторинга
   */
  private async initMonitoring(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      this.logger.info('📸 Screenshot directory initialized', { dir: this.screenshotDir });
    } catch (error) {
      this.logger.warn('Failed to create screenshot directory', { error });
    }
  }

  /**
   * Начало новой сессии мониторинга
   */
  startSession(taskId: string, userId: string): string {
    const sessionId = `booking-${taskId}-${Date.now()}`;
    
    this.session = {
      sessionId,
      taskId,
      userId,
      startTime: Date.now(),
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      steps: [],
      screenshots: [],
      logs: [],
      status: 'running'
    };

    this.logger.info('🚀 Monitoring session started', { sessionId, taskId, userId });
    return sessionId;
  }

  /**
   * Начало нового шага
   */
  startStep(stepId: string, stepName: string, metadata?: Record<string, any>): void {
    if (!this.session) {
      throw new Error('No active monitoring session');
    }

    this.currentStep = {
      id: stepId,
      name: stepName,
      startTime: Date.now(),
      status: 'running',
      metadata
    };

    this.session.steps.push(this.currentStep);
    this.session.totalSteps++;

    this.logger.info(`📝 Step started: ${stepName}`, { stepId, metadata });
  }

  /**
   * Завершение текущего шага
   */
  endStep(success: boolean, error?: string, metadata?: Record<string, any>): void {
    if (!this.currentStep || !this.session) {
      return;
    }

    const endTime = Date.now();
    this.currentStep.endTime = endTime;
    this.currentStep.duration = endTime - this.currentStep.startTime;
    this.currentStep.status = success ? 'success' : 'failed';
    this.currentStep.error = error;
    this.currentStep.metadata = { ...this.currentStep.metadata, ...metadata };

    if (success) {
      this.session.completedSteps++;
    } else {
      this.session.failedSteps++;
    }

    const emoji = success ? '✅' : '❌';
    this.logger.info(`${emoji} Step ${success ? 'completed' : 'failed'}: ${this.currentStep.name}`, {
      stepId: this.currentStep.id,
      duration: this.currentStep.duration,
      error,
      metadata
    });

    this.currentStep = null;
  }

  /**
   * Захват скриншота страницы
   */
  async captureScreenshot(page: Page, name: string, reason: 'error' | 'success' | 'step' | 'debug'): Promise<string | null> {
    try {
      if (!this.session || this.isShuttingDown) {
        return null;
      }

      // Проверяем, не закрыта ли страница
      if (page.isClosed()) {
        this.logger.warn('📸 Screenshot skipped: page is closed', { name, reason });
        return null;
      }

      this.screenshotCounter++;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.session.sessionId}-${this.screenshotCounter}-${reason}-${name}-${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      const screenshot = await page.screenshot({
        path: filepath,
        fullPage: true,
        type: 'png'
      });

      // Сохраняем путь к скриншоту в сессии
      this.session.screenshots.push(filepath);

      // Добавляем скриншот к текущему шагу
      if (this.currentStep) {
        this.currentStep.screenshot = filepath;
      }

      this.logger.info(`📸 Screenshot captured: ${name}`, {
        filename,
        reason,
        size: screenshot.length
      });

      return filepath;

    } catch (error) {
      // Более детальная обработка ошибок
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Target page, context or browser has been closed')) {
        this.logger.warn('📸 Screenshot skipped: browser/page closed', { name, reason });
      } else {
        this.logger.warn('Failed to capture screenshot', { 
          name, 
          reason, 
          error: errorMessage
        });
      }
      return null;
    }
  }

  /**
   * Автоматический захват скриншотов через интервалы
   */
  async startPeriodicScreenshots(page: Page, intervalMs: number = 10000): Promise<() => void> {
    let screenshotInterval: NodeJS.Timeout | null = null;
    let counter = 0;
    let isStopped = false;

    const startCapture = () => {
      screenshotInterval = setInterval(async () => {
        // Проверяем глобальный флаг остановки
        if (this.isShuttingDown || isStopped) {
          if (screenshotInterval) {
            clearInterval(screenshotInterval);
            this.activeIntervals.delete(screenshotInterval);
            screenshotInterval = null;
          }
          return;
        }

        // Проверяем, не закрыта ли страница
        try {
          if (page.isClosed()) {
            this.logger.warn('📸 Periodic screenshots stopped: page is closed');
            if (screenshotInterval) {
              clearInterval(screenshotInterval);
              this.activeIntervals.delete(screenshotInterval);
              screenshotInterval = null;
            }
            return;
          }
        } catch (error) {
          this.logger.warn('📸 Periodic screenshots stopped: page check failed', { error });
          if (screenshotInterval) {
            clearInterval(screenshotInterval);
            this.activeIntervals.delete(screenshotInterval);
            screenshotInterval = null;
          }
          return;
        }

        counter++;
        await this.captureScreenshot(page, `periodic-${counter}`, 'debug');
      }, intervalMs);

      // Добавляем интервал в активные
      if (screenshotInterval) {
        this.activeIntervals.add(screenshotInterval);
      }
    };

    const stopCapture = () => {
      isStopped = true;
      if (screenshotInterval) {
        clearInterval(screenshotInterval);
        this.activeIntervals.delete(screenshotInterval);
        screenshotInterval = null;
      }
      this.logger.info('📸 Periodic screenshots stopped');
    };

    startCapture();
    this.logger.info('📸 Periodic screenshots started', { intervalMs });

    return stopCapture;
  }

  /**
   * Мониторинг производительности страницы
   */
  async capturePerformanceMetrics(page: Page): Promise<Record<string, any> | null> {
    try {
      const metrics = await page.evaluate(() => {
        const performance = window.performance;
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        return {
          // Время загрузки
          loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
          domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
          
          // Память (если доступно)
          memory: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          } : null,
          
          // Время выполнения
          timing: navigation ? {
            connectTime: navigation.connectEnd - navigation.connectStart,
            responseTime: navigation.responseEnd - navigation.responseStart,
            domProcessingTime: navigation.domComplete - navigation.domContentLoadedEventStart
          } : null
        };
      });

      this.logger.info('📊 Performance metrics captured', metrics);
      return metrics;

    } catch (error) {
      this.logger.warn('Failed to capture performance metrics', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Анализ элементов страницы для отладки
   */
  async analyzePageElements(page: Page, selectors: string[]): Promise<Record<string, any>> {
    try {
      const analysis = await page.evaluate((selectors) => {
        const results: Record<string, any> = {};
        
        selectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            results[selector] = {
              found: elements.length > 0,
              count: elements.length,
              visible: Array.from(elements).some(el => {
                const style = window.getComputedStyle(el as Element);
                return style.display !== 'none' && style.visibility !== 'hidden';
              }),
              texts: Array.from(elements).slice(0, 3).map(el => el.textContent?.trim().substring(0, 50))
            };
          } catch (error) {
            results[selector] = {
              found: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });
        
        return results;
      }, selectors);

      this.logger.info('🔍 Page elements analyzed', { analysis });
      return analysis;

    } catch (error) {
      this.logger.warn('Failed to analyze page elements', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return {};
    }
  }

  /**
   * Захват состояния браузера для отладки
   */
  async captureBrowserState(page: Page): Promise<Record<string, any>> {
    try {
      const state = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          cookies: document.cookie,
          localStorage: Object.keys(localStorage).length,
          sessionStorage: Object.keys(sessionStorage).length,
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          errors: (window as any).errorLog || []
        };
      });

      this.logger.info('🌐 Browser state captured', state);
      return state;

    } catch (error) {
      this.logger.warn('Failed to capture browser state', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return {};
    }
  }

  /**
   * Логирование кастомного события
   */
  logEvent(event: string, data?: Record<string, any>): void {
    if (!this.session) {
      return;
    }

    const logEntry = `[${new Date().toISOString()}] ${event}: ${JSON.stringify(data || {})}`;
    this.session.logs.push(logEntry);

    this.logger.info(`📝 Event logged: ${event}`, data);
  }

  /**
   * Завершение сессии мониторинга
   */
  endSession(status: 'success' | 'failed' | 'cancelled', error?: string): BookingSession | null {
    if (!this.session) {
      return null;
    }

    this.session.endTime = Date.now();
    this.session.status = status;

    // Завершаем текущий шаг, если есть
    if (this.currentStep) {
      this.endStep(status === 'success', error);
    }

    const duration = this.session.endTime - this.session.startTime;
    const successRate = this.session.totalSteps > 0 
      ? (this.session.completedSteps / this.session.totalSteps) * 100 
      : 0;

    this.logger.info(`🏁 Monitoring session ended: ${status}`, {
      sessionId: this.session.sessionId,
      duration,
      totalSteps: this.session.totalSteps,
      completedSteps: this.session.completedSteps,
      failedSteps: this.session.failedSteps,
      successRate: `${successRate.toFixed(1)}%`,
      screenshots: this.session.screenshots.length,
      error
    });

    const finalSession = { ...this.session };
    this.session = null;
    this.currentStep = null;
    this.screenshotCounter = 0;

    // Останавливаем все активные интервалы
    this.stopAllIntervals();

    return finalSession;
  }

  /**
   * Получение текущей сессии
   */
  getCurrentSession(): BookingSession | null {
    return this.session;
  }

  /**
   * Остановка всех активных интервалов
   */
  private stopAllIntervals(): void {
    this.isShuttingDown = true;
    
    for (const interval of this.activeIntervals) {
      clearInterval(interval);
    }
    
    this.activeIntervals.clear();
    this.logger.info('🛑 All monitoring intervals stopped');
  }

  /**
   * Принудительная остановка мониторинга
   */
  forceStop(): void {
    this.logger.info('🛑 Force stopping monitoring');
    this.stopAllIntervals();
    
    if (this.session) {
      this.endSession('cancelled', 'Force stopped');
    }
  }

  /**
   * Сохранение отчета сессии
   */
  async saveSessionReport(session: BookingSession, outputDir?: string): Promise<string | null> {
    try {
      const reportDir = outputDir || path.join(this.screenshotDir, '..', 'reports');
      await fs.mkdir(reportDir, { recursive: true });

      const reportFile = path.join(reportDir, `booking-report-${session.sessionId}.json`);
      
      const report = {
        session,
        generatedAt: new Date().toISOString(),
        summary: {
          duration: session.endTime ? session.endTime - session.startTime : 0,
          successRate: session.totalSteps > 0 ? (session.completedSteps / session.totalSteps) * 100 : 0,
          screenshotCount: session.screenshots.length,
          logCount: session.logs.length
        }
      };

      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
      
      this.logger.info('📄 Session report saved', { reportFile });
      return reportFile;

    } catch (error) {
      this.logger.error('Failed to save session report', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Очистка старых скриншотов и отчетов
   */
  async cleanup(olderThanDays: number = 7): Promise<void> {
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      
      // Очистка скриншотов
      const screenshotFiles = await fs.readdir(this.screenshotDir);
      let deletedScreenshots = 0;
      
      for (const file of screenshotFiles) {
        const filepath = path.join(this.screenshotDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filepath);
          deletedScreenshots++;
        }
      }

      // Очистка отчетов
      const reportsDir = path.join(this.screenshotDir, '..', 'reports');
      let deletedReports = 0;
      
      try {
        const reportFiles = await fs.readdir(reportsDir);
        
        for (const file of reportFiles) {
          const filepath = path.join(reportsDir, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filepath);
            deletedReports++;
          }
        }
      } catch {
        // Reports directory might not exist
      }

      this.logger.info('🧹 Cleanup completed', {
        deletedScreenshots,
        deletedReports,
        olderThanDays
      });

    } catch (error) {
      this.logger.error('Cleanup failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

export default EnhancedBookingMonitor;