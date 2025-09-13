import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { addJob } from '@/lib/queue';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;
    const body = await request.json();
    const { checkInterval = 5000, maxAttempts = 100 } = body;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Задача не найдена' },
        { status: 404 }
      );
    }

    if (task.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // Создаем новый запуск для мониторинга
    const run = await prisma.run.create({
      data: {
        taskId,
        status: 'QUEUED',
        startedAt: new Date(),
        summary: {
          checkInterval,
          maxAttempts,
          type: 'monitor',
        },
      },
    });

    // Добавляем задачу мониторинга в очередь
    await addJob('slot-monitor', { 
      taskId, 
      runId: run.id,
      userId: user.id,
      checkInterval,
      maxAttempts 
    }, { delay: 1000 });

    return NextResponse.json({
      success: true,
      message: 'Мониторинг слотов запущен',
      data: {
        runId: run.id,
        checkInterval,
        maxAttempts,
        estimatedDuration: `${Math.ceil(maxAttempts * checkInterval / 1000 / 60)} минут`,
      },
    });
  } catch (error) {
    console.error('Monitor task error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}