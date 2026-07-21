import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { botSettingsService } from '@/lib/services/bot-settings.service';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Detailed Telegram admin logging...');
    
    // Check authentication
    const user = await getCurrentUser(request);
    console.log('User authenticated:', user ? { id: user.id, email: user.email, role: user.role } : 'No user');
    
    if (!user) {
      console.log('❌ No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    console.log('User role:', user.role);
    if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
      console.log('❌ Insufficient role:', user.role);
      return NextResponse.json({ 
        error: 'Access denied. Developer role required.',
        userRole: user.role 
      }, { status: 403 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log('Request body parsed successfully:', { 
        action: body.action, 
        hasData: !!body.data,
        hasBotToken: !!body.data?.botToken,
        tokenLength: body.data?.botToken?.length || 0
      });
    } catch (parseError) {
      console.log('❌ Error parsing request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: parseError instanceof Error ? parseError.message : 'Unknown error'
      }, { status: 400 });
    }

    const { action, data } = body;

    // Check action
    console.log('Action:', action);
    if (action !== 'update_bot_token') {
      console.log('❌ Invalid action:', action);
      return NextResponse.json({ 
        error: 'Invalid action. Expected update_bot_token',
        receivedAction: action 
      }, { status: 400 });
    }

    // Check data
    console.log('Data object:', data);
    if (!data) {
      console.log('❌ No data object');
      return NextResponse.json({ 
        error: 'Data object is required' 
      }, { status: 400 });
    }

    if (!data.botToken) {
      console.log('❌ No bot token in data');
      return NextResponse.json({ 
        error: 'Bot token is required',
        receivedData: data 
      }, { status: 400 });
    }

    console.log('Bot token received, length:', data.botToken.length);
    console.log('Bot token preview:', data.botToken.substring(0, 10) + '...');

    // Test token validation
    if (!data.skipValidation) {
      console.log('🔍 Validating bot token with Telegram API...');
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
        
        console.log('Telegram API response status:', testResponse.status);
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          console.log('❌ Telegram API error:', testResponse.status, errorText);
          return NextResponse.json({ 
            error: `Invalid bot token (HTTP ${testResponse.status})`,
            details: errorText
          }, { status: 400 });
        }
        
        const botInfo = await testResponse.json();
        console.log('Telegram API response:', botInfo);
        
        if (!botInfo.ok) {
          console.log('❌ Telegram API returned error:', botInfo.description);
          return NextResponse.json({ 
            error: `Telegram API error: ${botInfo.description}` 
          }, { status: 400 });
        }
        
        console.log('✅ Bot token is valid:', botInfo.result);
      } catch (error) {
        console.log('❌ Error validating bot token:', error);
        if (error instanceof Error && error.name === 'AbortError') {
          return NextResponse.json({ 
            error: 'Connection timeout. Please check your internet connection.' 
          }, { status: 408 });
        }
        
        return NextResponse.json({ 
          error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }, { status: 503 });
      }
    } else {
      console.log('⏭️ Skipping token validation as requested');
    }

    // Save token to database
    console.log('💾 Saving bot token to database...');
    try {
      const saved = await botSettingsService.setTelegramBotToken(data.botToken);
      console.log('Save result:', saved);
      
      if (!saved) {
        console.log('❌ Failed to save bot token');
        return NextResponse.json({ error: 'Failed to save bot token' }, { status: 500 });
      }
      
      console.log('✅ Bot token saved successfully');
    } catch (saveError) {
      console.log('❌ Error saving bot token:', saveError);
      return NextResponse.json({ 
        error: 'Failed to save bot token',
        details: saveError instanceof Error ? saveError.message : 'Unknown error'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Bot token saved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Unexpected error in detailed logging:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
