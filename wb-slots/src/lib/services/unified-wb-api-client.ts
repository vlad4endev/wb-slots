/**
 * 🏗️ Унифицированный WB API клиент
 * Заменяет все дублирующиеся версии WB API клиентов
 */

import { 
  BaseService, 
  IWBAPIClient, 
  WBAPIConfig, 
  WBAPIResponse, 
  ServiceError,
  NetworkError,
  ValidationError 
} from '../architecture';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export class UnifiedWBAPIClient extends BaseService implements IWBAPIClient {
  private client: AxiosInstance;
  private _config: WBAPIConfig;
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: WBAPIConfig) {
    super('UnifiedWBAPIClient', '1.0.0');
    this._config = config;
    this.client = this.createAxiosClient();
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ
  // ============================================================================

  protected async doInitialize(): Promise<void> {
    this.log('info', 'Initializing WB API client...');
    this.validateConfig(this._config, ['token', 'category', 'baseURL']);
    this.log('info', 'WB API client initialized');
  }

  protected async doStart(): Promise<void> {
    this.log('info', 'Starting WB API client...');
    // Проверяем валидность токена
    await this.validateToken();
    this.log('info', 'WB API client started');
  }

  protected async doStop(): Promise<void> {
    this.log('info', 'Stopping WB API client...');
    // Очищаем трекер rate limit
    this.rateLimitTracker.clear();
    this.log('info', 'WB API client stopped');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА IWBAPIClient
  // ============================================================================

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<WBAPIResponse<T>> {
    return this.executeWithMetrics('GET', async () => {
      await this.checkRateLimit();
      
      const response = await this.client.get<T>(endpoint, { params });
      return this.processResponse(response);
    });
  }

  async post<T>(endpoint: string, data?: any): Promise<WBAPIResponse<T>> {
    return this.executeWithMetrics('POST', async () => {
      await this.checkRateLimit();
      
      const response = await this.client.post<T>(endpoint, data);
      return this.processResponse(response);
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<WBAPIResponse<T>> {
    return this.executeWithMetrics('PUT', async () => {
      await this.checkRateLimit();
      
      const response = await this.client.put<T>(endpoint, data);
      return this.processResponse(response);
    });
  }

  async delete<T>(endpoint: string): Promise<WBAPIResponse<T>> {
    return this.executeWithMetrics('DELETE', async () => {
      await this.checkRateLimit();
      
      const response = await this.client.delete<T>(endpoint);
      return this.processResponse(response);
    });
  }

  async updateToken(token: string): Promise<void> {
    this.log('info', 'Updating WB API token...');
    this._config.token = token;
    this.client.defaults.headers['Authorization'] = token;
    this.log('info', 'WB API token updated');
  }

  async validateToken(): Promise<boolean> {
    try {
      // Простой запрос для проверки токена
      const response = await this.get('/api/v1/supplies');
      return response.success;
    } catch (error) {
      this.log('error', 'Token validation failed', error);
      return false;
    }
  }

  async getAPIMetrics(): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    rateLimitUsage: number;
    lastRequest: Date;
  }> {
    const metrics = await this.getMetrics();
    const rateLimitUsage = this.calculateRateLimitUsage();
    
    return {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      averageResponseTime: metrics.averageResponseTime,
      rateLimitUsage,
      lastRequest: metrics.lastActivity
    };
  }

  // ============================================================================
  // СПЕЦИФИЧНЫЕ МЕТОДЫ ДЛЯ WB API
  // ============================================================================

  /**
   * Получить список поставок
   */
  async getSupplies(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<WBAPIResponse<any[]>> {
    return this.get('/api/v1/supplies', params);
  }

  /**
   * Получить информацию о поставке
   */
  async getSupply(supplyId: string): Promise<WBAPIResponse<any>> {
    return this.get(`/api/v1/supplies/${supplyId}`);
  }

  /**
   * Получить доступные слоты
   */
  async getAvailableSlots(params: {
    warehouseId: number;
    boxTypeId: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<WBAPIResponse<any[]>> {
    return this.get('/api/v1/slots', params);
  }

  /**
   * Забронировать слот
   */
  async bookSlot(data: {
    supplyId: string;
    slotId: string;
    warehouseId: number;
    boxTypeId: number;
    date: string;
  }): Promise<WBAPIResponse<any>> {
    return this.post('/api/v1/slots/book', data);
  }

  /**
   * Получить список складов
   */
  async getWarehouses(): Promise<WBAPIResponse<any[]>> {
    return this.get('/api/v1/warehouses');
  }

  /**
   * Получить типы тары
   */
  async getBoxTypes(): Promise<WBAPIResponse<any[]>> {
    return this.get('/api/v1/box-types');
  }

  // ============================================================================
  // ЗАЩИЩЕННЫЕ МЕТОДЫ
  // ============================================================================

  private createAxiosClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this._config.baseURL,
      timeout: this._config.timeout,
      headers: {
        'Authorization': this._config.token,
        'Content-Type': 'application/json',
        'User-Agent': 'WB-Slots-Unified-Client/1.0',
      },
    });

    // Настройка перехватчиков
    this.setupInterceptors(client);
    
    return client;
  }

  private setupInterceptors(client: AxiosInstance): void {
    // Перехватчик запросов
    client.interceptors.request.use(
      (config) => {
        this.log('info', `WB API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        });
        return config;
      },
      (error) => {
        this.log('error', 'Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Перехватчик ответов
    client.interceptors.response.use(
      (response) => {
        this.log('info', `WB API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.log('error', `WB API Error: ${error.response?.status} ${error.config?.url}`, {
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - (this._config.rateLimit.window * 1000);
    
    // Очищаем старые записи
    for (const [key, value] of this.rateLimitTracker.entries()) {
      if (value.resetTime < windowStart) {
        this.rateLimitTracker.delete(key);
      }
    }
    
    // Проверяем текущий лимит
    const currentRequests = Array.from(this.rateLimitTracker.values())
      .reduce((sum, value) => sum + value.count, 0);
    
    if (currentRequests >= this._config.rateLimit.requests) {
      const oldestRequest = Math.min(...Array.from(this.rateLimitTracker.values()).map(v => v.resetTime));
      const waitTime = oldestRequest + (this._config.rateLimit.window * 1000) - now;
      
      if (waitTime > 0) {
        this.log('warn', `Rate limit exceeded, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }
  }

  private processResponse<T>(response: AxiosResponse<T>): WBAPIResponse<T> {
    const requestTime = Date.now();
    
    // Обновляем трекер rate limit
    const key = `${response.config.method}:${response.config.url}`;
    const existing = this.rateLimitTracker.get(key);
    if (existing) {
      existing.count++;
    } else {
      this.rateLimitTracker.set(key, { count: 1, resetTime: Date.now() });
    }
    
    return {
      success: response.status >= 200 && response.status < 300,
      data: response.data,
      statusCode: response.status,
      headers: response.headers as Record<string, string>,
      requestTime
    };
  }

  private calculateRateLimitUsage(): number {
    const now = Date.now();
    const windowStart = now - (this._config.rateLimit.window * 1000);
    
    const currentRequests = Array.from(this.rateLimitTracker.values())
      .filter(value => value.resetTime >= windowStart)
      .reduce((sum, value) => sum + value.count, 0);
    
    return (currentRequests / this._config.rateLimit.requests) * 100;
  }

  private async executeWithMetrics<T>(
    operation: string,
    fn: () => Promise<WBAPIResponse<T>>
  ): Promise<WBAPIResponse<T>> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const responseTime = Date.now() - startTime;
      
      this.updateMetrics('success', responseTime);
      
      if (!result.success) {
        this.updateMetrics('failure', responseTime);
        throw new ServiceError(
          this.name,
          operation,
          `API request failed with status ${result.statusCode}`,
          'API_ERROR',
          result
        );
      }
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics('failure', responseTime);
      
      if (axios.isAxiosError(error)) {
        throw new NetworkError(
          this.name,
          operation,
          `Network error: ${error.message}`,
          error.response?.data
        );
      }
      
      throw error;
    }
  }
}

// ============================================================================
// ФАБРИКА ДЛЯ СОЗДАНИЯ КЛИЕНТОВ
// ============================================================================

export class WBAPIClientFactory {
  static createClient(config: WBAPIConfig): UnifiedWBAPIClient {
    return new UnifiedWBAPIClient(config);
  }

  static createSuppliesClient(token: string): UnifiedWBAPIClient {
    return new UnifiedWBAPIClient({
      token,
      category: 'SUPPLIES',
      baseURL: 'https://suppliers-api.wildberries.ru',
      timeout: 30000,
      retryAttempts: 3,
      rateLimit: {
        requests: 100,
        window: 60
      }
    });
  }

  static createMarketplaceClient(token: string): UnifiedWBAPIClient {
    return new UnifiedWBAPIClient({
      token,
      category: 'MARKETPLACE',
      baseURL: 'https://marketplace-api.wildberries.ru',
      timeout: 30000,
      retryAttempts: 3,
      rateLimit: {
        requests: 100,
        window: 60
      }
    });
  }
}
