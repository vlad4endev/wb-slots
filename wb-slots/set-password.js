// Скрипт для установки нового пароля пользователю по email
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setPassword() {
  const email = 'vl4en.95@yandex.ru';
  const newPassword = 'Vlad1995%';

  try {
    console.log('🔐 Установка нового пароля для пользователя:', email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('❌ Пользователь не найден');
      process.exitCode = 1;
      return;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log('✅ Пароль обновлён для пользователя:', email);
  } catch (error) {
    console.error('❌ Ошибка при обновлении пароля:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

setPassword();


