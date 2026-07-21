/**
 * СОЗДАНИЕ ТЕСТОВОЙ СЕССИИ
 * Для отладки автобронирования
 */

import { prisma } from './src/lib/prisma';
import crypto from 'crypto';

async function createTestSession(userId: string) {
  console.log(`🔧 Создание тестовой сессии для: ${userId}\n`);

  try {
    // Проверяем, существует ли пользователь
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.log('❌ Пользователь не найден!');
      console.log('   Создайте пользователя сначала или используйте существующий ID');
      return;
    }

    console.log('✅ Пользователь найден:', user.email);

    // Удаляем старую сессию если есть
    const oldSession = await prisma.wBSession.findUnique({
      where: { userId },
    });

    if (oldSession) {
      await prisma.wBSession.delete({
        where: { userId },
      });
      console.log('🗑️  Старая сессия удалена');
    }

    // Создаём минимальную тестовую сессию
    const testSessionData = {
      sessionId: crypto.randomUUID(),
      cookies: [
        {
          name: 'WBToken',
          value: 'test-token-' + Date.now(),
          domain: '.wildberries.ru',
          path: '/',
          secure: true,
          httpOnly: true,
        },
      ],
      localStorage: {
        'wb-user': JSON.stringify({ id: userId }),
      },
      sessionStorage: {},
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 дней
      metadata: {
        fingerprint: crypto.randomBytes(16).toString('hex'),
        createdAt: new Date(),
        lastValidated: new Date(),
        version: '3.0.0-test',
      },
    };

    // Простое "шифрование" для теста (в реальности используйте encryption.ts)
    const sessionDataString = JSON.stringify(testSessionData);
    const encryptedData = Buffer.from(sessionDataString).toString('base64');

    const newSession = await prisma.wBSession.create({
      data: {
        userId,
        sessionData: encryptedData,
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
        ipAddress: '127.0.0.1',
        lastValidated: new Date(),
      },
    });

    console.log('\n✅ ТЕСТОВАЯ СЕССИЯ СОЗДАНА');
    console.log('   ID:', newSession.id);
    console.log('   Истекает:', newSession.expiresAt);
    console.log('   Активна:', newSession.isActive);

    console.log('\n⚠️  ВАЖНО:');
    console.log('   Это ТЕСТОВАЯ сессия для отладки!');
    console.log('   Она НЕ содержит реальные cookies от Wildberries.');
    console.log('   Для реального бронирования используйте /wb-auth');

    console.log('\n📝 Для реальной сессии:');
    console.log('   1. Откройте http://localhost:3000/wb-auth');
    console.log('   2. Войдите в Wildberries через браузер');
    console.log('   3. Система автоматически сохранит cookies');

  } catch (error) {
    console.error('\n❌ ОШИБКА:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const userId = process.argv[2];

if (!userId) {
  console.log('📝 Использование: npx tsx create-test-session.ts <userId>');
  console.log('\nСначала найдите ваш userId:');
  console.log('   npx tsx check-session.ts');
} else {
  createTestSession(userId);
}

