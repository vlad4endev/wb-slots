import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkWBSessionStatus } from '@/lib/utils/session-utils';
import { logger } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    // Используем единую утилиту для проверки статуса сессии
    const sessionStatus = await checkWBSessionStatus(userId);

    logger.debug({ 
      userId, 
      isActive: sessionStatus.isActive,
      sessionId: sessionStatus.sessionId 
    }, 'Session status checked');

    return NextResponse.json({
      success: true,
      data: {
        isActive: sessionStatus.isActive,
        lastLogin: sessionStatus.lastLogin,
        expiresAt: sessionStatus.expiresAt,
        sessionId: sessionStatus.sessionId,
        message: sessionStatus.message
      }
    });

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'WB Session Status API error');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
