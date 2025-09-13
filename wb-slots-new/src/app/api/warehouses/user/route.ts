import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const warehouseSchema = z.object({
  warehouseId: z.number(),
  warehouseName: z.string(),
  enabled: z.boolean().default(true),
  boxAllowed: z.boolean().default(true),
  monopalletAllowed: z.boolean().default(true),
  supersafeAllowed: z.boolean().default(true),
});

const createWarehousesSchema = z.object({
  warehouses: z.array(warehouseSchema).optional(),
  warehouseId: z.number().optional(),
  warehouseName: z.string().optional(),
  enabled: z.boolean().optional(),
  boxAllowed: z.boolean().optional(),
  monopalletAllowed: z.boolean().optional(),
  supersafeAllowed: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const userWarehouses = await prisma.warehousePref.findMany({
      where: { userId: user.id },
      orderBy: { warehouseName: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: { warehouses: userWarehouses },
    });
  } catch (error) {
    console.error('Get user warehouses error:', error);
    
    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = createWarehousesSchema.parse(body);

    if (validatedData.warehouses) {
      // Добавляем несколько складов
      const warehouses = await Promise.all(
        validatedData.warehouses.map(async (warehouseData) => {
          return await prisma.warehousePref.create({
            data: {
              userId: user.id,
              warehouseId: warehouseData.warehouseId,
              warehouseName: warehouseData.warehouseName,
              enabled: warehouseData.enabled,
              boxAllowed: warehouseData.boxAllowed,
              monopalletAllowed: warehouseData.monopalletAllowed,
              supersafeAllowed: warehouseData.supersafeAllowed,
            },
          });
        })
      );

      return NextResponse.json({
        success: true,
        data: { warehouses },
        message: `Добавлено ${warehouses.length} складов`,
      });
    } else {
      // Добавляем один склад
      const warehouse = await prisma.warehousePref.create({
        data: {
          userId: user.id,
          warehouseId: validatedData.warehouseId!,
          warehouseName: validatedData.warehouseName!,
          enabled: validatedData.enabled ?? true,
          boxAllowed: validatedData.boxAllowed ?? true,
          monopalletAllowed: validatedData.monopalletAllowed ?? true,
          supersafeAllowed: validatedData.supersafeAllowed ?? true,
        },
      });

      return NextResponse.json({
        success: true,
        data: { warehouse },
        message: 'Склад добавлен успешно',
      });
    }
  } catch (error) {
    console.error('Create user warehouse error:', error);
    
    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { warehouseId, enabled } = body;

    if (!warehouseId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Неверные данные' },
        { status: 400 }
      );
    }

    // Обновляем статус склада
    const warehouse = await prisma.warehousePref.updateMany({
      where: {
        userId: user.id,
        warehouseId: parseInt(warehouseId),
      },
      data: {
        enabled: enabled,
      },
    });

    if (warehouse.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Склад не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Склад ${enabled ? 'включен' : 'отключен'}`,
    });
  } catch (error) {
    console.error('Toggle warehouse error:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}