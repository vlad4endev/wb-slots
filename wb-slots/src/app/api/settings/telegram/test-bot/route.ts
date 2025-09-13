import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { botSettingsService } from '@/lib/services/bot-settings.service';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin/developer role
    if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Developer role required.' }, { status: 403 });
    }

    // Get bot token from database
    const botToken = await botSettingsService.getTelegramBotToken();
    
    if (!botToken) {
      return NextResponse.json({
        success: false,
        error: 'Bot token not configured',
        botInfo: null
      });
    }

    try {
      // Test the bot token
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'WB-Slots/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const botData = await response.json();
        if (botData.ok) {
          return NextResponse.json({
            success: true,
            botInfo: {
              id: botData.result.id,
              username: botData.result.username,
              first_name: botData.result.first_name,
              can_join_groups: botData.result.can_join_groups,
              can_read_all_group_messages: botData.result.can_read_all_group_messages,
              supports_inline_queries: botData.result.supports_inline_queries
            }
          });
        } else {
          return NextResponse.json({
            success: false,
            error: `Telegram API error: ${botData.description}`,
            botInfo: null
          });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `HTTP error: ${response.status}`,
          botInfo: null
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: 'Connection timeout',
          botInfo: null
        });
      }
      
      return NextResponse.json({
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        botInfo: null
      });
    }
  } catch (error) {
    console.error('Error testing bot:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      botInfo: null
    }, { status: 500 });
  }
}
