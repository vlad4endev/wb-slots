import { NextRequest, NextResponse } from 'next/server';
import { botSettingsService } from '@/lib/services/bot-settings.service';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Раньше этот роут отдавал превью системного TELEGRAM_BOT_TOKEN
    // (общего для всех пользователей секрета) вообще без проверки авторизации.
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied. Developer role required.' }, { status: 403 });
    }

    console.log('🔍 Checking Telegram bot token configuration...');
    
    // Check environment variable
    const envToken = process.env.TELEGRAM_BOT_TOKEN;
    console.log('Environment token exists:', !!envToken);
    console.log('Environment token length:', envToken?.length || 0);
    
    // Check database
    const dbToken = await botSettingsService.getTelegramBotToken();
    console.log('Database token exists:', !!dbToken);
    console.log('Database token length:', dbToken?.length || 0);
    
    // Check if bot is configured
    const isConfigured = await botSettingsService.isBotConfigured();
    console.log('Bot configured:', isConfigured);
    
    return NextResponse.json({
      success: true,
      data: {
        environment: {
          hasToken: !!envToken,
          tokenLength: envToken?.length || 0,
          tokenPreview: envToken ? envToken.substring(0, 10) + '...' : null
        },
        database: {
          hasToken: !!dbToken,
          tokenLength: dbToken?.length || 0,
          tokenPreview: dbToken ? dbToken.substring(0, 10) + '...' : null
        },
        configuration: {
          isConfigured,
          hasAnyToken: !!(envToken || dbToken)
        }
      }
    });
    
  } catch (error) {
    console.error('Error checking Telegram token:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
