import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { autoBookingService } from '@/lib/services/auto-booking-service';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const bookingSchema = z.object({
  taskId: z.string(),
  runId: z.string(),
  slotId: z.string(),
  supplyId: z.string(),
  warehouseId: z.number(),
  boxTypeId: z.number(),
  date: z.string(),
  coefficient: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = bookingSchema.parse(body);

    // Проверяем, не запущено ли уже бронирование
    if (autoBookingService.isBookingInProgress()) {
      return NextResponse.json({
        success: false,
        error: 'Бронирование уже запущено',
      }, { status: 409 });
    }

    // Создаем конфигурацию бронирования
    const bookingConfig = {
      ...validatedData,
      userId: user.id,
      prisma, // Передаем prisma в конфигурацию
    };


    // Запускаем бронирование
    const result = await autoBookingService.startBooking(bookingConfig);

    return NextResponse.json({
      success: true,
      data: result,
      message: result.success ? 'Слот успешно забронирован' : 'Ошибка бронирования',
    });

  } catch (error) {
    console.error('Auto booking API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    return NextResponse.json({
      success: true,
      data: {
        isBookingInProgress: autoBookingService.isBookingInProgress(),
      },
    });

  } catch (error) {
    console.error('Auto booking status API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Останавливаем бронирование
    await autoBookingService.stop();

    return NextResponse.json({
      success: true,
      message: 'Бронирование остановлено',
    });

  } catch (error) {
    console.error('Stop auto booking API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
