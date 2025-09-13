const { PrismaClient } = require('@prisma/client');

async function applyMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Применение миграции для таблицы bot_settings...');
    
    // Создаем таблицу bot_settings
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "bot_settings" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "description" TEXT,
        "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "bot_settings_pkey" PRIMARY KEY ("id")
      );
    `;
    
    // Создаем уникальный индекс для ключа
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "bot_settings_key_key" ON "bot_settings"("key");
    `;
    
    console.log('✅ Миграция успешно применена!');
    console.log('📋 Создана таблица bot_settings для хранения настроек бота');
    
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
