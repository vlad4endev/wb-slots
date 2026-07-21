import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';
import { botSettingsService } from '@/lib/services/bot-settings.service';
import { z } from 'zod';
import crypto from 'crypto';

// Схема валидации данных Telegram Login Widget
const telegramWidgetAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

// Функция для проверки подписи Telegram Login Widget
function validateTelegramWidgetData(data: any, botToken: string): boolean {
  try {
    const { hash, ...userData } = data;
    
    // Создаем строку для проверки
    const dataCheckString = Object.keys(userData)
      .sort()
      .map(key => `${key}=${userData[key]}`)
      .join('\n');
    
    // Создаем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Вычисляем хеш
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Error validating Telegram Widget data:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = telegramWidgetAuthSchema.parse(body);
    
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
    
    // Проверяем подпись данных (всегда, а не только в production —
    // иначе staging/dev-окружения позволяют войти под любым Telegram-аккаунтом)
    const isValid = validateTelegramWidgetData(validatedData, botToken);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid Telegram Widget data' },
        { status: 401 }
      );
    }

    // Проверяем свежесть auth_date, чтобы перехваченный payload нельзя было
    // переиспользовать бесконечно (реплей-атака). Telegram рекомендует okno в 1 сутки.
    const AUTH_DATE_MAX_AGE_SECONDS = 86400;
    const authAgeSeconds = Math.floor(Date.now() / 1000) - validatedData.auth_date;
    if (authAgeSeconds > AUTH_DATE_MAX_AGE_SECONDS || authAgeSeconds < -60) {
      return NextResponse.json(
        { success: false, error: 'Telegram Widget data expired' },
        { status: 401 }
      );
    }
    
    // Ищем пользователя по Telegram ID
    let user = await prisma.user.findFirst({
      where: {
        settings: {
          some: {
            category: 'NOTIFICATION',
            settings: {
              path: ['telegram', 'chatId'],
              equals: validatedData.id.toString(),
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
      const tempEmail = `telegram_${validatedData.id}@temp.local`;
      
      // Создаем пользователя
      user = await prisma.user.create({
        data: {
          email: tempEmail,
          name: `${validatedData.first_name} ${validatedData.last_name || ''}`.trim(),
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
              chatId: validatedData.id.toString(),
              enabled: true,
              userInfo: {
                firstName: validatedData.first_name,
                lastName: validatedData.last_name,
                username: validatedData.username,
                photoUrl: validatedData.photo_url,
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
              name: `${validatedData.first_name} ${validatedData.last_name || ''}`.trim(),
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
                    firstName: validatedData.first_name,
                    lastName: validatedData.last_name,
                    username: validatedData.username,
                    photoUrl: validatedData.photo_url,
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
            id: validatedData.id,
            firstName: validatedData.first_name,
            lastName: validatedData.last_name,
            username: validatedData.username,
            photoUrl: validatedData.photo_url,
          },
        },
      },
      message: 'Telegram widget authentication successful',
    });
    
    // Устанавливаем cookie с токеном
    setAuthCookie(response, token, request);
    
    return response;
  } catch (error) {
    console.error('Telegram widget auth error:', error);
    
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
