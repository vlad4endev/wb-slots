/**
 * ДИАГНОСТИКА СЕССИИ
 * Проверка наличия и валидности WBSession для пользователя
 */

import { prisma } from './src/lib/prisma';

async function checkUserSession(userId: string) {
  console.log(`🔍 Проверка сессии для пользователя: ${userId}\n`);

  try {
    // 1. Проверяем наличие сессии
    const session = await prisma.wBSession.findUnique({
      where: { userId },
    });

    if (!session) {
      console.log('❌ Сессия не найдена в БД');
      console.log('\n💡 Решение:');
      console.log('   1. Откройте страницу аутентификации: /wb-auth');
      console.log('   2. Войдите в личный кабинет Wildberries');
      console.log('   3. Система автоматически сохранит сессию');
      return;
    }

    console.log('✅ Сессия найдена в БД');
    console.log('   ID:', session.id);
    console.log('   Создана:', session.createdAt);
    console.log('   Обновлена:', session.updatedAt);
    console.log('   Активна:', session.isActive);
    console.log('   Истекает:', session.expiresAt || 'Не указано');
    console.log('   Последняя валидация:', session.lastValidated);
    console.log('   Использований:', session.useCount);

    // 2. Проверяем активность
    if (!session.isActive) {
      console.log('\n⚠️ Сессия НЕ активна');
      console.log('   Причина деактивации:', session.deactivationReason || 'Не указана');
      console.log('   Деактивирована:', session.deactivatedAt);
      console.log('\n💡 Решение:');
      console.log('   Необходимо создать новую сессию через /wb-auth');
      return;
    }

    // 3. Проверяем истечение
    if (session.expiresAt && session.expiresAt < new Date()) {
      console.log('\n⚠️ Сессия ИСТЕКЛА');
      console.log('   Истекла:', session.expiresAt);
      console.log('   Сейчас:', new Date());
      console.log('   Разница:', Math.round((new Date().getTime() - session.expiresAt.getTime()) / 1000 / 60), 'минут назад');
      console.log('\n💡 Решение:');
      console.log('   1. Деактивируем старую сессию');
      
      await prisma.wBSession.update({
        where: { userId },
        data: {
          isActive: false,
          deactivationReason: 'Session expired (manual check)',
          deactivatedAt: new Date(),
        },
      });
      
      console.log('   ✅ Старая сессия деактивирована');
      console.log('   2. Создайте новую сессию через /wb-auth');
      return;
    }

    // 4. Проверяем давность последней валидации
    const hoursSinceValidation = (new Date().getTime() - session.lastValidated.getTime()) / 1000 / 60 / 60;
    
    if (hoursSinceValidation > 24) {
      console.log('\n⚠️ Сессия давно не валидировалась');
      console.log(`   Последняя валидация: ${hoursSinceValidation.toFixed(1)} часов назад`);
      console.log('   Рекомендуется обновить сессию через /wb-auth');
    }

    // 5. Проверяем наличие данных сессии
    if (!session.sessionData || session.sessionData === '') {
      console.log('\n❌ Данные сессии пусты');
      console.log('   sessionData:', session.sessionData?.length || 0, 'байт');
      console.log('\n💡 Решение:');
      console.log('   Данные сессии повреждены. Создайте новую через /wb-auth');
      return;
    }

    console.log('\n✅ СЕССИЯ ВАЛИДНА');
    console.log('   sessionData размер:', session.sessionData.length, 'байт');
    console.log('   IP адрес:', session.ipAddress || 'Не указан');
    
    if (session.expiresAt) {
      const minutesUntilExpiry = (session.expiresAt.getTime() - new Date().getTime()) / 1000 / 60;
      console.log('   До истечения:', Math.round(minutesUntilExpiry), 'минут');
    }

  } catch (error) {
    console.error('\n❌ ОШИБКА при проверке сессии:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем userId из аргументов или используем первого пользователя
const userId = process.argv[2];

if (!userId) {
  console.log('📝 Использование: npx tsx check-session.ts <userId>');
  console.log('\nИли проверим всех пользователей:\n');
  
  prisma.user.findMany({ select: { id: true, email: true } })
    .then(users => {
      if (users.length === 0) {
        console.log('❌ Пользователей не найдено в БД');
      } else {
        console.log('Найдены пользователи:');
        users.forEach(u => console.log(`  - ${u.id} (${u.email})`));
        console.log('\nЗапустите: npx tsx check-session.ts <userId>');
      }
    })
    .finally(() => prisma.$disconnect());
} else {
  checkUserSession(userId);
}

