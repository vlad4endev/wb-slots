import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { warehouseIds } = await request.json();

    if (!warehouseIds || !Array.isArray(warehouseIds) || warehouseIds.length === 0) {
      return NextResponse.json({ 
        error: 'Warehouse IDs array is required' 
      }, { status: 400 });
    }

    // Получаем информацию о складах из справочника
    const warehouses = await prisma.warehouse.findMany({
      where: { 
        id: { in: warehouseIds },
        isActive: true 
      }
    });

    if (warehouses.length === 0) {
      return NextResponse.json({ 
        error: 'No active warehouses found with provided IDs' 
      }, { status: 404 });
    }

    // Добавляем склады к пользователю
    const userWarehouses = [];
    for (const warehouse of warehouses) {
      // Проверяем, не добавлен ли уже склад пользователю
      const existingWarehouse = await prisma.warehousePref.findFirst({
        where: {
          userId: user.id,
          warehouseId: warehouse.id
        }
      });

      if (!existingWarehouse) {
        const userWarehouse = await prisma.warehousePref.create({
          data: {
            userId: user.id,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            enabled: true,
            boxAllowed: true,
            monopalletAllowed: true,
            supersafeAllowed: true
          }
        });
        userWarehouses.push(userWarehouse);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Добавлено ${userWarehouses.length} складов в ваш список включенных складов`,
      warehouses: userWarehouses.map(w => ({
        id: w.id,
        warehouseId: w.warehouseId,
        warehouseName: w.warehouseName,
        enabled: w.enabled,
        boxAllowed: w.boxAllowed,
        monopalletAllowed: w.monopalletAllowed,
        supersafeAllowed: w.supersafeAllowed
      }))
    });
  } catch (error) {
    console.error('Error adding warehouses to user:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
