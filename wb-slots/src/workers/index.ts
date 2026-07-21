import { TaskScheduler } from '@/lib/scheduler';
import { scanSlotsWorker, bookSlotWorker, notifyWorker, monitorWorker } from '@/lib/queue';
import { SlotSearchWorker } from './slot-search-worker';
import { createStopTaskWorker } from './stop-task-worker';
import { createConnection } from '@/lib/queue';
import { logger } from '@/lib/logging';

logger.info('Starting WB Slots workers...');

// Initialize scheduler
const scheduler = TaskScheduler.getInstance();

// Initialize workers
const connection = createConnection();
const slotSearchWorker = new SlotSearchWorker(connection);
const stopTaskWorker = createStopTaskWorker();

// Start scheduler
scheduler.start().catch((error) => {
  logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start scheduler');
});

// Log worker status
logger.info('Workers started:', {
  workers: [
    'Scan slots worker',
    'Book slot worker',
    'Notify worker',
    'Monitor worker',
    'Slot search worker',
    'Stop task worker',
    'Task scheduler'
  ]
});

// Keep the process alive
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down workers...');
  await scheduler.stop();
  await slotSearchWorker.close();
  await stopTaskWorker.close();
  await monitorWorker.close();
  logger.info('Workers shut down successfully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down workers...');
  await scheduler.stop();
  await slotSearchWorker.close();
  await stopTaskWorker.close();
  await monitorWorker.close();
  logger.info('Workers shut down successfully');
  process.exit(0);
});
