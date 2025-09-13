const { PrismaClient } = require('@prisma/client');

async function checkSuppliesTokens() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Проверяем токены SUPPLIES...');
    
    // Получаем все токены SUPPLIES
    const tokens = await prisma.userToken.findMany({
      where: {
        category: 'SUPPLIES'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
    
    console.log(`📊 Найдено токенов SUPPLIES: ${tokens.length}`);
    
    if (tokens.length === 0) {
      console.log('❌ Токены SUPPLIES не найдены!');
      console.log('💡 Нужно добавить токен в настройках приложения');
      
      // Покажем все токены пользователя
      const allTokens = await prisma.userToken.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });
      
      console.log(`\n📋 Все токены в системе (${allTokens.length}):`);
      allTokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.category} - ${token.user.email} (${token.isActive ? 'активен' : 'неактивен'})`);
      });
      
    } else {
      tokens.forEach((token, index) => {
        console.log(`\n🔑 Токен SUPPLIES ${index + 1}:`);
        console.log(`  ID: ${token.id}`);
        console.log(`  User: ${token.user.email} (${token.user.id})`);
        console.log(`  Active: ${token.isActive}`);
        console.log(`  Created: ${token.createdAt}`);
        console.log(`  Last Used: ${token.lastUsedAt || 'никогда'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке токенов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSuppliesTokens();
