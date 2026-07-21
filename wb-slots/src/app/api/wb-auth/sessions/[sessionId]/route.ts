import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUnifiedSessionManager } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logging';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'ID сессии не указан' },
        { status: 400 }
      );
    }

    // Получаем сессию из базы данных
    const session = await prisma.wBSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id, // Убеждаемся, что сессия принадлежит пользователю
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Сессия не найдена' },
        { status: 404 }
      );
    }

    // Используем UnifiedWBSessionManager для работы с новой схемой
    const sessionManager = getUnifiedSessionManager();

    // Расшифровываем данные сессии через UnifiedWBSessionManager
    let decryptedCookies: any[] = [];
    let localStorage: Record<string, string> = {};
    let sessionStorage: Record<string, string> = {};
    let sessionIdFromData: string = session.id;
    let userAgent: string = '';

    try {
      // Расшифровываем данные сессии через UnifiedWBSessionManager (поддерживает старый и новый формат)
      const sessionData = await (sessionManager as any).decryptSessionData(session);
      
      // Извлекаем данные в правильном формате
      decryptedCookies = Array.isArray(sessionData.cookies) ? sessionData.cookies : [];
      localStorage = sessionData.localStorage || {};
      sessionStorage = sessionData.sessionStorage || {};
      sessionIdFromData = sessionData.sessionId || session.id;
      userAgent = sessionData.userAgent || '';
      
      logger.debug({ 
        sessionId, 
        cookiesCount: decryptedCookies.length,
        localStorageKeys: Object.keys(localStorage).length,
        sessionStorageKeys: Object.keys(sessionStorage).length,
        sessionIdFromData
      }, 'Session data decrypted successfully');
    } catch (error) {
      logger.error({ 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Error decrypting session data');
      // Возвращаем пустые данные в случае ошибки расшифровки
    }

    // Форматируем cookies для отображения (уже в правильном формате после расшифровки)
    const formattedCookies = Array.isArray(decryptedCookies) 
      ? decryptedCookies.map((cookie: any) => {
          // Если cookie уже в формате Playwright, используем его как есть
          if (cookie && typeof cookie === 'object' && cookie.name && cookie.value) {
            return {
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain || 'wildberries.ru',
              path: cookie.path || '/',
              httpOnly: cookie.httpOnly || false,
              secure: cookie.secure !== undefined ? cookie.secure : true,
              sameSite: cookie.sameSite || 'Lax'
            };
          }
          // Если это объект с именем и значением
          if (cookie && typeof cookie === 'object') {
            const entries = Object.entries(cookie);
            if (entries.length > 0) {
              return {
                name: entries[0][0],
                value: String(entries[0][1]),
                domain: 'wildberries.ru',
                path: '/',
                httpOnly: false,
                secure: true,
                sameSite: 'Lax'
              };
            }
          }
          return null;
        }).filter((cookie: any) => cookie !== null)
      : [];

    // Извлекаем важные токены
    const importantTokens = {
      csrfToken: null,
      authToken: null,
      sessionToken: null,
      refreshToken: null
    };

    if (Array.isArray(formattedCookies)) {
      formattedCookies.forEach(cookie => {
        const name = cookie.name?.toLowerCase() || '';
        const value = cookie.value || '';
        
        if (name.includes('csrf') || name.includes('token')) {
          importantTokens.csrfToken = value;
        }
        if (name.includes('auth') || name.includes('jwt')) {
          importantTokens.authToken = value;
        }
        if (name.includes('session')) {
          importantTokens.sessionToken = value;
        }
        if (name.includes('refresh')) {
          importantTokens.refreshToken = value;
        }
      });
    }

    // Подготавливаем детальную информацию о сессии
    const sessionDetails = {
      id: session.id,
      sessionId: sessionIdFromData,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      userAgent: userAgent,
      ipAddress: session.ipAddress,
      cookies: {
        total: formattedCookies.length,
        list: formattedCookies,
        important: importantTokens
      },
      storage: {
        localStorage: Object.keys(localStorage).length,
        sessionStorage: Object.keys(sessionStorage).length,
        localStorageData: localStorage,
        sessionStorageData: sessionStorage
      }
    };

    return NextResponse.json({
      success: true,
      data: { session: sessionDetails },
    });

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Get session details error');
    return NextResponse.json(
      { success: false, error: 'Ошибка получения деталей сессии' },
      { status: 500 }
    );
  }
}
