// ===== DEBUGGING TOOLS FOR ERROR HANDLING =====

import { Logger } from '../logging/logger';
import { ContextualError, ErrorContext } from './contextual-error';
import { ErrorCategory, ErrorSeverity } from './advanced-error-classification';
import { errorTracker } from './error-tracking';

// ===== TYPES =====

export interface DebugSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  context: ErrorContext;
  errors: ContextualError[];
  steps: DebugStep[];
  metadata: Record<string, any>;
  status: 'active' | 'completed' | 'failed';
}

export interface DebugStep {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: Record<string, any>;
  output?: Record<string, any>;
  errors: ContextualError[];
  metadata: Record<string, any>;
}

export interface DebugReport {
  sessionId: string;
  duration: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  stepTimeline: Array<{
    step: DebugStep;
    errors: ContextualError[];
  }>;
  recommendations: string[];
  performanceMetrics: {
    averageStepDuration: number;
    slowestStep: DebugStep | null;
    fastestStep: DebugStep | null;
  };
}

export interface ErrorPattern {
  pattern: string;
  category: ErrorCategory;
  frequency: number;
  examples: ContextualError[];
  suggestedFix: string;
}

// ===== MAIN CLASS =====

export class DebuggingTools {
  private static instance: DebuggingTools;
  private logger: Logger;
  private activeSessions: Map<string, DebugSession> = new Map();
  private completedSessions: Map<string, DebugSession> = new Map();
  private maxSessions: number = 100;

  private constructor() {
    this.logger = new Logger('INFO', { service: 'DebuggingTools' });
  }

  public static getInstance(): DebuggingTools {
    if (!DebuggingTools.instance) {
      DebuggingTools.instance = new DebuggingTools();
    }
    return DebuggingTools.instance;
  }

  // ===== DEBUG SESSION MANAGEMENT =====

  /**
   * Создание новой отладочной сессии
   */
  createDebugSession(
    context: ErrorContext,
    metadata: Record<string, any> = {}
  ): DebugSession {
    const session: DebugSession = {
      id: this.generateSessionId(),
      startTime: new Date(),
      context,
      errors: [],
      steps: [],
      metadata,
      status: 'active'
    };

    this.activeSessions.set(session.id, session);
    
    this.logger.info('Debug session created', {
      sessionId: session.id,
      context: session.context,
      metadata: session.metadata
    });

    return session;
  }

