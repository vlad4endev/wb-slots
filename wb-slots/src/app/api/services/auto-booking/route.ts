import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { AutoBookingService } from '@/lib/services/auto-booking-service';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createApiHandler } from '@/lib/errors';

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

const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const validatedData = bookingSchema.parse(body);

  // Создаем экземпляр сервиса автобронирования
  const autoBookingService = new AutoBookingService();

  // Проверяем, не запущено ли уже бронирование
  if (autoBookingService.isBookingInProgress()) {
    return NextResponse.json({
      success: false,
      error: 'Бронирование уже запущено',
    }, { status: 409 });
  }

  // ИСПРАВЛЕНО: Создаем правильную конфигурацию для EnhancedBookingConfig
  const bookingConfig = {
    taskId: validatedData.taskId,
    userId: user.id,
    runId: validatedData.runId,
    slotId: validatedData.slotId,
    supplyId: validatedData.supplyId,
    warehouseId: validatedData.warehouseId,
    boxTypeId: validatedData.boxTypeId,
    date: validatedData.date,
    coefficient: validatedData.coefficient,
    // Опциональные настройки retry и timeout
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT']
    },
    timeoutConfig: {
      pageLoad: 60000,
      navigation: 45000,
      elementWait: 30000,
      actionDelay: 1000
    }
  };

  // Запускаем бронирование
  const result = await autoBookingService.startBooking(bookingConfig);

  return NextResponse.json({
    success: true,
    data: result,
    message: result.success ? 'Слот успешно забронирован' : 'Ошибка бронирования',
  });
};

export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'auto-booking',
    method: 'POST'
  })
});

const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const autoBookingService = new AutoBookingService();

  return NextResponse.json({
    success: true,
    data: {
      isBookingInProgress: autoBookingService.isBookingInProgress(),
    },
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'auto-booking-status',
    method: 'GET'
  })
});

const deleteHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const autoBookingService = new AutoBookingService();

  // Останавливаем бронирование
  await autoBookingService.stop();

  return NextResponse.json({
    success: true,
    message: 'Бронирование остановлено',
  });
};

export const DELETE = createApiHandler(deleteHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'auto-booking-stop',
    method: 'DELETE'
  })
});
