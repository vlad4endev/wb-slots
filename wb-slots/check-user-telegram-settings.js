const { PrismaClient } = require('@prisma/client');

async function checkUserTelegramSettings() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Проверяем настройки Telegram для пользователя...');
    
    // ID пользователя из логов
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    
    // Проверяем настройки пользователя
    const userSettings = await prisma.userSettings.findFirst({
      where: {
        userId: userId,
        category: 'NOTIFICATION'
      }
    });
    
    console.log('📋 Настройки пользователя:', JSON.stringify(userSettings, null, 2));
    
    if (userSettings) {
      const telegramSettings = userSettings.settings;
      console.log('📱 Telegram настройки:', JSON.stringify(telegramSettings, null, 2));
      
      if (telegramSettings?.telegram) {
        console.log('✅ Telegram настройки найдены:');
        console.log('  - Chat ID:', telegramSettings.telegram.chatId);
        console.log('  - Enabled:', telegramSettings.telegram.enabled);
        console.log('  - User Info:', telegramSettings.telegram.userInfo);
      } else {
        console.log('❌ Telegram настройки не найдены');
      }
    } else {
      console.log('❌ Настройки пользователя не найдены');
    }
    
    // Проверяем все настройки пользователя
    const allUserSettings = await prisma.userSettings.findMany({
      where: {
        userId: userId
      }
    });
    
    console.log('\n📋 Все настройки пользователя:');
    allUserSettings.forEach((setting, index) => {
      console.log(`${index + 1}. Категория: ${setting.category}`);
      console.log(`   Настройки: ${JSON.stringify(setting.settings, null, 2)}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserTelegramSettings();
