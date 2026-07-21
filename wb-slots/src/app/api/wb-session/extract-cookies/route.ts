import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maskToken } from '@/lib/encryption';
import { logger } from '@/lib/logging';
import { getUnifiedSessionManager } from '@/lib/session';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { cookies, localStorage, sessionStorage } = await request.json();

    if (!cookies || !Array.isArray(cookies)) {
      return NextResponse.json({
        success: false,
        error: 'Cookies are required and must be an array'
      }, { status: 400 });
    }

    // Используем UnifiedWBSessionManager для сохранения в правильном формате
    const sessionManager = getUnifiedSessionManager();
    
    // Создаем структурированные данные сессии
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    
    const fullSessionData = {
      sessionId,
      cookies,
      localStorage: localStorage || {},
      sessionStorage: sessionStorage || {},
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      expiresAt: expiresAt.toISOString(),
      metadata: {
        createdAt: new Date(),
        lastValidated: new Date(),
        version: '3.0-unified'
      }
    };

    // Шифруем все данные в едином формате (используем приватный метод через типизацию)
    // Для этого создаем временный экземпляр менеджера
    const tempManager = getUnifiedSessionManager();
    const encryptedSessionData = (tempManager as any).encrypt(JSON.stringify(fullSessionData));

    // Сохраняем в базу данных с новой схемой
    await prisma.wBSession.upsert({
      where: {
        userId: user.id
      },
      update: {
        sessionData: encryptedSessionData,
        expiresAt,
        isActive: true,
        lastUsedAt: new Date(),
        lastValidated: new Date()
      },
      create: {
        userId: user.id,
        sessionData: encryptedSessionData,
        expiresAt,
        isActive: true,
        lastValidated: new Date(),
        lastUsedAt: new Date()
      }
    });

    logger.info('Cookies saved successfully', {
      userId: user.id,
      sessionId: maskToken(sessionId),
      cookiesCount: cookies.length,
      expiresAt
    });

    return NextResponse.json({
      success: true,
      message: 'Cookies saved successfully'
    });

  } catch (error) {
    logger.error('Extract cookies failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error
    });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
