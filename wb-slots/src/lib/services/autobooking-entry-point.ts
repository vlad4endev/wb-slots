/**
 * 🏗️ Единая точка входа для автобронирования
 * Централизованное управление всеми операциями автобронирования
 */

import { 
  AutoBookingConfig,
  BookingResult,
  BookingState,
  BookingSystemConfig,
  DEFAULT_SYSTEM_CONFIG,
  BookingError
} from '../architecture/autobooking-interfaces';
import { UnifiedAutoBookingService } from './unified-autobooking-service';
import { AutoBookingManager } from './autobooking-manager';

// ============================================================================
// КЛАСС ЕДИНОЙ ТОЧКИ ВХОДА
// ============================================================================

export class AutoBookingEntryPoint {
  private static instance: AutoBookingEntryPoint | null = null;
  private autoBookingService: UnifiedAutoBookingService;
  private bookingManager: AutoBookingManager;
  private isInitialized = false;

  private constructor() {
    this.autoBookingService = new UnifiedAutoBookingService();
    this.bookingManager = new AutoBookingManager();
  }

  /**
   * Получение единственного экземпляра
   */
  static getInstance(): AutoBookingEntryPoint {
    if (!AutoBookingEntryPoint.instance) {
      AutoBookingEntryPoint.instance = new AutoBookingEntryPoint();
    }
    return AutoBookingEntryPoint.instance;
  }

