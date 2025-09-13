import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

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

    // Получаем найденные слоты для этой задачи
    const foundSlots = await prisma.foundSlot.findMany({
      where: {
        run: {
          taskId: taskId,
        },
        userId: user.id, // Дополнительная проверка изоляции
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
        createdAt: 'desc',
      },
    });

    // Группируем слоты по запускам
    const slotsByRun = foundSlots.reduce((acc, slot) => {
      const runId = slot.runId;
      if (!acc[runId]) {
        acc[runId] = {
          run: slot.run,
          slots: [],
        };
      }
      acc[runId].slots.push(slot);
      return acc;
    }, {} as Record<string, { run: any; slots: any[] }>);

    return NextResponse.json({
      success: true,
      data: {
        foundSlots,
        slotsByRun,
        totalSlots: foundSlots.length,
        totalRuns: Object.keys(slotsByRun).length,
      },
    });
  } catch (error) {
    console.error('Get task slots error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
