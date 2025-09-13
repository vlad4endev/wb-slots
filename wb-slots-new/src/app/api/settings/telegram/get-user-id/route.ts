import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { telegramData } = await request.json();

    if (!telegramData || !telegramData.id) {
      return NextResponse.json({ 
        error: 'Telegram data is required' 
      }, { status: 400 });
    }

    const { id: telegramId, first_name, last_name, username } = telegramData;

    // Обновляем настройки пользователя с Telegram ID
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
            chatId: telegramId.toString(),
            enabled: true,
            userInfo: {
              firstName: first_name,
              lastName: last_name,
              username: username
            }
          }
        }
      },
      create: {
        userId: user.id,
        category: 'NOTIFICATION',
        settings: {
          telegram: {
            chatId: telegramId.toString(),
            enabled: true,
            userInfo: {
              firstName: first_name,
              lastName: last_name,
              username: username
            }
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram ID получен и сохранен автоматически',
      telegramId: telegramId.toString(),
      userInfo: {
        firstName: first_name,
        lastName: last_name,
        username: username
      }
    });
  } catch (error) {
    console.error('Error getting Telegram user ID:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем текущие настройки Telegram
    const userSettings = await prisma.userSettings.findFirst({
      where: {
        userId: user.id,
        category: 'NOTIFICATION'
      }
    });

    const telegramSettings = userSettings?.settings as any || {};
    const telegramEnabled = telegramSettings.telegram?.enabled || false;
    const telegramChatId = telegramSettings.telegram?.chatId || '';
    const userInfo = telegramSettings.telegram?.userInfo || {};

    return NextResponse.json({
      chatId: telegramChatId,
      enabled: telegramEnabled,
      userInfo: userInfo,
      hasTelegramId: !!telegramChatId
    });
  } catch (error) {
    console.error('Error fetching Telegram settings:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
