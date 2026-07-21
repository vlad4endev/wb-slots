import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { EnhancedSessionIntegration } from '@/lib/services/enhanced-session-integration';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    console.log(`📊 Getting WB session status via enhanced system for user ${userId}`);

    // Создаем интеграционный сервис
    const sessionIntegration = new EnhancedSessionIntegration(process.env.ENCRYPTION_KEY);

    try {
      // Получаем статус сессии через улучшенную систему
      const result = await sessionIntegration.getSessionStatus(userId);

      if (result.success) {
        console.log(`✅ Enhanced session status retrieved for user ${userId}`);
        
        return NextResponse.json({
          success: true,
          data: result.data
        });
      } else {
        console.error(`❌ Enhanced session status failed for user ${userId}:`, result.error);
        
        return NextResponse.json({
          success: false,
          error: result.error || 'Failed to get session status'
        }, { status: 500 });
      }
    } finally {
      // Закрываем ресурсы
      await sessionIntegration.close();
    }

  } catch (error) {
    console.error('Enhanced session status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
