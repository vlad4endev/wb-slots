import { AutoBookingWorker, BookingResult } from './auto-booking-worker';
import { AutoBookingConfig, BookingParams } from './config';

export interface AutoBookingTask {
  id: string;
  userId: string;
  taskId: string;
  supplyId: string;
  slotFilters: BookingParams['slotFilters'];
  credentials?: BookingParams['credentials'];
  config: Partial<AutoBookingConfig>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: BookingResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export class AutoBookingService {
  private tasks: Map<string, AutoBookingTask> = new Map();
  private workers: Map<string, AutoBookingWorker> = new Map();

  async createBookingTask(
    userId: string,
    taskId: string,
    supplyId: string,
    slotFilters: BookingParams['slotFilters'],
    credentials?: BookingParams['credentials'],
    config: Partial<AutoBookingConfig> = {}
  ): Promise<string> {
    const bookingTaskId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bookingTask: AutoBookingTask = {
      id: bookingTaskId,
      userId,
      taskId,
      supplyId,
      slotFilters,
      credentials,
      config,
      status: 'pending',
      createdAt: new Date(),
    };

    this.tasks.set(bookingTaskId, bookingTask);
    
    console.log(`📦 Auto-booking task created: ${bookingTaskId} for supply: ${supplyId}`);
    
    return bookingTaskId;
  }

  async executeBookingTask(bookingTaskId: string, taskName: string = '', supplyName: string = ''): Promise<BookingResult> {
    const task = this.tasks.get(bookingTaskId);
    if (!task) {
      throw new Error(`Booking task not found: ${bookingTaskId}`);
    }

    if (task.status !== 'pending') {
      throw new Error(`Booking task is not in pending status: ${task.status}`);
    }

    try {
      task.status = 'running';
      task.startedAt = new Date();

      console.log(`🚀 Starting auto-booking execution: ${bookingTaskId}`);

      const worker = new AutoBookingWorker(task.config);
      this.workers.set(bookingTaskId, worker);

      const params: BookingParams = {
        supplyId: task.supplyId,
        slotFilters: task.slotFilters,
        credentials: task.credentials,
      };

      const result = await worker.executeBooking(params, task.userId, taskName, supplyName);
      
      task.status = result.success ? 'completed' : 'failed';
      task.result = result;
      task.completedAt = new Date();

      console.log(`✅ Auto-booking completed: ${bookingTaskId}`, {
        success: result.success,
        executionTime: result.executionTime,
        screenshots: result.screenshots?.length || 0,
        logs: result.logs?.length || 0,
      });

      return result;

    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.result = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [],
        screenshots: [],
        executionTime: 0,
      };

      console.error(`❌ Auto-booking failed: ${bookingTaskId}`, error);
      
      return task.result;
    } finally {
      // Clean up worker
      const worker = this.workers.get(bookingTaskId);
      if (worker) {
        await worker.cleanup();
        this.workers.delete(bookingTaskId);
      }
    }
  }

  async getBookingTask(bookingTaskId: string): Promise<AutoBookingTask | null> {
    return this.tasks.get(bookingTaskId) || null;
  }

  async getBookingTasksByUser(userId: string): Promise<AutoBookingTask[]> {
    return Array.from(this.tasks.values()).filter(task => task.userId === userId);
  }

  async getBookingTasksByTask(taskId: string): Promise<AutoBookingTask[]> {
    return Array.from(this.tasks.values()).filter(task => task.taskId === taskId);
  }

  async cancelBookingTask(bookingTaskId: string): Promise<boolean> {
    const task = this.tasks.get(bookingTaskId);
    if (!task) {
      return false;
    }

    if (task.status === 'running') {
      const worker = this.workers.get(bookingTaskId);
      if (worker) {
        await worker.cleanup();
        this.workers.delete(bookingTaskId);
      }
    }

    task.status = 'failed';
    task.completedAt = new Date();
    task.result = {
      success: false,
      error: 'Task cancelled',
      logs: [],
      screenshots: [],
      executionTime: 0,
    };

    console.log(`🛑 Auto-booking task cancelled: ${bookingTaskId}`);
    return true;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up auto-booking service...');
    
    // Cancel all running tasks
    for (const [id, task] of this.tasks) {
      if (task.status === 'running') {
        await this.cancelBookingTask(id);
      }
    }

    // Clean up all workers
    for (const [id, worker] of this.workers) {
      await worker.cleanup();
    }
    
    this.workers.clear();
    console.log('✅ Auto-booking service cleaned up');
  }

  // Get statistics
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const tasks = Array.from(this.tasks.values());
    
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    };
  }
}

// Singleton instance
export const autoBookingService = new AutoBookingService();
