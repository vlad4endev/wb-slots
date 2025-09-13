import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { telegramIntegrationService } from '@/lib/services/telegram-integration-service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { testType = 'slots' } = body;

    let success = false;
    let message = '';

    switch (testType) {
      case 'slots':
        // Тестируем уведомление о найденных слотах
        success = await telegramIntegrationService.notifySlotsFound({
          userId: user.id,
          taskId: 'test-task',
          taskName: 'Тестовая задача',
          slots: [
            {
              warehouseId: 301809,
              warehouseName: 'Котовск',
              date: new Date().toISOString(),
              coefficient: 0,
              boxTypes: ['2', '5']
            },
            {
              warehouseId: 301809,
              warehouseName: 'Котовск',
              date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              coefficient: 1,
              boxTypes: ['6']
            }
          ]
        });
        message = success ? 'Тестовое уведомление о найденных слотах отправлено' : 'Ошибка отправки уведомления о найденных слотах';
        break;

      case 'booking-success':
        // Тестируем уведомление об успешном бронировании
        success = await telegramIntegrationService.notifyBookingSuccess({
          userId: user.id,
          taskId: 'test-task',
          taskName: 'Тестовая задача',
          slot: {
            warehouseId: 301809,
            warehouseName: 'Котовск',
            date: new Date().toISOString(),
            coefficient: 0
          },
          bookingId: 'test-booking-123'
        });
        message = success ? 'Тестовое уведомление об успешном бронировании отправлено' : 'Ошибка отправки уведомления об успешном бронировании';
        break;

      case 'booking-error':
        // Тестируем уведомление об ошибке бронирования
        success = await telegramIntegrationService.notifyBookingError({
          userId: user.id,
          taskId: 'test-task',
          taskName: 'Тестовая задача',
          slot: {
            warehouseId: 301809,
            warehouseName: 'Котовск',
            date: new Date().toISOString(),
            coefficient: 0
          },
          error: 'Тестовая ошибка бронирования'
        });
        message = success ? 'Тестовое уведомление об ошибке бронирования отправлено' : 'Ошибка отправки уведомления об ошибке бронирования';
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Неизвестный тип теста. Доступные: slots, booking-success, booking-error' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success,
      message,
      testType
    });

  } catch (error) {
    console.error('Test Telegram integration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
