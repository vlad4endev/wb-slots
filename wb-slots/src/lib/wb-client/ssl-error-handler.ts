import { apiLogger, LogContext } from './enhanced-logger';

export interface SSLErrorInfo {
  code: string;
  reason: string;
  host: string;
  cert?: {
    subjectaltname: string;
    valid_from: string;
    valid_to: string;
  };
}

export interface AlternativeEndpoint {
  url: string;
  priority: number;
  description: string;
  sslIssues?: boolean;
}

export class SSLErrorHandler {
  private static instance: SSLErrorHandler;
  private alternativeEndpoints: Map<string, AlternativeEndpoint[]> = new Map();

  constructor() {
    this.initializeAlternativeEndpoints();
  }

  static getInstance(): SSLErrorHandler {
    if (!SSLErrorHandler.instance) {
      SSLErrorHandler.instance = new SSLErrorHandler();
    }
    return SSLErrorHandler.instance;
  }

  private initializeAlternativeEndpoints(): void {
    // Альтернативные endpoints для warehouses
    this.alternativeEndpoints.set('warehouses', [
      {
        url: 'https://suppliers-api.wildberries.ru/api/v1/warehouses',
        priority: 1,
        description: 'Официальный suppliers API'
      },
      {
        url: 'https://api.wildberries.ru/api/v1/warehouses',
        priority: 2,
        description: 'Основной API (может иметь SSL проблемы)',
        sslIssues: true
      },
      {
        url: 'https://seller.wildberries.ru/api/v1/warehouses',
        priority: 3,
        description: 'Seller API (возвращает HTML)',
        sslIssues: false
      },
      {
        url: 'https://suppliers-api.wildberries.global/api/v1/warehouses',
        priority: 4,
        description: 'Global suppliers API'
      },
      {
        url: 'https://api.wildberries.global/api/v1/warehouses',
        priority: 5,
        description: 'Global API'
      }
    ]);

    // Альтернативные endpoints для supplies
    this.alternativeEndpoints.set('supplies', [
      {
        url: 'https://supplies-api.wildberries.ru/api/v1/supplies',
        priority: 1,
        description: 'Официальный supplies API'
      },
      {
        url: 'https://api.wildberries.ru/api/v1/supplies',
        priority: 2,
        description: 'Основной API'
      },
      {
        url: 'https://supplies-api.wildberries.global/api/v1/supplies',
        priority: 3,
        description: 'Global supplies API'
      }
    ]);

    // Альтернативные endpoints для coefficients
    this.alternativeEndpoints.set('coefficients', [
      {
        url: 'https://supplies-api.wildberries.ru/api/v1/acceptance/coefficients',
        priority: 1,
        description: 'Официальный coefficients API'
      },
      {
        url: 'https://api.wildberries.ru/api/v1/acceptance/coefficients',
        priority: 2,
        description: 'Основной API'
      }
    ]);
  }

  /**
   * Проверяет, является ли ошибка SSL ошибкой
   */
  isSSLError(error: any): boolean {
    if (!error || !error.cause) return false;
    
    const sslErrorCodes = [
      'ERR_TLS_CERT_ALTNAME_INVALID',
      'ERR_TLS_CERT_INVALID',
      'ERR_TLS_CERT_AUTHORITY_INVALID',
      'ERR_TLS_CERT_UNTRUSTED',
      'ERR_TLS_CERT_EXPIRED',
      'ERR_TLS_CERT_NOT_YET_VALID',
      'ERR_TLS_CERT_REVOKED',
      'ERR_TLS_CERT_HOSTNAME_MISMATCH'
    ];

    return sslErrorCodes.includes(error.cause.code) || 
           error.message?.includes('certificate') ||
           error.message?.includes('TLS') ||
           error.message?.includes('SSL');
  }

  /**
   * Извлекает информацию об SSL ошибке
   */
  extractSSLErrorInfo(error: any): SSLErrorInfo | null {
    if (!this.isSSLError(error)) return null;

    const cause = error.cause;
    return {
      code: cause.code || 'UNKNOWN_SSL_ERROR',
      reason: cause.reason || error.message,
      host: cause.host || 'unknown',
      cert: cause.cert ? {
        subjectaltname: cause.cert.subjectaltname,
        valid_from: cause.cert.valid_from,
        valid_to: cause.cert.valid_to
      } : undefined
    };
  }

  /**
   * Получает альтернативные endpoints для указанного типа API
   */
  getAlternativeEndpoints(apiType: string, excludeUrl?: string): AlternativeEndpoint[] {
    const endpoints = this.alternativeEndpoints.get(apiType) || [];
    
    if (excludeUrl) {
      return endpoints.filter(endpoint => endpoint.url !== excludeUrl);
    }
    
    return endpoints;
  }

  /**
   * Получает следующий endpoint для попытки
   */
  getNextEndpoint(apiType: string, failedUrl: string): AlternativeEndpoint | null {
    const alternatives = this.getAlternativeEndpoints(apiType, failedUrl);
    
    // Сортируем по приоритету (меньший номер = выше приоритет)
    alternatives.sort((a, b) => a.priority - b.priority);
    
    return alternatives.length > 0 ? alternatives[0] : null;
  }

