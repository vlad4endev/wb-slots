#!/usr/bin/env node

/**
 * Скрипт для настройки токена бота @SearchLotWB_bot
 * 
 * Использование:
 * node setup-searchlotwb-bot.js YOUR_BOT_TOKEN
 * 
 * Пример:
 * node setup-searchlotwb-bot.js 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
 */

const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('./src/lib/encryption');

const prisma = new PrismaClient();

async function setupBotToken(token) {
  if (!token) {
    console.error('❌ Ошибка: Токен бота не указан');
    console.log('Использование: node setup-searchlotwb-bot.js YOUR_BOT_TOKEN');
    process.exit(1);
  }

  // Проверяем формат токена
  if (!token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
    console.error('❌ Ошибка: Неверный формат токена');
    console.log('Токен должен иметь формат: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
    process.exit(1);
  }

  try {
    console.log('🔧 Настройка токена бота @SearchLotWB_bot...');

    // Шифруем токен
    const encryptedToken = encrypt(token);

    // Удаляем старый токен если есть
    await prisma.botSetting.deleteMany({
      where: { key: 'telegram_bot_token' }
    });

    // Сохраняем новый токен
    await prisma.botSetting.create({
      data: {
        key: 'telegram_bot_token',
        value: encryptedToken,
        description: 'Telegram bot token for @SearchLotWB_bot',
        isEncrypted: true
      }
    });

    console.log('✅ Токен бота успешно сохранен в базе данных');

    // Проверяем токен через Telegram API
    console.log('🔍 Проверка токена через Telegram API...');
    
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (data.ok) {
      console.log('✅ Токен валиден');
      console.log(`📱 Бот: @${data.result.username}`);
      console.log(`📝 Имя: ${data.result.first_name}`);
      console.log(`🆔 ID: ${data.result.id}`);
    } else {
      console.error('❌ Ошибка проверки токена:', data.description);
    }

    console.log('\n🎉 Настройка завершена!');
    console.log('📋 Следующие шаги:');
    console.log('1. Настройте Web App в BotFather: /newapp');
    console.log('2. Укажите URL: https://yourdomain.com/auth/telegram');
    console.log('3. Проверьте авторизацию в приложении');

  } catch (error) {
    console.error('❌ Ошибка настройки:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем токен из аргументов командной строки
const token = process.argv[2];

// Запускаем настройку
setupBotToken(token);
