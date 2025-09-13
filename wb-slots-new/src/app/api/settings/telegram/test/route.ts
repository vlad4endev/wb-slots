import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { TelegramService } from '@/lib/services/telegram-service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chatId } = body;

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const telegramService = new TelegramService();

    // Отправляем тестовое уведомление
    const success = await telegramService.sendNotification(user.id, 
      `🧪 <b>Тестовое уведомление</b>\n\n` +
      `👤 Пользователь: ${user.email}\n` +
      `🆔 ID: ${user.id}\n` +
      `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
      `✅ Если вы видите это сообщение, Telegram уведомления настроены корректно!`
    );

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Тестовое уведомление отправлено',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Ошибка отправки уведомления. Проверьте настройки Telegram.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Test Telegram notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}