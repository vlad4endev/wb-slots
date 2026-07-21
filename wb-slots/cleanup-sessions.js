#!/usr/bin/env node

/**
 * Скрипт для очистки недействительных сессий WB
 * Использование: node cleanup-sessions.js [userId] [action]
 */

const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/lib/encryption');

const prisma = new PrismaClient();

async function cleanupSessions(userId, action = 'deactivate-invalid') {
  try {
    console.log(`🧹 Starting session cleanup for user: ${userId}`);
    console.log(`📋 Action: ${action}`);

    switch (action) {
      case 'deactivate-invalid':
        await deactivateInvalidSessions(userId);
        break;
      case 'deactivate-all':
        await deactivateAllUserSessions(userId);
        break;
      case 'list':
        await listUserSessions(userId);
        break;
      default:
        console.log('❌ Неверное действие. Доступные: deactivate-invalid, deactivate-all, list');
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function deactivateInvalidSessions(userId) {
  console.log('🔍 Checking sessions for validity...');

  const sessions = await prisma.wBSession.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (sessions.length === 0) {
    console.log('✅ No active sessions found');
    return;
  }

  console.log(`📊 Found ${sessions.length} active sessions`);

  let deactivatedCount = 0;

  for (const session of sessions) {
    try {
      // Проверяем истечение срока
      if (session.expiresAt && session.expiresAt < new Date()) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
        deactivatedCount++;
        console.log(`⏰ Deactivated expired session: ${session.sessionId}`);
        continue;
      }

      // Проверяем наличие cookies
      if (!session.cookiesEncrypted) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
        deactivatedCount++;
        console.log(`🍪 Deactivated session without cookies: ${session.sessionId}`);
        continue;
      }

      // Проверяем валидность cookies
      try {
        const decryptedCookies = JSON.parse(decrypt(session.cookiesEncrypted));
        if (!Array.isArray(decryptedCookies) || decryptedCookies.length === 0) {
          await prisma.wBSession.update({
            where: { id: session.id },
            data: { isActive: false }
          });
          deactivatedCount++;
          console.log(`🔓 Deactivated session with invalid cookies: ${session.sessionId}`);
          continue;
        }
      } catch (error) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
        deactivatedCount++;
        console.log(`🔓 Deactivated session with corrupted cookies: ${session.sessionId}`);
        continue;
      }

      console.log(`✅ Session valid: ${session.sessionId}`);

    } catch (error) {
      console.error(`❌ Error checking session ${session.sessionId}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total sessions: ${sessions.length}`);
  console.log(`   Deactivated: ${deactivatedCount}`);
  console.log(`   Valid: ${sessions.length - deactivatedCount}`);
}

async function deactivateAllUserSessions(userId) {
  console.log('🧹 Deactivating all user sessions...');

  const result = await prisma.wBSession.updateMany({
    where: { userId },
    data: { isActive: false }
  });

  console.log(`✅ Deactivated ${result.count} sessions`);
}

async function listUserSessions(userId) {
  console.log('📋 Listing user sessions...');

  const sessions = await prisma.wBSession.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (sessions.length === 0) {
    console.log('✅ No sessions found');
    return;
  }

  console.log(`\n📊 Found ${sessions.length} sessions:\n`);

  sessions.forEach((session, index) => {
    const status = session.isActive ? '🟢 Active' : '🔴 Inactive';
    const expires = session.expiresAt ? 
      (session.expiresAt < new Date() ? '⏰ Expired' : '✅ Valid') : 
      '❓ No expiry';
    
    console.log(`${index + 1}. ${session.sessionId}`);
    console.log(`   Status: ${status}`);
    console.log(`   Expires: ${expires}`);
    console.log(`   Created: ${session.createdAt.toISOString()}`);
    console.log(`   Last used: ${session.lastUsedAt ? session.lastUsedAt.toISOString() : 'Never'}`);
    console.log('');
  });
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);
const userId = args[0];
const action = args[1] || 'deactivate-invalid';

if (!userId) {
  console.log('❌ Usage: node cleanup-sessions.js <userId> [action]');
  console.log('   Actions: deactivate-invalid, deactivate-all, list');
  process.exit(1);
}

cleanupSessions(userId, action);
