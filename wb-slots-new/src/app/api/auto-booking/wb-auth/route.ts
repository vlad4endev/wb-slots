import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { WBSessionManager } from '@/lib/wb-session-manager';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем активную сессию WB из базы данных
    const activeSession = await WBSessionManager.getActiveSession(user.id);
    
    const wbAuthStatus = {
      isAuthenticated: !!activeSession,
      lastLogin: activeSession ? activeSession.expiresAt.toISOString() : null,
      sessionExpires: activeSession ? activeSession.expiresAt.toISOString() : null,
      userInfo: activeSession ? {
        name: 'Пользователь WB',
        email: 'wb@wildberries.ru',
        role: 'Продавец'
      } : null,
      sessionId: activeSession?.sessionId || null
    };

    return NextResponse.json({
      success: true,
      data: wbAuthStatus
    });
  } catch (error) {
    console.error('Error checking WB auth status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
