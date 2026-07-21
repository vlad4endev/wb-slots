import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAppService } from '@/lib/app';
import { IAutoBookingService, AutoBookingConfig } from '@/lib/architecture/unified-interfaces';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logging';

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

    console.log(`🚀 Starting auto-booking for user ${user.id}`, { validatedData });

    // Получаем WB токен пользователя
    const userToken = await prisma.userToken.findFirst({
      where: { userId: user.id, category: 'SUPPLIES' },
    });

    if (!userToken) {
      return NextResponse.json(
        { success: false, error: 'WB API token not found for user' },
        { status: 400 }
      );
    }

    // Создаем конфигурацию для автобронирования
    const bookingConfig: AutoBookingConfig = {
      taskId: validatedData.taskId,
      userId: user.id,
      wbToken: userToken.token,
      slotId: validatedData.slotId,
      supplyId: validatedData.supplyId,
      warehouseId: validatedData.warehouseId,
      boxTypeId: validatedData.boxTypeId,
      date: validatedData.date,
      coefficient: validatedData.coefficient,
    };

    // Используем унифицированный сервис автобронирования
    const autoBookingService = getAppService<IAutoBookingService>('UnifiedAutoBookingService');

    // Проверяем, не запущено ли уже бронирование
    if (autoBookingService.isBookingInProgress()) {
      return NextResponse.json({
        success: false,
        error: 'Бронирование уже запущено. Пожалуйста, дождитесь завершения текущего процесса.',
      }, { status: 409 });
    }

    // Запускаем бронирование
    const result = await autoBookingService.bookSlot(bookingConfig);

    // ИСПРАВЛЕНО: Обновляем все записи в ОДНОЙ транзакции для атомарности
    // Это предотвращает race conditions и гарантирует целостность данных
    await prisma.$transaction(async (tx) => {
      if (result.success) {
        // 1. Обновляем статус задачи
        await tx.task.update({
          where: { id: validatedData.taskId },
          data: { 
            status: 'COMPLETED',
            updatedAt: new Date(),
          },
        });

        // 2. Атомарно обновляем FoundSlot (защита от дублей)
        // Используем updateMany с WHERE условием для optimistic locking
        const updatedSlots = await tx.foundSlot.updateMany({
          where: {
            userId: user.id,
            warehouseId: validatedData.warehouseId,
            date: validatedData.date,
            isBooked: false, // КРИТИЧНО: обновляем только если еще не забронирован
          },
          data: {
            isBooked: true,
            bookingId: result.bookingId,
            supplyId: validatedData.supplyId,
            updatedAt: new Date(),
          },
        });

        // Проверяем, что слот действительно был обновлен
        if (updatedSlots.count === 0) {
          logger.warn('Slot already booked or not found', {
            userId: user.id,
            warehouseId: validatedData.warehouseId,
            date: validatedData.date,
          });
        }

        // 3. Создаем BookingResult
        await tx.bookingResult.create({
          data: {
            userId: user.id,
            supplyId: validatedData.supplyId,
            warehouseId: validatedData.warehouseId,
            warehouseName: `Склад ${validatedData.warehouseId}`,
            bookingDate: validatedData.date,
            timeSlot: '09:00-18:00', // Будет браться из слота
            boxTypes: [String(validatedData.boxTypeId)],
            coefficient: validatedData.coefficient,
            bookingId: result.bookingId,
            status: 'SUCCESS',
            details: result.details,
          },
        });

        // 4. Создаем запись в логах
        await tx.runLog.create({
          data: {
            runId: validatedData.runId,
            level: 'INFO',
            message: 'Слот успешно забронирован',
            meta: {
              bookingId: result.bookingId,
              supplyId: validatedData.supplyId,
              warehouseId: validatedData.warehouseId,
              date: validatedData.date,
              slotsUpdated: updatedSlots.count,
            },
          },
        });

        logger.info('Booking transaction completed successfully', {
          bookingId: result.bookingId,
          slotsUpdated: updatedSlots.count,
        });
        
      } else {
        // Бронирование не удалось
        await tx.task.update({
          where: { id: validatedData.taskId },
          data: { 
            status: 'FAILED',
            updatedAt: new Date(),
          },
        });

        // Создаем BookingResult с ошибкой
        await tx.bookingResult.create({
          data: {
            userId: user.id,
            supplyId: validatedData.supplyId,
            warehouseId: validatedData.warehouseId,
            warehouseName: `Склад ${validatedData.warehouseId}`,
            bookingDate: validatedData.date,
            timeSlot: '09:00-18:00',
            boxTypes: [String(validatedData.boxTypeId)],
            coefficient: validatedData.coefficient,
            status: 'FAILED',
            errorMessage: result.error,
            details: result.details,
          },
        });

        // Создаем запись об ошибке в логах
        await tx.runLog.create({
          data: {
            runId: validatedData.runId,
            level: 'ERROR',
            message: 'Ошибка бронирования',
            meta: {
              error: result.error,
              supplyId: validatedData.supplyId,
              warehouseId: validatedData.warehouseId,
              date: validatedData.date,
              screenshot: result.screenshot,
            },
          },
        });

        logger.error('Booking failed', {
          error: result.error,
          taskId: validatedData.taskId,
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: result.success ? 'Слот успешно забронирован' : 'Ошибка бронирования',
    });

  } catch (error) {
    console.error('Auto booking API error:', error);
    
    // Если это ошибка валидации
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Неверные данные запроса',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const autoBookingService = getAppService<IAutoBookingService>('UnifiedAutoBookingService');

    return NextResponse.json({
      success: true,
      data: {
        isBookingInProgress: autoBookingService.isBookingInProgress(),
        userId: user.id,
      },
    });

  } catch (error) {
    logger.error('Auto booking status API error:', { error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const autoBookingService = getAppService<IAutoBookingService>('UnifiedAutoBookingService');

    // Останавливаем бронирование
    await autoBookingService.stop();

    return NextResponse.json({
      success: true,
      message: 'Бронирование остановлено',
    });

  } catch (error) {
    logger.error('Stop auto booking API error:', { error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}