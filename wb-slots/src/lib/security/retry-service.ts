import { getTelegramService } from '../notifications/telegram-service';
import { NotificationType } from '../notifications/telegram-config';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // Базовая задержка в миллисекундах
  maxDelay: number;  // Максимальная задержка в миллисекундах
  backoffMultiplier: number; // Множитель для экспоненциального backoff
  jitter: boolean;   // Добавлять случайную задержку
  retryableErrors: string[]; // Коды ошибок, при которых стоит повторить попытку
}

export interface RetryContext {
  userId: string;
  taskName: string;
  supplyName: string;
  supplyId: string;
  warehouseName: string;
  slotDate: string;
  slotTime: string;
  coefficient: number;
  operation: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  attempts: number;
  totalTime: number;
  lastError?: string;
}

export class RetryService {
  private static instance: RetryService;
  private configs: Map<string, RetryConfig> = new Map();

  private constructor() {
    this.initializeDefaultConfigs();
  }

  public static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }

  private initializeDefaultConfigs(): void {
    // Конфигурация для бронирования слотов
    this.configs.set('booking', {
      maxRetries: 5,
      baseDelay: 2000, // 2 секунды
      maxDelay: 60000, // 1 минута
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'RATE_LIMIT_EXCEEDED',
        'NETWORK_ERROR',
        'TIMEOUT',
        'TEMPORARY_ERROR',
        'CAPTCHA_REQUIRED',
        'SERVER_ERROR',
      ],
    });

    // Конфигурация для API запросов
    this.configs.set('api_request', {
      maxRetries: 3,
      baseDelay: 1000, // 1 секунда
      maxDelay: 10000, // 10 секунд
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: [
        'RATE_LIMIT_EXCEEDED',
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVER_ERROR',
      ],
    });

    // Конфигурация для поиска слотов
    this.configs.set('slot_search', {
      maxRetries: 3,
      baseDelay: 5000, // 5 секунд
      maxDelay: 30000, // 30 секунд
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'RATE_LIMIT_EXCEEDED',
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVER_ERROR',
      ],
    });

    // Конфигурация для критических операций
    this.configs.set('critical', {
      maxRetries: 10,
      baseDelay: 1000,
      maxDelay: 300000, // 5 минут
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: [
        'RATE_LIMIT_EXCEEDED',
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVER_ERROR',
        'TEMPORARY_ERROR',
      ],
    });
  }

  /**
   * Выполняет операцию с повторными попытками
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    configName: string = 'api_request',
    context?: RetryContext
  ): Promise<RetryResult<T>> {
    const config = this.configs.get(configName);
    if (!config) {
      throw new Error(`Retry config not found: ${configName}`);
    }

    const startTime = Date.now();
    let lastError: string = '';
    let attempts = 0;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      attempts = attempt + 1;

      try {
        console.log(`🔄 Retry attempt ${attempts}/${config.maxRetries + 1} for ${configName}`);
        
        const result = await operation();
        
        const totalTime = Date.now() - startTime;
        console.log(`✅ Operation succeeded on attempt ${attempts} after ${totalTime}ms`);

        return {
          success: true,
          result,
          attempts,
          totalTime,
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const errorCode = this.extractErrorCode(error);

        console.warn(`❌ Attempt ${attempts} failed: ${lastError}`);

        // Проверяем, стоит ли повторить попытку
        if (attempt === config.maxRetries || !this.shouldRetry(errorCode, config.retryableErrors)) {
          const totalTime = Date.now() - startTime;
          console.error(`💥 All retry attempts exhausted after ${totalTime}ms`);

          // Отправляем уведомление об ошибке, если есть контекст
          if (context) {
            await this.sendRetryFailureNotification(context, lastError, attempts);
          }

          return {
            success: false,
            error: lastError,
            attempts,
            totalTime,
            lastError,
          };
        }

        // Вычисляем задержку до следующей попытки
        const delay = this.calculateDelay(attempt, config);
        console.log(`⏳ Waiting ${delay}ms before next attempt...`);

        // Отправляем уведомление о повторной попытке, если есть контекст
        if (context && attempt < config.maxRetries) {
          await this.sendRetryAttemptNotification(context, lastError, attempt + 1, config.maxRetries + 1);
        }

        await this.sleep(delay);
      }
    }

    // Этот код не должен выполняться, но на всякий случай
    const totalTime = Date.now() - startTime;
    return {
      success: false,
      error: lastError,
      attempts,
      totalTime,
      lastError,
    };
  }

  /**
   * Вычисляет задержку до следующей попытки
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Экспоненциальный backoff
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    
    // Ограничиваем максимальной задержкой
    delay = Math.min(delay, config.maxDelay);
    
    // Добавляем jitter для избежания thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(0, Math.floor(delay));
  }

  /**
   * Проверяет, стоит ли повторить попытку
   */
  private shouldRetry(errorCode: string, retryableErrors: string[]): boolean {
    return retryableErrors.includes(errorCode);
  }

  /**
   * Извлекает код ошибки из объекта ошибки
   */
  private extractErrorCode(error: any): string {
    if (error && typeof error === 'object') {
      return error.code || error.statusCode || error.name || 'UNKNOWN_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Отправляет уведомление о повторной попытке
   */
  private async sendRetryAttemptNotification(
    context: RetryContext,
    error: string,
    currentAttempt: number,
    totalAttempts: number
  ): Promise<void> {
    try {
      if (!getTelegramService().isInitialized()) {
        return;
      }

      const user = getTelegramService().getUser(context.userId);
      if (!user || !user.isActive) {
        return;
      }

      await getTelegramService().sendNotification(
        context.userId,
        NotificationType.BOOKING_ERROR,
        {
          supplyName: context.supplyName,
          supplyId: context.supplyId,
          warehouseName: context.warehouseName,
          slotDate: context.slotDate,
          slotTime: context.slotTime,
          coefficient: context.coefficient.toString(),
          errorMessage: `Повторная попытка ${currentAttempt}/${totalAttempts}: ${error}`,
          executionTime: '0',
          taskName: context.taskName,
        }
      );
    } catch (error) {
      console.error('❌ Error sending retry notification:', error);
    }
  }

  /**
   * Отправляет уведомление о неудаче всех попыток
   */
  private async sendRetryFailureNotification(
    context: RetryContext,
    error: string,
    attempts: number
  ): Promise<void> {
    try {
      if (!getTelegramService().isInitialized()) {
        return;
      }

      const user = getTelegramService().getUser(context.userId);
      if (!user || !user.isActive) {
        return;
      }

      await getTelegramService().sendNotification(
        context.userId,
        NotificationType.BOOKING_ERROR,
        {
          supplyName: context.supplyName,
          supplyId: context.supplyId,
          warehouseName: context.warehouseName,
          slotDate: context.slotDate,
          slotTime: context.slotTime,
          coefficient: context.coefficient.toString(),
          errorMessage: `Все попытки исчерпаны (${attempts} попыток): ${error}`,
          executionTime: '0',
          taskName: context.taskName,
        }
      );
    } catch (error) {
      console.error('❌ Error sending retry failure notification:', error);
    }
  }

  /**
   * Добавляет новую конфигурацию retry
   */
  addConfig(name: string, config: RetryConfig): void {
    this.configs.set(name, config);
    console.log(`✅ Retry config added: ${name}`);
  }

  /**
   * Получает конфигурацию retry
   */
  getConfig(name: string): RetryConfig | undefined {
    return this.configs.get(name);
  }

  /**
   * Получает все конфигурации
   */
  getAllConfigs(): Map<string, RetryConfig> {
    return new Map(this.configs);
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Выполняет операцию с простой retry логикой
   */
  async simpleRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        console.warn(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Выполняет операцию с экспоненциальным backoff
   */
  async exponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.warn(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }
}

// Экспортируем singleton instance
export const retryService = RetryService.getInstance();
