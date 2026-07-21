import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { WBAPIResponse, WBClientError, WBRequestOptions, RateLimitInfo } from './types';
import { rateLimitService } from '../security/rate-limit-service';
import { apiLogger, LogContext } from './enhanced-logger';
import { responseProcessor, ProcessedResponse, DataExtractionOptions } from './response-processor';
import { paginationManager, PaginationRequest, PaginationResult, AutoPaginationOptions } from './pagination-manager';

export abstract class BaseWBClient {
  protected client: AxiosInstance;
  protected token: string;
  protected baseURL: string;
  protected userId?: string;

  constructor(token: string, baseURL: string, options: WBRequestOptions = {}) {
    this.token = token;
    this.baseURL = baseURL;
    this.userId = options.userId;

    this.client = axios.create({
      baseURL,
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const context = apiLogger.createContext(this.userId, config.url, config.method);
        const endTimer = apiLogger.startTimer(context);

        // Check rate limit before making request
        if (this.userId) {
          try {
            const rateLimitResult = await rateLimitService.checkWBApiRateLimit(this.userId);
            if (!rateLimitResult.allowed) {
              throw new WBClientError(
                'Rate limit exceeded. Please try again later.',
                429,
                'RATE_LIMIT_EXCEEDED',
                { retryAfter: rateLimitResult.retryAfter }
              );
            }
          } catch (rateLimitError) {
            console.warn(`⚠️ Rate limit check failed, continuing without rate limiting:`, rateLimitError);
            // Продолжаем без rate limiting если Redis недоступен
          }
        }

        // Add timestamp to prevent caching
        config.params = {
          ...config.params,
          timestamp: Date.now(),
        };

        // Store context in config for response interceptor
        (config as any).__logContext = context;
        (config as any).__endTimer = endTimer;

        // Log request
        apiLogger.logRequest(context, {
          url: config.url,
          method: config.method,
          headers: config.headers,
          params: config.params,
          data: config.data
        });

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const context = (response.config as any).__logContext;
        const endTimer = (response.config as any).__endTimer;

        if (endTimer) {
          endTimer();
        }

        // Check for rate limiting headers
        const rateLimitInfo = this.extractRateLimitInfo(response);
        if (rateLimitInfo) {
          apiLogger.logRateLimit(context, rateLimitInfo);
        }

        // Log response
        if (context) {
          apiLogger.logResponse(context, response);
        }

        return response;
      },
      async (error) => {
        const context = (error.config as any)?.__logContext;
        const endTimer = (error.config as any)?.__endTimer;

        if (endTimer) {
          endTimer();
        }

        if (error.response) {
          const { status, data } = error.response;
          
          // Handle rate limiting from server
          if (status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            apiLogger.logRateLimit(context, { retryAfter: parseInt(retryAfter) || 60 });
            
            throw new WBClientError(
              'Rate limit exceeded. Please try again later.',
              status,
              'RATE_LIMIT_EXCEEDED',
              { retryAfter: parseInt(retryAfter) || 60 }
            );
          }

          const errorMessage = data?.errorText || data?.message || error.message;
          const errorCode = data?.code || `HTTP_${status}`;

          apiLogger.logError(context, error);

          throw new WBClientError(
            errorMessage,
            status,
            errorCode,
            data
          );
        }

        if (error.request) {
          apiLogger.logError(context, error);
          
          throw new WBClientError(
            `Network error: ${error.message || 'No response received'}`,
            0,
            'NETWORK_ERROR',
            { 
              originalError: error.message,
              url: error.config?.url,
              method: error.config?.method
            }
          );
        }

        apiLogger.logError(context, error);

        throw new WBClientError(
          error.message || 'Unknown error',
          0,
          'UNKNOWN_ERROR'
        );
      }
    );
  }

