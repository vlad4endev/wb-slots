import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTelegramService } from '@/lib/services/telegram-service';
import { NotificationType } from '@/lib/notifications/telegram-config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { action, chatId, username, firstName, lastName } = body;

    console.log(`📱 Telegram notification API request from user ${user.id}`, { action, chatId });

    switch (action) {
      case 'register':
        if (!chatId) {
          return NextResponse.json(
            { success: false, error: 'Chat ID is required for registration' },
            { status: 400 }
          );
        }

        const registered = await getTelegramService().registerUser(
          user.id,
          chatId,
          username,
          firstName,
          lastName
        );

        if (registered) {
          return NextResponse.json({
            success: true,
            data: {
              message: 'Successfully registered for Telegram notifications',
              chatId,
            },
          });
        } else {
          return NextResponse.json(
            { success: false, error: 'Failed to register for Telegram notifications' },
            { status: 500 }
          );
        }

      case 'unregister':
        const unregistered = await getTelegramService().unregisterUser(user.id);
        
        if (unregistered) {
          return NextResponse.json({
            success: true,
            data: {
              message: 'Successfully unregistered from Telegram notifications',
            },
          });
        } else {
          return NextResponse.json(
            { success: false, error: 'Failed to unregister from Telegram notifications' },
            { status: 500 }
          );
        }

      case 'status':
        const userInfo = getTelegramService().getUser(user.id);
        const stats = getTelegramService().getStats();
        
        return NextResponse.json({
          success: true,
          data: {
            user: userInfo ? {
              chatId: userInfo.chatId,
              username: userInfo.username,
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              isActive: userInfo.isActive,
              registeredAt: userInfo.createdAt,
            } : null,
            stats,
            botInitialized: getTelegramService().isInitialized(),
          },
        });

      case 'test':
        if (!chatId) {
          return NextResponse.json(
            { success: false, error: 'Chat ID is required for test message' },
            { status: 400 }
          );
        }

        const testMessage = `🧪 <b>Тестовое сообщение</b>\n\nЭто тестовое уведомление от системы бронирования слотов Wildberries.\n\n✅ <i>Если вы видите это сообщение, уведомления работают корректно!</i>`;
        
        const sent = await getTelegramService().sendMessage(chatId, testMessage);
        
        if (sent) {
          return NextResponse.json({
            success: true,
            data: {
              message: 'Test message sent successfully',
            },
          });
        } else {
          return NextResponse.json(
            { success: false, error: 'Failed to send test message' },
            { status: 500 }
          );
        }

      case 'update-settings':
        const settings = body.settings;
        if (!settings) {
          return NextResponse.json(
            { success: false, error: 'Settings data is required' },
            { status: 400 }
          );
        }

        try {
          // Проверяем доступность бэкенда с таймаутом
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
          
          const response = await fetch(`${BACKEND_URL}/notifications/telegram/settings`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`,
            },
            body: JSON.stringify(settings),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const data = await response.json();
          return NextResponse.json(data);
        } catch (error) {
          console.log('Backend not available, using fallback update:', error.message);
          return NextResponse.json(
            { success: false, error: 'Failed to update settings' },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported actions: register, unregister, status, test' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Telegram notification API error:', error);
    
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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    console.log(`📱 Getting Telegram notification status for user ${user.id}`);

    // Получаем настройки из базы данных
    let settings = null;
    try {
      // Проверяем доступность бэкенда с таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
      
      const response = await fetch(`${BACKEND_URL}/notifications/telegram/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        settings = data.data?.settings;
      }
    } catch (error) {
      console.log('Backend not available, using fallback settings:', error.message);
      // Используем настройки по умолчанию если бэкенд недоступен
      settings = null;
    }

    // Получаем данные из памяти (для обратной совместимости)
    const userInfo = getTelegramService().getUser(user.id);
    const stats = getTelegramService().getStats();
    
    return NextResponse.json({
      success: true,
      data: {
        user: userInfo ? {
          chatId: userInfo.chatId,
          username: userInfo.username,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          isActive: userInfo.isActive,
          registeredAt: userInfo.createdAt,
        } : null,
        settings, // Добавляем настройки из БД
        stats,
        botInitialized: getTelegramService().isInitialized(),
        availableTypes: Object.values(NotificationType),
      },
    });

  } catch (error) {
    console.error('Get Telegram notification status error:', error);
    
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
