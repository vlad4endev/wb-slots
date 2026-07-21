import { AxiosResponse } from 'axios';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  timestamp?: number;
  duration?: number;
  retryAttempt?: number;
}

export interface APIResponseLog {
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: any;
  error?: any;
  metadata?: Record<string, any>;
}

export class EnhancedAPILogger {
  private static instance: EnhancedAPILogger;
  private logLevel: LogLevel = LogLevel.INFO;
  private enableDetailedLogging: boolean = true;
  private maxLogSize: number = 10000; // Максимальный размер лога в символах

  static getInstance(): EnhancedAPILogger {
    if (!EnhancedAPILogger.instance) {
      EnhancedAPILogger.instance = new EnhancedAPILogger();
    }
    return EnhancedAPILogger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setDetailedLogging(enabled: boolean): void {
    this.enableDetailedLogging = enabled;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatLog(log: APIResponseLog): string {
    const timestamp = new Date(log.context.timestamp || Date.now()).toISOString();
    const levelName = LogLevel[log.level];
    const contextStr = this.formatContext(log.context);
    
    let message = `[${timestamp}] ${levelName} ${log.message}`;
    if (contextStr) {
      message += ` ${contextStr}`;
    }
    
    return message;
  }

  private formatContext(context: LogContext): string {
    const parts: string[] = [];
    
    if (context.userId) parts.push(`user:${context.userId}`);
    if (context.requestId) parts.push(`req:${context.requestId}`);
    if (context.endpoint) parts.push(`endpoint:${context.endpoint}`);
    if (context.method) parts.push(`method:${context.method}`);
    if (context.duration !== undefined) parts.push(`duration:${context.duration}ms`);
    if (context.retryAttempt !== undefined) parts.push(`retry:${context.retryAttempt}`);
    
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  }

  private truncateData(data: any): any {
    if (!this.enableDetailedLogging) {
      return '[Detailed logging disabled]';
    }

    const dataStr = JSON.stringify(data);
    if (dataStr.length <= this.maxLogSize) {
      return data;
    }

    return {
      ...data,
      _truncated: true,
      _originalSize: dataStr.length,
      _truncatedTo: this.maxLogSize
    };
  }

  private log(log: APIResponseLog): void {
    if (!this.shouldLog(log.level)) {
      return;
    }

    const formattedMessage = this.formatLog(log);
    
    switch (log.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, log.data ? this.truncateData(log.data) : '');
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, log.data ? this.truncateData(log.data) : '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, log.data ? this.truncateData(log.data) : '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, log.error || log.data ? this.truncateData(log.error || log.data) : '');
        break;
    }
  }

  // Методы для логирования различных событий API
  logRequest(context: LogContext, requestData: any): void {
    this.log({
      level: LogLevel.DEBUG,
      message: '🌐 API Request',
      context,
      data: {
        url: requestData.url,
        method: requestData.method,
        headers: this.sanitizeHeaders(requestData.headers),
        params: requestData.params,
        data: requestData.data
      }
    });
  }

  logResponse(context: LogContext, response: AxiosResponse): void {
    const responseData = {
      status: response.status,
      statusText: response.statusText,
      headers: this.sanitizeHeaders(response.headers),
      data: response.data,
      config: {
        url: response.config.url,
        method: response.config.method,
        timeout: response.config.timeout
      }
    };

    this.log({
      level: LogLevel.INFO,
      message: '✅ API Response',
      context,
      data: responseData
    });
  }

  logError(context: LogContext, error: any): void {
    const errorData = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      config: error.config ? {
        url: error.config.url,
        method: error.config.method,
        timeout: error.config.timeout
      } : undefined
    };

    this.log({
      level: LogLevel.ERROR,
      message: '❌ API Error',
      context,
      error: errorData
    });
  }

  logRetry(context: LogContext, attempt: number, reason: string): void {
    this.log({
      level: LogLevel.WARN,
      message: `🔄 API Retry (${reason})`,
      context: { ...context, retryAttempt: attempt },
      data: { reason, attempt }
    });
  }

  logRateLimit(context: LogContext, rateLimitInfo: any): void {
    this.log({
      level: LogLevel.WARN,
      message: '🚨 Rate Limit Info',
      context,
      data: rateLimitInfo
    });
  }

  logDataExtraction(context: LogContext, extractionResult: any): void {
    this.log({
      level: LogLevel.DEBUG,
      message: '📊 Data Extraction',
      context,
      data: extractionResult
    });
  }

  logPagination(context: LogContext, paginationInfo: any): void {
    this.log({
      level: LogLevel.DEBUG,
      message: '📄 Pagination Info',
      context,
      data: paginationInfo
    });
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return headers;
    
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'x-auth-token', 'cookie'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  // Метод для создания контекста запроса
  createContext(userId?: string, endpoint?: string, method?: string): LogContext {
    return {
      userId,
      endpoint,
      method,
      requestId: this.generateRequestId(),
      timestamp: Date.now()
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Метод для измерения времени выполнения
  startTimer(context: LogContext): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      context.duration = duration;
    };
  }
}

// Экспортируем singleton instance
export const apiLogger = EnhancedAPILogger.getInstance();
