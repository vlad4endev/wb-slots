import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Симуляция получения логов
    const mockLogs = [
      {
        id: '1',
        level: 'info',
        message: 'Система запущена успешно',
        meta: { userId: user.id, timestamp: new Date().toISOString() },
        timestamp: new Date(Date.now() - 300000).toISOString(),
        service: 'system'
      },
      {
        id: '2',
        level: 'debug',
        message: 'Инициализация базы данных',
        meta: { connectionString: 'postgresql://...' },
        timestamp: new Date(Date.now() - 240000).toISOString(),
        service: 'database'
      },
      {
        id: '3',
        level: 'info',
        message: 'Пользователь авторизован',
        meta: { userId: user.id, email: user.email },
        timestamp: new Date(Date.now() - 180000).toISOString(),
        service: 'auth'
      },
      {
        id: '4',
        level: 'warn',
        message: 'Высокое использование памяти',
        meta: { memoryUsage: '85%', threshold: '80%' },
        timestamp: new Date(Date.now() - 120000).toISOString(),
        service: 'monitoring'
      },
      {
        id: '5',
        level: 'error',
        message: 'Ошибка подключения к внешнему API',
        meta: { api: 'wildberries', error: 'Connection timeout' },
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'wb-api'
      }
    ];

    return NextResponse.json({
      success: true,
      logs: mockLogs
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, level } = await request.json();

    if (!message || !level) {
      return NextResponse.json({ 
        error: 'Message and level are required' 
      }, { status: 400 });
    }

    // Симуляция записи лога
    const logEntry = {
      id: Date.now().toString(),
      level: level.toLowerCase(),
      message,
      meta: { 
        userId: user.id, 
        timestamp: new Date().toISOString(),
        test: true
      },
      timestamp: new Date().toISOString(),
      service: 'test-logging'
    };

    console.log(`[${level.toUpperCase()}] ${message}`, logEntry.meta);

    return NextResponse.json({
      success: true,
      message: 'Лог записан успешно',
      log: logEntry
    });
  } catch (error) {
    console.error('Error creating log:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}