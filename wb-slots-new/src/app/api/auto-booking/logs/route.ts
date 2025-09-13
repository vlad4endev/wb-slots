import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Получаем логи автобронирования
    const runs = await prisma.run.findMany({
      where: {
        userId: user.id
      },
      include: {
        task: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    const logs = runs.map(run => {
      // Извлекаем информацию о слотах из summary
      const summary = run.summary as any;
      const foundSlots = summary?.foundSlots || run.foundSlots || 0;
      const bestSlot = summary?.bestSlot;
      
      return {
        id: run.id,
        timestamp: run.createdAt.toISOString(),
        status: run.status === 'COMPLETED' ? 'success' : 
                run.status === 'FAILED' ? 'failed' : 'pending',
        taskName: run.task?.name || 'Неизвестная задача',
        slotInfo: {
          warehouse: bestSlot?.warehouseName || summary?.warehouseName || 'Склад не указан',
          date: bestSlot?.date || run.createdAt.toISOString().split('T')[0],
          time: bestSlot?.time || run.createdAt.toISOString().split('T')[1].split('.')[0],
          coefficient: bestSlot?.coefficient || summary?.coefficient || 0
        },
        message: run.status === 'COMPLETED' ? 
          `Найдено слотов: ${foundSlots}` :
          run.status === 'FAILED' ? 
          (run.error || 'Ошибка выполнения задачи') : 
          'Задача выполняется',
        details: {
          foundSlots,
          error: run.error,
          summary: run.summary,
          supplyId: summary?.supplyId,
          bookingStatus: summary?.bookingStatus
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        logs,
        total: runs.length,
        hasMore: runs.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching auto-booking logs:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
