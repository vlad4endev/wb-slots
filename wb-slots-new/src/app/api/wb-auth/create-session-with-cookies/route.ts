import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { WBSessionManager } from '@/lib/wb-session-manager';
import { encrypt } from '@/lib/encryption';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userAgent, ipAddress, cookies, localStorage, sessionStorage } = await request.json();

    if (!cookies) {
      return NextResponse.json({ 
        error: 'Cookies are required' 
      }, { status: 400 });
    }

    // Парсим cookies из строки в объект
    const cookiesObj: Record<string, string> = {};
    if (typeof cookies === 'string') {
      cookies.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookiesObj[name] = value;
        }
      });
    } else if (typeof cookies === 'object') {
      Object.assign(cookiesObj, cookies);
    }

    // Создаем данные сессии
    const sessionData = {
      sessionId: `session_${Date.now()}_${user.id}`,
      cookies: cookiesObj,
      userAgent: userAgent || 'Unknown',
      ipAddress: ipAddress || 'Unknown',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
    };

    // Создаем сессию через WBSessionManager
    const sessionInfo = await WBSessionManager.createSession(user.id, sessionData);

    // Дополнительно сохраняем localStorage и sessionStorage если они есть
    if (localStorage || sessionStorage) {
      const additionalData = {
        cookies: cookiesObj,
        localStorage: localStorage || {},
        sessionStorage: sessionStorage || {}
      };

      // Шифруем дополнительные данные
      const encryptedData = encrypt(JSON.stringify(additionalData));

      // Обновляем сессию с дополнительными данными
      await WBSessionManager.updateSessionData(sessionInfo.sessionId, encryptedData);
    }

    return NextResponse.json({
      success: true,
      message: 'Session created successfully with cookies extracted',
      data: {
        sessionId: sessionInfo.sessionId,
        expiresAt: sessionInfo.expiresAt,
        cookiesCount: Object.keys(cookiesObj).length,
        hasLocalStorage: !!localStorage,
        hasSessionStorage: !!sessionStorage
      }
    });

  } catch (error) {
    console.error('Error creating WB session with cookies:', error);
    return NextResponse.json({ 
      error: 'Failed to create session with cookies' 
    }, { status: 500 });
  }
}
