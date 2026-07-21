// ===== AUTOMATION MONITOR =====

import { Page } from 'playwright';
import { Logger } from '../logging/logger';
import { BrowserHealthStatus, BrowserMetrics } from './robust-browser-manager';

// ===== INTERFACES =====

export interface AutomationSession {
  id: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  operation: string;
  userId?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface AutomationStep {
  id: string;
  sessionId: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
  screenshot?: string;
}

export interface AutomationMetrics {
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  averageSessionDuration: number;
  averageStepDuration: number;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  errorRate: number;
  successRate: number;
  uptime: number;
  memoryUsage: number;
  networkLatency: number;
}

export interface AutomationAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  sessionId?: string;
  stepId?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
}

export interface MonitoringConfig {
  enableRealTimeMonitoring: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableScreenshotCapture: boolean;
  enableNetworkMonitoring: boolean;
  enableMemoryMonitoring: boolean;
  screenshotOnError: boolean;
  screenshotOnSuccess: boolean;
  screenshotInterval: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
    networkLatency: number;
  };
  retentionPeriod: number;
}

// ===== AUTOMATION MONITOR =====

export class AutomationMonitor {
  private logger: Logger;
  private config: MonitoringConfig;
  private sessions: Map<string, AutomationSession> = new Map();
  private steps: Map<string, AutomationStep> = new Map();
  private alerts: Map<string, AutomationAlert> = new Map();
  private metrics: AutomationMetrics;
  private startTime: number;
  private periodicScreenshotInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.logger = new Logger('INFO', { context: 'AutomationMonitor' });
    this.startTime = Date.now();
    
