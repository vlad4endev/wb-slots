// ===== ADVANCED ERROR CLASSIFICATION SYSTEM =====

import { Logger } from '../logging/logger';

// ===== ERROR CATEGORIES =====

export enum ErrorCategory {
  // Системные ошибки
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  
  // Бизнес-логика
  VALIDATION = 'VALIDATION',
  BUSINESS_RULE = 'BUSINESS_RULE',
  CONFLICT = 'CONFLICT',
  NOT_FOUND = 'NOT_FOUND',
  
  // Внешние сервисы
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  
  // Браузерная автоматизация
  BROWSER = 'BROWSER',
  SELECTOR = 'SELECTOR',
  ANTI_BOT = 'ANTI_BOT',
  CAPTCHA = 'CAPTCHA',
  
  // WB API
  WB_API = 'WB_API',
  WB_AUTH = 'WB_AUTH',
  WB_SESSION = 'WB_SESSION',
  
  // Уведомления
  NOTIFICATION = 'NOTIFICATION',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  
  // Конфигурация
  CONFIGURATION = 'CONFIGURATION',
  ENVIRONMENT = 'ENVIRONMENT'
}

// ===== ERROR SEVERITY =====

export enum ErrorSeverity {
  LOW = 'LOW',           // Информационные сообщения
  MEDIUM = 'MEDIUM',     // Предупреждения
  HIGH = 'HIGH',         // Ошибки, требующие внимания
  CRITICAL = 'CRITICAL', // Критические ошибки, останавливающие работу
  EMERGENCY = 'EMERGENCY' // Аварийные ситуации
}

// ===== ERROR CONTEXT =====

export interface ErrorContext {
  // Идентификация
  requestId?: string;
  userId?: string;
  sessionId?: string;
  taskId?: string;
  runId?: string;
  
  // Локация ошибки
  service?: string;
  method?: string;
  file?: string;
  line?: number;
  function?: string;
  
  // Временные метки
  timestamp?: Date;
  duration?: number;
  
  // Дополнительные данные
  input?: Record<string, any>;
  output?: Record<string, any>;
  metadata?: Record<string, any>;
  
  // Связанные ресурсы
  relatedIds?: string[];
  tags?: string[];
  
  // Среда выполнения
  environment?: string;
  version?: string;
  build?: string;
}

// ===== ERROR CLASSIFICATION =====

export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  type: string;
  subType?: string;
  isRetryable: boolean;
  isUserFacing: boolean;
  requiresImmediateAction: boolean;
  suggestedActions: string[];
  documentation?: string;
}

// ===== ERROR DETECTION RULES =====

export interface ErrorDetectionRule {
  pattern: RegExp | string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  type: string;
  subType?: string;
  isRetryable: boolean;
  isUserFacing: boolean;
  requiresImmediateAction: boolean;
  suggestedActions: string[];
  documentation?: string;
}

// ===== MAIN CLASS =====

export class AdvancedErrorClassifier {
  private static instance: AdvancedErrorClassifier;
  private logger: Logger;
  private detectionRules: ErrorDetectionRule[] = [];

  private constructor() {
    this.logger = new Logger('INFO', { service: 'AdvancedErrorClassifier' });
    this.initializeDetectionRules();
  }

  public static getInstance(): AdvancedErrorClassifier {
    if (!AdvancedErrorClassifier.instance) {
      AdvancedErrorClassifier.instance = new AdvancedErrorClassifier();
    }
    return AdvancedErrorClassifier.instance;
  }

  // ===== INITIALIZATION =====

  private initializeDetectionRules(): void {
    this.detectionRules = [
      // Системные ошибки
      {
        pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        code: 'NETWORK_CONNECTION_FAILED',
        type: 'ConnectionError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Check network connectivity', 'Retry operation', 'Check service availability'],
        documentation: 'Network connection failed'
      },
      {
        pattern: /timeout|TIMEOUT/,
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        code: 'OPERATION_TIMEOUT',
        type: 'TimeoutError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Increase timeout', 'Retry operation', 'Check service performance'],
        documentation: 'Operation timed out'
      },

      // База данных
      {
        pattern: /Unique constraint|duplicate key/,
        category: ErrorCategory.CONFLICT,
        severity: ErrorSeverity.MEDIUM,
        code: 'DUPLICATE_RESOURCE',
        type: 'ConflictError',
        isRetryable: false,
        isUserFacing: true,
        requiresImmediateAction: false,
        suggestedActions: ['Check for existing resource', 'Use different identifier', 'Update existing resource'],
        documentation: 'Resource already exists'
      },
      {
        pattern: /Foreign key constraint|referential integrity/,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.HIGH,
        code: 'INVALID_REFERENCE',
        type: 'ValidationError',
        isRetryable: false,
        isUserFacing: true,
        requiresImmediateAction: false,
        suggestedActions: ['Check referenced resource exists', 'Fix data integrity', 'Validate input data'],
        documentation: 'Invalid reference to related resource'
      },
      {
        pattern: /Connection.*failed|Database.*unavailable/,
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.CRITICAL,
        code: 'DATABASE_CONNECTION_FAILED',
        type: 'DatabaseError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: true,
        suggestedActions: ['Check database status', 'Restart database service', 'Check connection pool'],
        documentation: 'Database connection failed'
      },

