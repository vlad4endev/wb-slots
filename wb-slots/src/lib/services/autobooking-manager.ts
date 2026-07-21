/**
 * 🏗️ Менеджер автобронирования
 * Управляет очередью, ресурсами и планированием автобронирования
 */

import { 
  BaseService, 
  ServiceError 
} from '../architecture';
import { 
  IBookingManager,
  AutoBookingConfig,
  BookingSystemConfig,
  DEFAULT_SYSTEM_CONFIG
} from '../architecture/autobooking-interfaces';
import { UnifiedAutoBookingService } from './unified-autobooking-service';

interface QueueItem {
  id: string;
  config: AutoBookingConfig;
  priority: number;
  scheduledFor: Date;
  createdAt: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export class AutoBookingManager extends BaseService implements IBookingManager {
  private queue: Map<string, QueueItem> = new Map();
  private activeBookings: Set<string> = new Set();
  private maxConcurrentBookings: number;
  private autoBookingService: UnifiedAutoBookingService;
  private systemConfig: BookingSystemConfig;

  constructor(config: Partial<BookingSystemConfig> = {}) {
    super('AutoBookingManager', '1.0.0');
    this.systemConfig = { ...DEFAULT_SYSTEM_CONFIG, ...config };
    this.maxConcurrentBookings = this.systemConfig.maxConcurrentBookings;
    this.autoBookingService = new UnifiedAutoBookingService();
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ
  // ============================================================================

  protected async doInitialize(): Promise<void> {
    this.log('info', 'Initializing auto booking manager...');
    
    // Инициализируем сервис автобронирования
    await this.autoBookingService.initialize();
    
    this.log('info', 'Auto booking manager initialized');
  }

  protected async doStart(): Promise<void> {
    this.log('info', 'Starting auto booking manager...');
    
    // Запускаем сервис автобронирования
    await this.autoBookingService.start();
    
    // Запускаем обработчик очереди
    this.startQueueProcessor();
    
    this.log('info', 'Auto booking manager started');
  }

  protected async doStop(): Promise<void> {
    this.log('info', 'Stopping auto booking manager...');
    
    // Останавливаем сервис автобронирования
    await this.autoBookingService.stop();
    
    // Очищаем очередь
    this.queue.clear();
    this.activeBookings.clear();
    
    this.log('info', 'Auto booking manager stopped');
  }

  // ============================================================================
  // РЕАЛИЗАЦИЯ ИНТЕРФЕЙСА IBookingManager
  // ============================================================================

  async addToQueue(config: AutoBookingConfig, priority: number = 5): Promise<string> {
    return this.executeWithMetrics('addToQueue', async () => {
      const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queueItem: QueueItem = {
        id: queueId,
        config,
        priority,
        scheduledFor: new Date(),
        createdAt: new Date(),
        status: 'PENDING'
      };
      
      this.queue.set(queueId, queueItem);
      
      this.log('info', `Added booking to queue: ${queueId} (priority: ${priority})`);
      return queueId;
    });
  }

  async removeFromQueue(bookingId: string): Promise<void> {
    return this.executeWithMetrics('removeFromQueue', async () => {
      const queueItem = this.queue.get(bookingId);
      if (!queueItem) {
        throw new ServiceError(this.name, 'removeFromQueue', `Queue item ${bookingId} not found`);
      }
      
      queueItem.status = 'CANCELLED';
      this.queue.delete(bookingId);
      
      this.log('info', `Removed booking from queue: ${bookingId}`);
    });
  }

  async getQueueStatus(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    const items = Array.from(this.queue.values());
    
    return {
      total: items.length,
      pending: items.filter(item => item.status === 'PENDING').length,
      inProgress: items.filter(item => item.status === 'IN_PROGRESS').length,
      completed: items.filter(item => item.status === 'COMPLETED').length,
      failed: items.filter(item => item.status === 'FAILED').length
    };
  }

  async getAvailableResources(): Promise<{
    maxConcurrentBookings: number;
    currentBookings: number;
    availableSlots: number;
  }> {
    const currentBookings = this.activeBookings.size;
    const availableSlots = Math.max(0, this.maxConcurrentBookings - currentBookings);
    
    return {
      maxConcurrentBookings: this.maxConcurrentBookings,
      currentBookings,
      availableSlots
    };
  }

  async scheduleBooking(config: AutoBookingConfig, delay: number = 0): Promise<string> {
    return this.executeWithMetrics('scheduleBooking', async () => {
      const queueId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const scheduledFor = new Date(Date.now() + delay);
      
      const queueItem: QueueItem = {
        id: queueId,
        config,
        priority: 10, // Высокий приоритет для запланированных
        scheduledFor,
        createdAt: new Date(),
        status: 'PENDING'
      };
      
      this.queue.set(queueId, queueItem);
      
      this.log('info', `Scheduled booking: ${queueId} for ${scheduledFor.toISOString()}`);
      return queueId;
    });
  }

  async rescheduleBooking(bookingId: string, newTime: Date): Promise<void> {
    return this.executeWithMetrics('rescheduleBooking', async () => {
      const queueItem = this.queue.get(bookingId);
      if (!queueItem) {
        throw new ServiceError(this.name, 'rescheduleBooking', `Queue item ${bookingId} not found`);
      }
      
      queueItem.scheduledFor = newTime;
      queueItem.status = 'PENDING';
      
      this.log('info', `Rescheduled booking: ${bookingId} for ${newTime.toISOString()}`);
    });
  }

  async getSystemHealth(): Promise<any> {
    const queueStatus = await this.getQueueStatus();
    const resources = await this.getAvailableResources();
    const autoBookingHealth = await this.autoBookingService.getHealth();
    
    return {
      status: 'healthy',
      uptime: Date.now() - (this._startTime?.getTime() || Date.now()),
      lastCheck: new Date(),
      errors: [],
      metrics: {
        queue: queueStatus,
        resources,
        autoBooking: autoBookingHealth
      }
    };
  }

  async getPerformanceMetrics(): Promise<any> {
    const autoBookingMetrics = await this.autoBookingService.getMetrics();
    const queueStatus = await this.getQueueStatus();
    const resources = await this.getAvailableResources();
    
    return {
      totalRequests: autoBookingMetrics.totalRequests,
      successfulRequests: autoBookingMetrics.successfulRequests,
      failedRequests: autoBookingMetrics.failedRequests,
      averageResponseTime: autoBookingMetrics.averageResponseTime,
      lastActivity: autoBookingMetrics.lastActivity,
      queue: queueStatus,
      resources
    };
  }

  // ============================================================================
  // ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================================

  /**
   * Получить следующий элемент из очереди
   */
  private getNextQueueItem(): QueueItem | null {
    const pendingItems = Array.from(this.queue.values())
      .filter(item => item.status === 'PENDING' && item.scheduledFor <= new Date())
      .sort((a, b) => {
        // Сначала по приоритету (больше = выше приоритет)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Затем по времени создания (раньше = выше приоритет)
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    
    return pendingItems[0] || null;
  }

  /**
   * Запуск обработчика очереди
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        this.log('error', 'Queue processor error', error);
      }
    }, 1000); // Проверяем каждую секунду
  }

  /**
   * Обработка очереди
   */
  private async processQueue(): Promise<void> {
    const resources = await this.getAvailableResources();
    
    // Если нет доступных слотов, не обрабатываем очередь
    if (resources.availableSlots <= 0) {
      return;
    }
    
    // Получаем следующий элемент из очереди
    const queueItem = this.getNextQueueItem();
    if (!queueItem) {
      return;
    }
    
    // Проверяем, есть ли доступные ресурсы
    if (this.activeBookings.size >= this.maxConcurrentBookings) {
      return;
    }
    
    // Запускаем бронирование
    await this.processBooking(queueItem);
  }

  /**
   * Обработка одного бронирования
   */
  private async processBooking(queueItem: QueueItem): Promise<void> {
    try {
      // Обновляем статус
      queueItem.status = 'IN_PROGRESS';
      this.activeBookings.add(queueItem.id);
      
      this.log('info', `Processing booking: ${queueItem.id}`);
      
      // Выполняем бронирование
      const result = await this.autoBookingService.bookSlot(queueItem.config);
      
      // Обновляем статус
      if (result.success) {
        queueItem.status = 'COMPLETED';
        this.log('info', `Booking completed successfully: ${queueItem.id}`);
      } else {
        queueItem.status = 'FAILED';
        this.log('error', `Booking failed: ${queueItem.id}`, result.error);
      }
      
    } catch (error) {
      queueItem.status = 'FAILED';
      this.log('error', `Booking error: ${queueItem.id}`, error);
    } finally {
      // Удаляем из активных бронирований
      this.activeBookings.delete(queueItem.id);
      
      // Удаляем из очереди через некоторое время
      setTimeout(() => {
        this.queue.delete(queueItem.id);
      }, 60000); // Удаляем через минуту
    }
  }

  /**
   * Получить статистику очереди
   */
  async getQueueStatistics(): Promise<{
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    priorityDistribution: Record<number, number>;
  }> {
    const items = Array.from(this.queue.values());
    const completedItems = items.filter(item => item.status === 'COMPLETED');
    const failedItems = items.filter(item => item.status === 'FAILED');
    
    const totalProcessed = completedItems.length + failedItems.length;
    const successRate = totalProcessed > 0 ? (completedItems.length / totalProcessed) * 100 : 0;
    
    // Подсчитываем распределение по приоритетам
    const priorityDistribution: Record<number, number> = {};
    for (const item of items) {
      priorityDistribution[item.priority] = (priorityDistribution[item.priority] || 0) + 1;
    }
    
    return {
      totalProcessed,
      successRate,
      averageProcessingTime: 0, // TODO: Реализовать подсчет времени обработки
      priorityDistribution
    };
  }

  /**
   * Очистить очередь
   */
  async clearQueue(): Promise<void> {
    this.queue.clear();
    this.activeBookings.clear();
    this.log('info', 'Queue cleared');
  }

  /**
   * Получить детали элемента очереди
   */
  async getQueueItemDetails(queueId: string): Promise<QueueItem | null> {
    return this.queue.get(queueId) || null;
  }

  /**
   * Обновить приоритет элемента очереди
   */
  async updateQueueItemPriority(queueId: string, newPriority: number): Promise<void> {
    const queueItem = this.queue.get(queueId);
    if (!queueItem) {
      throw new ServiceError(this.name, 'updateQueueItemPriority', `Queue item ${queueId} not found`);
    }
    
    queueItem.priority = newPriority;
    this.log('info', `Updated priority for queue item ${queueId}: ${newPriority}`);
  }
}
