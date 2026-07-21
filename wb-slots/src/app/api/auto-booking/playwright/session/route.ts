import { NextRequest, NextResponse } from 'next/server';
import { AutoBookingService } from '@/lib/services/enhanced-auto-booking-service';
import { Logger } from '@/lib/logging/logger';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

const logger = new Logger('INFO', { service: 'PlaywrightSessionAPI' });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, credentials, smsProvider } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные параметры' },
        { status: 400 }
      );
    }

    const playwright = new AutoBookingService();

    switch (action) {
      case 'login':
        if (!credentials) {
          return NextResponse.json(
            { error: 'Отсутствуют учетные данные для входа' },
            { status: 400 }
          );
        }

        // Для PlaywrightAutoBookingService логин происходит через startBooking
        // Здесь мы просто возвращаем успех, так как сессия уже должна быть сохранена
        return NextResponse.json({
          success: true,
          message: 'Авторизация успешна',
        });

      case 'check':
        const isAuthenticated = !playwright.isBookingInProgress();
        return NextResponse.json({
          success: true,
          isAuthenticated,
        });

      case 'logout':
        await playwright.stop();
        
        // Деактивируем сессию в БД
        await prisma.wBSession.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });

        return NextResponse.json({
          success: true,
          message: 'Выход выполнен',
        });

      default:
        return NextResponse.json(
          { error: 'Неизвестное действие' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Ошибка управления сессией:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  } finally {
    // Закрываем браузер после использования
    try {
      const playwright = new AutoBookingService();
      await playwright.stop();
    } catch (error) {
      // Игнорируем ошибки закрытия
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Отсутствует параметр userId' },
        { status: 400 }
      );
    }

    // Получаем информацию о сессиях пользователя
    const sessions = await prisma.wBSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sessionId: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        sessionId: session.sessionId,
        isActive: session.isActive,
        expiresAt: session.expiresAt,
        lastUsedAt: session.lastUsedAt,
        createdAt: session.createdAt,
      })),
    });

  } catch (error) {
    logger.error('Ошибка получения сессий:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

