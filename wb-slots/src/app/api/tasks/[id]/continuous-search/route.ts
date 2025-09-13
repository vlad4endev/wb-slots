import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { continuousSlotSearchService } from '@/lib/services/continuous-slot-search-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🚀 POST /api/tasks/[id]/continuous-search - Starting continuous search request');
    const user = await requireAuth(request);
    const { id: taskId } = await params;
    
    console.log(`🔍 User: ${user.id}, Task ID: ${taskId}`);

    // Проверяем, существует ли задача
    const task = await prisma.task.findUnique({
      where: { id: taskId, userId: user.id },
    });

    if (!task) {
      console.log(`❌ Task not found: ${taskId}`);
      return NextResponse.json({
        success: false,
        error: 'Task not found',
      }, { status: 404 });
    }

    console.log(`✅ Task found: ${task.name} (${task.taskNumber})`);

    // Проверяем, не запущен ли уже поиск
    const isSearchInProgress = continuousSlotSearchService.isSearchInProgress();
    console.log(`🔍 Search in progress: ${isSearchInProgress}`);
    
    if (isSearchInProgress) {
      console.log(`⚠️ Search already in progress, rejecting request`);
      return NextResponse.json({
        success: false,
        error: 'Search is already in progress',
      }, { status: 409 });
    }

    // Создаем новый run
    console.log('📝 Creating new run for task...');
    const run = await prisma.run.create({
      data: {
        taskId: task.id,
        userId: user.id,
        status: 'QUEUED',
        startedAt: new Date(),
      },
    });
    console.log(`✅ Run created: ${run.id}`);

    // Парсим фильтры задачи
    const filters = task.filters as any;
    console.log('🔧 Task filters:', filters);

    // Создаем конфигурацию поиска
    const searchConfig = {
      taskId: task.id,
      userId: user.id,
      runId: run.id,
      warehouseIds: filters.warehouseIds || [],
      boxTypeIds: filters.boxTypeIds || [2, 5],
      coefficientMin: filters.coefficientMin || 0,
      coefficientMax: filters.coefficientMax || 20,
      dateFrom: filters.dates?.from || new Date().toISOString(),
      dateTo: filters.dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isSortingCenter: filters.isSortingCenter || false,
      maxSearchCycles: 1000,
      searchDelay: 30000,
      maxExecutionTime: 7 * 24 * 60 * 60 * 1000,
      autoBook: task.autoBook || false,
      autoBookSupplyId: task.autoBookSupplyId || '',
      // Параметры циклического поиска (используем значения по умолчанию)
      continueUntilFound: true,
      minSlotsRequired: 1,
      maxConsecutiveEmptyCycles: 10,
    };

    // Запускаем поиск асинхронно
    console.log('⚙️ Search config:', searchConfig);
    console.log('🚀 Starting continuous search asynchronously for task:', task.taskNumber);
    continuousSlotSearchService.startContinuousSearch(searchConfig).catch(error => {
      console.error('❌ Continuous search error:', error);
    });

    return NextResponse.json({
      success: true,
      data: {
        runId: run.id,
        taskNumber: task.taskNumber,
        searchConfig,
      },
      message: `Continuous search started for task #${task.taskNumber}`,
    });

  } catch (error) {
    console.error('Start continuous search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;

    // Проверяем, существует ли задача
    const task = await prisma.task.findUnique({
      where: { id: taskId, userId: user.id },
    });

    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task not found',
      }, { status: 404 });
    }

    // Останавливаем поиск
    await continuousSlotSearchService.stopSearch();

    return NextResponse.json({
      success: true,
      message: `Continuous search stopped for task #${task.taskNumber}`,
    });

  } catch (error) {
    console.error('Stop continuous search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;

    // Проверяем, существует ли задача
    const task = await prisma.task.findUnique({
      where: { id: taskId, userId: user.id },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            logs: {
              orderBy: { ts: 'desc' },
              take: 50,
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task not found',
      }, { status: 404 });
    }

    const isSearchInProgress = continuousSlotSearchService.isSearchInProgress();
    const currentSearchId = continuousSlotSearchService.getCurrentSearchId();

    // Получаем найденные слоты для текущего запуска
    const currentRun = task.runs[0]; // Самый последний запуск
    let foundSlots: any[] = [];
    if (currentRun) {
      foundSlots = await prisma.foundSlot.findMany({
        where: { runId: currentRun.id },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        task: {
          id: task.id,
          taskNumber: task.taskNumber,
          name: task.name,
          status: task.status,
          autoBook: task.autoBook,
          autoBookSupplyId: task.autoBookSupplyId,
          filters: task.filters,
        },
        search: {
          isInProgress: isSearchInProgress,
          currentSearchId,
          isThisTaskSearching: currentSearchId === taskId,
          foundSlotsCount: foundSlots.length,
        },
        runs: task.runs.map(run => ({
          id: run.id,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          foundSlots: run.foundSlots,
          summary: run.summary,
          logsCount: run.logs.length,
          recentLogs: run.logs.slice(0, 10).map(log => ({
            level: log.level,
            message: log.message,
            ts: log.ts,
            meta: log.meta,
          })),
        })),
        foundSlots: foundSlots.map(slot => ({
          id: slot.id,
          warehouseId: slot.warehouseId,
          warehouseName: slot.warehouseName,
          date: slot.date,
          timeSlot: slot.timeSlot,
          coefficient: slot.coefficient,
          available: slot.available,
          boxTypes: slot.boxTypes,
          createdAt: slot.createdAt,
        })),
      },
    });

  } catch (error) {
    console.error('Get continuous search status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