  private extractRateLimitInfo(response: AxiosResponse): RateLimitInfo | null {
    const headers = response.headers;
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];

    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      };
    }

    return null;
  }

  protected async request<T = any>(
    config: AxiosRequestConfig
  ): Promise<WBAPIResponse<T>> {
    try {
      const response = await this.client.request<WBAPIResponse<T>>(config);
      return response.data;
    } catch (error) {
      if (error instanceof WBClientError) {
        throw error;
      }

      throw new WBClientError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        'REQUEST_ERROR'
      );
    }
  }

  protected async get<T = any>(
    url: string,
    params?: Record<string, any>
  ): Promise<WBAPIResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    });
  }

  protected async post<T = any>(
    url: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<WBAPIResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      params,
    });
  }

  protected async put<T = any>(
    url: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<WBAPIResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      params,
    });
  }

  protected async delete<T = any>(
    url: string,
    params?: Record<string, any>
  ): Promise<WBAPIResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      params,
    });
  }

  // Utility method to check if token is valid
  public async validateToken(): Promise<boolean> {
    try {
      // Try to make a simple request to validate token
      await this.get('/api/v1/warehouses');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Выполняет запрос с улучшенной обработкой ответа
   */
  protected async requestWithProcessing<T = any>(
    config: AxiosRequestConfig,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<T>> {
    const context = apiLogger.createContext(this.userId, config.url, config.method);
    
    try {
      const response = await this.client.request(config);
      return await responseProcessor.processResponse<T>(response, options, context);
    } catch (error) {
      apiLogger.logError(context, error);
      throw error;
    }
  }

  /**
   * Выполняет GET запрос с улучшенной обработкой ответа
   */
  protected async getWithProcessing<T = any>(
    url: string,
    params?: Record<string, any>,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<T>> {
    return this.requestWithProcessing<T>({
      method: 'GET',
      url,
      params,
    }, options);
  }

  /**
   * Выполняет POST запрос с улучшенной обработкой ответа
   */
  protected async postWithProcessing<T = any>(
    url: string,
    data?: any,
    params?: Record<string, any>,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<T>> {
    return this.requestWithProcessing<T>({
      method: 'POST',
      url,
      data,
      params,
    }, options);
  }

  /**
   * Выполняет запрос с пагинацией
   */
  protected async requestWithPagination<T = any>(
    config: AxiosRequestConfig,
    paginationRequest: PaginationRequest,
    options: DataExtractionOptions = {}
  ): Promise<PaginationResult<T>> {
    const normalizedRequest = paginationManager.normalizePaginationRequest(paginationRequest);
    
    // Добавляем параметры пагинации к запросу
    const paginatedConfig = {
      ...config,
      params: {
        ...config.params,
        ...normalizedRequest
      }
    };

    const processedResponse = await this.requestWithProcessing<T[]>(paginatedConfig, options);
    
    return {
      data: processedResponse.data,
      pagination: processedResponse.pagination || paginationManager.createPaginationInfo(
        normalizedRequest,
        processedResponse.data.length,
        processedResponse.data.length
      ),
      hasMore: processedResponse.pagination?.hasMore || false
    };
  }

  /**
   * Автоматически получает все страницы данных
   */
  protected async autoPaginate<T = any>(
    config: AxiosRequestConfig,
    initialPaginationRequest: PaginationRequest = {},
    options: AutoPaginationOptions = {},
    extractionOptions: DataExtractionOptions = {}
  ): Promise<T[]> {
    const context = apiLogger.createContext(this.userId, config.url, config.method);
    
    const fetchFunction = async (paginationRequest: PaginationRequest): Promise<PaginationResult<T>> => {
      return this.requestWithPagination<T>(config, paginationRequest, extractionOptions);
    };

    return paginationManager.autoPaginate(fetchFunction, initialPaginationRequest, options, context);
  }

  /**
   * Создает стандартизированный ответ API
   */
  protected createStandardResponse<T>(
    data: T,
    pagination?: any,
    metadata?: Record<string, any>
  ): WBAPIResponse<T> {
    return responseProcessor.createStandardResponse(data, pagination, metadata);
  }

  /**
   * Создает ответ с ошибкой
   */
  protected createErrorResponse(
    error: string,
    code?: string,
    details?: any
  ): WBAPIResponse<null> {
    return responseProcessor.createErrorResponse(error, code, details);
  }
}
