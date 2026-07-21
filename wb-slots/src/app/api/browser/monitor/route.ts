import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { browserMonitorService } from '@/lib/services/browser-monitor-service';
// import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { action, config } = body;

    console.info('📊 Browser monitor request', { userId, action, config });

    switch (action) {
      case 'start':
        // Обновляем конфигурацию с ID пользователя
        browserMonitorService.updateConfig({
          ...config,
          userId,
          enabled: true
        });
        
        await browserMonitorService.start();
        
        return NextResponse.json({
          success: true,
          message: 'Browser monitor started successfully',
          state: browserMonitorService.getState()
        });

      case 'stop':
        await browserMonitorService.stop();
        
        return NextResponse.json({
          success: true,
          message: 'Browser monitor stopped successfully',
          state: browserMonitorService.getState()
        });

      case 'restart':
        await browserMonitorService.restart();
        
        return NextResponse.json({
          success: true,
          message: 'Browser monitor restarted successfully',
          state: browserMonitorService.getState()
        });

      case 'update_config':
        browserMonitorService.updateConfig({
          ...config,
          userId
        });
        
        return NextResponse.json({
          success: true,
          message: 'Browser monitor config updated successfully',
          state: browserMonitorService.getState()
        });

      case 'force_check':
        const browserState = await browserMonitorService.forceCheck();
        
        return NextResponse.json({
          success: true,
          message: 'Browser state checked successfully',
          browserState
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Browser monitor error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    console.info('📊 Getting browser monitor state', { userId });

    const state = browserMonitorService.getState();

    return NextResponse.json({
      success: true,
      state: {
        ...state,
        // Скрываем чувствительные данные
        config: {
          ...state.config,
          userId: state.config.userId ? '***' : undefined
        }
      }
    });

  } catch (error) {
    console.error('❌ Browser monitor state error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
