// ===== CONTEXTUAL ERROR SYSTEM =====

import { Logger } from '../logging/logger';
import { 
  ErrorCategory, 
  ErrorSeverity, 
  ErrorContext, 
  ErrorClassification,
  advancedErrorClassifier 
} from './advanced-error-classification';

// ===== CONTEXTUAL ERROR CLASS =====

export class ContextualError extends Error {
  public readonly id: string;
  public readonly timestamp: Date;
  public readonly classification: ErrorClassification;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly stackTrace: string;
  public readonly metadata: Record<string, any>;

  constructor(
    message: string,
    classification: ErrorClassification,
    context: ErrorContext = {},
    originalError?: Error,
    metadata: Record<string, any> = {}
  ) {
    super(message);
    
    this.name = 'ContextualError';
    this.id = this.generateErrorId();
    this.timestamp = new Date();
    this.classification = classification;
    this.context = this.enrichContext(context);
    this.originalError = originalError;
    this.stackTrace = this.captureStackTrace();
    this.metadata = metadata;

    // Сохраняем оригинальный stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextualError);
    }
  }

  // ===== FACTORY METHODS =====

  /**
   * Создание контекстной ошибки из обычной ошибки
   */
  static fromError(
    error: Error,
    context: ErrorContext = {},
    additionalMetadata: Record<string, any> = {}
  ): ContextualError {
    const classification = advancedErrorClassifier.classifyError(error, context);
    
    return new ContextualError(
      error.message,
      classification,
      context,
      error,
      additionalMetadata
    );
  }

  /**
   * Создание контекстной ошибки из строки
   */
  static fromMessage(
    message: string,
    context: ErrorContext = {},
    additionalMetadata: Record<string, any> = {}
  ): ContextualError {
    const classification = advancedErrorClassifier.classifyError(message, context);
    
    return new ContextualError(
      message,
      classification,
      context,
      undefined,
      additionalMetadata
    );
  }

  /**
   * Создание контекстной ошибки с кастомной классификацией
   */
  static withClassification(
    message: string,
    classification: ErrorClassification,
    context: ErrorContext = {},
    originalError?: Error,
    metadata: Record<string, any> = {}
  ): ContextualError {
    return new ContextualError(
      message,
      classification,
      context,
      originalError,
      metadata
    );
  }

  // ===== CONTEXT ENRICHMENT =====

  private enrichContext(context: ErrorContext): ErrorContext {
    const enriched: ErrorContext = {
      ...context,
      timestamp: this.timestamp,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown',
      build: process.env.BUILD_ID || 'unknown'
    };

    // Добавляем информацию о системе
    if (!enriched.metadata) {
      enriched.metadata = {};
    }

    enriched.metadata.system = {
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid
    };

    // Добавляем информацию о стеке вызовов
    if (this.stackTrace) {
      enriched.metadata.stackInfo = this.parseStackTrace();
    }

    return enriched;
  }

  // ===== STACK TRACE PROCESSING =====

  private captureStackTrace(): string {
    const stack = this.stack || this.originalError?.stack || '';
    return stack;
  }

  private parseStackTrace(): {
    frames: Array<{
      function?: string;
      file?: string;
      line?: number;
      column?: number;
    }>;
    summary: string;
  } {
    const stack = this.stackTrace;
    const frames: Array<{
      function?: string;
      file?: string;
      line?: number;
      column?: number;
    }> = [];

    if (stack) {
      const lines = stack.split('\n');
      
      for (const line of lines) {
        // Парсим строки стека в формате Node.js
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
          frames.push({
            function: match[1],
            file: match[2],
            line: parseInt(match[3]),
            column: parseInt(match[4])
          });
        }
      }
    }

    return {
      frames,
      summary: `${frames.length} stack frames`
    };
  }

  // ===== UTILITY METHODS =====

  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Получение краткого описания ошибки
   */
  getSummary(): string {
    return `${this.classification.type}: ${this.message}`;
  }

  /**
   * Получение детального описания ошибки
   */
  getDetails(): {
    id: string;
    message: string;
    classification: ErrorClassification;
    context: ErrorContext;
    timestamp: Date;
    isRetryable: boolean;
    suggestedActions: string[];
  } {
    return {
      id: this.id,
      message: this.message,
      classification: this.classification,
      context: this.context,
      timestamp: this.timestamp,
      isRetryable: this.classification.isRetryable,
      suggestedActions: this.classification.suggestedActions
    };
  }

  /**
   * Получение информации для логирования
   */
  getLogInfo(): Record<string, any> {
    return {
      id: this.id,
      message: this.message,
      category: this.classification.category,
      severity: this.classification.severity,
      code: this.classification.code,
      type: this.classification.type,
      isRetryable: this.classification.isRetryable,
      isUserFacing: this.classification.isUserFacing,
      requiresImmediateAction: this.classification.requiresImmediateAction,
      context: this.context,
      timestamp: this.timestamp,
      stackTrace: this.stackTrace,
      metadata: this.metadata,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }

  /**
   * Получение информации для пользователя
   */
  getUserMessage(): string {
    if (this.classification.isUserFacing) {
      return this.message;
    }

    // Для системных ошибок возвращаем общее сообщение
    switch (this.classification.category) {
      case ErrorCategory.NETWORK:
        return 'Проблема с сетевым подключением. Попробуйте позже.';
      case ErrorCategory.DATABASE:
        return 'Временная проблема с базой данных. Попробуйте позже.';
      case ErrorCategory.AUTHENTICATION:
        return 'Ошибка аутентификации. Проверьте учетные данные.';
      case ErrorCategory.AUTHORIZATION:
        return 'Недостаточно прав для выполнения операции.';
      case ErrorCategory.VALIDATION:
        return 'Некорректные данные. Проверьте введенную информацию.';
      case ErrorCategory.CONFLICT:
        return 'Конфликт данных. Ресурс уже существует.';
      case ErrorCategory.NOT_FOUND:
        return 'Запрашиваемый ресурс не найден.';
      case ErrorCategory.RATE_LIMIT:
        return 'Слишком много запросов. Попробуйте позже.';
      case ErrorCategory.TIMEOUT:
        return 'Операция заняла слишком много времени. Попробуйте позже.';
      default:
        return 'Произошла ошибка. Попробуйте позже.';
    }
  }

  /**
   * Получение информации для отладки
   */
  getDebugInfo(): Record<string, any> {
    return {
      id: this.id,
      message: this.message,
      classification: this.classification,
      context: this.context,
      timestamp: this.timestamp,
      stackTrace: this.stackTrace,
      metadata: this.metadata,
      originalError: this.originalError,
      suggestedActions: this.classification.suggestedActions,
      documentation: this.classification.documentation
    };
  }

  /**
   * Проверка, является ли ошибка критической
   */
  isCritical(): boolean {
    return this.classification.severity === ErrorSeverity.CRITICAL || 
           this.classification.severity === ErrorSeverity.EMERGENCY;
  }

  /**
   * Проверка, требует ли ошибка немедленных действий
   */
  requiresAction(): boolean {
    return this.classification.requiresImmediateAction;
  }

  /**
   * Получение тегов для группировки ошибок
   */
  getTags(): string[] {
    const tags: string[] = [
      this.classification.category,
      this.classification.severity,
      this.classification.type
    ];

    if (this.context.service) {
      tags.push(`service:${this.context.service}`);
    }

    if (this.context.method) {
      tags.push(`method:${this.context.method}`);
    }

    if (this.context.userId) {
      tags.push(`user:${this.context.userId}`);
    }

    return tags;
  }

  /**
   * Сериализация ошибки в JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      classification: this.classification,
      context: this.context,
      timestamp: this.timestamp,
      stackTrace: this.stackTrace,
      metadata: this.metadata,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }

  /**
   * Создание копии ошибки с дополнительным контекстом
   */
  withContext(additionalContext: ErrorContext): ContextualError {
    return new ContextualError(
      this.message,
      this.classification,
      { ...this.context, ...additionalContext },
      this.originalError,
      this.metadata
    );
  }

  /**
   * Создание копии ошибки с дополнительными метаданными
   */
  withMetadata(additionalMetadata: Record<string, any>): ContextualError {
    return new ContextualError(
      this.message,
      this.classification,
      this.context,
      this.originalError,
      { ...this.metadata, ...additionalMetadata }
    );
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Создание контекстной ошибки из обычной ошибки
 */
export function createContextualError(
  error: Error,
  context: ErrorContext = {},
  metadata: Record<string, any> = {}
): ContextualError {
  return ContextualError.fromError(error, context, metadata);
}

/**
 * Создание контекстной ошибки из сообщения
 */
export function createContextualErrorFromMessage(
  message: string,
  context: ErrorContext = {},
  metadata: Record<string, any> = {}
): ContextualError {
  return ContextualError.fromMessage(message, context, metadata);
}

/**
 * Создание контекстной ошибки с кастомной классификацией
 */
export function createContextualErrorWithClassification(
  message: string,
  classification: ErrorClassification,
  context: ErrorContext = {},
  originalError?: Error,
  metadata: Record<string, any> = {}
): ContextualError {
  return ContextualError.withClassification(
    message,
    classification,
    context,
    originalError,
    metadata
  );
}

// ===== ERROR CONTEXT BUILDERS =====

/**
 * Создание контекста для API запроса
 */
export function createApiContext(
  requestId: string,
  method: string,
  path: string,
  userId?: string
): ErrorContext {
  return {
    requestId,
    method,
    file: path,
    userId,
    tags: ['api', 'request']
  };
}

/**
 * Создание контекста для сервиса
 */
export function createServiceContext(
  service: string,
  method: string,
  userId?: string,
  taskId?: string
): ErrorContext {
  return {
    service,
    method,
    userId,
    taskId,
    tags: ['service', service]
  };
}

/**
 * Создание контекста для браузерной автоматизации
 */
export function createBrowserContext(
  action: string,
  selector?: string,
  url?: string,
  userId?: string
): ErrorContext {
  return {
    service: 'browser',
    method: action,
    userId,
    metadata: {
      selector,
      url,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    },
    tags: ['browser', 'automation']
  };
}

/**
 * Создание контекста для WB API
 */
export function createWBApiContext(
  endpoint: string,
  method: string,
  userId?: string,
  sessionId?: string
): ErrorContext {
  return {
    service: 'wb-api',
    method,
    userId,
    sessionId,
    metadata: {
      endpoint
    },
    tags: ['wb-api', 'external-service']
  };
}

