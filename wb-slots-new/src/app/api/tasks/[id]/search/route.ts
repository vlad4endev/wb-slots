import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addJob } from '@/lib/queue';
import { z } from 'zod';

const searchSlotsSchema = z.object({
  forceSearch: z.boolean().default(false), // Принудительный поиск
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;
    const body = await request.json();
    const validatedData = searchSlotsSchema.parse(body);

    // Проверяем существование задачи
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

    // Проверяем, что задача активна
    if (!task.enabled) {
      return NextResponse.json(
        { success: false, error: 'Задача неактивна' },
        { status: 400 }
      );
    }

    // Проверяем, что есть склады для поиска
    if (!task.filters.warehouseIds || task.filters.warehouseIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Не выбраны склады для поиска' },
        { status: 400 }
      );
    }

    // Проверяем, не выполняется ли уже поиск
    const activeRun = await prisma.run.findFirst({
      where: {
        taskId,
        status: 'RUNNING',
      },
    });

    if (activeRun && !validatedData.forceSearch) {
      return NextResponse.json(
        { success: false, error: 'Поиск уже выполняется для этой задачи' },
        { status: 409 }
      );
    }

    // Подготавливаем параметры поиска
    const searchConfig = {
      userId: user.id,
      taskId,
      warehouseIds: task.filters.warehouseIds,
      coefficientMin: task.filters.coefficientMin || 0,
      coefficientMax: task.filters.coefficientMax || 20,
      dateFrom: task.filters.dates?.from || new Date().toISOString(),
      dateTo: task.filters.dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      stopOnFirstFound: true, // По умолчанию останавливаемся при первом найденном слоте
    };

    // Создаем запись о запуске
    const run = await prisma.run.create({
      data: {
        taskId,
        userId: user.id,
        status: 'RUNNING',
        startedAt: new Date(),
        summary: {
          searchConfig,
        },
      },
    });

      // Добавляем задачу поиска в очередь
      const job = await addJob('scan-slots', {
        taskId,
        userId: user.id,
        runId: run.id,
      });

    return NextResponse.json({
      success: true,
      message: 'Поиск слотов запущен',
      data: {
        jobId: job.id,
        taskId,
        estimatedDuration: '2-5 минут',
        warehouses: task.filters.warehouseIds.length,
      },
    });

  } catch (error) {
    console.error('Search slots error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Ошибка валидации данных' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
