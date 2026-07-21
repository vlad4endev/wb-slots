/**
 * Скрипт для быстрой настройки Telegram уведомлений
 * 
 * Использование:
 * node setup-telegram-notifications.js <userId> <telegramChatId>
 * 
 * Пример:
 * node setup-telegram-notifications.js cmgpoehb80000y43eopvxe7fa 123456789
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTelegramNotifications() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Ошибка: Недостаточно аргументов');
    console.log('\n📋 Использование:');
    console.log('  node setup-telegram-notifications.js <userId> <telegramChatId>');
    console.log('\n📝 Пример:');
    console.log('  node setup-telegram-notifications.js cmgpoehb80000y43eopvxe7fa 123456789');
    console.log('\n💡 Как получить Chat ID:');
    console.log('  1. Напишите боту @userinfobot в Telegram');
    console.log('  2. Он отправит вам ваш Chat ID');
    process.exit(1);
  }

  const [userId, chatId] = args;

  console.log('\n🔧 Настройка Telegram уведомлений...\n');
  console.log(`👤 User ID: ${userId}`);
  console.log(`💬 Chat ID: ${chatId}\n`);

  try {
    // Проверяем, существует ли пользователь
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.error(`❌ Пользователь с ID ${userId} не найден!`);
      process.exit(1);
    }

    console.log(`✅ Пользователь найден: ${user.email}\n`);

    // Создаем или обновляем настройки уведомлений
    const result = await prisma.userSettings.upsert({
      where: {
        userId_category: {
          userId: userId,
          category: 'NOTIFICATION'
        }
      },
      update: {
        settings: {
          telegram: {
            chatId: chatId.toString(),
            enabled: true,
            userInfo: null
          }
        },
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        category: 'NOTIFICATION',
        settings: {
          telegram: {
            chatId: chatId.toString(),
            enabled: true,
            userInfo: null
          }
        }
      }
    });

    console.log('✅ Настройки Telegram успешно сохранены!\n');
    console.log('📝 Детали:');
    console.log(`   Category: ${result.category}`);
    console.log(`   Chat ID: ${chatId}`);
    console.log(`   Enabled: true`);
    console.log(`   Created/Updated: ${result.updatedAt}\n`);

    // Проверяем настройки
    const verification = await prisma.userSettings.findFirst({
      where: {
        userId: userId,
        category: 'NOTIFICATION'
      }
    });

    if (verification) {
      const settings = verification.settings as any;
      console.log('🔍 Проверка настроек:');
      console.log(`   Telegram enabled: ${settings.telegram?.enabled}`);
      console.log(`   Telegram chatId: ${settings.telegram?.chatId}\n`);
      
      if (settings.telegram?.enabled && settings.telegram?.chatId) {
        console.log('🎉 Настройки корректны! Уведомления будут работать.\n');
      } else {
        console.log('⚠️  Предупреждение: Настройки сохранены, но могут быть неполными.\n');
      }
    }

    console.log('💡 Что дальше:');
    console.log('   1. Откройте приложение: http://localhost:3000/settings');
    console.log('   2. Перейдите в раздел "Уведомления"');
    console.log('   3. Ваш Chat ID уже сохранен! Просто проверьте настройки');
    console.log('   4. Или запустите задачу поиска - уведомления будут работать\n');
    console.log('📱 Получить Chat ID через интерфейс:');
    console.log('   • В настройках есть кнопка "Получить ID"');
    console.log('   • Она откроет бота @chatIDrobot в Telegram');
    console.log('   • Chat ID сохраняется автоматически после нажатия "Сохранить"\n');

  } catch (error) {
    console.error('❌ Ошибка при настройке:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupTelegramNotifications();

