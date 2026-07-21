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
    const { userId, phoneNumber } = body;
    const targetUserId = userId || user.id;

    console.log(`🔧 Force creating WB session via enhanced system for user ${targetUserId}`);

    // Создаем интеграционный сервис
    const sessionIntegration = new EnhancedSessionIntegration(process.env.ENCRYPTION_KEY);

    try {
      // Принудительно создаем сессию через улучшенную систему
      const result = await sessionIntegration.forceCreateSession(targetUserId, phoneNumber);

      if (result.success) {
        console.log(`✅ Enhanced session force creation successful for user ${targetUserId}`);
        
        return NextResponse.json({
          success: true,
          data: {
            sessionId: result.sessionId,
            userId: targetUserId,
            message: 'Session force created successfully via enhanced system'
          },
          warnings: result.warnings
        });
      } else {
        console.error(`❌ Enhanced session force creation failed for user ${targetUserId}:`, result.error);
        
        return NextResponse.json({
          success: false,
          error: result.error || 'Session force creation failed',
          warnings: result.warnings
        }, { status: 500 });
      }
    } finally {
      // Закрываем ресурсы
      await sessionIntegration.close();
    }

  } catch (error) {
    console.error('Enhanced session force creation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
