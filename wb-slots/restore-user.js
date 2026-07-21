// Скрипт для восстановления пользователя
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function restoreUser() {
  try {
    console.log('🔧 Восстановление пользователя...');
    
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    const email = 'vl4en.95@yandex.ru';
    
    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (existingUser) {
      console.log('✅ Пользователь уже существует:', {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        isActive: existingUser.isActive
      });
      
      // Проверяем, активен ли пользователь
      if (!existingUser.isActive) {
        console.log('🔄 Активируем пользователя...');
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: true }
        });
        console.log('✅ Пользователь активирован');
      }
      
      return;
    }
    
    // Создаем нового пользователя
    console.log('👤 Создание нового пользователя...');
    
    const hashedPassword = await bcrypt.hash('temp-password-123', 10);
    
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        email: email,
        passwordHash: hashedPassword,
        name: 'Vladimir',
        role: 'DEVELOPER',
        isActive: true,
        timezone: 'Europe/Moscow'
      }
    });
    
    console.log('✅ Пользователь создан:', {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive
    });
    
    // Создаем настройки пользователя
    console.log('⚙️ Создание настроек пользователя...');
    
    await prisma.userSettings.create({
      data: {
        userId: userId,
        category: 'telegram',
        settings: {
          botToken: '',
          chatId: '',
          isEnabled: false
        }
      }
    });
    
    console.log('✅ Настройки пользователя созданы');
    
  } catch (error) {
    console.error('❌ Ошибка восстановления пользователя:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreUser();
