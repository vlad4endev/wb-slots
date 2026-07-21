import { AxiosResponse } from 'axios';
import { WBAPIResponse, WBClientError } from './types';
import { apiLogger, LogContext } from './enhanced-logger';

export enum ResponseFormat {
  JSON = 'application/json',
  XML = 'application/xml',
  CSV = 'text/csv',
  TEXT = 'text/plain',
  FORM_DATA = 'multipart/form-data'
}

export interface PaginationInfo {
  page?: number;
  limit?: number;
  offset?: number;
  total?: number;
  hasMore?: boolean;
  nextPage?: string;
  prevPage?: string;
}

export interface ProcessedResponse<T = any> {
  data: T;
  pagination?: PaginationInfo;
  metadata?: {
    format: ResponseFormat;
    size: number;
    processingTime: number;
    extractedAt: string;
  };
  originalResponse?: any;
}

export interface DataExtractionOptions {
  dataPath?: string; // Путь к данным в ответе (например, 'data.items')
  paginationPath?: string; // Путь к информации о пагинации
  transformFunction?: (data: any) => any; // Функция трансформации данных
  validateFunction?: (data: any) => boolean; // Функция валидации данных
}

export class APIResponseProcessor {
  private static instance: APIResponseProcessor;

  static getInstance(): APIResponseProcessor {
    if (!APIResponseProcessor.instance) {
      APIResponseProcessor.instance = new APIResponseProcessor();
    }
    return APIResponseProcessor.instance;
  }

  /**
   * Обрабатывает ответ API с поддержкой различных форматов
   */
  async processResponse<T = any>(
    response: AxiosResponse,
    options: DataExtractionOptions = {},
    context: LogContext
  ): Promise<ProcessedResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Определяем формат ответа
      const format = this.detectResponseFormat(response);
      
      // Извлекаем данные в зависимости от формата
      const extractedData = await this.extractDataByFormat(response, format, context);
      
      // Применяем путь к данным если указан
      const data = options.dataPath 
        ? this.extractDataByPath(extractedData, options.dataPath)
        : extractedData;
      
      // Извлекаем информацию о пагинации
      const pagination = options.paginationPath
        ? this.extractPaginationByPath(extractedData, options.paginationPath)
        : this.extractPaginationFromResponse(response, extractedData);
      
      // Применяем трансформацию если указана
      const transformedData = options.transformFunction
        ? options.transformFunction(data)
        : data;
      
      // Валидируем данные если указана функция валидации
      if (options.validateFunction && !options.validateFunction(transformedData)) {
        throw new WBClientError(
          'Data validation failed',
          422,
          'VALIDATION_ERROR',
          { data: transformedData }
        );
      }
      
      const processingTime = Date.now() - startTime;
      
      const result: ProcessedResponse<T> = {
        data: transformedData,
        pagination,
        metadata: {
          format,
          size: JSON.stringify(transformedData).length,
          processingTime,
          extractedAt: new Date().toISOString()
        },
        originalResponse: this.enableDetailedLogging ? response.data : undefined
      };
      
      // Логируем результат обработки
      apiLogger.logDataExtraction(context, {
        format,
        dataSize: result.metadata.size,
        processingTime,
        pagination: pagination ? 'present' : 'none',
        validation: options.validateFunction ? 'passed' : 'skipped'
      });
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      apiLogger.logError(context, {
        message: 'Response processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        options
      });
      
