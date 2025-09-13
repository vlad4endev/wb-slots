import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSettings = await prisma.userSettings.findFirst({
      where: {
        userId: user.id,
        category: 'NOTIFICATION'
      }
    });

    const telegramSettings = userSettings?.settings as any || {};
    
    return NextResponse.json({
      chatId: telegramSettings.telegram?.chatId || '',
      enabled: telegramSettings.telegram?.enabled || false,
      userInfo: telegramSettings.telegram?.userInfo || null
    });
  } catch (error) {
    console.error('Error fetching Telegram user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, enabled, userInfo } = await request.json();

    if (!chatId || typeof enabled !== 'boolean') {
      return NextResponse.json({ 
        error: 'Chat ID is required and enabled must be boolean' 
      }, { status: 400 });
    }

    // Update or create user settings
    await prisma.userSettings.upsert({
      where: {
        userId_category: {
          userId: user.id,
          category: 'NOTIFICATION'
        }
      },
      update: {
        settings: {
          telegram: {
            chatId,
            enabled,
            userInfo: userInfo || null
          }
        }
      },
      create: {
        userId: user.id,
        category: 'NOTIFICATION',
        settings: {
          telegram: {
            chatId,
            enabled,
            userInfo: userInfo || null
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram settings updated successfully' 
    });
  } catch (error) {
    console.error('Error updating Telegram user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
