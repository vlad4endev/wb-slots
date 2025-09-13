const { PrismaClient } = require('@prisma/client');

async function createTestToken() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Создаем тестовый токен SUPPLIES...');
    
    // Найдем пользователя
    const user = await prisma.user.findFirst({
      where: {
        email: 'vl4en.95@yandex.ru'
      }
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }
    
    console.log('👤 Пользователь найден:', user.email);
    
    // Проверим, есть ли уже токен SUPPLIES
    const existingToken = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        category: 'SUPPLIES'
      }
    });
    
    if (existingToken) {
      console.log('✅ Токен SUPPLIES уже существует:', existingToken.id);
      return;
    }
    
    // Создаем тестовый токен (без шифрования для простоты)
    const testToken = 'test-supplies-token-12345';
    
    const newToken = await prisma.userToken.create({
      data: {
        userId: user.id,
        category: 'SUPPLIES',
        tokenEncrypted: testToken, // Временно без шифрования
        isActive: true
      }
    });
    
    console.log('✅ Тестовый токен SUPPLIES создан:', newToken.id);
    console.log('🔑 Токен:', testToken);
    
  } catch (error) {
    console.error('❌ Ошибка при создании токена:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestToken();
