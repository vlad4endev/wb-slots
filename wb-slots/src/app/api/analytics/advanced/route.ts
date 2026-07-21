import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createApiHandler } from '@/lib/errors/error-handling-middleware';
import { analyticsQuerySchema } from '@/lib/validation';
import { Run } from '@prisma/client';

// Отключаем prerendering для этого API route
export const dynamic = 'force-dynamic';

// GET handler без try-catch
const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);

  const { searchParams } = new URL(request.url);
  
  // Валидация query параметров с использованием Zod
  const queryData = analyticsQuerySchema.parse({
    timeRange: searchParams.get('timeRange') || 'week',
    userId: searchParams.get('userId'),
    page: searchParams.get('page') || '1',
    limit: searchParams.get('limit') || '100',
  });
  
  const timeRange = queryData.timeRange;
  const userId = queryData.userId || user.id;
  const page = queryData.page;
  const maxLimit = 500; // Максимальный лимит для безопасности
  const safeLimit = Math.min(queryData.limit, maxLimit);

  // Calculate date range
  const now = new Date();
  let dateFrom: Date;
  
  switch (timeRange) {
    case 'day':
      dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  // Get overview metrics
  const totalTasks = await prisma.task.count({
    where: { userId }
  });

  const activeTasks = await prisma.task.count({
    where: { 
      userId,
      enabled: true,
      status: 'ACTIVE'
    }
  });

  const completedTasks = await prisma.task.count({
    where: { 
      userId,
      status: 'COMPLETED'
    }
  });

  // Get runs data with pagination and optimized query
  const runs = await prisma.run.findMany({
    where: {
      userId,
      startedAt: { gte: dateFrom }
    },
    include: {
      task: {
        select: {
          id: true,
          name: true,
          status: true,
          taskNumber: true
        }
      },
      foundSlots: {
        take: 10, // Ограничиваем количество foundSlots для каждого run
        orderBy: {
          createdAt: 'desc'
        }
      }
    },
    orderBy: {
      startedAt: 'desc'
    },
    take: safeLimit,
    skip: (page - 1) * safeLimit
  });
  
  // Получаем общее количество для пагинации
  const totalRuns = await prisma.run.count({
    where: {
      userId,
      startedAt: { gte: dateFrom }
    }
  });

  const totalSlotsFound = runs.reduce((sum, run) => sum + (run.foundSlots || 0), 0);
  const successfulRuns = runs.filter(run => run.status === 'COMPLETED');
  const successRate = runs.length > 0 ? (successfulRuns.length / runs.length) * 100 : 0;

  // Calculate average response time (mock data for now)
  const averageResponseTime = runs.length > 0 
    ? runs.reduce((sum, run) => {
        const duration = run.finishedAt && run.startedAt 
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : 0;
        return sum + duration;
      }, 0) / runs.length
    : 0;

  // Generate trends data
  const trends = {
    daily: generateTrendData(runs, 'day', dateFrom),
    weekly: generateTrendData(runs, 'week', dateFrom),
    monthly: generateTrendData(runs, 'month', dateFrom)
  };

  // Get performance data
  const performance = {
    byWarehouse: await getWarehousePerformance(userId, dateFrom),
    byTimeSlot: await getTimeSlotPerformance(userId, dateFrom),
    byTask: await getTaskPerformance(userId, dateFrom)
  };

  // Get alerts (mock data for now)
  const alerts = [
    {
      id: '1',
      type: 'success' as const,
      message: 'Система работает стабильно',
      timestamp: new Date().toISOString(),
      resolved: true
    },
    {
      id: '2',
      type: 'warning' as const,
      message: 'Высокая нагрузка на WB API',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      resolved: false
    }
  ];

  const analyticsData = {
    overview: {
      totalTasks,
      activeTasks,
      completedTasks,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      totalSlotsFound
    },
    trends,
    performance,
    alerts,
    pagination: {
      page,
      limit: safeLimit,
      total: totalRuns,
      pages: Math.ceil(totalRuns / safeLimit)
    }
  };

  return NextResponse.json({
    success: true,
    data: analyticsData
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/analytics/advanced',
    method: 'GET'
  })
});

function generateTrendData(
  runs: Array<{ startedAt: Date; finishedAt: Date | null; foundSlots: number | null; status: string }>,
  period: string,
  dateFrom: Date
) {
  const data: Array<{ date: string; value: number }> = [];
  const now = new Date();
  
  let interval: number;
  let format: (date: Date) => string;
  
  switch (period) {
    case 'day':
      interval = 60 * 60 * 1000; // 1 hour
      format = (date) => date.toISOString().slice(11, 16);
      break;
    case 'week':
      interval = 24 * 60 * 60 * 1000; // 1 day
      format = (date) => date.toISOString().slice(5, 10);
      break;
    case 'month':
      interval = 7 * 24 * 60 * 60 * 1000; // 1 week
      format = (date) => `Week ${Math.ceil(date.getDate() / 7)}`;
      break;
    default:
      interval = 24 * 60 * 60 * 1000;
      format = (date) => date.toISOString().slice(5, 10);
  }

  for (let d = new Date(dateFrom); d <= now; d.setTime(d.getTime() + interval)) {
    const periodStart = new Date(d);
    const periodEnd = new Date(d.getTime() + interval);
    
    const periodRuns = runs.filter(run => {
      const runDate = new Date(run.startedAt);
      return runDate >= periodStart && runDate < periodEnd;
    });
    
    const successfulRuns = periodRuns.filter(run => run.status === 'COMPLETED');
    const successRate = periodRuns.length > 0 ? (successfulRuns.length / periodRuns.length) * 100 : 0;
    
    data.push({
      date: format(d),
      value: Math.round(successRate * 100) / 100
    });
  }

  return data;
}

async function getWarehousePerformance(userId: string, dateFrom: Date) {
  // Mock data - in real implementation, this would query actual warehouse data
  return [
    { name: 'Москва (Тула)', successRate: 85, totalAttempts: 120 },
    { name: 'Санкт-Петербург', successRate: 78, totalAttempts: 95 },
    { name: 'Екатеринбург', successRate: 72, totalAttempts: 80 },
    { name: 'Новосибирск', successRate: 68, totalAttempts: 65 }
  ];
}

async function getTimeSlotPerformance(userId: string, dateFrom: Date) {
  // Mock data - in real implementation, this would analyze actual time patterns
  return [
    { time: '08:00-10:00', successRate: 88, totalAttempts: 45 },
    { time: '10:00-12:00', successRate: 82, totalAttempts: 38 },
    { time: '12:00-14:00', successRate: 75, totalAttempts: 32 },
    { time: '14:00-16:00', successRate: 70, totalAttempts: 28 },
    { time: '16:00-18:00', successRate: 65, totalAttempts: 25 },
    { time: '18:00-20:00', successRate: 60, totalAttempts: 20 }
  ];
}

async function getTaskPerformance(userId: string, dateFrom: Date) {
  const tasks = await prisma.task.findMany({
    where: { userId },
    include: {
      runs: {
        where: { startedAt: { gte: dateFrom } }
      }
    }
  });

  return tasks.map(task => {
    const totalAttempts = task.runs.length;
    const successfulRuns = task.runs.filter(run => run.status === 'COMPLETED');
    const successRate = totalAttempts > 0 ? (successfulRuns.length / totalAttempts) * 100 : 0;
    
    return {
      name: task.name,
      successRate: Math.round(successRate * 100) / 100,
      totalAttempts
    };
  });
}
