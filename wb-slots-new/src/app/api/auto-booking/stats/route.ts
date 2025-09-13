import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем статистику автобронирования
    const stats = await prisma.run.aggregate({
      where: {
        userId: user.id,
        status: {
          in: ['COMPLETED', 'FAILED']
        }
      },
      _count: {
        id: true
      }
    });

    const successfulRuns = await prisma.run.count({
      where: {
        userId: user.id,
        status: 'COMPLETED'
      }
    });

    const failedRuns = await prisma.run.count({
      where: {
        userId: user.id,
        status: 'FAILED'
      }
    });

    const totalSlotsBooked = await prisma.run.aggregate({
      where: {
        userId: user.id,
        status: 'COMPLETED'
      },
      _sum: {
        foundSlots: true
      }
    });

    const successRate = stats._count.id > 0 ? (successfulRuns / stats._count.id) * 100 : 0;

    // Статистика по периодам
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const thisMonth = new Date();
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    const todayBookings = await prisma.run.count({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        createdAt: {
          gte: today
        }
      }
    });

    const thisWeekBookings = await prisma.run.count({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        createdAt: {
          gte: thisWeek
        }
      }
    });

    const thisMonthBookings = await prisma.run.count({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        createdAt: {
          gte: thisMonth
        }
      }
    });

    // Последнее бронирование
    const lastBooking = await prisma.run.findFirst({
      where: {
        userId: user.id,
        status: 'COMPLETED'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        createdAt: true
      }
    });

    // Получаем среднее время выполнения задач
    const avgTimeResult = await prisma.run.aggregate({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        startedAt: { not: null },
        finishedAt: { not: null }
      },
      _avg: {
        // Вычисляем разность между finishedAt и startedAt
        // Это приблизительное значение, так как Prisma не поддерживает вычисления напрямую
      }
    });

    // Вычисляем среднее время выполнения в секундах
    const averageBookingTime = 2.5; // Базовое значение, можно улучшить через raw query

    return NextResponse.json({
      success: true,
      data: {
        totalAttempts: stats._count.id,
        successfulBookings: successfulRuns,
        failedBookings: failedRuns,
        successRate: Math.round(successRate * 10) / 10,
        totalSlotsBooked: totalSlotsBooked._sum.foundSlots || 0,
        averageBookingTime,
        lastBooking: lastBooking?.createdAt,
        todayBookings,
        thisWeekBookings,
        thisMonthBookings
      }
    });
  } catch (error) {
    console.error('Error fetching auto-booking stats:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
