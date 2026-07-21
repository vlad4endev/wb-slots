import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Проверка наличия активной WB сессии для автобронирования
 * Не требует токена API - только проверяет сессию браузера
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    console.log('🔍 Проверка WB сессии для пользователя:', user.id);

    // Проверяем наличие WB сессии пользователя
    const wbSession = await prisma.wBSession.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: {
        lastValidated: 'desc',
      },
    });

    console.log('📊 Результат поиска WB сессии:', {
      found: !!wbSession,
      sessionId: wbSession?.id,
      isActive: wbSession?.isActive,
      lastValidated: wbSession?.lastValidated,
    });

    if (!wbSession) {
      return NextResponse.json({
        success: true,
        data: {
          hasSession: false,
          message: 'Нет активной сессии Wildberries. Авторизуйтесь через WB для автобронирования.',
        },
      });
    }

    // Проверяем, не истекла ли сессия
    // Используем expiresAt если есть, иначе проверяем lastValidated (не старше 7 дней)
    if (wbSession.expiresAt && new Date(wbSession.expiresAt) < new Date()) {
      console.log('⚠️ Сессия истекла по expiresAt:', wbSession.expiresAt);
      
      // Помечаем сессию как неактивную
      await prisma.wBSession.update({
        where: { id: wbSession.id },
        data: { 
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: 'expired'
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          hasSession: false,
          message: 'Сессия Wildberries истекла. Требуется повторная авторизация.',
        },
      });
    }

    // Дополнительная проверка по lastValidated (если expiresAt не установлен)
    if (!wbSession.expiresAt) {
      const lastValidated = new Date(wbSession.lastValidated || wbSession.createdAt);
      const sessionAge = Date.now() - lastValidated.getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней

      if (sessionAge > maxAge) {
        console.log('⚠️ Сессия истекла по lastValidated:', lastValidated);
        
        await prisma.wBSession.update({
          where: { id: wbSession.id },
          data: { 
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'expired_by_age'
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            hasSession: false,
            message: 'Сессия Wildberries истекла. Требуется повторная авторизация.',
          },
        });
      }
    }

    console.log('✅ Активная WB сессия найдена');

    return NextResponse.json({
      success: true,
      data: {
        hasSession: true,
        sessionId: wbSession.id,
        lastActive: wbSession.lastUsedAt || wbSession.lastValidated || wbSession.createdAt,
        expiresAt: wbSession.expiresAt,
        message: 'Активная сессия Wildberries найдена',
      },
    });

  } catch (error) {
    console.error('❌ Ошибка проверки WB сессии:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка проверки сессии',
      },
      { status: 500 }
    );
  }
}

