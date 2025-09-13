import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Очищаем cookie с токеном
    const response = NextResponse.json({
      success: true,
      message: 'Вы успешно вышли из системы',
    });

    // Удаляем cookie с токеном
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Удаляем cookie
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка выхода из системы' },
      { status: 500 }
    );
  }
}