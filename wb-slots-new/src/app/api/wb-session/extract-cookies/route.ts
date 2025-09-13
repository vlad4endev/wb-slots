import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

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

    // Подготавливаем данные для сохранения
    const sessionData = {
      cookies,
      localStorage: localStorage || {},
      sessionStorage: sessionStorage || {}
    };

    // Шифруем данные в формате, совместимом с WBSessionManager
    const encryptedData = encrypt(JSON.stringify(sessionData.cookies));

    // Сохраняем в базу данных
    await prisma.wBSession.upsert({
      where: {
        userId: user.id
      },
      update: {
        cookies: { encrypted: encryptedData } as any,
        isActive: true,
        lastUsedAt: new Date()
      },
      create: {
        userId: user.id,
        sessionId: `session_${Date.now()}_${user.id}`,
        cookies: { encrypted: encryptedData } as any,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
        lastUsedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Cookies saved successfully'
    });

  } catch (error) {
    console.error('Extract cookies error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