  /**
   * Инициализация системы автобронирования
   */
  async initialize(config?: Partial<BookingSystemConfig>): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Auto booking system already initialized');
      return;
    }

    console.log('🚀 Initializing auto booking system...');
    
    try {
      // Инициализируем сервис автобронирования
      await this.autoBookingService.initialize();
      console.log('✅ Auto booking service initialized');
      
      // Инициализируем менеджер
      await this.bookingManager.initialize();
      console.log('✅ Booking manager initialized');
      
      this.isInitialized = true;
      console.log('🎉 Auto booking system initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize auto booking system:', error);
      throw error;
    }
  }

  /**
   * Запуск системы автобронирования
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Auto booking system must be initialized before starting');
    }

    console.log('🚀 Starting auto booking system...');
    
    try {
      // Запускаем сервис автобронирования
      await this.autoBookingService.start();
      console.log('✅ Auto booking service started');
      
      // Запускаем менеджер
      await this.bookingManager.start();
      console.log('✅ Booking manager started');
      
      console.log('🎉 Auto booking system started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start auto booking system:', error);
      throw error;
    }
  }

  /**
   * Остановка системы автобронирования
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping auto booking system...');
    
    try {
      // Останавливаем менеджер
      await this.bookingManager.stop();
      console.log('✅ Booking manager stopped');
      
      // Останавливаем сервис автобронирования
      await this.autoBookingService.stop();
      console.log('✅ Auto booking service stopped');
      
      console.log('✅ Auto booking system stopped successfully');
      
    } catch (error) {
      console.error('❌ Failed to stop auto booking system:', error);
      throw error;
    }
  }

  // ============================================================================
  // ОСНОВНЫЕ ОПЕРАЦИИ АВТОБРОНИРОВАНИЯ
  // ============================================================================

  /**
   * Бронирование слота (синхронное)
   */
  async bookSlot(config: AutoBookingConfig): Promise<BookingResult> {
    this.ensureInitialized();
    return await this.autoBookingService.bookSlot(config);
  }

  /**
   * Запуск автоматического бронирования (асинхронное)
   */
  async startAutoBooking(config: AutoBookingConfig): Promise<string> {
    this.ensureInitialized();
    return await this.autoBookingService.startAutoBooking(config);
  }

  /**
   * Остановка автоматического бронирования
   */
  async stopAutoBooking(bookingId: string): Promise<void> {
    this.ensureInitialized();
    return await this.autoBookingService.stopAutoBooking(bookingId);
  }

  /**
   * Отмена бронирования
   */
  async cancelBooking(bookingId: string): Promise<void> {
    this.ensureInitialized();
    return await this.autoBookingService.cancelAutoBooking(bookingId);
  }

  /**
   * Добавление в очередь бронирования
   */
  async addToQueue(config: AutoBookingConfig, priority: number = 5): Promise<string> {
    this.ensureInitialized();
    return await this.bookingManager.addToQueue(config, priority);
  }

  /**
   * Планирование бронирования
   */
  async scheduleBooking(config: AutoBookingConfig, delay: number = 0): Promise<string> {
    this.ensureInitialized();
    return await this.bookingManager.scheduleBooking(config, delay);
  }

  // ============================================================================
  // МОНИТОРИНГ И СТАТУС
  // ============================================================================

  /**
   * Проверка состояния системы
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    running: boolean;
    autoBooking: any;
    manager: any;
    summary: {
      activeBookings: number;
      queueSize: number;
      availableResources: number;
    };
  }> {
    const autoBookingHealth = await this.autoBookingService.getHealth();
    const managerHealth = await this.bookingManager.getSystemHealth();
    const queueStatus = await this.bookingManager.getQueueStatus();
    const resources = await this.bookingManager.getAvailableResources();
    
    return {
      initialized: this.isInitialized,
      running: this.autoBookingService.status === 'running',
      autoBooking: autoBookingHealth,
      manager: managerHealth,
      summary: {
        activeBookings: this.autoBookingService.getActiveBookings().length,
        queueSize: queueStatus.total,
        availableResources: resources.availableSlots
      }
    };
  }

  /**
   * Получение состояния бронирования
   */
  async getBookingState(bookingId: string): Promise<BookingState | null> {
    this.ensureInitialized();
    return await this.autoBookingService.getBookingState(bookingId);
  }

  /**
   * Получение активных бронирований
   */
  getActiveBookings(): string[] {
    this.ensureInitialized();
    return this.autoBookingService.getActiveBookings();
  }

  /**
   * Получение истории бронирований
   */
  getBookingHistory(limit?: number): BookingResult[] {
    this.ensureInitialized();
    return this.autoBookingService.getBookingHistory(limit);
  }

  /**
   * Получение статуса очереди
   */
  async getQueueStatus(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    this.ensureInitialized();
    return await this.bookingManager.getQueueStatus();
  }

  /**
   * Получение доступных ресурсов
   */
  async getAvailableResources(): Promise<{
    maxConcurrentBookings: number;
    currentBookings: number;
    availableSlots: number;
  }> {
    this.ensureInitialized();
    return await this.bookingManager.getAvailableResources();
  }

  // ============================================================================
  // МЕТРИКИ И АНАЛИТИКА
  // ============================================================================

  /**
   * Получение метрик автобронирования
   */
  async getBookingMetrics(): Promise<{
    totalBookings: number;
    successfulBookings: number;
    failedBookings: number;
    averageBookingTime: number;
    successRate: number;
    methodStats: Record<string, number>;
    errorStats: Record<string, number>;
  }> {
    this.ensureInitialized();
    return await this.autoBookingService.getBookingMetrics();
  }

  /**
   * Получение метрик системы
   */
  async getSystemMetrics(): Promise<{
    performance: any;
    queue: any;
    resources: any;
  }> {
    this.ensureInitialized();
    
    const autoBookingMetrics = await this.autoBookingService.getMetrics();
    const managerMetrics = await this.bookingManager.getPerformanceMetrics();
    const queueStatus = await this.bookingManager.getQueueStatus();
    const resources = await this.bookingManager.getAvailableResources();
    
    return {
      performance: autoBookingMetrics,
      queue: queueStatus,
      resources
    };
  }

  /**
   * Получение статистики очереди
   */
  async getQueueStatistics(): Promise<{
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    priorityDistribution: Record<number, number>;
  }> {
    this.ensureInitialized();
    return await this.bookingManager.getQueueStatistics();
  }

  // ============================================================================
  // УПРАВЛЕНИЕ СИСТЕМОЙ
  // ============================================================================

  /**
   * Очистка очереди
   */
  async clearQueue(): Promise<void> {
    this.ensureInitialized();
    return await this.bookingManager.clearQueue();
  }

  /**
   * Обновление приоритета в очереди
   */
  async updateQueuePriority(queueId: string, newPriority: number): Promise<void> {
    this.ensureInitialized();
    return await this.bookingManager.updateQueueItemPriority(queueId, newPriority);
  }

  /**
   * Получение деталей элемента очереди
   */
  async getQueueItemDetails(queueId: string): Promise<any> {
    this.ensureInitialized();
    return await this.bookingManager.getQueueItemDetails(queueId);
  }

  /**
   * Перепланирование бронирования
   */
  async rescheduleBooking(bookingId: string, newTime: Date): Promise<void> {
    this.ensureInitialized();
    return await this.bookingManager.rescheduleBooking(bookingId, newTime);
  }

  // ============================================================================
  // УТИЛИТЫ
  // ============================================================================

  /**
   * Проверка инициализации
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Auto booking system not initialized. Call initialize() first.');
    }
  }

  /**
   * Проверка здоровья системы
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    components: {
      autoBooking: any;
      manager: any;
    };
  }> {
    try {
      const autoBookingHealth = await this.autoBookingService.getHealth();
      const managerHealth = await this.bookingManager.getSystemHealth();
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (autoBookingHealth.status === 'unhealthy' || managerHealth.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (autoBookingHealth.status === 'degraded' || managerHealth.status === 'degraded') {
        overallStatus = 'degraded';
      }
      
      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        components: {
          autoBooking: autoBookingHealth,
          manager: managerHealth
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          autoBooking: { status: 'unhealthy', error: error },
          manager: { status: 'unhealthy', error: error }
        }
      };
    }
  }
}

// ============================================================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ
// ============================================================================

let globalAutoBookingEntryPoint: AutoBookingEntryPoint | null = null;

/**
 * Получение глобального экземпляра
 */