  /**
   * Завершение отладочной сессии
   */
  completeDebugSession(sessionId: string, status: 'completed' | 'failed' = 'completed'): DebugSession | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn('Debug session not found', { sessionId });
      return null;
    }

    session.endTime = new Date();
    session.status = status;

    // Перемещаем в завершенные сессии
    this.activeSessions.delete(sessionId);
    this.completedSessions.set(sessionId, session);

    // Очищаем старые сессии
    this.cleanupOldSessions();

    this.logger.info('Debug session completed', {
      sessionId,
      status,
      duration: session.endTime.getTime() - session.startTime.getTime(),
      totalSteps: session.steps.length,
      totalErrors: session.errors.length
    });

    return session;
  }

  /**
   * Добавление ошибки в отладочную сессию
   */
  addErrorToSession(sessionId: string, error: ContextualError): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn('Debug session not found for error', { sessionId, errorId: error.id });
      return;
    }

    session.errors.push(error);
    
    // Отслеживаем ошибку
    errorTracker.trackError(error, 'debug-session', {
      sessionId,
      sessionContext: session.context
    });

    this.logger.debug('Error added to debug session', {
      sessionId,
      errorId: error.id,
      errorMessage: error.message,
      errorCategory: error.classification.category
    });
  }

  // ===== DEBUG STEP MANAGEMENT =====

  /**
   * Создание отладочного шага
   */
  createDebugStep(
    sessionId: string,
    name: string,
    input?: Record<string, any>,
    metadata: Record<string, any> = {}
  ): DebugStep {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    const step: DebugStep = {
      id: this.generateStepId(),
      name,
      startTime: new Date(),
      status: 'pending',
      input,
      errors: [],
      metadata
    };

    session.steps.push(step);

    this.logger.debug('Debug step created', {
      sessionId,
      stepId: step.id,
      stepName: name,
      input
    });

    return step;
  }

  /**
   * Запуск отладочного шага
   */
  startDebugStep(sessionId: string, stepId: string): void {
    const step = this.findStep(sessionId, stepId);
    if (!step) {
      this.logger.warn('Debug step not found', { sessionId, stepId });
      return;
    }

    step.status = 'running';
    step.startTime = new Date();

    this.logger.debug('Debug step started', {
      sessionId,
      stepId,
      stepName: step.name
    });
  }

  /**
   * Завершение отладочного шага
   */
  completeDebugStep(
    sessionId: string,
    stepId: string,
    status: 'completed' | 'failed' = 'completed',
    output?: Record<string, any>
  ): void {
    const step = this.findStep(sessionId, stepId);
    if (!step) {
      this.logger.warn('Debug step not found', { sessionId, stepId });
      return;
    }

    step.status = status;
    step.endTime = new Date();
    step.duration = step.endTime.getTime() - step.startTime.getTime();
    step.output = output;

    this.logger.debug('Debug step completed', {
      sessionId,
      stepId,
      stepName: step.name,
      status,
      duration: step.duration,
      output
    });
  }

  /**
   * Добавление ошибки в отладочный шаг
   */
  addErrorToStep(sessionId: string, stepId: string, error: ContextualError): void {
    const step = this.findStep(sessionId, stepId);
    if (!step) {
      this.logger.warn('Debug step not found for error', { sessionId, stepId, errorId: error.id });
      return;
    }

    step.errors.push(error);
    step.status = 'failed';

    // Также добавляем в сессию
    this.addErrorToSession(sessionId, error);

    this.logger.debug('Error added to debug step', {
      sessionId,
      stepId,
      stepName: step.name,
      errorId: error.id,
      errorMessage: error.message
    });
  }

  // ===== ERROR ANALYSIS =====

  /**
   * Анализ паттернов ошибок
   */
  analyzeErrorPatterns(sessionId?: string): ErrorPattern[] {
    const errors = sessionId 
      ? this.getSessionErrors(sessionId)
      : Array.from(errorTracker.getErrorsByCategory(ErrorCategory.SYSTEM));

    const patterns = new Map<string, ErrorPattern>();

    for (const error of errors) {
      const key = `${error.classification.category}_${error.classification.code}`;
      
      if (!patterns.has(key)) {
        patterns.set(key, {
          pattern: `${error.classification.category}: ${error.classification.code}`,
          category: error.classification.category,
          frequency: 0,
          examples: [],
          suggestedFix: error.classification.suggestedActions.join('; ')
        });
      }

      const pattern = patterns.get(key)!;
      pattern.frequency++;
      
      if (pattern.examples.length < 3) {
        pattern.examples.push(error);
      }
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Анализ производительности отладочной сессии
   */
  analyzeSessionPerformance(sessionId: string): {
    totalDuration: number;
    averageStepDuration: number;
    slowestStep: DebugStep | null;
    fastestStep: DebugStep | null;
    stepTimeline: Array<{
      step: DebugStep;
      duration: number;
      status: string;
    }>;
  } | null {
    const session = this.completedSessions.get(sessionId) || this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const completedSteps = session.steps.filter(step => step.duration !== undefined);
    const totalDuration = session.endTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const averageStepDuration = completedSteps.length > 0
      ? completedSteps.reduce((sum, step) => sum + (step.duration || 0), 0) / completedSteps.length
      : 0;

    const slowestStep = completedSteps.reduce((slowest, current) => 
      (current.duration || 0) > (slowest.duration || 0) ? current : slowest, 
      completedSteps[0] || null
    );

    const fastestStep = completedSteps.reduce((fastest, current) => 
      (current.duration || 0) < (fastest.duration || 0) ? current : fastest, 
      completedSteps[0] || null
    );

    const stepTimeline = session.steps.map(step => ({
      step,
      duration: step.duration || 0,
      status: step.status
    }));

    return {
      totalDuration,
      averageStepDuration,
      slowestStep,
      fastestStep,
      stepTimeline
    };
  }

  // ===== DEBUG REPORTS =====

  /**
   * Генерация отладочного отчета
   */
  generateDebugReport(sessionId: string): DebugReport | null {
    const session = this.completedSessions.get(sessionId) || this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const duration = session.endTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const completedSteps = session.steps.filter(step => step.status === 'completed');
    const failedSteps = session.steps.filter(step => step.status === 'failed');

    // Анализ ошибок
    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;

    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    for (const error of session.errors) {
      errorsByCategory[error.classification.category]++;
      errorsBySeverity[error.classification.severity]++;
    }

    // Таймлайн шагов
    const stepTimeline = session.steps.map(step => ({
      step,
      errors: step.errors
    }));

    // Рекомендации
    const recommendations = this.generateDebugRecommendations(session);

    // Метрики производительности
    const performanceMetrics = this.analyzeSessionPerformance(sessionId) || {
      averageStepDuration: 0,
      slowestStep: null,
      fastestStep: null
    };

    return {
      sessionId,
      duration,
      totalSteps: session.steps.length,
      completedSteps: completedSteps.length,
      failedSteps: failedSteps.length,
      totalErrors: session.errors.length,
      errorsByCategory,
      errorsBySeverity,
      stepTimeline,
      recommendations,
      performanceMetrics
    };
  }

  private generateDebugRecommendations(session: DebugSession): string[] {
    const recommendations: string[] = [];

    // Рекомендации по ошибкам
    const errorPatterns = this.analyzeErrorPatterns(session.id);
    const highFrequencyPatterns = errorPatterns.filter(pattern => pattern.frequency > 2);

    if (highFrequencyPatterns.length > 0) {
      recommendations.push(`High frequency error patterns detected: ${highFrequencyPatterns.map(p => p.pattern).join(', ')}`);
    }

    // Рекомендации по производительности
    const performance = this.analyzeSessionPerformance(session.id);
    if (performance && performance.slowestStep && performance.slowestStep.duration && performance.slowestStep.duration > 10000) {
      recommendations.push(`Slow step detected: ${performance.slowestStep.name} (${performance.slowestStep.duration}ms)`);
    }

    // Рекомендации по статусу сессии
    if (session.status === 'failed') {
      recommendations.push('Session failed. Check error logs and fix issues before retrying.');
    }

    const failedSteps = session.steps.filter(step => step.status === 'failed');
    if (failedSteps.length > 0) {
      recommendations.push(`${failedSteps.length} steps failed. Review step errors and fix issues.`);
    }

    return recommendations;
  }

  // ===== UTILITY METHODS =====

  private findStep(sessionId: string, stepId: string): DebugStep | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return session.steps.find(step => step.id === stepId) || null;
  }

  private getSessionErrors(sessionId: string): ContextualError[] {
    const session = this.activeSessions.get(sessionId) || this.completedSessions.get(sessionId);
    return session ? session.errors : [];
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `debug_${timestamp}_${random}`;
  }

  private generateStepId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `step_${timestamp}_${random}`;
  }

  private cleanupOldSessions(): void {
    if (this.completedSessions.size > this.maxSessions) {
      const sessions = Array.from(this.completedSessions.values())
        .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0));
      
      const toKeep = sessions.slice(0, this.maxSessions);
      this.completedSessions.clear();
      
      for (const session of toKeep) {
        this.completedSessions.set(session.id, session);
      }
    }
  }

  // ===== PUBLIC API =====

  getActiveSessions(): DebugSession[] {
    return Array.from(this.activeSessions.values());
  }

  getCompletedSessions(): DebugSession[] {
    return Array.from(this.completedSessions.values());
  }

  getSession(sessionId: string): DebugSession | null {
    return this.activeSessions.get(sessionId) || this.completedSessions.get(sessionId) || null;
  }

  getSessionCount(): { active: number; completed: number } {
    return {
      active: this.activeSessions.size,
      completed: this.completedSessions.size
    };
  }

  exportSessionData(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const report = this.generateDebugReport(sessionId);
    const performance = this.analyzeSessionPerformance(sessionId);
    const patterns = this.analyzeErrorPatterns(sessionId);

    const data = {
      session,
      report,
      performance,
      patterns,
      exportDate: new Date().toISOString()
    };

    return JSON.stringify(data, null, 2);
  }
}

