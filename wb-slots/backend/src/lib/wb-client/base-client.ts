import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { WBAPIResponse, WBClientError, WBRequestOptions } from './types';

export abstract class BaseWBClient {
  protected client: AxiosInstance;
  protected token: string;

  constructor(token: string, baseURL: string) {
    this.token = token;
    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds default timeout
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'User-Agent': 'WB-Slots-Service/1.0',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 WB API Request: ${config.method?.toUpperCase()} ${config.url}`);
        if (config.params) {
          console.log(`📋 Query params:`, config.params);
        }
        if (config.data) {
          console.log(`📦 Request body:`, config.data);
        }
        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ WB API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ WB API Error: ${error.response?.status} ${error.config?.url}`, {
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  protected async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  protected async post<T>(url: string, data?: any, params?: Record<string, any>): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.post(url, data, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  protected async put<T>(url: string, data?: any, params?: Record<string, any>): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.put(url, data, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  protected async delete<T>(url: string, params?: Record<string, any>): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.delete(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): WBClientError {
    if (error.response) {
      // Server responded with error status
      const statusCode = error.response.status;
      const data = error.response.data;
      
      return new WBClientError(
        data?.errorText || data?.message || `HTTP ${statusCode} Error`,
        statusCode,
        data?.code,
        data
      );
    } else if (error.request) {
      // Request was made but no response received
      return new WBClientError(
        'No response from WB API',
        0,
        'NO_RESPONSE',
        { originalError: error.message }
      );
    } else {
      // Something else happened
      return new WBClientError(
        error.message || 'Unknown error occurred',
        0,
        'UNKNOWN_ERROR',
        { originalError: error }
      );
    }
  }
}
