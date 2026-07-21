import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createTaskSchema, paginationSchema, TaskFilters } from '@/lib/validation';
import { z } from 'zod';
import { TaskScheduler } from '@/lib/scheduler';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { continuousSlotSearchService } from '@/lib/services/continuous-slot-search-service';
import { logger } from '@/lib/logging';
import { createApiHandler } from '@/lib/errors/error-handling-middleware';

// GET handler без try-catch - обработка ошибок через middleware
const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  
  // Валидация query параметров с использованием Zod
  const queryData = paginationSchema.parse({
    page: searchParams.get('page') || '1',
    limit: searchParams.get('limit') || '20',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });
  
  const page = queryData.page;
  const limit = queryData.limit;
  const sortBy = queryData.sortBy || 'createdAt';
  const sortOrder = queryData.sortOrder;

  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      runs: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { runs: true },
      },
    },
  });

  const total = await prisma.task.count({
    where: { userId: user.id },
  });

  return NextResponse.json({
    success: true,
    data: {
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/tasks',
    method: 'GET'
  })
});

// POST handler без try-catch - обработка ошибок через middleware
const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const validatedData = createTaskSchema.parse(body);

  // Create task and run in a transaction for atomicity
  const [task, run] = await prisma.$transaction(async (tx) => {
    // Create task
    const newTask = await tx.task.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || '',
        enabled: validatedData.enabled,
        autoBook: validatedData.autoBook,
        autoBookSupplyId: validatedData.autoBookSupplyId || '',
        preorderID: validatedData.preorderID || '', // Сохраняем preorderID
        chosenSupplyId: validatedData.autoBookSupplyId || '', // Сохраняем выбранную поставку
        filters: validatedData.filters,
        retryPolicy: validatedData.retryPolicy,
        priority: validatedData.priority,
        scheduleCron: validatedData.scheduleCron,
        userId: user.id,
      },
      include: {
        _count: {
          select: { runs: true },
        },
      },
    });

    // Create run for tracking task execution
    const newRun = await tx.run.create({
      data: {
        taskId: newTask.id,
        userId: user.id,
        status: 'QUEUED',
        startedAt: new Date(),
      },
    });

    return [newTask, newRun];
  });

  // Schedule task if it has a cron expression and is enabled
  if (task.scheduleCron && task.enabled) {
    const scheduler = TaskScheduler.getInstance();
    await scheduler.scheduleTask(task);
  }

  // Автоматически запускаем непрерывный поиск слотов для новой задачи
  // Ошибки запуска поиска не прерывают создание задачи
  try {
    // Парсим фильтры задачи - используем безопасную проверку типов
    const filters = task.filters as unknown as TaskFilters;
    
    // Запускаем непрерывный поиск в фоновом режиме
    const searchConfig = {
      taskId: task.id,
      userId: user.id,
      runId: run.id,
      warehouseIds: filters.warehouseIds || [],
      boxTypeIds: filters.boxTypeIds || [2, 5], // Типы поставки по умолчанию: Короба и Монопаллеты
      coefficientMin: filters.coefficientMin || 0,
      coefficientMax: filters.coefficientMax || 20,
      dateFrom: filters.dates?.from || new Date().toISOString(),
      dateTo: filters.dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isSortingCenter: filters.isSortingCenter || false,
      maxSearchCycles: 1000, // Максимум 1000 циклов поиска
      searchDelay: 30000, // 30 секунд между поисками
      maxExecutionTime: 7 * 24 * 60 * 60 * 1000, // 7 дней максимум
      autoBook: task.autoBook || false,
      autoBookSupplyId: task.autoBookSupplyId || '',
      chosenSupplyId: task.chosenSupplyId || '',
    };

    // Запускаем поиск асинхронно
    continuousSlotSearchService.startContinuousSearch(searchConfig).catch(error => {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        taskId: task.id
      }, 'Continuous search error');
    });

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      taskId: task.id
    }, 'Error starting continuous slot search');
    // Не прерываем создание задачи, если не удалось запустить поиск
  }

  return NextResponse.json({
    success: true,
    data: { 
      task: {
        ...task,
        taskNumber: task.taskNumber, // Включаем номер задачи в ответ
      },
      runId: run.id,
    },
    message: `Task #${task.taskNumber} created successfully and continuous slot search started`,
  });
};

export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/tasks',
    method: 'POST'
  })
});
