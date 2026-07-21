// ===== ADVANCED ERROR HANDLING EXAMPLE =====

import { 
  ContextualError,
  createContextualError,
  createContextualErrorFromMessage,
  createApiContext,
  createServiceContext,
  createBrowserContext,
  createWBApiContext
} from '../lib/errors/contextual-error';
import { 
  ErrorCategory, 
  ErrorSeverity,
  advancedErrorClassifier 
} from '../lib/errors/advanced-error-classification';
import { errorTracker } from '../lib/errors/error-tracking';
import { 
  debuggingTools,
  withDebugSession,
  withDebugStep 
} from '../lib/errors/debugging-tools';
import { 
  errorRecoverySystem,
  withRecovery 
} from '../lib/errors/error-recovery';

/**
 * Пример использования продвинутой системы обработки ошибок
 */
async function advancedErrorHandlingExample() {
  console.log('🚀 Starting Advanced Error Handling Example');

  try {
    // ===== 1. СОЗДАНИЕ КОНТЕКСТНЫХ ОШИБОК =====
    
    console.log('📝 Creating contextual errors...');
    
    // Создание ошибки из обычной ошибки
    const networkError = new Error('ECONNREFUSED: Connection refused');
    const contextualNetworkError = createContextualError(
      networkError,
      createApiContext('req-123', 'POST', '/api/booking', 'user-456'),
      { endpoint: 'https://api.wildberries.ru', timeout: 30000 }
    );

    console.log('Network Error:', {
      id: contextualNetworkError.id,
      message: contextualNetworkError.message,
      category: contextualNetworkError.classification.category,
      severity: contextualNetworkError.classification.severity,
      isRetryable: contextualNetworkError.classification.isRetryable,
      suggestedActions: contextualNetworkError.classification.suggestedActions
    });

    // Создание ошибки из сообщения
    const contextualValidationError = createContextualErrorFromMessage(
      'Validation failed: Invalid email format',
      createServiceContext('UserService', 'validateUser', 'user-789'),
      { field: 'email', value: 'invalid-email' }
    );

    console.log('Validation Error:', {
      id: contextualValidationError.id,
      message: contextualValidationError.message,
      category: contextualValidationError.classification.category,
      severity: contextualValidationError.classification.severity,
      userMessage: contextualValidationError.getUserMessage()
    });

    // Создание ошибки браузерной автоматизации
    const contextualBrowserError = createContextualErrorFromMessage(
      'Element not found: .login-button',
      createBrowserContext('click', '.login-button', 'https://seller.wildberries.ru', 'user-123'),
      { selector: '.login-button', page: 'login' }
    );

    console.log('Browser Error:', {
      id: contextualBrowserError.id,
      message: contextualBrowserError.message,
      category: contextualBrowserError.classification.category,
      severity: contextualBrowserError.classification.severity,
      tags: contextualBrowserError.getTags()
    });

    // ===== 2. ОТСЛЕЖИВАНИЕ ОШИБОК =====
    
    console.log('📊 Tracking errors...');
    
    // Отслеживание ошибок
    errorTracker.trackError(contextualNetworkError, 'api-endpoint');
    errorTracker.trackError(contextualValidationError, 'user-service');
    errorTracker.trackError(contextualBrowserError, 'browser-automation');

    // Отслеживание ошибки из исключения
    try {
      throw new Error('Database connection failed');
    } catch (error) {
      errorTracker.trackErrorFromException(
        error as Error,
        createServiceContext('DatabaseService', 'connect', 'user-123'),
        'database-service',
        { connectionString: 'postgresql://...' }
      );
    }

    // Получение статистики
    const errorCount = errorTracker.getErrorCount();
    console.log('Error Statistics:', {
      totalErrors: errorCount,
      errorsByCategory: {
        network: errorTracker.getErrorsByCategory(ErrorCategory.NETWORK).length,
        validation: errorTracker.getErrorsByCategory(ErrorCategory.VALIDATION).length,
        browser: errorTracker.getErrorsByCategory(ErrorCategory.BROWSER).length,
        database: errorTracker.getErrorsByCategory(ErrorCategory.DATABASE).length
      }
    });

    // ===== 3. ОТЛАДОЧНЫЕ СЕССИИ =====
    
    console.log('🔍 Using debugging sessions...');
    
    // Создание отладочной сессии
    const debugSession = await withDebugSession(
      createServiceContext('AutoBookingService', 'bookSlot', 'user-123', 'task-456'),
      async (session) => {
        console.log('Debug Session:', {
          id: session.id,
          context: session.context,
          status: session.status
        });

        // Выполнение отладочных шагов
        const step1 = await withDebugStep(
          session.id,
          'initialize-browser',
          async (step) => {
            console.log('Step 1:', { id: step.id, name: step.name, status: step.status });
            
            // Симуляция инициализации браузера
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Симуляция ошибки
            if (Math.random() > 0.5) {
              throw new Error('Browser initialization failed');
            }
            
            return { browser: 'initialized', version: '120.0.0' };
          },
          { headless: true, timeout: 30000 }
        );

        const step2 = await withDebugStep(
          session.id,
          'navigate-to-page',
          async (step) => {
            console.log('Step 2:', { id: step.id, name: step.name, status: step.status });
            
            // Симуляция навигации
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return { url: 'https://seller.wildberries.ru', status: 'loaded' };
          },
          { url: 'https://seller.wildberries.ru' }
        );

        const step3 = await withDebugStep(
          session.id,
          'find-login-button',
          async (step) => {
            console.log('Step 3:', { id: step.id, name: step.name, status: step.status });
            
            // Симуляция поиска элемента
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Симуляция ошибки поиска элемента
            throw new Error('Element not found: .login-button');
          },
          { selector: '.login-button' }
        );

        return { step1, step2, step3 };
      },
      { testMode: true, environment: 'development' }
    );

    // Генерация отладочного отчета
    const debugReport = debuggingTools.generateDebugReport(debugSession.id);
    if (debugReport) {
      console.log('Debug Report:', {
        sessionId: debugReport.sessionId,
        duration: debugReport.duration,
        totalSteps: debugReport.totalSteps,
        completedSteps: debugReport.completedSteps,
        failedSteps: debugReport.failedSteps,
        totalErrors: debugReport.totalErrors,
        recommendations: debugReport.recommendations
      });
    }

    // ===== 4. СИСТЕМА ВОССТАНОВЛЕНИЯ =====
    
    console.log('🔄 Using error recovery system...');
    
    // Попытка восстановления после ошибки
    const recoveryResult = await withRecovery(
      async () => {
        // Симуляция операции, которая может завершиться ошибкой
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (Math.random() > 0.3) {
          throw new Error('Network timeout');
        }
        
        return { success: true, data: 'Operation completed' };
      },
      contextualNetworkError,
      createApiContext('req-456', 'POST', '/api/retry', 'user-123')
    );

    console.log('Recovery Result:', {
      success: recoveryResult !== undefined,
      result: recoveryResult
    });

    // Получение статистики восстановления
    const recoveryStats = errorRecoverySystem.getRecoveryStats();
    console.log('Recovery Statistics:', recoveryStats);

    // ===== 5. АНАЛИЗ ПАТТЕРНОВ ОШИБОК =====
    
    console.log('📈 Analyzing error patterns...');
    
    const errorPatterns = debuggingTools.analyzeErrorPatterns();
    console.log('Error Patterns:', errorPatterns.map(pattern => ({
      pattern: pattern.pattern,
      frequency: pattern.frequency,
      category: pattern.category,
      suggestedFix: pattern.suggestedFix
    })));

    // ===== 6. ГЕНЕРАЦИЯ ОТЧЕТОВ =====
    
    console.log('📋 Generating reports...');
    
    // Отчет об ошибках за последний час
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();
    const errorReport = errorTracker.generateReport(oneHourAgo, now);
    
    console.log('Error Report:', {
      period: errorReport.period,
      totalErrors: errorReport.totalErrors,
      uniqueErrors: errorReport.uniqueErrors,
      criticalErrors: errorReport.criticalErrors,
      topErrors: errorReport.topErrors.slice(0, 3).map(item => ({
        error: item.error.getSummary(),
        count: item.count,
        percentage: item.percentage.toFixed(2) + '%'
      })),
      recommendations: errorReport.recommendations
    });

    // ===== 7. КЛАССИФИКАЦИЯ ОШИБОК =====
    
    console.log('🏷️ Error classification examples...');
    
    const testErrors = [
      'ECONNREFUSED: Connection refused',
      'Element not found: .submit-button',
      'Bot detected by anti-bot system',
      'Database connection timeout',
      'Invalid email format provided',
      'Rate limit exceeded: 429 Too Many Requests',
      'Session expired, please login again',
      'Configuration error: Missing API key'
    ];

    for (const errorMessage of testErrors) {
      const classification = advancedErrorClassifier.classifyError(errorMessage);
      console.log(`Error: "${errorMessage}"`, {
        category: classification.category,
        severity: classification.severity,
        code: classification.code,
        type: classification.type,
        isRetryable: classification.isRetryable,
        isUserFacing: classification.isUserFacing,
        suggestedActions: classification.suggestedActions
      });
    }

    // ===== 8. УПРАВЛЕНИЕ АЛЕРТАМИ =====
    
    console.log('🚨 Managing alerts...');
    
    const alerts = errorTracker.getAlerts();
    console.log('Active Alerts:', alerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      isActive: alert.isActive,
      triggerCount: alert.triggerCount,
      message: alert.message
    })));

    // ===== 9. ЭКСПОРТ ДАННЫХ =====
    
    console.log('💾 Exporting data...');
    
    // Экспорт данных об ошибках
    const errorData = errorTracker.exportData();
    console.log('Error Data Export:', {
      size: errorData.length,
      preview: errorData.substring(0, 200) + '...'
    });

    // Экспорт данных отладочной сессии
    const sessionData = debuggingTools.exportSessionData(debugSession.id);
    if (sessionData) {
      console.log('Session Data Export:', {
        size: sessionData.length,
        preview: sessionData.substring(0, 200) + '...'
      });
    }

    console.log('🎉 Advanced Error Handling Example completed successfully!');

  } catch (error) {
    console.error('❌ Example failed:', error);
    
    // Отслеживаем ошибку примера
    const exampleError = createContextualError(
      error as Error,
      createServiceContext('ErrorHandlingExample', 'runExample'),
      { example: 'advanced-error-handling' }
    );
    
    errorTracker.trackError(exampleError, 'example');
  }
}

