#!/usr/bin/env node

/**
 * Скрипт для миграции существующих сессий WB на новую архитектуру
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Функция для создания ключа шифрования
function createEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Функция для шифрования данных (упрощенная версия)
function encrypt(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

async function migrateSessions() {
  try {
    console.log('🔄 Starting session migration to new architecture...');

    // Получаем все существующие сессии
    const oldSessions = await prisma.wBSession.findMany({
      where: { isActive: true }
    });

    console.log(`📊 Found ${oldSessions.length} active sessions to migrate`);

    if (oldSessions.length === 0) {
      console.log('✅ No sessions to migrate');
      return;
    }

    // Создаем ключ шифрования если его нет
    const encryptionKey = process.env.ENCRYPTION_KEY || createEncryptionKey();
    
    if (!process.env.ENCRYPTION_KEY) {
      console.log('⚠️  ENCRYPTION_KEY not found in environment variables');
      console.log('🔑 Generated new key:', encryptionKey);
      console.log('📝 Add this to your .env file:');
      console.log(`ENCRYPTION_KEY=${encryptionKey}`);
      console.log('');
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const session of oldSessions) {
      try {
        console.log(`🔄 Migrating session for user: ${session.userId}`);

        // Создаем новую структуру данных сессии
        const sessionData = {
          cookies: session.cookiesEncrypted ? JSON.parse(session.cookiesEncrypted) : [],
          localStorage: session.localStorageEncrypted ? JSON.parse(session.localStorageEncrypted) : {},
          sessionStorage: session.sessionStorageEncrypted ? JSON.parse(session.sessionStorageEncrypted) : {},
          userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: {
            width: 1920,
            height: 1080
          },
          metadata: {
            fingerprint: '',
            createdAt: session.createdAt,
            lastValidated: session.lastUsedAt || session.createdAt
          }
        };

        // Создаем отпечаток целостности
        const fingerprint = crypto.createHash('sha256')
          .update(JSON.stringify({
            userId: session.userId,
            cookieCount: sessionData.cookies.length,
            localStorageKeys: Object.keys(sessionData.localStorage).sort(),
            sessionStorageKeys: Object.keys(sessionData.sessionStorage).sort(),
            userAgent: sessionData.userAgent,
            createdAt: sessionData.metadata.createdAt
          }))
          .digest('hex');

        sessionData.metadata.fingerprint = fingerprint;

        // Шифруем данные
        const encryptedData = encrypt(JSON.stringify(sessionData), encryptionKey);

        // Обновляем сессию в новой структуре
        await prisma.wBSession.update({
          where: { id: session.id },
          data: {
            sessionData: encryptedData,
            lastValidated: session.lastUsedAt || session.createdAt,
            updatedAt: new Date()
          }
        });

        console.log(`✅ Migrated session for user: ${session.userId}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Failed to migrate session for user ${session.userId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration completed:');
    console.log(`✅ Successfully migrated: ${migratedCount} sessions`);
    console.log(`❌ Failed to migrate: ${errorCount} sessions`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some sessions failed to migrate. You may need to:');
      console.log('1. Check the encryption key');
      console.log('2. Verify the data format');
      console.log('3. Recreate failed sessions manually');
    }

    console.log('\n🎉 Migration completed!');
    console.log('📝 Next steps:');
    console.log('1. Update your .env file with the encryption key');
    console.log('2. Test the new session architecture');
    console.log('3. Remove old session fields from the database if needed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем миграцию
migrateSessions();
