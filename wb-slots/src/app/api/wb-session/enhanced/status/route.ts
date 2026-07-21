import { NextRequest, NextResponse } from 'next/server';
import { EnhancedWBSessionManager, getUnifiedSessionManager } from '@/lib/session';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const user = await requireAuth(request);

    // Проверяем наличие ключа шифрования
    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json(
        { success: false, error: 'ENCRYPTION_KEY not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    // Создаем менеджер сессий
    const sessionManager = getUnifiedSessionManager();

    // Получаем статистику сессий
    const stats = await sessionManager.getSessionStats(userId);

    return NextResponse.json({
      success: true,
      data: {
        userId,
        stats,
        hasActiveSession: stats.activeSessions > 0,
        lastLoginAt: stats.lastLoginAt,
        averageSessionDuration: stats.averageSessionDuration
      }
    });

  } catch (error) {
    console.error('Enhanced session status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
