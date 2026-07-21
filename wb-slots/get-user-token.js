// Получение токена пользователя из базы данных
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function getUserToken() {
  try {
    console.log('🔑 Получение токена пользователя...');
    
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    
    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }
    
    console.log('👤 Пользователь найден:', {
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Создаем JWT токен с правильным секретом
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role
      },
      'your-super-secret-jwt-key-here-change-in-production',
      { expiresIn: '7d' }
    );
    
    console.log('🎫 Токен создан:');
    console.log(token);
    
    // Проверяем WB сессию
    const wbSession = await prisma.wBSession.findFirst({
      where: {
        userId: user.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (wbSession) {
      console.log('✅ WB сессия активна:', {
        sessionId: wbSession.sessionId,
        isActive: wbSession.isActive,
        expiresAt: wbSession.expiresAt
      });
    } else {
      console.log('❌ WB сессия не найдена или неактивна');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getUserToken();
