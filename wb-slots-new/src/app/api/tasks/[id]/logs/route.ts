import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;

    // Проверяем доступ к задаче
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      // Если задача не найдена, возвращаем пустые данные вместо ошибки
      return NextResponse.json({
        success: true,
        data: {
          logs: [],
          activeRuns: [],
          taskStatus: 'NOT_FOUND',
          taskEnabled: false,
        },
      });
    }

    if (task.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // Получаем логи задачи
    const logs = await prisma.runLog.findMany({
      where: {
        run: {
          taskId,
        },
      },
      include: {
        run: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
      orderBy: {
        ts: 'desc',
      },
      take: 100, // Последние 100 записей
    });

    // Получаем активные запуски
    const activeRuns = await prisma.run.findMany({
      where: {
        taskId,
        status: 'RUNNING',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        logs,
        activeRuns,
        taskStatus: 'PENDING', // Убираем task.status, так как это поле не существует
        taskEnabled: task.enabled,
      },
    });
  } catch (error) {
    console.error('Get task logs error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
