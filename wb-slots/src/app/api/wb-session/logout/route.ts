import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId } = body;
    const targetUserId = userId || user.id;

    console.log(`🚪 Logging out WB session for user ${targetUserId}`);

    // Деактивируем все активные сессии пользователя
    const result = await prisma.wBSession.updateMany({
      where: {
        userId: targetUserId,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Deactivated ${result.count} sessions for user ${targetUserId}`);

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUserId,
        deactivatedSessions: result.count,
        message: 'Сессия завершена успешно'
      }
    });

  } catch (error) {
    console.error('WB Session Logout API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