  /**
   * Создает fetch конфигурацию с обработкой SSL ошибок
   */
  createFetchConfig(url: string, options: RequestInit = {}): RequestInit {
    // Для Node.js окружения добавляем опции для игнорирования SSL ошибок
    if (typeof window === 'undefined') {
      // В Node.js окружении можно использовать node-fetch с опциями
      return {
        ...options,
        // Добавляем заголовки для обхода некоторых SSL проблем
        headers: {
          ...options.headers,
          'User-Agent': 'WB-Slots/1.0.0 (Node.js)',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      };
    }

    return options;
  }

  /**
   * Обрабатывает SSL ошибку и возвращает рекомендации
   */
  handleSSLError(error: any, url: string, context: LogContext): {
    shouldRetry: boolean;
    nextEndpoint?: AlternativeEndpoint;
    recommendations: string[];
  } {
    const sslInfo = this.extractSSLErrorInfo(error);
    
    if (!sslInfo) {
      return {
        shouldRetry: false,
        recommendations: ['Ошибка не связана с SSL']
      };
    }

    const recommendations: string[] = [];
    let shouldRetry = true;
    let nextEndpoint: AlternativeEndpoint | undefined;

    // Анализируем тип SSL ошибки
    switch (sslInfo.code) {
      case 'ERR_TLS_CERT_ALTNAME_INVALID':
        recommendations.push('Сертификат не соответствует домену');
        recommendations.push('Попробуйте альтернативный endpoint');
        
        // Определяем тип API по URL
        const apiType = this.detectApiType(url);
        nextEndpoint = this.getNextEndpoint(apiType, url);
        break;

      case 'ERR_TLS_CERT_INVALID':
        recommendations.push('Недействительный SSL сертификат');
        recommendations.push('Проверьте дату и время системы');
        break;

      case 'ERR_TLS_CERT_AUTHORITY_INVALID':
        recommendations.push('Сертификат не доверен');
        recommendations.push('Возможно, нужно обновить корневые сертификаты');
        break;

      default:
        recommendations.push(`Неизвестная SSL ошибка: ${sslInfo.code}`);
        break;
    }

    // Логируем SSL ошибку
    apiLogger.logError(context, {
      message: 'SSL Error detected',
      sslInfo,
      url,
      recommendations,
      nextEndpoint: nextEndpoint?.url
    });

    return {
      shouldRetry,
      nextEndpoint,
      recommendations
    };
  }

  /**
   * Определяет тип API по URL
   */
  private detectApiType(url: string): string {
    if (url.includes('/warehouses')) return 'warehouses';
    if (url.includes('/supplies')) return 'supplies';
    if (url.includes('/coefficients')) return 'coefficients';
    return 'unknown';
  }

  /**
   * Создает список всех доступных endpoints для API типа
   */
  getAllEndpoints(apiType: string): string[] {
    const endpoints = this.alternativeEndpoints.get(apiType) || [];
    return endpoints.map(endpoint => endpoint.url);
  }

  /**
   * Проверяет, является ли endpoint проблемным
   */
  isProblematicEndpoint(url: string): boolean {
    const apiType = this.detectApiType(url);
    const endpoints = this.alternativeEndpoints.get(apiType) || [];
    const endpoint = endpoints.find(e => e.url === url);
    return endpoint?.sslIssues === true;
  }

  /**
   * Получает статистику по endpoints
   */
  getEndpointStats(): Record<string, { total: number; problematic: number; working: number }> {
    const stats: Record<string, { total: number; problematic: number; working: number }> = {};

    for (const [apiType, endpoints] of this.alternativeEndpoints) {
      stats[apiType] = {
        total: endpoints.length,
        problematic: endpoints.filter(e => e.sslIssues).length,
        working: endpoints.filter(e => !e.sslIssues).length
      };
    }

    return stats;
  }

  /**
   * Добавляет новый альтернативный endpoint
   */
  addAlternativeEndpoint(apiType: string, endpoint: AlternativeEndpoint): void {
    if (!this.alternativeEndpoints.has(apiType)) {
      this.alternativeEndpoints.set(apiType, []);
    }

    const endpoints = this.alternativeEndpoints.get(apiType)!;
    
    // Проверяем, не существует ли уже такой endpoint
    if (!endpoints.find(e => e.url === endpoint.url)) {
      endpoints.push(endpoint);
      // Сортируем по приоритету
      endpoints.sort((a, b) => a.priority - b.priority);
    }
  }

  /**
   * Обновляет статус endpoint (рабочий/проблемный)
   */
  updateEndpointStatus(url: string, isWorking: boolean): void {
    const apiType = this.detectApiType(url);
    const endpoints = this.alternativeEndpoints.get(apiType);
    
    if (endpoints) {
      const endpoint = endpoints.find(e => e.url === url);
      if (endpoint) {
        endpoint.sslIssues = !isWorking;
      }
    }
  }
}

// Экспортируем singleton instance
export const sslErrorHandler = SSLErrorHandler.getInstance();
