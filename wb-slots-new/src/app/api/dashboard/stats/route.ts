import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Получаем статистику задач
    const totalTasks = await prisma.task.count({
      where: { userId: user.id },
    });

    const activeTasks = await prisma.task.count({
      where: { 
        userId: user.id,
        enabled: true,
      },
    });

    // Получаем статистику запусков
    const totalRuns = await prisma.run.count({
      where: {
        task: {
          userId: user.id,
        },
      },
    });

    const successfulRuns = await prisma.run.count({
      where: {
        task: {
          userId: user.id,
        },
        status: 'SUCCESS',
      },
    });

    // Получаем количество найденных слотов
    const foundSlotsResult = await prisma.run.aggregate({
      where: {
        task: {
          userId: user.id,
        },
        status: 'SUCCESS',
      },
      _sum: {
        foundSlots: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalTasks,
        activeTasks,
        totalRuns,
        successfulRuns,
        foundSlots: foundSlotsResult._sum.foundSlots || 0,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Ошибка получения статистики' },
      { status: 500 }
    );
  }
}