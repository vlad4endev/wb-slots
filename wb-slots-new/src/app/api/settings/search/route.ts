import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const searchSettingsSchema = z.object({
  checkInterval: z.number().int().min(10).max(60).default(10),
  maxAttempts: z.number().int().min(10).max(1000).default(100),
  apiRateLimit: z.number().int().min(1).max(10).default(6),
  stopOnFirstFound: z.boolean().default(true),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10).default(3),
    backoffMs: z.number().int().min(1000).max(60000).default(5000),
  }),
  priority: z.number().int().min(0).max(10).default(5),
  enabled: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Получаем настройки поиска пользователя
    const settings = await prisma.userSettings.findFirst({
      where: { userId: user.id, category: 'SEARCH' },
    });

    if (!settings) {
      // Возвращаем настройки по умолчанию
      return NextResponse.json({
        success: true,
        data: {
          checkInterval: 10,
          maxAttempts: 100,
          apiRateLimit: 6,
          stopOnFirstFound: true,
          retryPolicy: {
            maxRetries: 3,
            backoffMs: 5000,
          },
          priority: 5,
          enabled: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: settings.settings,
    });

  } catch (error) {
    console.error('Get search settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения настроек' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = searchSettingsSchema.parse(body);

    // Сохраняем настройки поиска
    await prisma.userSettings.upsert({
      where: {
        userId_category: {
          userId: user.id,
          category: 'SEARCH',
        },
      },
      update: {
        settings: validatedData,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        category: 'SEARCH',
        settings: validatedData,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Настройки поиска сохранены',
    });

  } catch (error) {
    console.error('Save search settings error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Ошибка валидации данных' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка сохранения настроек' },
      { status: 500 }
    );
  }
}