      // Аутентификация и авторизация
      {
        pattern: /401|Unauthorized|Invalid credentials/,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        code: 'AUTHENTICATION_FAILED',
        type: 'AuthenticationError',
        isRetryable: false,
        isUserFacing: true,
        requiresImmediateAction: false,
        suggestedActions: ['Check credentials', 'Refresh token', 'Re-authenticate'],
        documentation: 'Authentication failed'
      },
      {
        pattern: /403|Forbidden|Insufficient permissions/,
        category: ErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.HIGH,
        code: 'AUTHORIZATION_DENIED',
        type: 'AuthorizationError',
        isRetryable: false,
        isUserFacing: true,
        requiresImmediateAction: false,
        suggestedActions: ['Check user permissions', 'Contact administrator', 'Verify access rights'],
        documentation: 'Access denied'
      },

      // Браузерная автоматизация
      {
        pattern: /Element not found|Selector not found/,
        category: ErrorCategory.SELECTOR,
        severity: ErrorSeverity.MEDIUM,
        code: 'ELEMENT_NOT_FOUND',
        type: 'SelectorError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Update selectors', 'Check page structure', 'Wait for element to load'],
        documentation: 'Web element not found'
      },
      {
        pattern: /Bot detected|Automation detected/,
        category: ErrorCategory.ANTI_BOT,
        severity: ErrorSeverity.HIGH,
        code: 'BOT_DETECTED',
        type: 'AntiBotError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Improve anti-detection', 'Change IP address', 'Use different browser settings'],
        documentation: 'Bot detection triggered'
      },
      {
        pattern: /Captcha|CAPTCHA/,
        category: ErrorCategory.CAPTCHA,
        severity: ErrorSeverity.MEDIUM,
        code: 'CAPTCHA_REQUIRED',
        type: 'CaptchaError',
        isRetryable: true,
        isUserFacing: true,
        requiresImmediateAction: false,
        suggestedActions: ['Solve captcha manually', 'Use captcha solving service', 'Wait and retry'],
        documentation: 'Captcha challenge required'
      },

      // WB API
      {
        pattern: /WB.*API.*error|Wildberries.*error/,
        category: ErrorCategory.WB_API,
        severity: ErrorSeverity.HIGH,
        code: 'WB_API_ERROR',
        type: 'WBApiError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Check WB API status', 'Verify API credentials', 'Retry with backoff'],
        documentation: 'Wildberries API error'
      },
      {
        pattern: /Session.*expired|Token.*invalid/,
        category: ErrorCategory.WB_SESSION,
        severity: ErrorSeverity.MEDIUM,
        code: 'WB_SESSION_EXPIRED',
        type: 'WBSessionError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Refresh session', 'Re-authenticate', 'Update session token'],
        documentation: 'Wildberries session expired'
      },

      // Уведомления
      {
        pattern: /Telegram.*error|Bot.*error/,
        category: ErrorCategory.TELEGRAM,
        severity: ErrorSeverity.MEDIUM,
        code: 'TELEGRAM_ERROR',
        type: 'TelegramError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Check bot token', 'Verify chat ID', 'Check Telegram API status'],
        documentation: 'Telegram notification error'
      },
      {
        pattern: /Rate limit|Too many requests/,
        category: ErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        code: 'RATE_LIMIT_EXCEEDED',
        type: 'RateLimitError',
        isRetryable: true,
        isUserFacing: false,
        requiresImmediateAction: false,
        suggestedActions: ['Wait before retry', 'Implement exponential backoff', 'Reduce request frequency'],
        documentation: 'Rate limit exceeded'
      },

      // Валидация
      {
        pattern: /Validation.*failed|Invalid.*input/,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        code: 'VALIDATION_FAILED',
        type: 'ValidationError',
        isRetryable: false,
        isUserFacing: true,
        requiresImmediateAction: false,
        suggestedActions: ['Check input data', 'Validate parameters', 'Fix data format'],
        documentation: 'Input validation failed'
      },

      // Конфигурация
      {
        pattern: /Configuration.*error|Missing.*config/,
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.CRITICAL,
        code: 'CONFIGURATION_ERROR',
        type: 'ConfigurationError',
        isRetryable: false,
        isUserFacing: false,
        requiresImmediateAction: true,
        suggestedActions: ['Check configuration files', 'Set required environment variables', 'Verify settings'],
        documentation: 'Configuration error'
      }
    ];

    this.logger.info(`Initialized ${this.detectionRules.length} error detection rules`);
  }

  // ===== CLASSIFICATION METHODS =====

  /**
   * Классификация ошибки на основе сообщения и контекста
   */
  classifyError(error: Error | string, context?: ErrorContext): ErrorClassification {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    // Ищем подходящее правило
    for (const rule of this.detectionRules) {
      if (this.matchesRule(errorMessage, rule)) {
        return {
          category: rule.category,
          severity: rule.severity,
          code: rule.code,
          type: rule.type,
          subType: rule.subType,
          isRetryable: rule.isRetryable,
          isUserFacing: rule.isUserFacing,
          requiresImmediateAction: rule.requiresImmediateAction,
          suggestedActions: rule.suggestedActions,
          documentation: rule.documentation
        };
      }
    }

    // Если не найдено подходящее правило, используем общую классификацию
    return this.classifyUnknownError(errorMessage, context);
  }

  /**
   * Проверка соответствия ошибки правилу
   */
  private matchesRule(errorMessage: string, rule: ErrorDetectionRule): boolean {
    if (typeof rule.pattern === 'string') {
      return errorMessage.toLowerCase().includes(rule.pattern.toLowerCase());
    } else {
      return rule.pattern.test(errorMessage);
    }
  }

  /**
   * Классификация неизвестной ошибки
   */
  private classifyUnknownError(errorMessage: string, context?: ErrorContext): ErrorClassification {
    // Анализируем контекст для определения категории
    let category = ErrorCategory.SYSTEM;
    let severity = ErrorSeverity.MEDIUM;

    if (context?.service) {
      if (context.service.includes('browser') || context.service.includes('playwright')) {
        category = ErrorCategory.BROWSER;
      } else if (context.service.includes('database') || context.service.includes('prisma')) {
        category = ErrorCategory.DATABASE;
      } else if (context.service.includes('telegram') || context.service.includes('notification')) {
        category = ErrorCategory.NOTIFICATION;
      } else if (context.service.includes('wb') || context.service.includes('wildberries')) {
        category = ErrorCategory.WB_API;
      }
    }

    // Определяем серьезность на основе ключевых слов
    if (errorMessage.toLowerCase().includes('critical') || errorMessage.toLowerCase().includes('fatal')) {
      severity = ErrorSeverity.CRITICAL;
    } else if (errorMessage.toLowerCase().includes('error') || errorMessage.toLowerCase().includes('failed')) {
      severity = ErrorSeverity.HIGH;
    } else if (errorMessage.toLowerCase().includes('warning') || errorMessage.toLowerCase().includes('warn')) {
      severity = ErrorSeverity.MEDIUM;
    }

    return {
      category,
      severity,
      code: 'UNKNOWN_ERROR',
      type: 'UnknownError',
      isRetryable: true,
      isUserFacing: false,
      requiresImmediateAction: severity === ErrorSeverity.CRITICAL,
      suggestedActions: ['Investigate error details', 'Check logs', 'Contact support'],
      documentation: 'Unknown error type'
    };
  }

  // ===== UTILITY METHODS =====

  /**
   * Добавление нового правила детекции
   */
  addDetectionRule(rule: ErrorDetectionRule): void {
    this.detectionRules.push(rule);
    this.logger.info(`Added new error detection rule: ${rule.code}`);
  }

  /**
   * Получение всех правил детекции
   */
  getDetectionRules(): ErrorDetectionRule[] {
    return [...this.detectionRules];
  }

  /**
   * Получение правил по категории
   */
  getRulesByCategory(category: ErrorCategory): ErrorDetectionRule[] {
    return this.detectionRules.filter(rule => rule.category === category);
  }

  /**
   * Получение правил по серьезности
   */
  getRulesBySeverity(severity: ErrorSeverity): ErrorDetectionRule[] {
    return this.detectionRules.filter(rule => rule.severity === severity);
  }

  /**
   * Проверка, является ли ошибка повторяемой
   */
  isRetryableError(error: Error | string, context?: ErrorContext): boolean {
    const classification = this.classifyError(error, context);
    return classification.isRetryable;
  }

  /**
   * Проверка, требует ли ошибка немедленных действий
   */
  requiresImmediateAction(error: Error | string, context?: ErrorContext): boolean {
    const classification = this.classifyError(error, context);
    return classification.requiresImmediateAction;
  }

  /**
   * Получение рекомендуемых действий для ошибки
   */
  getSuggestedActions(error: Error | string, context?: ErrorContext): string[] {
    const classification = this.classifyError(error, context);
    return classification.suggestedActions;
  }

  /**
   * Экспорт правил детекции
   */
  exportRules(): string {
    return JSON.stringify(this.detectionRules, null, 2);
  }

  /**
   * Импорт правил детекции
   */
  importRules(rulesJson: string): void {
    try {
      const rules = JSON.parse(rulesJson) as ErrorDetectionRule[];
      this.detectionRules = rules;
      this.logger.info(`Imported ${rules.length} error detection rules`);
    } catch (error) {
      this.logger.error('Failed to import error detection rules', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Invalid rules format');
    }
  }
}

// ===== SINGLETON INSTANCE =====

// Используем globalThis для сохранения instance между hot-reloads в Next.js
declare global {
  var __advancedErrorClassifier: AdvancedErrorClassifier | undefined;
}

if (!global.__advancedErrorClassifier) {
  global.__advancedErrorClassifier = AdvancedErrorClassifier.getInstance();
}

export const advancedErrorClassifier = global.__advancedErrorClassifier;

