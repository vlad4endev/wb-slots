import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { botSettingsService } from '@/lib/services/bot-settings.service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await request.json();

    if (!chatId) {
      return NextResponse.json({ 
        error: 'Chat ID is required' 
      }, { status: 400 });
    }

    // Get bot token
    const botToken = await botSettingsService.getTelegramBotToken();
    if (!botToken) {
      return NextResponse.json({ 
        error: 'Bot token not configured' 
      }, { status: 400 });
    }

    try {
      // Get user info from Telegram
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          return NextResponse.json({
            success: true,
            userInfo: {
              id: data.result.id,
              firstName: data.result.first_name,
              lastName: data.result.last_name || '',
              username: data.result.username || '',
              type: data.result.type
            }
          });
        } else {
          return NextResponse.json({
            success: false,
            error: `Telegram API error: ${data.description}`
          });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `HTTP error: ${response.status}`
        });
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  } catch (error) {
    console.error('Error getting Telegram user info:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
