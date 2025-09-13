import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WBSessionManager } from '@/lib/wb-session-manager';
import { z } from 'zod';

const createSessionSchema = z.object({
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  cookies: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = createSessionSchema.parse(body);

    // Генерируем уникальный ID сессии
    const sessionId = `wb_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Парсим реальные cookies из браузера
        const cookies: Record<string, string> = {};
        if (validatedData.cookies) {
          validatedData.cookies.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
              cookies[name] = value;
            }
          });
        }

        // Если cookies пустые, создаем тестовую сессию
        if (Object.keys(cookies).length === 0) {
          console.log('No cookies found, creating test session');
          cookies['WBToken'] = 'test-token-' + Date.now();
          cookies['x-supplier-id'] = 'test-supplier';
          cookies['SessionId'] = sessionId;
        }

    // Добавляем системную информацию
    cookies['SessionId'] = sessionId;
    cookies['UserAgent'] = validatedData.userAgent || 'Unknown';
    cookies['AuthTime'] = new Date().toISOString();

    // Создаем сессию
    const sessionData = {
      sessionId,
      cookies: cookies,
      userAgent: validatedData.userAgent || 'Unknown',
      ipAddress: validatedData.ipAddress,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
    };

    const session = await WBSessionManager.createSession(user.id, sessionData);

    return NextResponse.json({
      success: true,
      message: 'WB сессия создана успешно',
      data: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      },
    });

  } catch (error) {
    console.error('Create WB session error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Ошибка валидации данных' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка создания WB сессии' },
      { status: 500 }
    );
  }
}