      throw error;
    }
  }

  /**
   * Определяет формат ответа по заголовкам
   */
  private detectResponseFormat(response: AxiosResponse): ResponseFormat {
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      return ResponseFormat.JSON;
    } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      return ResponseFormat.XML;
    } else if (contentType.includes('text/csv')) {
      return ResponseFormat.CSV;
    } else if (contentType.includes('multipart/form-data')) {
      return ResponseFormat.FORM_DATA;
    } else {
      return ResponseFormat.TEXT;
    }
  }

  /**
   * Извлекает данные в зависимости от формата ответа
   */
  private async extractDataByFormat(
    response: AxiosResponse,
    format: ResponseFormat,
    context: LogContext
  ): Promise<any> {
    switch (format) {
      case ResponseFormat.JSON:
        return this.extractJSONData(response, context);
      
      case ResponseFormat.XML:
        return await this.extractXMLData(response, context);
      
      case ResponseFormat.CSV:
        return this.extractCSVData(response, context);
      
      case ResponseFormat.TEXT:
        return this.extractTextData(response, context);
      
      case ResponseFormat.FORM_DATA:
        return this.extractFormData(response, context);
      
      default:
        throw new WBClientError(
          `Unsupported response format: ${format}`,
          415,
          'UNSUPPORTED_FORMAT'
        );
    }
  }

  /**
   * Извлекает JSON данные
   */
  private extractJSONData(response: AxiosResponse, context: LogContext): any {
    try {
      if (typeof response.data === 'string') {
        return JSON.parse(response.data);
      }
      return response.data;
    } catch (error) {
      apiLogger.logError(context, {
        message: 'Failed to parse JSON response',
        error: error instanceof Error ? error.message : 'Unknown error',
        data: response.data
      });
      
      throw new WBClientError(
        'Invalid JSON response',
        422,
        'INVALID_JSON',
        { originalData: response.data }
      );
    }
  }

  /**
   * Извлекает XML данные
   */
  private async extractXMLData(response: AxiosResponse, context: LogContext): Promise<any> {
    try {
      // Для XML парсинга можно использовать библиотеку xml2js
      // Пока возвращаем как текст
      const xmlText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      apiLogger.logDataExtraction(context, {
        format: 'XML',
        size: xmlText.length,
        note: 'XML parsing not implemented, returning as text'
      });
      
      return { xml: xmlText };
    } catch (error) {
      apiLogger.logError(context, {
        message: 'Failed to process XML response',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new WBClientError(
        'XML processing failed',
        422,
        'XML_PROCESSING_ERROR'
      );
    }
  }

  /**
   * Извлекает CSV данные
   */
  private extractCSVData(response: AxiosResponse, context: LogContext): any {
    try {
      const csvText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const lines = csvText.split('\n');
      const headers = lines[0]?.split(',') || [];
      const rows = lines.slice(1).map(line => line.split(','));
      
      const result = rows.map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header.trim()] = row[index]?.trim() || '';
        });
        return obj;
      });
      
      apiLogger.logDataExtraction(context, {
        format: 'CSV',
        rows: result.length,
        headers: headers.length
      });
      
      return result;
    } catch (error) {
      apiLogger.logError(context, {
        message: 'Failed to process CSV response',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new WBClientError(
        'CSV processing failed',
        422,
        'CSV_PROCESSING_ERROR'
      );
    }
  }

  /**
   * Извлекает текстовые данные
   */
  private extractTextData(response: AxiosResponse, context: LogContext): any {
    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    
    apiLogger.logDataExtraction(context, {
      format: 'TEXT',
      size: text.length
    });
    
    return { text };
  }

  /**
   * Извлекает данные формы
   */
  private extractFormData(response: AxiosResponse, context: LogContext): any {
    // Для form-data можно использовать библиотеку form-data
    // Пока возвращаем как есть
    apiLogger.logDataExtraction(context, {
      format: 'FORM_DATA',
      note: 'Form data processing not fully implemented'
    });
    
    return response.data;
  }

  /**
   * Извлекает данные по указанному пути
   */
  private extractDataByPath(data: any, path: string): any {
    const keys = path.split('.');
    let result = data;
    
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return null;
      }
    }
    
    return result;
  }

  /**
   * Извлекает информацию о пагинации из ответа
   */
  private extractPaginationFromResponse(response: AxiosResponse, data: any): PaginationInfo | undefined {
    // Проверяем различные возможные места для информации о пагинации
    const paginationSources = [
      data?.pagination,
      data?.meta?.pagination,
      data?.pageInfo,
      data?.paging,
      response.headers['x-pagination'],
      response.headers['x-total-count'],
      response.headers['x-page-count']
    ];
    
    for (const source of paginationSources) {
      if (source) {
        return this.normalizePaginationInfo(source);
      }
    }
    
    // Проверяем заголовки для стандартной пагинации
    const totalCount = response.headers['x-total-count'];
    const pageCount = response.headers['x-page-count'];
    const currentPage = response.headers['x-current-page'];
    const perPage = response.headers['x-per-page'];
    
    if (totalCount || pageCount || currentPage || perPage) {
      return {
        total: totalCount ? parseInt(totalCount) : undefined,
        page: currentPage ? parseInt(currentPage) : undefined,
        limit: perPage ? parseInt(perPage) : undefined,
        hasMore: currentPage && pageCount ? parseInt(currentPage) < parseInt(pageCount) : undefined
      };
    }
    
    return undefined;
  }

  /**
   * Извлекает информацию о пагинации по указанному пути
   */
  private extractPaginationByPath(data: any, path: string): PaginationInfo | undefined {
    const paginationData = this.extractDataByPath(data, path);
    return paginationData ? this.normalizePaginationInfo(paginationData) : undefined;
  }

  /**
   * Нормализует информацию о пагинации к стандартному формату
   */
  private normalizePaginationInfo(paginationData: any): PaginationInfo {
    return {
      page: paginationData.page || paginationData.currentPage || paginationData.pageNumber,
      limit: paginationData.limit || paginationData.perPage || paginationData.pageSize,
      offset: paginationData.offset || paginationData.skip,
      total: paginationData.total || paginationData.totalCount || paginationData.totalItems,
      hasMore: paginationData.hasMore || paginationData.hasNext || paginationData.hasNextPage,
      nextPage: paginationData.nextPage || paginationData.next,
      prevPage: paginationData.prevPage || paginationData.previous || paginationData.prev
    };
  }

  /**
   * Создает стандартизированный ответ API
   */
  createStandardResponse<T>(
    data: T,
    pagination?: PaginationInfo,
    metadata?: Record<string, any>
  ): WBAPIResponse<T> {
    return {
      data,
      error: false,
      errorText: '',
      additionalErrors: [],
      ...(pagination && { pagination }),
      ...(metadata && { metadata })
    };
  }

  /**
   * Создает ответ с ошибкой
   */
  createErrorResponse(
    error: string,
    code?: string,
    details?: any
  ): WBAPIResponse<null> {
    return {
      data: null,
      error: true,
      errorText: error,
      additionalErrors: details ? [details] : [],
      ...(code && { code })
    };
  }

  private get enableDetailedLogging(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.ENABLE_DETAILED_LOGGING === 'true';
  }
}

// Экспортируем singleton instance
export const responseProcessor = APIResponseProcessor.getInstance();