// ===== SINGLETON INSTANCE =====

export const debuggingTools = DebuggingTools.getInstance();

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Создание отладочной сессии с автоматическим управлением
 */
export function withDebugSession<T>(
  context: ErrorContext,
  operation: (session: DebugSession) => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> {
  const session = debuggingTools.createDebugSession(context, metadata);
  
  return operation(session)
    .then(result => {
      debuggingTools.completeDebugSession(session.id, 'completed');
      return result;
    })
    .catch(error => {
      const contextualError = ContextualError.fromError(error, context, metadata);
      debuggingTools.addErrorToSession(session.id, contextualError);
      debuggingTools.completeDebugSession(session.id, 'failed');
      throw contextualError;
    });
}

/**
 * Выполнение отладочного шага с автоматическим управлением
 */
export function withDebugStep<T>(
  sessionId: string,
  stepName: string,
  operation: (step: DebugStep) => Promise<T>,
  input?: Record<string, any>,
  metadata: Record<string, any> = {}
): Promise<T> {
  const step = debuggingTools.createDebugStep(sessionId, stepName, input, metadata);
  debuggingTools.startDebugStep(sessionId, step.id);
  
  return operation(step)
    .then(result => {
      debuggingTools.completeDebugStep(sessionId, step.id, 'completed', { result });
      return result;
    })
    .catch(error => {
      const contextualError = ContextualError.fromError(error, {
        service: 'debug-step',
        method: stepName
      }, { stepId: step.id, input });
      
      debuggingTools.addErrorToStep(sessionId, step.id, contextualError);
      debuggingTools.completeDebugStep(sessionId, step.id, 'failed', { error: contextualError.getLogInfo() });
      throw contextualError;
    });
}

