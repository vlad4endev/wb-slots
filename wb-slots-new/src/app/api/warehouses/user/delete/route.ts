import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId');

    if (!warehouseId) {
      return NextResponse.json({ 
        error: 'Warehouse ID is required' 
      }, { status: 400 });
    }

    // Удаляем склад из списка пользователя
    const deletedWarehouse = await prisma.warehousePref.deleteMany({
      where: {
        userId: user.id,
        warehouseId: parseInt(warehouseId)
      }
    });

    if (deletedWarehouse.count === 0) {
      return NextResponse.json({ 
        error: 'Warehouse not found in user list' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Склад удален из вашего списка'
    });
  } catch (error) {
    console.error('Error deleting warehouse from user:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
