import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { addJob } from '@/lib/queue';

export function createStopTaskWorker() {
  const worker = new Worker(
    'stop-task',
    async (job: Job) => {
      const { taskId } = job.data;
      console.log(`Stopping task ${taskId}...`);

      try {
        // Обновляем статус всех активных запусков задачи на CANCELLED
        await prisma.run.updateMany({
          where: {
            taskId,
            status: {
              in: ['QUEUED', 'RUNNING'],
            },
          },
          data: {
            status: 'CANCELLED',
            finishedAt: new Date(),
          },
        });

        // Создаем лог остановки
        const runs = await prisma.run.findMany({
          where: { taskId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        if (runs.length > 0) {
          await prisma.runLog.create({
            data: {
              runId: runs[0].id,
              level: 'INFO',
              message: 'Задача остановлена пользователем',
              meta: {
                stoppedBy: 'user',
                stoppedAt: new Date().toISOString(),
              },
            },
          });
        }

        console.log(`Task ${taskId} stopped successfully`);
      } catch (error) {
        console.error(`Error stopping task ${taskId}:`, error);
        throw error;
      }
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Stop task job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Stop task job ${job?.id} failed:`, err);
  });

  return worker;
}

