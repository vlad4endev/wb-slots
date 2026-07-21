// ===== SIMPLIFIED SESSION REFRESH API =====

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createApiHandler } from '@/lib/errors';
import { getUnifiedSessionManager } from '@/lib/session';

// ===== POST: Обновление сессии пользователя =====
const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const { userId } = body;
  const targetUserId = userId || user.id;

  // Проверяем права (пользователь может обновлять только свою сессию, админ - любую)
  if (user.role !== 'ADMIN' && targetUserId !== user.id) {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Вы можете обновлять только свою сессию.'
    }, { status: 403 });
  }

  // Обновляем сессию
  const wbSessionManager = getUnifiedSessionManager();
  const refreshResult = await wbSessionManager.autoRefreshSession(targetUserId);

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
    endpoint: 'session-refresh',
    method: 'POST'
  })
});

// ===== GET: Получение информации о сессии =====
const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const { userId } = body;
  const targetUserId = userId || user.id;

  // Проверяем права
  if (user.role !== 'ADMIN' && targetUserId !== user.id) {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Вы можете просматривать только свою сессию.'
    }, { status: 403 });
  }

  // Получаем информацию о сессии
  const sessionData = await wbSessionManager.getActiveSession(targetUserId);
  const validation = await wbSessionManager.validateSession(targetUserId);

  return NextResponse.json({
    success: true,
    data: {
      hasActiveSession: !!sessionData,
      sessionValidation: validation,
      sessionData: sessionData ? {
        timestamp: sessionData.timestamp,
        userAgent: sessionData.userAgent
      } : null
    }
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-info',
    method: 'GET'
  })
});
