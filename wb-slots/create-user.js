#!/usr/bin/env node

/**
 * Скрипт для создания пользователя из JWT данных
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createUser() {
  try {
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    const email = 'vl4en.95@yandex.ru';
    const role = 'DEVELOPER';

    console.log('🔧 Creating user from JWT data...');
    console.log(`User ID: ${userId}`);
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);

    // Проверяем, не существует ли уже пользователь
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (existingUser) {
      console.log('✅ User already exists:', {
        id: existingUser.id,
        email: existingUser.email,
        isActive: existingUser.isActive,
        role: existingUser.role
      });
      return;
    }

    // Создаем пользователя
    const hashedPassword = await bcrypt.hash('defaultpassword123', 12);
    
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        email: email,
        passwordHash: hashedPassword,
        role: role,
        isActive: true,
        emailVerified: new Date(),
        timezone: 'Europe/Moscow'
      }
    });

    console.log('✅ User created successfully:', {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt
    });

    console.log('\n🔑 Default password: defaultpassword123');
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем создание пользователя
createUser();
