import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TelegramService } from '@/lib/services/telegram-service';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const notificationSchema = z.object({
  message: z.string(),
  type: z.enum(['SLOT_FOUND', 'BOOKING_SUCCESS', 'BOOKING_ERROR', 'TASK_COMPLETED']).optional(),
  data: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = notificationSchema.parse(body);

    // Создаем экземпляр TelegramService с prisma
    const telegramService = new TelegramService(prisma);

    // Отправляем уведомление
    const success = await telegramService.sendNotification(user.id, validatedData.message);

    return NextResponse.json({
      success,
      message: success ? 'Уведомление отправлено' : 'Ошибка отправки уведомления',
    });

  } catch (error) {
    console.error('Telegram notification API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Создаем экземпляр TelegramService с prisma
    const telegramService = new TelegramService(prisma);

    // Проверяем, настроены ли уведомления
    const isConfigured = await telegramService.isNotificationConfigured(user.id);

    return NextResponse.json({
      success: true,
      data: {
        isConfigured,
      },
    });

  } catch (error) {
    console.error('Telegram status API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
