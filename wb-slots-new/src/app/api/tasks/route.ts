import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createTaskSchema, paginationSchema } from '@/lib/validation';
import { TaskScheduler } from '@/lib/scheduler';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { continuousSlotSearchService } from '@/lib/services/continuous-slot-search-service';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

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
  } catch (error) {
    console.error('Get tasks error:', error);
    
    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = createTaskSchema.parse(body);

    // Create task
    const task = await prisma.task.create({
      data: {
        ...validatedData,
        userId: user.id,
      },
      include: {
        _count: {
          select: { runs: true },
        },
      },
    });

    // Schedule task if it has a cron expression and is enabled
    if (task.scheduleCron && task.enabled) {
      const scheduler = TaskScheduler.getInstance();
      await scheduler.scheduleTask(task);
    }

    // Создаем run для отслеживания выполнения задачи
    const run = await prisma.run.create({
      data: {
        taskId: task.id,
        userId: user.id,
        status: 'QUEUED',
        startedAt: new Date(),
      },
    });

    // Автоматически запускаем непрерывный поиск слотов для новой задачи
    try {
      // Парсим фильтры задачи
      const filters = task.filters as any;
      
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
      };

      // Запускаем поиск асинхронно
      continuousSlotSearchService.startContinuousSearch(searchConfig).catch(error => {
        console.error('Continuous search error:', error);
      });

    } catch (error) {
      console.error('Error starting continuous slot search:', error);
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
  } catch (error) {
    console.error('Create task error:', error);

    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
