import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WBAuthPopupService } from '@/lib/services/wb-auth-popup-service';
import { WBSessionManager, getUnifiedSessionManager } from '@/lib/session';
import { Logger } from '@/lib/logging/logger';

const logger = new Logger();

/**
 * API для создания новой сессии WB с улучшенной архитектурой
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { action } = body;

    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Encryption key not configured'
      }, { status: 500 });
    }

    const sessionManager = getUnifiedSessionManager();

    switch (action) {
      case 'start':
        return await startSessionCreation(user.id, sessionManager);
      
      case 'check':
        return await checkSessionCreation(user.id);
      
      case 'close':
        return await closeSessionCreation(user.id);
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: start, check, or close'
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('WBSession Create API error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Запуск создания сессии
 */
async function startSessionCreation(userId: string, sessionManager: WBSessionManager) {
  try {
    logger.info('🚀 Starting session creation', { userId });

    const authService = new WBAuthPopupService();
    
    // Запускаем popup авторизации
    await authService.startAuthPopup({
      userId,
      onProgress: (message: string) => {
        logger.info('📝 Auth progress', { userId, message });
      },
      onSuccess: async (sessionData: any) => {
        logger.info('✅ Auth successful, creating session', { userId });
        
        // Создаем сессию с новой архитектурой
        const fingerprint = await sessionManager.createSession(userId, sessionData.page);
        
        logger.info('🎉 Session created successfully', { 
          userId, 
          fingerprint: fingerprint.substring(0, 8) + '...' 
        });
      },
      onError: (error: string) => {
        logger.error('❌ Auth failed', { userId, error });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Session creation started. Please complete authentication in the browser.',
        status: 'waiting_for_auth'
      }
    });

    } catch (error) {
      logger.error('❌ Failed to start session creation', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
}

/**
 * Проверка статуса создания сессии
 */
async function checkSessionCreation(userId: string) {
  try {
    logger.info('🔍 Checking session creation status', { userId });

    const authService = new WBAuthPopupService();
    const status = await authService.getStatus();

    return NextResponse.json({
      success: true,
      data: {
        status: status.isActive ? 'in_progress' : 'completed',
        isActive: status.isActive,
        message: status.isActive ? 'Authentication in progress' : 'Authentication completed'
      }
    });

    } catch (error) {
      logger.error('❌ Failed to check session creation status', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
}

/**
 * Закрытие процесса создания сессии
 */
async function closeSessionCreation(userId: string) {
  try {
    logger.info('🔒 Closing session creation', { userId });

    const authService = new WBAuthPopupService();
    await authService.closePopup();

    return NextResponse.json({
      success: true,
      data: {
        message: 'Session creation process closed'
      }
    });

    } catch (error) {
      logger.error('❌ Failed to close session creation', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
}
