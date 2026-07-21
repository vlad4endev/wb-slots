import { NextRequest, NextResponse } from 'next/server';
import { EnhancedWBAuthService } from '@/lib/services/enhanced-wb-auth-service';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const user = await requireAuth(request);

    // Проверяем наличие ключа шифрования
    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json(
        { success: false, error: 'ENCRYPTION_KEY not configured' },
        { status: 500 }
      );
    }

    const { action, userId, options } = await request.json();
    const targetUserId = userId || user.id;

    // Создаем сервис авторизации
    const authService = new EnhancedWBAuthService(process.env.ENCRYPTION_KEY);

    let result;

    switch (action) {
      case 'authenticate':
        result = await authService.authenticate({
          userId: targetUserId,
          ...options
        });
        break;

      case 'restore':
        result = await authService.restoreSession(targetUserId);
        break;

      case 'refresh':
        result = await authService.refreshSession(targetUserId);
        break;

      case 'stats':
        const stats = await authService.getSessionStats(targetUserId);
        return NextResponse.json({
          success: true,
          data: stats
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Закрываем браузер после использования
    await authService.closeBrowser();

    return NextResponse.json({
      success: result.success,
      data: result.success ? {
        sessionId: result.sessionId,
        userId: targetUserId
      } : null,
      error: result.error,
      warnings: result.warnings
    });

  } catch (error) {
    console.error('Enhanced WB auth error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
