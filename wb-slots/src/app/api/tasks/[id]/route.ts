import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { addJob } from '@/lib/queue';
import { createApiHandler } from '@/lib/errors/error-handling-middleware';
import { updateTaskSchema, TaskFilters, RetryPolicy } from '@/lib/validation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
// import { TaskStatus } from '@prisma/client';

// Схема для POST action
const taskActionSchema = z.object({
  action: z.enum(['start', 'stop'], {
    errorMap: () => ({ message: 'Action must be either "start" or "stop"' })
  })
});

// GET handler без try-catch
const getHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireAuth(request);
  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      runs: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          foundSlotsDetails: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
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
    data: taskWithFilters,
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/tasks/[id]',
    method: 'GET'
  })
});

// PUT handler без try-catch
const putHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireAuth(request);
  const { id: taskId } = await params;
  const body = await request.json();

  // Валидация с использованием Zod
  const validatedData = updateTaskSchema.parse(body);

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

  // Подготовка данных для обновления с учетом валидированных значений
  const updateData: Prisma.TaskUpdateInput = {
    updatedAt: new Date(),
  };

  if (validatedData.name !== undefined) {
    updateData.name = validatedData.name.trim();
  }
  if (validatedData.description !== undefined) {
    updateData.description = validatedData.description?.trim() || null;
  }
  if (validatedData.autoBook !== undefined) {
    updateData.autoBook = validatedData.autoBook;
  }
  if (validatedData.autoBookSupplyId !== undefined) {
    updateData.autoBookSupplyId = validatedData.autoBookSupplyId?.trim() || null;
  }
  if (validatedData.filters !== undefined) {
    updateData.filters = validatedData.filters;
  }
  if (validatedData.retryPolicy !== undefined) {
    updateData.retryPolicy = validatedData.retryPolicy;
  }
  if (validatedData.priority !== undefined) {
    updateData.priority = validatedData.priority;
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    message: 'Задача обновлена успешно',
    data: { task: updatedTask },
  });
};

export const PUT = createApiHandler(putHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/tasks/[id]',
    method: 'PUT'
  })
});

// POST handler без try-catch
const postHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireAuth(request);
  const { id: taskId } = await params;
  const body = await request.json();
  
  // Валидация action с использованием Zod
  const { action } = taskActionSchema.parse(body);

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
};

export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/tasks/[id]',
    method: 'POST'
  })
});

// DELETE handler без try-catch
const deleteHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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
};

export const DELETE = createApiHandler(deleteHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/tasks/[id]',
    method: 'DELETE'
  })
});