import { robustHTTPClient } from './robust-http-client';
import { sslErrorHandler } from './ssl-error-handler';
import { apiLogger, LogContext } from './enhanced-logger';

export interface DiagnosticResult {
  endpoint: string;
  status: 'success' | 'ssl_error' | 'http_error' | 'timeout' | 'network_error' | 'html_response';
  responseTime: number;
  error?: string;
  sslInfo?: {
    code: string;
    reason: string;
    certInfo?: {
      subjectaltname: string;
      valid_from: string;
      valid_to: string;
    };
  };
  recommendations: string[];
}

export interface APIDiagnosticReport {
  apiType: string;
  totalEndpoints: number;
  workingEndpoints: number;
  sslIssues: number;
  results: DiagnosticResult[];
  summary: {
    bestEndpoint?: string;
    fastestEndpoint?: string;
    mostReliableEndpoint?: string;
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  };
  recommendations: string[];
}

export class SSLDiagnostics {
  private static instance: SSLDiagnostics;

  static getInstance(): SSLDiagnostics {
    if (!SSLDiagnostics.instance) {
      SSLDiagnostics.instance = new SSLDiagnostics();
    }
    return SSLDiagnostics.instance;
  }

  /**
   * Диагностирует все endpoints для указанного типа API
   */
  async diagnoseAPI(apiType: string): Promise<APIDiagnosticReport> {
    const context = apiLogger.createContext(undefined, `diagnose-${apiType}`, 'GET');
    
    console.log(`🔍 Начинаем диагностику API: ${apiType}`);
    
    const endpoints = sslErrorHandler.getAllEndpoints(apiType);
    const results: DiagnosticResult[] = [];
    
    for (const endpoint of endpoints) {
      console.log(`🔍 Проверяем endpoint: ${endpoint}`);
      const result = await this.diagnoseEndpoint(endpoint, context);
      results.push(result);
      
      // Небольшая задержка между проверками
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const report = this.generateReport(apiType, results);
    
    console.log(`📊 Диагностика завершена для ${apiType}:`);
    console.log(`   - Всего endpoints: ${report.totalEndpoints}`);
    console.log(`   - Рабочих: ${report.workingEndpoints}`);
    console.log(`   - SSL проблем: ${report.sslIssues}`);
    console.log(`   - Общее состояние: ${report.summary.overallHealth}`);
    
    return report;
  }

  /**
   * Диагностирует конкретный endpoint
   */
  private async diagnoseEndpoint(endpoint: string, context: LogContext): Promise<DiagnosticResult> {
    const startTime = Date.now();
    const recommendations: string[] = [];
    
    try {
      const response = await robustHTTPClient.get(
        endpoint,
        {},
        { timeout: 10000, retries: 0 },
        context
      );
      
      const responseTime = Date.now() - startTime;
      
      // Проверяем, является ли ответ HTML
      if (this.isHTMLResponse(response)) {
        return {
          endpoint,
          status: 'html_response',
          responseTime,
          error: 'Endpoint returns HTML instead of JSON',
          recommendations: [
            'Endpoint не поддерживает API запросы',
            'Возможно, это веб-страница вместо API endpoint',
            'Попробуйте другой endpoint'
          ]
        };
      }
      
      return {
        endpoint,
        status: 'success',
        responseTime,
        recommendations: ['Endpoint работает корректно']
      };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (sslErrorHandler.isSSLError(error)) {
        const sslInfo = sslErrorHandler.extractSSLErrorInfo(error);
        
        return {
          endpoint,
          status: 'ssl_error',
          responseTime,
          error: error.message,
          sslInfo: sslInfo ? {
            code: sslInfo.code,
            reason: sslInfo.reason,
            certInfo: sslInfo.cert
          } : undefined,
          recommendations: this.getSSLRecommendations(sslInfo)
        };
      }
      
      if (error.name === 'AbortError') {
        return {
          endpoint,
          status: 'timeout',
          responseTime,
          error: 'Request timeout',
          recommendations: [
            'Увеличьте timeout',
            'Проверьте сетевое соединение',
            'Endpoint может быть перегружен'
          ]
        };
      }
      
      if (error.message?.includes('fetch failed')) {
        return {
          endpoint,
          status: 'network_error',
          responseTime,
          error: error.message,
          recommendations: [
            'Проверьте сетевое соединение',
            'Возможно, endpoint недоступен',
            'Проверьте DNS настройки'
          ]
        };
      }
      
      if (error.message?.includes('HTTP 4') || error.message?.includes('HTTP 5')) {
        return {
          endpoint,
          status: 'http_error',
          responseTime,
          error: error.message,
          recommendations: [
            'Проверьте правильность API endpoint',
            'Возможно, изменился формат API',
            'Проверьте аутентификацию'
          ]
        };
      }
      
      return {
        endpoint,
        status: 'network_error',
        responseTime,
        error: error.message,
        recommendations: ['Неизвестная ошибка, проверьте endpoint']
      };
    }
  }

  /**
   * Проверяет, является ли ответ HTML
   */
  private isHTMLResponse(response: any): boolean {
    if (!response || !response.headers) return false;
    
    const contentType = response.headers['content-type'] || '';
    return contentType.includes('text/html');
  }

  /**
   * Получает рекомендации для SSL ошибок
   */
  private getSSLRecommendations(sslInfo: any): string[] {
    const recommendations: string[] = [];
    
    if (!sslInfo) {
      recommendations.push('Неизвестная SSL ошибка');
      return recommendations;
    }
    
    switch (sslInfo.code) {
      case 'ERR_TLS_CERT_ALTNAME_INVALID':
        recommendations.push('Сертификат не соответствует домену');
        recommendations.push('Попробуйте альтернативный endpoint');
        if (sslInfo.cert?.subjectaltname) {
          recommendations.push(`Сертификат действителен для: ${sslInfo.cert.subjectaltname}`);
        }
        break;
        
      case 'ERR_TLS_CERT_INVALID':
        recommendations.push('Недействительный SSL сертификат');
        recommendations.push('Проверьте дату и время системы');
        break;
        
      case 'ERR_TLS_CERT_AUTHORITY_INVALID':
        recommendations.push('Сертификат не доверен');
        recommendations.push('Обновите корневые сертификаты');
        break;
        
      case 'ERR_TLS_CERT_EXPIRED':
        recommendations.push('Сертификат истек');
        if (sslInfo.cert?.valid_to) {
          recommendations.push(`Сертификат истек: ${sslInfo.cert.valid_to}`);
        }
        break;
        
      default:
        recommendations.push(`SSL ошибка: ${sslInfo.code}`);
        recommendations.push('Попробуйте альтернативный endpoint');
        break;
    }
    
    return recommendations;
  }

  /**
   * Генерирует отчет по результатам диагностики
   */
  private generateReport(apiType: string, results: DiagnosticResult[]): APIDiagnosticReport {
    const totalEndpoints = results.length;
    const workingEndpoints = results.filter(r => r.status === 'success').length;
    const sslIssues = results.filter(r => r.status === 'ssl_error').length;
    
    // Находим лучшие endpoints
    const successfulResults = results.filter(r => r.status === 'success');
    const bestEndpoint = successfulResults.length > 0 ? successfulResults[0].endpoint : undefined;
    const fastestEndpoint = successfulResults.length > 0 
      ? successfulResults.reduce((fastest, current) => 
          current.responseTime < fastest.responseTime ? current : fastest
        ).endpoint 
      : undefined;
    
    // Определяем общее состояние здоровья
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    const successRate = workingEndpoints / totalEndpoints;
    
    if (successRate >= 0.8) {
      overallHealth = 'excellent';
    } else if (successRate >= 0.6) {
      overallHealth = 'good';
    } else if (successRate >= 0.4) {
      overallHealth = 'fair';
    } else if (successRate >= 0.2) {
      overallHealth = 'poor';
    } else {
      overallHealth = 'critical';
    }
    
    // Генерируем общие рекомендации
    const recommendations: string[] = [];
    
    if (workingEndpoints === 0) {
      recommendations.push('❌ КРИТИЧНО: Нет рабочих endpoints');
      recommendations.push('Проверьте сетевое соединение и настройки');
    } else if (sslIssues > workingEndpoints) {
      recommendations.push('⚠️ Много SSL проблем');
      recommendations.push('Рекомендуется использовать рабочие endpoints');
    }
    
    if (bestEndpoint) {
      recommendations.push(`✅ Рекомендуемый endpoint: ${bestEndpoint}`);
    }
    
    if (fastestEndpoint && fastestEndpoint !== bestEndpoint) {
      recommendations.push(`⚡ Самый быстрый endpoint: ${fastestEndpoint}`);
    }
    
    return {
      apiType,
      totalEndpoints,
      workingEndpoints,
      sslIssues,
      results,
      summary: {
        bestEndpoint,
        fastestEndpoint,
        mostReliableEndpoint: bestEndpoint, // Пока используем bestEndpoint
        overallHealth
      },
      recommendations
    };
  }

  /**
   * Диагностирует все типы API
   */
  async diagnoseAllAPIs(): Promise<APIDiagnosticReport[]> {
    const apiTypes = ['warehouses', 'supplies', 'coefficients'];
    const reports: APIDiagnosticReport[] = [];
    
    console.log('🔍 Начинаем полную диагностику всех API...');
    
    for (const apiType of apiTypes) {
      try {
        const report = await this.diagnoseAPI(apiType);
        reports.push(report);
      } catch (error) {
        console.error(`❌ Ошибка диагностики ${apiType}:`, error);
      }
    }
    
    console.log('📊 Полная диагностика завершена');
    return reports;
  }

  /**
   * Создает краткий отчет по всем API
   */
  generateSummaryReport(reports: APIDiagnosticReport[]): {
    totalAPIs: number;
    totalEndpoints: number;
    workingEndpoints: number;
    sslIssues: number;
    overallHealth: string;
    recommendations: string[];
  } {
    const totalAPIs = reports.length;
    const totalEndpoints = reports.reduce((sum, r) => sum + r.totalEndpoints, 0);
    const workingEndpoints = reports.reduce((sum, r) => sum + r.workingEndpoints, 0);
    const sslIssues = reports.reduce((sum, r) => sum + r.sslIssues, 0);
    
    const successRate = workingEndpoints / totalEndpoints;
    let overallHealth: string;
    
    if (successRate >= 0.8) {
      overallHealth = 'excellent';
    } else if (successRate >= 0.6) {
      overallHealth = 'good';
    } else if (successRate >= 0.4) {
      overallHealth = 'fair';
    } else if (successRate >= 0.2) {
      overallHealth = 'poor';
    } else {
      overallHealth = 'critical';
    }
    
    const recommendations: string[] = [];
    
    if (successRate < 0.5) {
      recommendations.push('❌ КРИТИЧНО: Менее 50% endpoints работают');
      recommendations.push('Проверьте сетевое соединение и настройки');
    }
    
    if (sslIssues > workingEndpoints) {
      recommendations.push('⚠️ SSL проблем больше, чем рабочих endpoints');
      recommendations.push('Рекомендуется обновить SSL сертификаты или использовать альтернативные endpoints');
    }
    
    const bestAPIs = reports.filter(r => r.summary.overallHealth === 'excellent' || r.summary.overallHealth === 'good');
    if (bestAPIs.length > 0) {
      recommendations.push(`✅ Хорошо работающие API: ${bestAPIs.map(r => r.apiType).join(', ')}`);
    }
    
    return {
      totalAPIs,
      totalEndpoints,
      workingEndpoints,
      sslIssues,
      overallHealth,
      recommendations
    };
  }
}

// Экспортируем singleton instance
export const sslDiagnostics = SSLDiagnostics.getInstance();
