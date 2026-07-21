import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { EnhancedSessionIntegration } from '@/lib/services/enhanced-session-integration';

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

    const body = await request.json();
    const { userId } = body;
    const targetUserId = userId || user.id;

    console.log(`🧹 Cleaning up WB sessions via enhanced system for user ${targetUserId}`);

    // Создаем интеграционный сервис
    const sessionIntegration = new EnhancedSessionIntegration(process.env.ENCRYPTION_KEY);

    try {
      // Очищаем сессии через улучшенную систему
      const result = await sessionIntegration.cleanupSessions(targetUserId);

      if (result.success) {
        console.log(`✅ Enhanced session cleanup completed for user ${targetUserId}`);
        
        return NextResponse.json({
          success: true,
          data: result.data
        });
      } else {
        console.error(`❌ Enhanced session cleanup failed for user ${targetUserId}:`, result.error);
        
        return NextResponse.json({
          success: false,
          error: result.error || 'Session cleanup failed'
        }, { status: 500 });
      }
    } finally {
      // Закрываем ресурсы
      await sessionIntegration.close();
    }

  } catch (error) {
    console.error('Enhanced session cleanup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
