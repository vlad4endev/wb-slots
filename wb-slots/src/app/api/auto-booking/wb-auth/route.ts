import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkWBSessionStatus } from '@/lib/utils/session-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    // Используем единую утилиту для проверки статуса сессии
    const sessionStatus = await checkWBSessionStatus(userId);

    const wbAuthStatus = {
      isAuthenticated: sessionStatus.isActive,
      lastLogin: sessionStatus.lastLogin?.toISOString() || null,
      sessionExpires: sessionStatus.expiresAt?.toISOString() || null,
      userInfo: sessionStatus.isActive ? {
        name: 'Пользователь WB',
        email: 'wb@wildberries.ru',
        role: 'Продавец'
      } : null,
      sessionId: sessionStatus.sessionId || null,
      message: sessionStatus.message
    };

    return NextResponse.json({
      success: true,
      data: wbAuthStatus
    });
  } catch (error) {
    console.error('Error checking WB auth status:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
