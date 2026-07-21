import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { botSettingsService } from '@/lib/services/bot-settings.service';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Testing Telegram admin endpoint...');
    
    // Check authentication
    const user = await getCurrentUser(request);
    console.log('User:', user ? { id: user.id, email: user.email, role: user.role } : 'Not authenticated');
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Access denied. Developer role required.',
        userRole: user.role 
      }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    console.log('Request body:', body);

    const { action, data } = body;

    if (action !== 'update_bot_token') {
      return NextResponse.json({ 
        error: 'Invalid action. Expected update_bot_token',
        receivedAction: action 
      }, { status: 400 });
    }

    if (!data || !data.botToken) {
      return NextResponse.json({ 
        error: 'Bot token is required',
        receivedData: data 
      }, { status: 400 });
    }

    // Test token validation (optional)
    if (!data.skipValidation) {
      console.log('🔍 Validating bot token...');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const testResponse = await fetch(`https://api.telegram.org/bot${data.botToken}/getMe`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'WB-Slots/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          console.error('Telegram API error:', testResponse.status, errorText);
          return NextResponse.json({ 
            error: `Invalid bot token (HTTP ${testResponse.status})`,
            details: errorText
          }, { status: 400 });
        }
        
        const botInfo = await testResponse.json();
        if (!botInfo.ok) {
          return NextResponse.json({ 
            error: `Telegram API error: ${botInfo.description}` 
          }, { status: 400 });
        }
        
        console.log('✅ Bot token is valid:', botInfo.result);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return NextResponse.json({ 
            error: 'Connection timeout. Please check your internet connection.' 
          }, { status: 408 });
        }
        
        console.error('Network error testing bot token:', error);
        return NextResponse.json({ 
          error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }, { status: 503 });
      }
    }

    // Save token to database
    console.log('💾 Saving bot token to database...');
    const saved = await botSettingsService.setTelegramBotToken(data.botToken);
    console.log('Save result:', saved);
    
    if (!saved) {
      return NextResponse.json({ error: 'Failed to save bot token' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Bot token saved successfully',
      botInfo: data.skipValidation ? null : 'Token validated and saved'
    });

  } catch (error) {
    console.error('Error in Telegram admin test:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
