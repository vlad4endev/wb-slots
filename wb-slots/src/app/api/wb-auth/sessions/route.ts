import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserSessions } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Получаем все сессии пользователя
    const sessions = await getUserSessions(user.id);

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

    // Полностью удаляем сессию из базы данных
    await WBSessionManager.deleteSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Сессия удалена',
    });

  } catch (error) {
    console.error('Delete WB session error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления сессии' },
      { status: 500 }
    );
  }
}
