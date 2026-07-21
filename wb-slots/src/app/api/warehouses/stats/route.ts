import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Получение статистики складов...');
    
    const user = await requireAuth(request);
    
    // Получаем общую статистику складов
    const totalWarehouses = await prisma.warehouse.count();
    const activeWarehouses = await prisma.warehouse.count({
      where: { isActive: true }
    });
    const inactiveWarehouses = await prisma.warehouse.count({
      where: { isActive: false }
    });
    
    // Получаем последние обновления
    const lastUpdated = await prisma.warehouse.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    });
    
    const lastCreated = await prisma.warehouse.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    
    // Получаем статистику по регионам (примерная группировка по названиям)
    const warehousesByRegion = await prisma.warehouse.groupBy({
      by: ['name'],
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
      take: 10
    });
    
    // Получаем статистику изменений за последние дни
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentUpdates = await prisma.warehouse.count({
      where: {
        updatedAt: {
          gte: lastWeek
        }
      }
    });
    
    const monthlyUpdates = await prisma.warehouse.count({
      where: {
        updatedAt: {
          gte: lastMonth
        }
      }
    });
    
    const stats = {
      total: totalWarehouses,
      active: activeWarehouses,
      inactive: inactiveWarehouses,
      lastUpdated: lastUpdated?.updatedAt || null,
      lastCreated: lastCreated?.createdAt || null,
      recentUpdates: recentUpdates,
      monthlyUpdates: monthlyUpdates,
      topRegions: warehousesByRegion.map(w => ({
        name: w.name,
        count: w._count.name
      }))
    };
    
    console.log('✅ Статистика получена:', {
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive
    });
    
    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Статистика складов получена успешно'
    });
    
  } catch (error) {
    console.error('Get warehouse stats error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка получения статистики складов',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
