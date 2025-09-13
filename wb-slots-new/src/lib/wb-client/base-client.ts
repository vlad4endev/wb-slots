import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { WBAPIResponse, WBClientError, WBRequestOptions, RateLimitInfo } from './types';

export abstract class BaseWBClient {
  protected client: AxiosInstance;
  protected token: string;
  protected baseURL: string;

  constructor(token: string, baseURL: string, options: WBRequestOptions = {}) {
    this.token = token;
    this.baseURL = baseURL;

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
      (config) => {
        // Add timestamp to prevent caching
        config.params = {
          ...config.params,
          timestamp: Date.now(),
        };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Check for rate limiting headers
        const rateLimitInfo = this.extractRateLimitInfo(response);
        if (rateLimitInfo) {
          console.warn('Rate limit info:', rateLimitInfo);
        }

        return response;
      },
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const errorMessage = data?.errorText || data?.message || error.message;
          const errorCode = data?.code || `HTTP_${status}`;

          throw new WBClientError(
            errorMessage,
            status,
            errorCode,
            data
          );
        }

        if (error.request) {
          throw new WBClientError(
            'Network error: No response received',
            0,
            'NETWORK_ERROR'
          );
        }

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
}
