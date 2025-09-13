const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickFixToken() {
  const userId = 'cmfbry14q0000136cf6k6yhu2';
  
  console.log('🔧 Быстрое исправление токена WB API...');
  
  try {
    // Обновляем токен на временное значение для тестирования
    const result = await prisma.userToken.updateMany({
      where: {
        userId: userId,
        category: 'SUPPLIES',
      },
      data: {
        tokenEncrypted: 'test-token-for-demo', // Временный токен для демонстрации
        isActive: true,
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Обновлено ${result.count} токенов SUPPLIES`);
    console.log('⚠️  ВНИМАНИЕ: Это тестовый токен! Для работы с реальным API нужен настоящий токен WB');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickFixToken();