    this.metrics = {
      totalSessions: 0,
      successfulSessions: 0,
      failedSessions: 0,
      averageSessionDuration: 0,
      averageStepDuration: 0,
      totalSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      errorRate: 0,
      successRate: 100,
      uptime: 0,
      memoryUsage: 0,
      networkLatency: 0
    };

    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }
  }

  // ===== SESSION MANAGEMENT =====

  startSession(
    operation: string,
    options?: {
      userId?: string;
      taskId?: string;
      metadata?: Record<string, any>;
    }
  ): string {
    const sessionId = this.generateId();
    const session: AutomationSession = {
      id: sessionId,
      startTime: Date.now(),
      status: 'running',
      operation,
      userId: options?.userId,
      taskId: options?.taskId,
      metadata: options?.metadata
    };

    this.sessions.set(sessionId, session);
    this.metrics.totalSessions++;

    this.logger.info(`🚀 Started automation session: ${sessionId}`, {
      operation,
      userId: options?.userId,
      taskId: options?.taskId
    });

    return sessionId;
  }

  endSession(
    sessionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    error?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Session not found: ${sessionId}`);
      return;
    }

    session.endTime = Date.now();
    session.status = status;
    const duration = session.endTime - session.startTime;

    // Update metrics
    if (status === 'completed') {
      this.metrics.successfulSessions++;
    } else {
      this.metrics.failedSessions++;
    }

    this.updateAverageSessionDuration(duration);

    this.logger.info(`🏁 Ended automation session: ${sessionId}`, {
      status,
      duration,
      error
    });

    // Check for alerts
    this.checkSessionAlerts(session, error);
  }

  // ===== STEP MANAGEMENT =====

  startStep(
    sessionId: string,
    stepName: string,
    metadata?: Record<string, any>
  ): string {
    const stepId = this.generateId();
    const step: AutomationStep = {
      id: stepId,
      sessionId,
      name: stepName,
      startTime: Date.now(),
      status: 'running',
      metadata
    };

    this.steps.set(stepId, step);
    this.metrics.totalSteps++;

    this.logger.debug(`📝 Started step: ${stepName}`, {
      stepId,
      sessionId
    });

    return stepId;
  }

  endStep(
    stepId: string,
    status: 'completed' | 'failed' | 'skipped',
    error?: string,
    screenshot?: string
  ): void {
    const step = this.steps.get(stepId);
    if (!step) {
      this.logger.warn(`⚠️ Step not found: ${stepId}`);
      return;
    }

    step.endTime = Date.now();
    step.status = status;
    step.duration = step.endTime - step.startTime;
    step.error = error;
    step.screenshot = screenshot;

    // Update metrics
    if (status === 'completed') {
      this.metrics.successfulSteps++;
    } else {
      this.metrics.failedSteps++;
    }

    this.updateAverageStepDuration(step.duration);

    this.logger.debug(`✅ Ended step: ${step.name}`, {
      stepId,
      status,
      duration: step.duration,
      error
    });

    // Check for alerts
    this.checkStepAlerts(step);
  }

  // ===== SCREENSHOT MANAGEMENT =====

  async captureScreenshot(
    page: Page,
    context: string,
    type: 'error' | 'success' | 'periodic' = 'periodic'
  ): Promise<string | null> {
    if (!this.config.enableScreenshotCapture) {
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${context}-${type}-${timestamp}.png`;
      const screenshot = await page.screenshot({
        fullPage: true,
        path: `screenshots/${filename}`
      });

      this.logger.debug(`📸 Screenshot captured: ${filename}`, {
        context,
        type,
        size: screenshot.length
      });

      return filename;
    } catch (error) {
      this.logger.error('❌ Failed to capture screenshot', { error, context, type });
      return null;
    }
  }

  async startPeriodicScreenshots(
    page: Page,
    intervalMs: number = 30000
  ): Promise<() => void> {
    if (!this.config.enableScreenshotCapture) {
      return () => {};
    }

    this.periodicScreenshotInterval = setInterval(async () => {
      try {
        await this.captureScreenshot(page, 'periodic', 'periodic');
      } catch (error) {
        this.logger.error('❌ Failed to capture periodic screenshot', { error });
      }
    }, intervalMs);

    return () => {
      if (this.periodicScreenshotInterval) {
        clearInterval(this.periodicScreenshotInterval);
        this.periodicScreenshotInterval = undefined;
      }
    };
  }

  // ===== PERFORMANCE MONITORING =====

  async monitorPagePerformance(page: Page): Promise<void> {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    try {
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        return {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
        };
      });

      this.metrics.memoryUsage = performanceMetrics.memoryUsage;
      
      this.logger.debug('📊 Page performance metrics', performanceMetrics);
    } catch (error) {
      this.logger.error('❌ Failed to monitor page performance', { error });
    }
  }

  async monitorNetworkActivity(page: Page): Promise<void> {
    if (!this.config.enableNetworkMonitoring) {
      return;
    }

    const networkMetrics = {
      requests: 0,
      responses: 0,
      failures: 0,
      totalLatency: 0
    };

    page.on('request', () => {
      networkMetrics.requests++;
    });

    page.on('response', (response) => {
      networkMetrics.responses++;
      const request = response.request();
      const latency = Date.now() - (request as any).timestamp();
      networkMetrics.totalLatency += latency;
    });

    page.on('requestfailed', () => {
      networkMetrics.failures++;
    });

    // Update metrics periodically
    setInterval(() => {
      if (networkMetrics.responses > 0) {
        this.metrics.networkLatency = networkMetrics.totalLatency / networkMetrics.responses;
      }
    }, 5000);
  }

  // ===== HEALTH MONITORING =====

  updateBrowserHealth(healthStatus: BrowserHealthStatus): void {
    this.metrics.uptime = healthStatus.uptime;
    this.metrics.memoryUsage = healthStatus.memoryUsage;
    this.metrics.networkLatency = healthStatus.networkLatency;

    // Check for health alerts
    if (!healthStatus.isHealthy) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: 'Browser health degraded',
        metadata: healthStatus
      });
    }

    if (healthStatus.memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.createAlert({
        type: 'warning',
        severity: 'medium',
        message: 'High memory usage detected',
        metadata: { memoryUsage: healthStatus.memoryUsage }
      });
    }

    if (healthStatus.networkLatency > this.config.alertThresholds.networkLatency) {
      this.createAlert({
        type: 'warning',
        severity: 'medium',
        message: 'High network latency detected',
        metadata: { networkLatency: healthStatus.networkLatency }
      });
    }
  }

  // ===== ALERT MANAGEMENT =====

  createAlert(alert: Omit<AutomationAlert, 'id' | 'timestamp' | 'resolved'>): string {
    const alertId = this.generateId();
    const fullAlert: AutomationAlert = {
      ...alert,
      id: alertId,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.set(alertId, fullAlert);

    this.logger[alert.severity === 'critical' ? 'error' : 'warn'](
      `🚨 Alert created: ${alert.message}`,
      {
        alertId,
        type: alert.type,
        severity: alert.severity,
        metadata: alert.metadata
      }
    );

    return alertId;
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      this.logger.warn(`⚠️ Alert not found: ${alertId}`);
      return;
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();

    this.logger.info(`✅ Alert resolved: ${alert.message}`, {
      alertId,
      resolutionTime: alert.resolvedAt - alert.timestamp
    });
  }

  private checkSessionAlerts(session: AutomationSession, error?: string): void {
    // Check error rate
    const errorRate = (this.metrics.failedSessions / this.metrics.totalSessions) * 100;
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `High error rate detected: ${errorRate.toFixed(2)}%`,
        sessionId: session.id,
        metadata: { errorRate, totalSessions: this.metrics.totalSessions }
      });
    }

    // Check session duration
    const duration = (session.endTime || Date.now()) - session.startTime;
    if (duration > this.config.alertThresholds.responseTime) {
      this.createAlert({
        type: 'warning',
        severity: 'medium',
        message: `Long session duration: ${duration}ms`,
        sessionId: session.id,
        metadata: { duration, operation: session.operation }
      });
    }
  }

  private checkStepAlerts(step: AutomationStep): void {
    if (step.status === 'failed' && step.duration && step.duration > 10000) {
      this.createAlert({
        type: 'error',
        severity: 'medium',
        message: `Step failed after long duration: ${step.name}`,
        stepId: step.id,
        metadata: { 
          stepName: step.name, 
          duration: step.duration, 
          error: step.error 
        }
      });
    }
  }

  // ===== METRICS CALCULATION =====

  private updateAverageSessionDuration(duration: number): void {
    const totalSessions = this.metrics.successfulSessions + this.metrics.failedSessions;
    if (totalSessions > 0) {
      this.metrics.averageSessionDuration = 
        (this.metrics.averageSessionDuration * (totalSessions - 1) + duration) / totalSessions;
    }
  }

  private updateAverageStepDuration(duration: number): void {
    const totalSteps = this.metrics.successfulSteps + this.metrics.failedSteps;
    if (totalSteps > 0) {
      this.metrics.averageStepDuration = 
        (this.metrics.averageStepDuration * (totalSteps - 1) + duration) / totalSteps;
    }
  }

  private startRealTimeMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.updateMetrics();
    }, 10000); // Every 10 seconds
  }

  private updateMetrics(): void {
    // Update error rate
    if (this.metrics.totalSessions > 0) {
      this.metrics.errorRate = (this.metrics.failedSessions / this.metrics.totalSessions) * 100;
      this.metrics.successRate = (this.metrics.successfulSessions / this.metrics.totalSessions) * 100;
    }

    // Update uptime
    this.metrics.uptime = Date.now() - this.startTime;

    // Clean up old data
    this.cleanupOldData();
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    
    // Clean up old sessions
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (session.startTime < cutoffTime) {
        this.sessions.delete(sessionId);
      }
    }

    // Clean up old steps
    for (const [stepId, step] of Array.from(this.steps.entries())) {
      if (step.startTime < cutoffTime) {
        this.steps.delete(stepId);
      }
    }

    // Clean up old alerts
    for (const [alertId, alert] of Array.from(this.alerts.entries())) {
      if (alert.timestamp < cutoffTime && alert.resolved) {
        this.alerts.delete(alertId);
      }
    }
  }

  // ===== UTILITY METHODS =====

  private generateId(): string {
    return `automation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== PUBLIC METHODS =====

  getMetrics(): AutomationMetrics {
    return { ...this.metrics };
  }

  getSession(sessionId: string): AutomationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getStep(stepId: string): AutomationStep | undefined {
    return this.steps.get(stepId);
  }

  getActiveSessions(): AutomationSession[] {
    return Array.from(this.sessions.values()).filter(session => session.status === 'running');
  }

  getUnresolvedAlerts(): AutomationAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getAlertsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): AutomationAlert[] {
    return Array.from(this.alerts.values()).filter(alert => 
      alert.severity === severity && !alert.resolved
    );
  }

  exportData(): {
    sessions: AutomationSession[];
    steps: AutomationStep[];
    alerts: AutomationAlert[];
    metrics: AutomationMetrics;
  } {
    return {
      sessions: Array.from(this.sessions.values()),
      steps: Array.from(this.steps.values()),
      alerts: Array.from(this.alerts.values()),
      metrics: this.getMetrics()
    };
  }

  cleanup(): void {
    if (this.periodicScreenshotInterval) {
      clearInterval(this.periodicScreenshotInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.sessions.clear();
    this.steps.clear();
    this.alerts.clear();
    
    this.logger.info('🧹 Automation monitor cleaned up');
  }
}
