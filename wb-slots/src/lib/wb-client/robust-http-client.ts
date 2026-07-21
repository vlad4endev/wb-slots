import { apiLogger, LogContext } from './enhanced-logger';
import { sslErrorHandler, AlternativeEndpoint } from './ssl-error-handler';

export interface HTTPClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  userAgent?: string;
  enableSSLRetry?: boolean;
  maxRedirects?: number;
}

export interface HTTPResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  redirected: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  retryOnSSL: boolean;
  retryOnTimeout: boolean;
  retryOn5xx: boolean;
}

export class RobustHTTPClient {
  private static instance: RobustHTTPClient;
  private defaultOptions: HTTPClientOptions;
  private retryConfig: RetryConfig;

  constructor() {
    this.defaultOptions = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      userAgent: 'WB-Slots/1.0.0',
      enableSSLRetry: true,
      maxRedirects: 5
    };

    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      retryOnSSL: true,
      retryOnTimeout: true,
      retryOn5xx: true
    };
  }

  static getInstance(): RobustHTTPClient {
    if (!RobustHTTPClient.instance) {
      RobustHTTPClient.instance = new RobustHTTPClient();
    }
    return RobustHTTPClient.instance;
  }

  /**
   * Настраивает опции клиента
   */
  configure(options: Partial<HTTPClientOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Настраивает параметры retry
   */
  configureRetry(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Выполняет HTTP запрос с обработкой ошибок и retry
   */
  async request<T = any>(
    url: string,
    options: RequestInit = {},
    clientOptions: HTTPClientOptions = {},
    context?: LogContext
  ): Promise<HTTPResponse<T>> {
    const finalOptions = { ...this.defaultOptions, ...clientOptions };
    const finalContext = context || apiLogger.createContext(undefined, url, options.method || 'GET');

    // Создаем конфигурацию fetch с обработкой SSL
    const fetchConfig = this.createFetchConfig(url, options, finalOptions);

    let lastError: any;
    let attempt = 0;
    let currentUrl = url;

    while (attempt <= finalOptions.retries!) {
      try {
        apiLogger.logRequest(finalContext, {
          url: currentUrl,
          method: options.method || 'GET',
          attempt: attempt + 1,
          maxRetries: finalOptions.retries
        });

        const response = await this.executeRequest(currentUrl, fetchConfig, finalOptions);

        // Проверяем, является ли ответ HTML (что означает, что endpoint не работает)
        if (this.isHTMLResponse(response)) {
          throw new Error(`Endpoint returned HTML instead of JSON: ${response.headers.get('content-type')}`);
        }

        const data = await this.parseResponse<T>(response);

        apiLogger.logResponse(finalContext, {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          attempt: attempt + 1
        });

        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: this.extractHeaders(response.headers),
          url: response.url,
          redirected: response.redirected
        };

      } catch (error: any) {
        lastError = error;
        attempt++;

        apiLogger.logError(finalContext, {
          message: `Request attempt ${attempt} failed`,
          error: error.message,
          url: currentUrl,
          attempt,
          maxRetries: finalOptions.retries
        });

        // Проверяем, нужно ли retry
        const shouldRetry = this.shouldRetry(error, attempt, finalOptions.retries!);
        
        if (!shouldRetry) {
          break;
        }

        // Если это SSL ошибка и включен SSL retry, пробуем альтернативный endpoint
        if (sslErrorHandler.isSSLError(error) && finalOptions.enableSSLRetry) {
          const sslResult = sslErrorHandler.handleSSLError(error, currentUrl, finalContext);
          
          if (sslResult.nextEndpoint) {
            currentUrl = sslResult.nextEndpoint.url;
            apiLogger.logRetry(finalContext, attempt, `SSL error, trying alternative endpoint: ${currentUrl}`);
            continue;
          }
        }

        // Обычный retry с задержкой
        if (attempt <= finalOptions.retries!) {
          const delay = this.calculateRetryDelay(attempt);
          apiLogger.logRetry(finalContext, attempt, `Retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    // Если все попытки исчерпаны, пробуем альтернативные endpoints
    if (finalOptions.enableSSLRetry && sslErrorHandler.isSSLError(lastError)) {
      const alternativeResult = await this.tryAlternativeEndpoints(
        url,
        options,
        finalOptions,
        finalContext
      );

      if (alternativeResult) {
        return alternativeResult;
      }
    }

    throw lastError;
  }

  /**
   * Выполняет GET запрос
   */
  async get<T = any>(
    url: string,
    options: RequestInit = {},
    clientOptions: HTTPClientOptions = {},
    context?: LogContext
  ): Promise<HTTPResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' }, clientOptions, context);
  }

  /**
   * Выполняет POST запрос
   */
  async post<T = any>(
    url: string,
    data?: any,
    options: RequestInit = {},
    clientOptions: HTTPClientOptions = {},
    context?: LogContext
  ): Promise<HTTPResponse<T>> {
    const postOptions: RequestInit = {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    if (data) {
      postOptions.body = JSON.stringify(data);
    }

    return this.request<T>(url, postOptions, clientOptions, context);
  }

  /**
   * Создает конфигурацию fetch
   */
  private createFetchConfig(url: string, options: RequestInit, clientOptions: HTTPClientOptions): RequestInit {
    const config: RequestInit = {
      ...options,
      headers: {
        'User-Agent': clientOptions.userAgent || this.defaultOptions.userAgent,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        ...options.headers
      }
    };

    // Добавляем timeout через AbortController
    if (clientOptions.timeout) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), clientOptions.timeout);
      config.signal = controller.signal;
    }

    return config;
  }

  /**
   * Выполняет HTTP запрос
   */
  private async executeRequest(url: string, config: RequestInit, options: HTTPClientOptions): Promise<Response> {
    const response = await fetch(url, config);

    // Проверяем статус ответа
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  /**
   * Парсит ответ
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/')) {
      const text = await response.text();
      // Пытаемся парсить как JSON, если это не удается, возвращаем текст
      try {
        return JSON.parse(text);
      } catch {
        return text as any;
      }
    } else {
      return await response.text() as any;
    }
  }

  /**
   * Проверяет, является ли ответ HTML
   */
  private isHTMLResponse(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('text/html');
  }

  /**
   * Извлекает заголовки из Response
   */
  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Определяет, нужно ли делать retry
   */
  private shouldRetry(error: any, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    // SSL ошибки
    if (sslErrorHandler.isSSLError(error) && this.retryConfig.retryOnSSL) {
      return true;
    }

    // Timeout ошибки
    if (error.name === 'AbortError' && this.retryConfig.retryOnTimeout) {
      return true;
    }

    // HTTP 5xx ошибки
    if (error.message?.includes('HTTP 5') && this.retryConfig.retryOn5xx) {
      return true;
    }

    // Сетевые ошибки
    if (error.message?.includes('fetch failed') || error.message?.includes('network')) {
      return true;
    }

    return false;
  }

  /**
   * Вычисляет задержку для retry
   */
  private calculateRetryDelay(attempt: number): number {
    return this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
  }

  /**
   * Задержка
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Пробует альтернативные endpoints
   */
  private async tryAlternativeEndpoints<T = any>(
    originalUrl: string,
    options: RequestInit,
    clientOptions: HTTPClientOptions,
    context: LogContext
  ): Promise<HTTPResponse<T> | null> {
    const apiType = sslErrorHandler['detectApiType'](originalUrl);
    const alternatives = sslErrorHandler.getAlternativeEndpoints(apiType, originalUrl);

    for (const alternative of alternatives) {
      try {
        apiLogger.logRetry(context, 0, `Trying alternative endpoint: ${alternative.url}`);
        
        const result = await this.request<T>(
          alternative.url,
          options,
          { ...clientOptions, retries: 1 }, // Ограничиваем retry для альтернативных endpoints
          context
        );

        // Если успешно, обновляем статус endpoint
        sslErrorHandler.updateEndpointStatus(alternative.url, true);
        
        apiLogger.logResponse(context, {
          message: `Alternative endpoint successful: ${alternative.url}`,
          status: result.status
        });

        return result;

      } catch (error) {
        apiLogger.logError(context, {
          message: `Alternative endpoint failed: ${alternative.url}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Обновляем статус endpoint как проблемный
        sslErrorHandler.updateEndpointStatus(alternative.url, false);
      }
    }

    return null;
  }

  /**
   * Получает статистику по endpoints
   */
  getEndpointStats(): Record<string, any> {
    return sslErrorHandler.getEndpointStats();
  }

  /**
   * Проверяет доступность endpoint
   */
  async checkEndpointHealth(url: string, timeout: number = 5000): Promise<{
    available: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.get(url, {}, { timeout, retries: 0 });
      const responseTime = Date.now() - startTime;
      
      return {
        available: true,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        available: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Проверяет все альтернативные endpoints для API типа
   */
  async checkAllEndpoints(apiType: string): Promise<Array<{
    url: string;
    available: boolean;
    responseTime: number;
    error?: string;
  }>> {
    const endpoints = sslErrorHandler.getAllEndpoints(apiType);
    const results = [];

    for (const url of endpoints) {
      const health = await this.checkEndpointHealth(url);
      results.push({
        url,
        ...health
      });
    }

    return results;
  }
}

// Экспортируем singleton instance
export const robustHTTPClient = RobustHTTPClient.getInstance();
