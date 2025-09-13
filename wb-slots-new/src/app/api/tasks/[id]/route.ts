import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { addJob } from '@/lib/queue';
// import { TaskStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        runs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { runs: true },
        },
      },
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

    // Убеждаемся, что filters всегда является объектом, а runs - массивом
    const taskWithFilters = {
      ...task,
      filters: task.filters || {},
      runs: task.runs || []
    };

    return NextResponse.json({
      success: true,
      data: { task: taskWithFilters },
    });
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;
    const body = await request.json();

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

    // Валидация данных
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Название задачи обязательно' },
        { status: 400 }
      );
    }

    if (!body.filters.warehouseIds || body.filters.warehouseIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Необходимо выбрать хотя бы один склад' },
        { status: 400 }
      );
    }

    if (!body.filters.boxTypeIds || body.filters.boxTypeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Необходимо выбрать хотя бы один тип поставки' },
        { status: 400 }
      );
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        autoBook: body.autoBook || false,
        autoBookSupplyId: body.autoBookSupplyId?.trim() || null,
        filters: body.filters,
        retryPolicy: body.retryPolicy || {
          maxRetries: 3,
          backoffMs: 5000
        },
        priority: body.priority || 1,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Задача обновлена успешно',
      data: { task: updatedTask },
    });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;
    const body = await request.json();
    const { action } = body;

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

    if (action === 'stop') {
      // Останавливаем задачу
      await prisma.task.update({
        where: { id: taskId },
        data: { 
          enabled: false,
        },
      });

      // Добавляем задачу остановки в очередь
      await addJob('stop-task', { taskId, userId: user.id }, { delay: 1000 });

      return NextResponse.json({
        success: true,
        message: 'Задача остановлена',
      });
    }

    if (action === 'start') {
      // Создаем Run запись для логирования
      const run = await prisma.run.create({
        data: {
          taskId: taskId,
          userId: user.id,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      // Запускаем задачу
      await prisma.task.update({
        where: { id: taskId },
        data: {
          enabled: true,
        },
      });

      // Добавляем задачу поиска в очередь с runId
      await addJob('scan-slots', {
        taskId,
        userId: user.id,
        runId: run.id
      }, { delay: 1000 });

      return NextResponse.json({
        success: true,
        message: 'Задача запущена с SlotSearchService',
        runId: run.id,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Неизвестное действие' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Task action error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;

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

    // Удаляем задачу и все связанные данные (каскадное удаление)
    await prisma.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({
      success: true,
      message: 'Задача успешно удалена',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}