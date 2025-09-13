const { PrismaClient } = require('@prisma/client');

async function updateWBToken() {
  const prisma = new PrismaClient();
  
  try {
    // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ТОКЕН WB API
    const realWBToken = 'YOUR_REAL_WB_API_TOKEN_HERE';
    
    if (realWBToken === 'YOUR_REAL_WB_API_TOKEN_HERE') {
      console.log('❌ Пожалуйста, замените YOUR_REAL_WB_API_TOKEN_HERE на реальный токен WB API');
      console.log('📝 Откройте файл update-wb-token.js и замените значение realWBToken');
      return;
    }
    
    const result = await prisma.userToken.updateMany({
      where: { category: 'SUPPLIES' },
      data: { 
        tokenEncrypted: realWBToken,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Updated tokens:', result.count);
    console.log('🔑 New token preview:', realWBToken.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateWBToken();
