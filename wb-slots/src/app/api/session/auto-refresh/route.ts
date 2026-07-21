// ===== SESSION AUTO-REFRESH API =====

import { NextRequest, NextResponse } from 'next/server';

// Отключаем prerendering для этого API route
export const dynamic = 'force-dynamic';
import { requireAuth } from '@/lib/auth';
import { createApiHandler } from '@/lib/errors';
import { getUnifiedSessionManager } from '@/lib/session';
import { sessionScheduler } from '@/lib/session/session-scheduler';

// ===== GET: Получение статуса автообновления =====
const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  
  // Получаем статистику планировщика
  const schedulerStats = sessionScheduler.getStats();
  
  // Получаем информацию о сессии пользователя
  const wbSessionManager = getUnifiedSessionManager();
  const sessionValidation = await wbSessionManager.validateSession(user.id);
  
  return NextResponse.json({
    success: true,
    data: {
      scheduler: {
        enabled: true,
        stats: schedulerStats
      },
      userSession: {
        isValid: sessionValidation.isValid,
        needsRefresh: sessionValidation.needsRefresh,
        sessionAge: sessionValidation.sessionAge,
        error: sessionValidation.error
      }
    }
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-auto-refresh-status',
    method: 'GET'
  })
});

// ===== POST: Принудительное обновление сессии =====
const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  
  // Принудительно обновляем сессию пользователя
  const wbSessionManager = getUnifiedSessionManager();
  const refreshResult = await wbSessionManager.autoRefreshSession(user.id);
  
  if (refreshResult.success) {
    return NextResponse.json({
      success: true,
      data: {
        sessionId: refreshResult.sessionId,
        newExpiresAt: refreshResult.newExpiresAt,
        message: 'Сессия успешно обновлена'
      }
    });
  } else {
    return NextResponse.json({
      success: false,
      error: refreshResult.error || 'Ошибка обновления сессии'
    }, { status: 400 });
  }
};

export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-auto-refresh',
    method: 'POST'
  })
});

// ===== PUT: Принудительная проверка всех сессий =====
const putHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  
  // Проверяем права администратора
  if (user.role !== 'ADMIN') {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Требуются права администратора.'
    }, { status: 403 });
  }
  
  // Принудительно запускаем проверку всех сессий
  await sessionScheduler.forceCheck();
  
  const stats = sessionScheduler.getStats();
  
  return NextResponse.json({
    success: true,
    data: {
      message: 'Проверка сессий запущена',
      stats
    }
  });
};

export const PUT = createApiHandler(putHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-force-check',
    method: 'PUT'
  })
});
