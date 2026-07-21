import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { 
  createWarehousesSchema, 
  updateWarehouseSchema,
  deleteWarehouseSchema,
  parseWarehouseId,
  normalizeWarehouseData,
  normalizeWarehousesData
} from '@/lib/validation/warehouse-validation';

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
    
    console.log('📥 Incoming warehouse data:', {
      userId: user.id,
      bodyType: typeof body,
      bodyKeys: Object.keys(body),
      warehouseIdType: body.warehouseId ? typeof body.warehouseId : 'undefined',
      warehouseIdValue: body.warehouseId
    });
    
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
      console.error('Validation error details:', error.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Неверные данные', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received,
            expected: err.expected
          }))
        },
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
    
    console.log('📥 PATCH warehouse data:', {
      userId: user.id,
      body
    });
    
    const validatedData = updateWarehouseSchema.parse(body);

    // Обновляем статус склада
    const warehouse = await prisma.warehousePref.updateMany({
      where: {
        userId: user.id,
        warehouseId: validatedData.warehouseId,
      },
      data: {
        enabled: validatedData.enabled,
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
      message: `Склад ${validatedData.enabled ? 'включен' : 'отключен'}`,
    });
  } catch (error) {
    console.error('Toggle warehouse error:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (error instanceof z.ZodError) {
      console.error('Validation error details:', error.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Неверные данные', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received,
            expected: err.expected
          }))
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    console.log('📥 DELETE warehouse data:', {
      userId: user.id,
      body
    });
    
    const validatedData = deleteWarehouseSchema.parse(body);

    // Удаляем склад
    const warehouse = await prisma.warehousePref.deleteMany({
      where: {
        userId: user.id,
        warehouseId: validatedData.warehouseId,
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
      message: 'Склад удален успешно',
    });
  } catch (error) {
    console.error('Delete warehouse error:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (error instanceof z.ZodError) {
      console.error('Validation error details:', error.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Неверные данные', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received,
            expected: err.expected
          }))
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}