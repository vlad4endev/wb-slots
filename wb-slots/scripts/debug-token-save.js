#!/usr/bin/env node

/**
 * Скрипт для диагностики проблем с сохранением токенов
 */

const { PrismaClient } = require('@prisma/client');
const { encrypt, decrypt } = require('../src/lib/encryption');

const prisma = new PrismaClient();

async function debugTokenSave() {
  console.log('🔍 Диагностика проблем с сохранением токенов...\n');

  try {
    // 1. Проверяем подключение к базе данных
    console.log('📊 Проверка подключения к базе данных...');
    await prisma.$connect();
    console.log('✅ Подключение к базе данных успешно\n');

    // 2. Проверяем структуру таблицы user_tokens
    console.log('🗃️ Проверка структуры таблицы user_tokens...');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_tokens' 
      ORDER BY ordinal_position;
    `;
    console.log('Структура таблицы:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('');

    // 3. Проверяем существующие токены
    console.log('🔑 Проверка существующих токенов...');
    const existingTokens = await prisma.userToken.findMany({
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });
    
    console.log(`Найдено токенов: ${existingTokens.length}`);
    existingTokens.forEach((token, index) => {
      console.log(`  ${index + 1}. ID: ${token.id}`);
      console.log(`     Пользователь: ${token.user.email} (${token.user.id})`);
      console.log(`     Категория: ${token.category}`);
      console.log(`     Активен: ${token.isActive}`);
      console.log(`     Создан: ${token.createdAt}`);
      console.log(`     Зашифрованный токен: ${token.tokenEncrypted.substring(0, 20)}...`);
      
      // Пытаемся расшифровать токен
      try {
        const decrypted = decrypt(token.tokenEncrypted);
        console.log(`     Расшифрованный токен: ${decrypted.substring(0, 10)}...`);
      } catch (error) {
        console.log(`     ❌ Ошибка расшифровки: ${error.message}`);
      }
      console.log('');
    });

    // 4. Тестируем шифрование/расшифровку
    console.log('🔐 Тестирование шифрования...');
    const testToken = 'test-token-12345';
    console.log(`Исходный токен: ${testToken}`);
    
    try {
      const encrypted = encrypt(testToken);
      console.log(`Зашифрованный: ${encrypted.substring(0, 30)}...`);
      
      const decrypted = decrypt(encrypted);
      console.log(`Расшифрованный: ${decrypted}`);
      
      if (testToken === decrypted) {
        console.log('✅ Шифрование работает корректно');
      } else {
        console.log('❌ Ошибка: токены не совпадают');
      }
    } catch (error) {
      console.log(`❌ Ошибка шифрования: ${error.message}`);
    }
    console.log('');

    // 5. Проверяем валидацию токенов
    console.log('✅ Проверка валидации токенов...');
    const validCategories = ['STATISTICS', 'SUPPLIES', 'MARKETPLACE', 'CONTENT', 'PROMOTION', 'ANALYTICS', 'FINANCE'];
    console.log('Допустимые категории:', validCategories.join(', '));
    
    // Проверяем, есть ли токены с недопустимыми категориями
    const invalidTokens = await prisma.userToken.findMany({
      where: {
        category: {
          notIn: validCategories
        }
      }
    });
    
    if (invalidTokens.length > 0) {
      console.log(`⚠️ Найдены токены с недопустимыми категориями: ${invalidTokens.length}`);
      invalidTokens.forEach(token => {
        console.log(`  - ID: ${token.id}, Категория: ${token.category}`);
      });
    } else {
      console.log('✅ Все токены имеют допустимые категории');
    }
    console.log('');

    // 6. Проверяем дубликаты токенов
    console.log('🔄 Проверка дубликатов токенов...');
    const duplicates = await prisma.$queryRaw`
      SELECT user_id, category, COUNT(*) as count
      FROM user_tokens 
      GROUP BY user_id, category 
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length > 0) {
      console.log(`⚠️ Найдены дубликаты токенов: ${duplicates.length}`);
      duplicates.forEach(dup => {
        console.log(`  - Пользователь: ${dup.user_id}, Категория: ${dup.category}, Количество: ${dup.count}`);
      });
    } else {
      console.log('✅ Дубликатов токенов не найдено');
    }
    console.log('');

    // 7. Проверяем пользователей без токенов
    console.log('👥 Проверка пользователей без токенов...');
    const usersWithoutTokens = await prisma.user.findMany({
      where: {
        userTokens: {
          none: {}
        }
      },
      select: { id: true, email: true }
    });
    
    console.log(`Пользователей без токенов: ${usersWithoutTokens.length}`);
    usersWithoutTokens.forEach(user => {
      console.log(`  - ${user.email} (${user.id})`);
    });
    console.log('');

    // 8. Рекомендации
    console.log('💡 РЕКОМЕНДАЦИИ:');
    console.log('');
    
    if (existingTokens.length === 0) {
      console.log('🔧 Нет сохраненных токенов. Проверьте:');
      console.log('   - Правильность заполнения формы добавления токена');
      console.log('   - Наличие ошибок в консоли браузера');
      console.log('   - Работу API endpoint /api/tokens');
    }
    
    if (invalidTokens.length > 0) {
      console.log('🔧 Есть токены с недопустимыми категориями:');
      console.log('   - Обновите валидацию в createTokenSchema');
      console.log('   - Удалите или исправьте недопустимые токены');
    }
    
    if (duplicates.length > 0) {
      console.log('🔧 Есть дубликаты токенов:');
      console.log('   - Проверьте логику проверки существующих токенов');
      console.log('   - Удалите дубликаты из базы данных');
    }

    console.log('✅ Диагностика завершена');

  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск диагностики
if (require.main === module) {
  debugTokenSave().catch(console.error);
}

module.exports = { debugTokenSave };