/**
 * Пример демонстрации различных типов ошибок
 */
async function errorTypesDemo() {
  console.log('🎭 Error Types Demo');

  const errorTypes = [
    {
      name: 'Network Error',
      error: new Error('ECONNREFUSED: Connection refused'),
      context: createApiContext('req-001', 'GET', '/api/data')
    },
    {
      name: 'Validation Error',
      error: new Error('Validation failed: Invalid input'),
      context: createServiceContext('ValidationService', 'validate')
    },
    {
      name: 'Browser Error',
      error: new Error('Element not found: .button'),
      context: createBrowserContext('click', '.button')
    },
    {
      name: 'Database Error',
      error: new Error('Database connection timeout'),
      context: createServiceContext('DatabaseService', 'query')
    },
    {
      name: 'WB API Error',
      error: new Error('WB API error: 500 Internal Server Error'),
      context: createWBApiContext('/api/supplies', 'GET')
    }
  ];

  for (const { name, error, context } of errorTypes) {
    const contextualError = createContextualError(error, context);
    
    console.log(`${name}:`, {
      id: contextualError.id,
      category: contextualError.classification.category,
      severity: contextualError.classification.severity,
      isRetryable: contextualError.classification.isRetryable,
      userMessage: contextualError.getUserMessage(),
      debugInfo: {
        tags: contextualError.getTags(),
        isCritical: contextualError.isCritical(),
        requiresAction: contextualError.requiresAction()
      }
    });

    // Отслеживаем ошибку
    errorTracker.trackError(contextualError, 'demo');
  }
}

// Экспорт функций для использования
export {
  advancedErrorHandlingExample,
  errorTypesDemo
};

// Запуск примера, если файл выполняется напрямую
if (require.main === module) {
  advancedErrorHandlingExample()
    .then(() => errorTypesDemo())
    .then(() => console.log('✅ All examples completed'))
    .catch(error => console.error('❌ Examples failed:', error));
}

