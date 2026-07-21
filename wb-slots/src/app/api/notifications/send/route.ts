import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTelegramService } from '@/lib/services/telegram-service';
import { NotificationType } from '@/lib/notifications/telegram-config';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { 
      type, 
      data, 
      userId, 
      broadcast = false,
      parseMode,
      disableWebPagePreview,
      disableNotification 
    } = body;

    // Валидация типа уведомления
    if (!type || !Object.values(NotificationType).includes(type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid notification type. Supported types: ' + Object.values(NotificationType).join(', ') 
        },
        { status: 400 }
      );
    }

    // Валидация данных
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Notification data is required' },
        { status: 400 }
      );
    }

    console.log(`📤 Sending notification: ${type}`, { 
      userId: broadcast ? 'broadcast' : userId, 
      dataKeys: Object.keys(data) 
    });

    const options = {
      parseMode,
      disableWebPagePreview,
      disableNotification,
    };

    let result;

    if (broadcast) {
      // Отправка всем активным пользователям
      result = await getTelegramService().broadcastNotification(type, data, options);
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Notification broadcasted successfully',
          sent: result.sent,
          failed: result.failed,
          total: result.sent + result.failed,
        },
      });
    } else {
      // Отправка конкретному пользователю
      const targetUserId = userId || user.id;
      const sent = await getTelegramService().sendNotification(targetUserId, type, data, options);
      
      if (sent) {
        return NextResponse.json({
          success: true,
          data: {
            message: 'Notification sent successfully',
            userId: targetUserId,
            type,
          },
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Failed to send notification' },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('Send notification error:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
