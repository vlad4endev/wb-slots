import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Получить список всех WB сессий пользователя (для отладки)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Получаем все WB сессии пользователя
    const sessions = await prisma.wBSession.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          id: session.id,
          isActive: session.isActive,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastValidated: session.lastValidated,
          lastUsedAt: session.lastUsedAt,
          expiresAt: session.expiresAt,
          deactivatedAt: session.deactivatedAt,
          deactivationReason: session.deactivationReason,
          ipAddress: session.ipAddress,
          useCount: session.useCount,
        })),
        total: sessions.length,
        active: sessions.filter(s => s.isActive).length,
      },
    });

  } catch (error) {
    console.error('Error fetching WB sessions list:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка получения списка сессий',
      },
      { status: 500 }
    );
  }
}







