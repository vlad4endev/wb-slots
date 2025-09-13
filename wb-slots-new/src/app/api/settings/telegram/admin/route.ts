import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

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

    // Get bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

    // Get notification templates (with error handling for missing table)
    let templates = [];
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
        // Note: In production, you'd want to store this securely
        // For now, we'll just validate it
        if (!data.botToken) {
          return NextResponse.json({ error: 'Bot token is required' }, { status: 400 });
        }
        
        // Test the token
        const testResponse = await fetch(`https://api.telegram.org/bot${data.botToken}/getMe`);
        if (!testResponse.ok) {
          return NextResponse.json({ error: 'Invalid bot token' }, { status: 400 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Bot token validated successfully. Please update TELEGRAM_BOT_TOKEN in .env.local' 
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
