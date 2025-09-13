const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWbToken() {
  const userId = 'cmfbry14q0000136cf6k6yhu2'; // ID пользователя из логов
  
  console.log('🔍 Ищем токены SUPPLIES для пользователя:', userId);
  
  try {
    // Проверяем существующие токены
    const existingTokens = await prisma.userToken.findMany({
      where: {
        userId: userId,
        category: 'SUPPLIES',
      },
    });
    
    console.log('📋 Найдено токенов SUPPLIES:', existingTokens.length);
    
    if (existingTokens.length > 0) {
      console.log('🔍 Текущие токены:');
      existingTokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ID: ${token.id}`);
        console.log(`     Token: ${token.tokenEncrypted}`);
        console.log(`     Active: ${token.isActive}`);
        console.log(`     Created: ${token.createdAt}`);
        console.log('---');
      });
    }
    
    console.log('\n❌ ПРОБЛЕМА: Токен содержит тестовое значение "YOUR_WB_API_TOKEN_HERE"');
    console.log('✅ РЕШЕНИЕ: Нужно заменить на реальный токен WB API');
    console.log('\n📝 Инструкции:');
    console.log('1. Получите реальный токен WB API из личного кабинета Wildberries');
    console.log('2. Запустите скрипт update-wb-token.js с реальным токеном');
    console.log('3. Или выполните SQL запрос:');
    console.log(`   UPDATE "UserToken" SET "tokenEncrypted" = 'ВАШ_РЕАЛЬНЫЙ_ТОКЕН' WHERE "userId" = '${userId}' AND "category" = 'SUPPLIES';`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWbToken();