export function getAutoBookingEntryPoint(): AutoBookingEntryPoint {
  if (!globalAutoBookingEntryPoint) {
    globalAutoBookingEntryPoint = AutoBookingEntryPoint.getInstance();
  }
  return globalAutoBookingEntryPoint;
}

/**
 * Инициализация системы автобронирования
 */
export async function initializeAutoBookingSystem(config?: Partial<BookingSystemConfig>): Promise<AutoBookingEntryPoint> {
  const entryPoint = getAutoBookingEntryPoint();
  await entryPoint.initialize(config);
  return entryPoint;
}

/**
 * Запуск системы автобронирования
 */
export async function startAutoBookingSystem(): Promise<AutoBookingEntryPoint> {
  const entryPoint = getAutoBookingEntryPoint();
  await entryPoint.start();
  return entryPoint;
}

/**
 * Остановка системы автобронирования
 */
export async function stopAutoBookingSystem(): Promise<void> {
  const entryPoint = getAutoBookingEntryPoint();
  await entryPoint.stop();
}

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С АВТОБРОНИРОВАНИЕМ
// ============================================================================

/**
 * Быстрое бронирование слота
 */
export async function quickBookSlot(config: AutoBookingConfig): Promise<BookingResult> {
  const entryPoint = getAutoBookingEntryPoint();
  return await entryPoint.bookSlot(config);
}

/**
 * Добавление в очередь с высоким приоритетом
 */
export async function urgentBooking(config: AutoBookingConfig): Promise<string> {
  const entryPoint = getAutoBookingEntryPoint();
  return await entryPoint.addToQueue(config, 10); // Высокий приоритет
}

/**
 * Планирование бронирования
 */
export async function scheduleBooking(config: AutoBookingConfig, delayMs: number): Promise<string> {
  const entryPoint = getAutoBookingEntryPoint();
  return await entryPoint.scheduleBooking(config, delayMs);
}

/**
 * Проверка состояния системы
 */
export async function getAutoBookingSystemStatus(): Promise<any> {
  const entryPoint = getAutoBookingEntryPoint();
  return await entryPoint.getSystemStatus();
}

/**
 * Проверка здоровья системы
 */
export async function getAutoBookingSystemHealth(): Promise<any> {
  const entryPoint = getAutoBookingEntryPoint();
  return await entryPoint.healthCheck();
}
