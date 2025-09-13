import { TaskScheduler } from '@/lib/scheduler';
import { scanSlotsWorker, bookSlotWorker, notifyWorker, monitorWorker } from '@/lib/queue';
import { AutoBookingWorker } from './auto-booking-worker';
import { SlotSearchWorker } from './slot-search-worker';
import { createStopTaskWorker } from './stop-task-worker';
import { createConnection } from '@/lib/queue';

console.log('Starting WB Slots workers...');

// Initialize scheduler
const scheduler = TaskScheduler.getInstance();

// Initialize workers
const connection = createConnection();
const autoBookingWorker = new AutoBookingWorker(connection);
const slotSearchWorker = new SlotSearchWorker(connection);
const stopTaskWorker = createStopTaskWorker();

// Start scheduler
scheduler.start().catch(console.error);

// Log worker status
console.log('Workers started:');
console.log('- Scan slots worker');
console.log('- Book slot worker');
console.log('- Notify worker');
console.log('- Monitor worker');
console.log('- Auto-booking worker');
console.log('- Slot search worker');
console.log('- Stop task worker');
console.log('- Task scheduler');

// Keep the process alive
process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await scheduler.stop();
  await autoBookingWorker.close();
  await slotSearchWorker.close();
  await stopTaskWorker.close();
  await monitorWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await scheduler.stop();
  await autoBookingWorker.close();
  await slotSearchWorker.close();
  await stopTaskWorker.close();
  await monitorWorker.close();
  process.exit(0);
});
