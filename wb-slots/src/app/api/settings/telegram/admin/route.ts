import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { botSettingsService } from '@/lib/services/bot-settings.service';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Проверяем роль пользователя - доступ для DEVELOPER и ADMIN
    if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Developer role required.' }, { status: 403 });
    }

    // Get bot token from database or environment
    const dbBotToken = await botSettingsService.getTelegramBotToken();
    const envBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const botToken = dbBotToken || envBotToken;

    // Get notification templates (with error handling for missing table)
    let templates: any[] = [];
    try {
      templates = await prisma.notificationTemplate.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.warn('NotificationTemplate table not found, returning empty templates array');
      templates = [];
    }

    return NextResponse.json({
      botToken: botToken ? '***configured***' : '',
      botTokenConfigured: !!botToken,
      templates
    });
  } catch (error) {
    console.error('Error fetching admin Telegram settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Проверяем роль пользователя - доступ для DEVELOPER и ADMIN
    if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Developer role required.' }, { status: 403 });
    }

    const { action, data } = await request.json();

    switch (action) {
      case 'update_bot_token':
        if (!data.botToken) {
          return NextResponse.json({ error: 'Bot token is required' }, { status: 400 });
        }
        
        // Skip validation if explicitly requested (for offline environments)
        if (data.skipValidation) {
          console.log('Skipping bot token validation as requested');
        } else {
          // Test the token with timeout and proper error handling
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
          
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
              error: `Invalid bot token (HTTP ${testResponse.status})` 
            }, { status: 400 });
          }
          
          const botInfo = await testResponse.json();
          if (!botInfo.ok) {
            return NextResponse.json({ 
              error: `Telegram API error: ${botInfo.description}` 
            }, { status: 400 });
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json({ 
              error: 'Connection timeout. Please check your internet connection and try again.' 
            }, { status: 408 });
          }
          
          console.error('Network error testing bot token:', error);
          return NextResponse.json({ 
            error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your internet connection.` 
          }, { status: 503 });
        }
        }

        // Save token to database
        const saved = await botSettingsService.setTelegramBotToken(data.botToken);
        if (!saved) {
          return NextResponse.json({ error: 'Failed to save bot token' }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Bot token saved successfully' 
        });

      case 'create_template':
        const { name, description, type, template, variables } = data;
        
        if (!name || !type || !template) {
          return NextResponse.json({ 
            error: 'Name, type, and template are required' 
          }, { status: 400 });
        }

        try {
          const newTemplate = await prisma.notificationTemplate.create({
            data: {
              name,
              description,
              type,
              template,
              variables: variables || {}
            }
          });

          return NextResponse.json({ 
            success: true, 
            template: newTemplate,
            message: 'Template created successfully' 
          });
        } catch (error) {
          return NextResponse.json({ 
            error: 'NotificationTemplate table not found. Please run database migration first.' 
          }, { status: 500 });
        }

      case 'update_template':
        const { id, ...updateData } = data;
        
        if (!id) {
          return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
        }

        try {
          const updatedTemplate = await prisma.notificationTemplate.update({
            where: { id },
            data: updateData
          });

          return NextResponse.json({ 
            success: true, 
            template: updatedTemplate,
            message: 'Template updated successfully' 
          });
        } catch (error) {
          return NextResponse.json({ 
            error: 'NotificationTemplate table not found. Please run database migration first.' 
          }, { status: 500 });
        }

      case 'delete_template':
        const { templateId } = data;
        
        if (!templateId) {
          return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
        }

        try {
          await prisma.notificationTemplate.delete({
            where: { id: templateId }
          });

          return NextResponse.json({ 
            success: true, 
            message: 'Template deleted successfully' 
          });
        } catch (error) {
          return NextResponse.json({ 
            error: 'NotificationTemplate table not found. Please run database migration first.' 
          }, { status: 500 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing admin Telegram settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
