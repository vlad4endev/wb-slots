// ========================================
// Retry-Enabled API Clients
// ========================================

import { RetryService, RETRY_CONFIGS } from '../retry/retry-service';
import { Logger } from '../logging/logger';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retryConfig: any;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: AxiosRequestConfig;
}

export class RetryEnabledApiClient {
  protected axios: AxiosInstance;
  protected retryService: RetryService;
  protected logger: Logger;
  protected config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.logger = new Logger(this.constructor.name);
    this.retryService = new RetryService(config.retryConfig);

    this.axios = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WB-Slots/1.0.0',
        ...config.headers
      }
    });

    this.setupInterceptors();
  }

  /**
   * GET request with retry
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.retryService.execute(
      () => this.axios.get<T>(url, config),
      this.config.retryConfig,
      `GET ${url}`
    ).then(result => {
      if (!result.success) {
        throw result.error;
      }
      return result.result!;
    });
  }

  /**
   * POST request with retry
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.retryService.execute(
      () => this.axios.post<T>(url, data, config),
      this.config.retryConfig,
      `POST ${url}`
    ).then(result => {
      if (!result.success) {
        throw result.error;
      }
      return result.result!;
    });
  }

  /**
   * PUT request with retry
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.retryService.execute(
      () => this.axios.put<T>(url, data, config),
      this.config.retryConfig,
      `PUT ${url}`
    ).then(result => {
      if (!result.success) {
        throw result.error;
      }
      return result.result!;
    });
  }

  /**
   * DELETE request with retry
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.retryService.execute(
      () => this.axios.delete<T>(url, config),
      this.config.retryConfig,
      `DELETE ${url}`
    ).then(result => {
      if (!result.success) {
        throw result.error;
      }
      return result.result!;
    });
  }

  /**
   * Get retry statistics
   */
  getRetryStats() {
    return this.retryService.getStats();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = Date.now();
    try {
      await this.get('/health');
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      return { status: 'unhealthy', latency };
    }
  }

  // Private methods

  private setupInterceptors(): void {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        this.logger.debug('API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        this.logger.debug('API response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('API response error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }
}

/**
 * WB API Client with retry logic
 */
export class RetryEnabledWBApiClient extends RetryEnabledApiClient {
  constructor(token: string, baseURL: string) {
    super({
      baseURL,
      timeout: 30000,
      retryConfig: RETRY_CONFIGS.WB_API,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Get available slots with retry
   */
  async getAvailableSlots(params: {
    warehouseIds: number[];
    boxTypeIds: number[];
    dateFrom: string;
    dateTo: string;
    coefficientMin: number;
    coefficientMax: number;
    isSortingCenter?: boolean;
  }): Promise<any[]> {
    const response = await this.get('/api/v1/slots', { params });
    return response.data;
  }

  /**
   * Get warehouses with retry
   */
  async getWarehouses(): Promise<any[]> {
    const response = await this.get('/api/v1/warehouses');
    return response.data;
  }

  /**
   * Get supplies with retry
   */
  async getSupplies(supplyId?: string): Promise<any[]> {
    const url = supplyId ? `/api/v1/supplies/${supplyId}` : '/api/v1/supplies';
    const response = await this.get(url);
    return response.data;
  }

  /**
   * Get statistics with retry
   */
  async getStatistics(dateFrom: string, dateTo: string): Promise<any> {
    const response = await this.get('/api/v1/statistics', {
      params: { dateFrom, dateTo }
    });
    return response.data;
  }
}

/**
 * Telegram Bot API Client with retry logic
 */
export class RetryEnabledTelegramClient extends RetryEnabledApiClient {
  constructor(botToken: string) {
    super({
      baseURL: `https://api.telegram.org/bot${botToken}`,
      timeout: 10000,
      retryConfig: RETRY_CONFIGS.TELEGRAM,
      headers: {
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Send message with retry
   */
  async sendMessage(chatId: string, text: string, options?: any): Promise<any> {
    const response = await this.post('/sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options
    });
    return response.data;
  }

  /**
   * Send photo with retry
   */
  async sendPhoto(chatId: string, photo: string, caption?: string): Promise<any> {
    const response = await this.post('/sendPhoto', {
      chat_id: chatId,
      photo,
      caption
    });
    return response.data;
  }

  /**
   * Get webhook info with retry
   */
  async getWebhookInfo(): Promise<any> {
    const response = await this.get('/getWebhookInfo');
    return response.data;
  }

  /**
   * Set webhook with retry
   */
  async setWebhook(url: string, options?: any): Promise<any> {
    const response = await this.post('/setWebhook', {
      url,
      ...options
    });
    return response.data;
  }
}

/**
 * Email SMTP Client with retry logic
 */
export class RetryEnabledEmailClient {
  private retryService: RetryService;
  private logger: Logger;
  private config: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    retryConfig: any;
  };

  constructor(config: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }) {
    this.config = {
      ...config,
      retryConfig: RETRY_CONFIGS.EMAIL
    };
    this.logger = new Logger('INFO', { service: 'RetryEnabledEmailClient' });
    this.retryService = new RetryService(this.config.retryConfig);
  }

  /**
   * Send email with retry
   */
  async sendEmail(options: {
    from: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: any[];
  }): Promise<any> {
    return this.retryService.execute(
      async () => {
        // This would use nodemailer in a real implementation
        // For now, we'll simulate the email sending
        this.logger.info('Sending email', {
          to: options.to,
          subject: options.subject
        });
        
        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return { messageId: `msg_${Date.now()}` };
      },
      this.config.retryConfig,
      `sendEmail to ${Array.isArray(options.to) ? options.to.join(',') : options.to}`
    ).then(result => {
      if (!result.success) {
        throw result.error;
      }
      return result.result!;
    });
  }

  /**
   * Get retry statistics
   */
  getRetryStats() {
    return this.retryService.getStats();
  }
}

// Factory functions
export function createWBApiClient(token: string, baseURL: string): RetryEnabledWBApiClient {
  return new RetryEnabledWBApiClient(token, baseURL);
}

export function createTelegramClient(botToken: string): RetryEnabledTelegramClient {
  return new RetryEnabledTelegramClient(botToken);
}

export function createEmailClient(config: {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}): RetryEnabledEmailClient {
  return new RetryEnabledEmailClient(config);
}
