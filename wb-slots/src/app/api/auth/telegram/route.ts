import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';
import { botSettingsService } from '@/lib/services/bot-settings.service';
import { z } from 'zod';
import crypto from 'crypto';

// Схема валидации данных Telegram Web App
const telegramAuthSchema = z.object({
  initData: z.string(),
  initDataUnsafe: z.object({
    user: z.object({
      id: z.number(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional(),
      language_code: z.string().optional(),
      is_premium: z.boolean().optional(),
    }),
    query_id: z.string().optional(),
    auth_date: z.number().optional(),
    hash: z.string().optional(),
  }),
});

// Функция для проверки подписи Telegram Web App
function validateTelegramWebAppData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) return false;
    
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Error validating Telegram Web App data:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = telegramAuthSchema.parse(body);
    
    const { initData, initDataUnsafe } = validatedData;
    const { user: telegramUser } = initDataUnsafe;
    
    // Получаем токен бота из базы данных или переменных окружения
    const dbBotToken = await botSettingsService.getTelegramBotToken();
    const envBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const botToken = dbBotToken || envBotToken;
    
    if (!botToken) {
      return NextResponse.json(
        { success: false, error: 'Telegram bot token not configured. Please configure @SearchLotWB_bot token in admin settings.' },
        { status: 500 }
      );
    }
    
    // Проверяем подпись данных (в продакшене)
    if (process.env.NODE_ENV === 'production') {
      const isValid = validateTelegramWebAppData(initData, botToken);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid Telegram Web App data' },
          { status: 401 }
        );
      }
    }
    
    // Ищем пользователя по Telegram ID
    let user = await prisma.user.findFirst({
      where: {
        settings: {
          some: {
            category: 'NOTIFICATION',
            settings: {
              path: ['telegram', 'chatId'],
              equals: telegramUser.id.toString(),
            },
          },
        },
      },
      include: {
        settings: {
          where: {
            category: 'NOTIFICATION',
          },
        },
      },
    });
    
    // Если пользователь не найден, создаем нового
    if (!user) {
      // Генерируем временный email на основе Telegram ID
      const tempEmail = `telegram_${telegramUser.id}@temp.local`;
      
      // Создаем пользователя
      user = await prisma.user.create({
        data: {
          email: tempEmail,
          name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
          passwordHash: '', // Пустой пароль для Telegram пользователей
          role: 'USER',
          isActive: true,
          emailVerified: new Date(), // Считаем email верифицированным для Telegram пользователей
        },
        include: {
          settings: true,
        },
      });
      
      // Создаем настройки Telegram
      await prisma.userSettings.create({
        data: {
          userId: user.id,
          category: 'NOTIFICATION',
          settings: {
            telegram: {
              chatId: telegramUser.id.toString(),
              enabled: true,
              userInfo: {
                firstName: telegramUser.first_name,
                lastName: telegramUser.last_name,
                username: telegramUser.username,
                languageCode: telegramUser.language_code,
                isPremium: telegramUser.is_premium,
              },
            },
          },
        },
      });
    } else {
      // Обновляем информацию о пользователе из Telegram
      const telegramSettings = user.settings.find(s => s.category === 'NOTIFICATION');
      if (telegramSettings) {
        const settings = telegramSettings.settings as any;
        if (settings.telegram) {
          // Обновляем информацию о пользователе
          await prisma.user.update({
            where: { id: user.id },
            data: {
              name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
            },
          });
          
          // Обновляем настройки Telegram
          await prisma.userSettings.update({
            where: { id: telegramSettings.id },
            data: {
              settings: {
                ...settings,
                telegram: {
                  ...settings.telegram,
                  userInfo: {
                    firstName: telegramUser.first_name,
                    lastName: telegramUser.last_name,
                    username: telegramUser.username,
                    languageCode: telegramUser.language_code,
                    isPremium: telegramUser.is_premium,
                  },
                },
              },
            },
          });
        }
      }
    }
    
    // Проверяем, активен ли пользователь
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated' },
        { status: 403 }
      );
    }
    
    // Генерируем JWT токен
    const token = await generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    
    // Обновляем время последнего входа
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });
    
    // Создаем ответ
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          timezone: user.timezone,
          role: user.role,
          createdAt: user.createdAt,
          telegramUser: {
            id: telegramUser.id,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            username: telegramUser.username,
            languageCode: telegramUser.language_code,
            isPremium: telegramUser.is_premium,
          },
        },
      },
      message: 'Telegram authentication successful',
    });
    
    // Устанавливаем cookie с токеном
    setAuthCookie(response, token, request);
    
    return response;
  } catch (error) {
    console.error('Telegram auth error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
