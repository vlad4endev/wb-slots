// ===== ENHANCED AUTO REFRESH API =====

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createApiHandler } from '@/lib/errors';
import { sessionAutoRefreshService } from '@/lib/session/session-auto-refresh-service';
import { sessionErrorHandler } from '@/lib/errors/session-error-handler';
import { enhancedRunLogger } from '@/lib/logging/enhanced-run-logger';

// ===== POST: Автоматическое обновление сессии =====
const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const { userId, forceRefresh = false, context } = body;
  
  const targetUserId = userId || user.id;

  // Проверяем права (пользователь может обновлять только свою сессию, админ - любую)
  if (user.role !== 'ADMIN' && targetUserId !== user.id) {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Вы можете обновлять только свою сессию.'
    }, { status: 403 });
  }

  try {
    // Проверяем здоровье сессии
    const healthCheck = await sessionAutoRefreshService.checkSessionHealth(targetUserId);
    
    if (!healthCheck.isHealthy) {
      return NextResponse.json({
        success: false,
        error: healthCheck.error || 'Сессия не найдена или недействительна',
        data: {
          isHealthy: false,
          needsRefresh: false,
          expiresIn: 0
        }
      }, { status: 400 });
    }

    // Если сессия здорова и не требуется принудительное обновление
    if (!healthCheck.needsRefresh && !forceRefresh) {
      return NextResponse.json({
        success: true,
        data: {
          isHealthy: true,
          needsRefresh: false,
          expiresIn: healthCheck.expiresIn,
          lastUsedAt: healthCheck.lastUsedAt,
          message: 'Сессия не требует обновления'
        }
      });
    }

    // Выполняем обновление сессии
    const refreshResult = await sessionAutoRefreshService.handleSessionExpired(
      targetUserId,
      context
    );

    if (refreshResult.success) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId: refreshResult.sessionId,
          newExpiresAt: refreshResult.newExpiresAt,
          refreshMethod: refreshResult.refreshMethod,
          isHealthy: true,
          needsRefresh: false,
          message: 'Сессия успешно обновлена'
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: refreshResult.error || 'Ошибка обновления сессии',
        data: {
          isHealthy: false,
          needsRefresh: true,
          refreshAttempts: sessionErrorHandler.getRefreshStats()[targetUserId] || 0
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Enhanced auto refresh API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    }, { status: 500 });
  }
};

// ===== GET: Проверка состояния сессии =====
const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || user.id;

  // Проверяем права
  if (user.role !== 'ADMIN' && userId !== user.id) {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен'
    }, { status: 403 });
  }

  try {
    const healthCheck = await sessionAutoRefreshService.checkSessionHealth(userId);
    const refreshStats = sessionErrorHandler.getRefreshStats();

    return NextResponse.json({
      success: true,
      data: {
        isHealthy: healthCheck.isHealthy,
        needsRefresh: healthCheck.needsRefresh,
        expiresIn: healthCheck.expiresIn,
        lastUsedAt: healthCheck.lastUsedAt,
        error: healthCheck.error,
        refreshAttempts: refreshStats[userId] || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Session health check API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка проверки сессии'
    }, { status: 500 });
  }
};

// ===== DELETE: Сброс счетчика попыток обновления =====
const deleteHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const { userId } = body;
  
  const targetUserId = userId || user.id;

  // Проверяем права
  if (user.role !== 'ADMIN' && targetUserId !== user.id) {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен'
    }, { status: 403 });
  }

  try {
    sessionErrorHandler.resetRefreshAttempts(targetUserId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Счетчик попыток обновления сброшен',
        userId: targetUserId
      }
    });

  } catch (error) {
    console.error('Reset refresh attempts API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сброса счетчика'
    }, { status: 500 });
  }
};

export const POST = postHandler;
export const GET = getHandler;
export const DELETE = deleteHandler;
