import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { syncUserSessions, validateAndFixSessions, getSessionStats } from '@/lib/utils/session-sync-utils';

/**
 * API для синхронизации и исправления сессий WB
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { action, userId } = body;
    const targetUserId = userId || user.id;

    // Проверяем права (пользователь может синхронизировать только свою сессию, админ - любую)
    if (user.role !== 'ADMIN' && targetUserId !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен. Вы можете синхронизировать только свои сессии.'
      }, { status: 403 });
    }

    switch (action) {
      case 'sync':
        // Принудительная синхронизация сессий
        const syncResult = await syncUserSessions(targetUserId);
        return NextResponse.json({
          success: true,
          data: {
            message: 'Сессии синхронизированы',
            ...syncResult
          }
        });

      case 'validate':
        // Проверка и исправление несоответствий
        const validationResult = await validateAndFixSessions(targetUserId);
        return NextResponse.json({
          success: true,
          data: {
            message: 'Проверка сессий завершена',
            ...validationResult
          }
        });

      case 'stats':
        // Получение статистики сессий
        const stats = await getSessionStats(targetUserId);
        return NextResponse.json({
          success: true,
          data: {
            message: 'Статистика сессий получена',
            ...stats
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Неверное действие. Доступные действия: sync, validate, stats'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Session sync API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    // Проверяем права
    if (user.role !== 'ADMIN' && userId !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен. Вы можете просматривать только свои сессии.'
      }, { status: 403 });
    }

    // Получаем статистику сессий
    const stats = await getSessionStats(userId);
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'Статистика сессий получена',
        ...stats
      }
    });

  } catch (error) {
    console.error('Session stats API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
