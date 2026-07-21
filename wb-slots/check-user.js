#!/usr/bin/env node

/**
 * Скрипт для проверки и восстановления пользователя
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    const email = 'vl4en.95@yandex.ru';

    console.log('🔍 Checking user in database...');
    console.log(`User ID: ${userId}`);
    console.log(`Email: ${email}`);

    // Проверяем пользователя по ID
    const userById = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (userById) {
      console.log('✅ User found by ID:', {
        id: userById.id,
        email: userById.email,
        isActive: userById.isActive,
        role: userById.role,
        createdAt: userById.createdAt
      });
      return;
    }

    console.log('❌ User not found by ID');

    // Проверяем пользователя по email
    const userByEmail = await prisma.user.findUnique({
      where: { email: email }
    });

    if (userByEmail) {
      console.log('✅ User found by email:', {
        id: userByEmail.id,
        email: userByEmail.email,
        isActive: userByEmail.isActive,
        role: userByEmail.role,
        createdAt: userByEmail.createdAt
      });
      
      console.log('⚠️  JWT token contains different user ID!');
      console.log(`JWT User ID: ${userId}`);
      console.log(`Database User ID: ${userByEmail.id}`);
      
      return;
    }

    console.log('❌ User not found by email either');

    // Показываем всех пользователей
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        role: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('\n📊 All users in database:');
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });

    // Предлагаем создать пользователя
    console.log('💡 Options:');
    console.log('1. Create new user with the JWT data');
    console.log('2. Update JWT token to match existing user');
    console.log('3. Check if there are any database connection issues');

  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем проверку
checkUser();