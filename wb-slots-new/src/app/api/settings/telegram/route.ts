import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Получаем настройки Telegram пользователя
    const settings = await prisma.userSettings.findFirst({
      where: {
        userId: user.id,
        category: 'NOTIFICATION',
      },
    });

    const telegramSettings = settings?.settings as any || {};

    return NextResponse.json({
      success: true,
      data: {
        chatId: telegramSettings.telegram?.chatId || '',
        enabled: telegramSettings.telegram?.enabled || false,
      },
    });
  } catch (error) {
    console.error('Get Telegram settings error:', error);
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
    const { chatId, enabled = true } = body;

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    // Сохраняем настройки Telegram
    await prisma.userSettings.upsert({
      where: {
        userId_category: {
          userId: user.id,
          category: 'NOTIFICATION',
        },
      },
      update: {
        settings: {
          telegram: {
            chatId,
            enabled,
          },
        },
      },
      create: {
        userId: user.id,
        category: 'NOTIFICATION',
        settings: {
          telegram: {
            chatId,
            enabled,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Telegram настройки сохранены',
    });
  } catch (error) {
    console.error('Save Telegram settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}