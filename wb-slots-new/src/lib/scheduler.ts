import { Queue } from 'bullmq';
import { scanSlotsQueue } from './queue';
import { prisma } from './prisma';
import { Task } from '@prisma/client';
import cron from 'cron-parser';

export class TaskScheduler {
  private static instance: TaskScheduler;
  private scheduledJobs: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  /**
   * Start the scheduler
   */
  public async start(): Promise<void> {
    console.log('Starting task scheduler...');
    
    // Load all enabled tasks with cron schedules
    const tasks = await prisma.task.findMany({
      where: {
        enabled: true,
        scheduleCron: {
          not: null,
        },
      },
    });

    // Schedule each task
    for (const task of tasks) {
      await this.scheduleTask(task);
    }

    console.log(`Scheduled ${tasks.length} tasks`);
  }

  /**
   * Schedule a single task
   */
  public async scheduleTask(task: Task): Promise<void> {
    if (!task.scheduleCron || !task.enabled) {
      return;
    }

    try {
      // Validate cron expression
      cron.parseString(task.scheduleCron);
    } catch (error) {
      console.error(`Invalid cron expression for task ${task.id}: ${task.scheduleCron}`, error);
      return;
    }

    // Cancel existing job if any
    await this.cancelTask(task.id);

    // Create new scheduled job
    const job = await scanSlotsQueue.add(
      'scheduled-scan',
      {
        taskId: task.id,
        userId: task.userId,
        runId: '', // Will be generated when job runs
      },
      {
        repeat: {
          pattern: task.scheduleCron,
        },
        jobId: `task-${task.id}`,
      }
    );

    this.scheduledJobs.set(task.id, job);
    console.log(`Scheduled task ${task.id} with cron: ${task.scheduleCron}`);
  }

  /**
   * Cancel a scheduled task
   */
  public async cancelTask(taskId: string): Promise<void> {
    const job = this.scheduledJobs.get(taskId);
    if (job) {
      await job.remove();
      this.scheduledJobs.delete(taskId);
      console.log(`Cancelled scheduled task ${taskId}`);
    }
  }

  /**
   * Update a scheduled task
   */
  public async updateTask(task: Task): Promise<void> {
    await this.cancelTask(task.id);
    await this.scheduleTask(task);
  }

  /**
   * Run a task immediately
   */
  public async runTaskNow(taskId: string, userId: string): Promise<string> {
    // Create a new run record
    const run = await prisma.run.create({
      data: {
        taskId,
        userId,
        status: 'QUEUED',
        startedAt: new Date(),
      },
    });

    // Queue the job
    await scanSlotsQueue.add(
      'manual-scan',
      {
        taskId,
        userId,
        runId: run.id,
      },
      {
        priority: 10, // Higher priority for manual runs
      }
    );

    console.log(`Queued manual run for task ${taskId}, run ID: ${run.id}`);
    return run.id;
  }

  /**
   * Get all scheduled tasks
   */
  public getScheduledTasks(): string[] {
    return Array.from(this.scheduledJobs.keys());
  }

  /**
   * Stop the scheduler
   */
  public async stop(): Promise<void> {
    console.log('Stopping task scheduler...');
    
    // Cancel all scheduled jobs
    for (const [taskId, job] of this.scheduledJobs) {
      await job.remove();
    }
    
    this.scheduledJobs.clear();
    console.log('Task scheduler stopped');
  }

  /**
   * Validate cron expression
   */
  public static validateCronExpression(cronExpression: string): boolean {
    try {
      cron.parseString(cronExpression);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get next execution time for a cron expression
   */
  public static getNextExecutionTime(cronExpression: string): Date | null {
    try {
      const interval = cron.parseString(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      return null;
    }
  }

  /**
   * Get common cron presets
   */
  public static getCronPresets(): Record<string, string> {
    return {
      'Every minute': '* * * * *',
      'Every 5 minutes': '*/5 * * * *',
      'Every 10 minutes': '*/10 * * * *',
      'Every 15 minutes': '*/15 * * * *',
      'Every 30 minutes': '*/30 * * * *',
      'Every hour': '0 * * * *',
      'Every 2 hours': '0 */2 * * *',
      'Every 6 hours': '0 */6 * * *',
      'Every 12 hours': '0 */12 * * *',
      'Daily at midnight': '0 0 * * *',
      'Daily at 6 AM': '0 6 * * *',
      'Daily at 9 AM': '0 9 * * *',
      'Daily at 6 PM': '0 18 * * *',
      'Weekdays at 9 AM': '0 9 * * 1-5',
      'Weekends at 10 AM': '0 10 * * 6,0',
    };
  }
}
