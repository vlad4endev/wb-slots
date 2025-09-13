import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let whereClause: any = {};

    // Если не запрашивают неактивные, показываем только активные
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const warehouses = await prisma.warehouse.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Получаем общую статистику
    const totalCount = await prisma.warehouse.count();
    const activeCount = await prisma.warehouse.count({ where: { isActive: true } });

    return NextResponse.json({
      success: true,
      data: { 
        warehouses,
        stats: {
          total: totalCount,
          active: activeCount,
          inactive: totalCount - activeCount
        }
      },
    });
  } catch (error) {
    console.error('Get warehouse reference error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
