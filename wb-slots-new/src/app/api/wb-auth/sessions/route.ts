import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WBSessionManager } from '@/lib/wb-session-manager';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Получаем все сессии пользователя
    const sessions = await WBSessionManager.getUserSessions(user.id);

    return NextResponse.json({
      success: true,
      data: { sessions },
    });

  } catch (error) {
    console.error('Get WB sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения сессий' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'ID сессии не указан' },
        { status: 400 }
      );
    }

    // Деактивируем сессию
    await WBSessionManager.deactivateSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Сессия деактивирована',
    });

  } catch (error) {
    console.error('Delete WB session error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления сессии' },
      { status: 500 }
    );
  }
}
