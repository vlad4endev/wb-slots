import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { createConnection } from '@/lib/queue';
import { logger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, taskId, supplyId, slot, priority = 0, delay = 0 } = body;

    if (!userId || !taskId || !supplyId || !slot) {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные параметры' },
        { status: 400 }
      );
    }

    logger.info(`Добавление задачи бронирования в очередь: taskId=${taskId}`);

    // Создаем очередь
    const connection = createConnection();
    const queue = new Queue('playwright-auto-booking', { connection });

    // Добавляем задачу в очередь
    const job = await queue.add(
      'book-slot',
      {
        userId,
        taskId,
        supplyId,
        slot,
      },
      {
        priority,
        delay,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    logger.info(`Задача добавлена в очередь: ${job.id}`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Задача добавлена в очередь бронирования',
    });

  } catch (error) {
    logger.error('Ошибка добавления задачи в очередь:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const connection = createConnection();
    const queue = new Queue('playwright-auto-booking', { connection });

    // Получаем статистику очереди
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    let userJobs = null;
    if (userId) {
      // Фильтруем задачи по пользователю
      const allJobs = [...waiting, ...active, ...completed, ...failed];
      userJobs = allJobs.filter(job => job.data.userId === userId);
    }

    return NextResponse.json({
      success: true,
      stats: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length,
      },
      userJobs: userJobs ? await Promise.all(userJobs.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        state: await job.getState(),
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
      }))) : null,
    });

  } catch (error) {
    logger.error('Ошибка получения статистики очереди:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const userId = searchParams.get('userId');

    if (!jobId && !userId) {
      return NextResponse.json(
        { error: 'Необходимо указать jobId или userId' },
        { status: 400 }
      );
    }

    const connection = createConnection();
    const queue = new Queue('playwright-auto-booking', { connection });

    if (jobId) {
      // Удаляем конкретную задачу
      const job = await queue.getJob(jobId);
      if (!job) {
        return NextResponse.json(
          { error: 'Задача не найдена' },
          { status: 404 }
        );
      }

      await job.remove();
      logger.info(`Задача ${jobId} удалена`);

      return NextResponse.json({
        success: true,
        message: 'Задача удалена',
      });
    } else if (userId) {
      // Удаляем все задачи пользователя
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const allJobs = [...waiting, ...active];
      const userJobs = allJobs.filter(job => job.data.userId === userId);

      for (const job of userJobs) {
        await job.remove();
      }

      logger.info(`Удалено ${userJobs.length} задач пользователя ${userId}`);

      return NextResponse.json({
        success: true,
        message: `Удалено ${userJobs.length} задач`,
        deletedCount: userJobs.length,
      });
    }

  } catch (error) {
    logger.error('Ошибка удаления задач:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
