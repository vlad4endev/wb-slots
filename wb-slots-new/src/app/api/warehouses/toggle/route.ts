import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { warehouseId, isActive } = await request.json();

    if (!warehouseId || typeof isActive !== 'boolean') {
      return NextResponse.json({ 
        error: 'Warehouse ID and isActive status are required' 
      }, { status: 400 });
    }

    // Обновляем статус склада в справочнике
    const updatedWarehouse = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: { isActive }
    });

    return NextResponse.json({
      success: true,
      message: `Склад ${updatedWarehouse.name} ${isActive ? 'активирован' : 'деактивирован'}`,
      warehouse: {
        id: updatedWarehouse.id,
        name: updatedWarehouse.name,
        isActive: updatedWarehouse.isActive
      }
    });
  } catch (error) {
    console.error('Error toggling warehouse status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
