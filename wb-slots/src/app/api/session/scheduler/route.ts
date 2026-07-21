// ===== SESSION SCHEDULER MANAGEMENT API =====

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createApiHandler } from '@/lib/errors';
import { sessionScheduler } from '@/lib/session/session-scheduler';
import { z } from 'zod';

// ===== SCHEMAS =====

const schedulerConfigSchema = z.object({
  checkInterval: z.number().min(5 * 60 * 1000).max(24 * 60 * 60 * 1000), // 5 минут - 24 часа
  batchSize: z.number().min(1).max(50),
  maxConcurrent: z.number().min(1).max(10),
  enabled: z.boolean()
});

// ===== GET: Получение статуса планировщика =====
const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  
  // Проверяем права администратора
  if (user.role !== 'ADMIN') {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Требуются права администратора.'
    }, { status: 403 });
  }
  
  const stats = sessionScheduler.getStats();
  
  return NextResponse.json({
    success: true,
    data: {
      scheduler: {
        isRunning: true, // TODO: добавить метод для проверки статуса
        stats
      }
    }
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-scheduler-status',
    method: 'GET'
  })
});

// ===== POST: Запуск планировщика =====
const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  
  // Проверяем права администратора
  if (user.role !== 'ADMIN') {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Требуются права администратора.'
    }, { status: 403 });
  }
  
  sessionScheduler.start();
  
  return NextResponse.json({
    success: true,
    data: {
      message: 'Планировщик сессий запущен'
    }
  });
};

export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-scheduler-start',
    method: 'POST'
  })
});

// ===== DELETE: Остановка планировщика =====
const deleteHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  
  // Проверяем права администратора
  if (user.role !== 'ADMIN') {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Требуются права администратора.'
    }, { status: 403 });
  }
  
  sessionScheduler.stop();
  
  return NextResponse.json({
    success: true,
    data: {
      message: 'Планировщик сессий остановлен'
    }
  });
};

export const DELETE = createApiHandler(deleteHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-scheduler-stop',
    method: 'DELETE'
  })
});

// ===== PUT: Обновление конфигурации планировщика =====
const putHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  
  // Проверяем права администратора
  if (user.role !== 'ADMIN') {
    return NextResponse.json({
      success: false,
      error: 'Доступ запрещен. Требуются права администратора.'
    }, { status: 403 });
  }
  
  const body = await request.json();
  const validatedConfig = schedulerConfigSchema.parse(body);
  
  sessionScheduler.updateConfig(validatedConfig);
  
  return NextResponse.json({
    success: true,
    data: {
      message: 'Конфигурация планировщика обновлена',
      config: validatedConfig
    }
  });
};

export const PUT = createApiHandler(putHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'session-scheduler-config',
    method: 'PUT'
  })
});
