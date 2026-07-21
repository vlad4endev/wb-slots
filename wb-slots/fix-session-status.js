// Скрипт для исправления статуса WB сессии
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSessionStatus() {
  try {
    console.log('🔧 Исправление статуса WB сессии...');
    
    // Находим сессию по ID
    const sessionId = 'wb_session_1759113929787_5igjhmxw9';
    
    const session = await prisma.wBSession.findUnique({
      where: { sessionId }
    });
    
    if (!session) {
      console.log('❌ Сессия не найдена');
      return;
    }
    
    console.log('📋 Текущий статус сессии:');
    console.log(`- ID: ${session.sessionId}`);
    console.log(`- Активна: ${session.isActive}`);
    console.log(`- Создана: ${session.createdAt}`);
    console.log(`- Истекает: ${session.expiresAt}`);
    console.log(`- Последнее использование: ${session.lastUsedAt}`);
    
    // Проверяем, не истекла ли сессия
    const now = new Date();
    const isExpired = session.expiresAt < now;
    
    if (isExpired) {
      console.log('⚠️ Сессия истекла, активировать нельзя');
      return;
    }
    
    // Активируем сессию
    const updatedSession = await prisma.wBSession.update({
      where: { sessionId },
      data: { 
        isActive: true,
        lastUsedAt: new Date()
      }
    });
    
    console.log('✅ Сессия успешно активирована!');
    console.log(`- Новый статус: ${updatedSession.isActive}`);
    console.log(`- Обновлено: ${updatedSession.updatedAt}`);
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении сессии:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSessionStatus();
