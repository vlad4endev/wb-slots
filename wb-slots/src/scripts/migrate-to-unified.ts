/**
 * 🏗️ Скрипт миграции на унифицированную архитектуру
 * Удаляет дублирующийся код и заменяет его на унифицированные сервисы
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// КОНФИГУРАЦИЯ МИГРАЦИИ
// ============================================================================

const MIGRATION_CONFIG = {
  // Файлы для удаления (дублирующиеся сервисы)
  filesToRemove: [
    // Дублирующиеся сервисы поиска слотов
    'src/lib/services/slot-search-service.ts',
    'src/lib/services/continuous-slot-search-service.ts',
    'src/lib/services/refactored/slot-search-service.ts',
    'src/lib/services/unified/slot-search-service.ts',
    
    // Дублирующиеся сервисы автобронирования
    'src/lib/services/auto-booking-service.ts',
    'src/lib/services/enhanced-auto-booking-service.ts',
    'src/lib/services/wb-auth-popup-service.ts',
    'src/lib/services/unified-auto-booking-service.ts',
    
    // Дублирующиеся сервисы уведомлений
    'src/lib/services/telegram-service.ts',
    'src/lib/services/telegram-integration-service.ts',
    'src/lib/services/telegram-notifier.ts',
    'src/lib/services/unified-notification-service.ts',
    
    // Дублирующиеся WB API клиенты
    'src/lib/wb-client/supplies-client.ts',
    'src/lib/wb-client/marketplace-client.ts',
    'src/lib/wb-client/base-client.ts',
    'backend/src/lib/wb-client/supplies-client.ts',
    'backend/src/lib/wb-client/base-client.ts',
    
    // Дублирующиеся API endpoints
    'src/app/api/services/slot-search/route.ts',
    'src/app/api/services/auto-booking/route.ts',
    'src/app/api/services/telegram/route.ts',
  ],
  
  // Файлы для обновления (замена импортов)
  filesToUpdate: [
    'src/app/api/tasks/route.ts',
    'src/app/api/warehouses/route.ts',
    'src/app/api/notifications/route.ts',
    'src/workers/slot-search-worker.ts',
    'src/workers/auto-booking-worker.ts',
    'src/workers/unified-auto-booking-worker.ts',
  ],
  
  // Замены импортов
  importReplacements: [
    {
      from: "import { SlotSearchService } from '@/lib/services/slot-search-service'",
      to: "import { getAppService } from '@/lib/app'"
    },
    {
      from: "import { AutoBookingService } from '@/lib/services/auto-booking-service'",
      to: "import { getAppService } from '@/lib/app'"
    },
    {
      from: "import { TelegramService } from '@/lib/services/telegram-service'",
      to: "import { getAppService } from '@/lib/app'"
    },
    {
      from: "import { WBSuppliesClient } from '@/lib/wb-client/supplies-client'",
      to: "import { createWBAPIClientForUser } from '@/lib/services'"
    },
    {
      from: "import { WBMarketplaceClient } from '@/lib/wb-client/marketplace-client'",
      to: "import { createWBAPIClientForUser } from '@/lib/services'"
    },
  ],
  
  // Замены использования сервисов
  serviceReplacements: [
    {
      from: "new SlotSearchService()",
      to: "getAppService('slotSearch')"
    },
    {
      from: "new AutoBookingService()",
      to: "getAppService('autoBooking')"
    },
    {
      from: "new TelegramService()",
      to: "getAppService('notifications')"
    },
    {
      from: "new WBSuppliesClient(token)",
      to: "await createWBAPIClientForUser(userId, token, 'SUPPLIES')"
    },
    {
      from: "new WBMarketplaceClient(token)",
      to: "await createWBAPIClientForUser(userId, token, 'MARKETPLACE')"
    },
  ]
};

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ МИГРАЦИИ
// ============================================================================

async function migrateToUnified() {
  console.log('🏗️ Starting migration to unified architecture...');
  
  try {
    // 1. Удаляем дублирующиеся файлы
    console.log('🗑️ Removing duplicate files...');
    await removeDuplicateFiles();
    
    // 2. Обновляем импорты в файлах
    console.log('🔄 Updating imports...');
    await updateImports();
    
    // 3. Обновляем использование сервисов
    console.log('🔧 Updating service usage...');
    await updateServiceUsage();
    
    // 4. Создаем резервную копию
    console.log('💾 Creating backup...');
    await createBackup();
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Next steps:');
    console.log('  1. Test the application with: npm run dev');
    console.log('  2. Check services health: GET /api/services?action=health');
    console.log('  3. Remove backup files if everything works correctly');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('🔄 Restoring from backup...');
    await restoreFromBackup();
    throw error;
  }
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

async function removeDuplicateFiles() {
  const projectRoot = process.cwd();
  
  for (const filePath of MIGRATION_CONFIG.filesToRemove) {
    const fullPath = path.join(projectRoot, filePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`  ✅ Removed: ${filePath}`);
      } catch (error) {
        console.warn(`  ⚠️ Failed to remove: ${filePath}`, error);
      }
    } else {
      console.log(`  ℹ️ File not found: ${filePath}`);
    }
  }
}

async function updateImports() {
  const projectRoot = process.cwd();
  
  for (const filePath of MIGRATION_CONFIG.filesToUpdate) {
    const fullPath = path.join(projectRoot, filePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        let updated = false;
        
        for (const replacement of MIGRATION_CONFIG.importReplacements) {
          if (content.includes(replacement.from)) {
            content = content.replace(replacement.from, replacement.to);
            updated = true;
          }
        }
        
        if (updated) {
          fs.writeFileSync(fullPath, content);
          console.log(`  ✅ Updated imports: ${filePath}`);
        } else {
          console.log(`  ℹ️ No imports to update: ${filePath}`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to update: ${filePath}`, error);
      }
    } else {
      console.log(`  ℹ️ File not found: ${filePath}`);
    }
  }
}

async function updateServiceUsage() {
  const projectRoot = process.cwd();
  
  for (const filePath of MIGRATION_CONFIG.filesToUpdate) {
    const fullPath = path.join(projectRoot, filePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        let updated = false;
        
        for (const replacement of MIGRATION_CONFIG.serviceReplacements) {
          if (content.includes(replacement.from)) {
            content = content.replace(new RegExp(replacement.from, 'g'), replacement.to);
            updated = true;
          }
        }
        
        if (updated) {
          fs.writeFileSync(fullPath, content);
          console.log(`  ✅ Updated service usage: ${filePath}`);
        } else {
          console.log(`  ℹ️ No service usage to update: ${filePath}`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to update: ${filePath}`, error);
      }
    }
  }
}

async function createBackup() {
  const projectRoot = process.cwd();
  const backupDir = path.join(projectRoot, 'backup-before-migration');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // Создаем резервную копию важных файлов
  const importantFiles = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'next.config.js',
    'tailwind.config.js',
    'prisma/schema.prisma'
  ];
  
  for (const file of importantFiles) {
    const sourcePath = path.join(projectRoot, file);
    const backupPath = path.join(backupDir, file);
    
    if (fs.existsSync(sourcePath)) {
      const backupFileDir = path.dirname(backupPath);
      if (!fs.existsSync(backupFileDir)) {
        fs.mkdirSync(backupFileDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, backupPath);
    }
  }
  
  console.log(`  ✅ Backup created: ${backupDir}`);
}

async function restoreFromBackup() {
  const projectRoot = process.cwd();
  const backupDir = path.join(projectRoot, 'backup-before-migration');
  
  if (fs.existsSync(backupDir)) {
    // Восстанавливаем файлы из резервной копии
    const files = fs.readdirSync(backupDir, { recursive: true });
    
    for (const file of files) {
      const sourcePath = path.join(backupDir, file);
      const targetPath = path.join(projectRoot, file);
      
      if (fs.statSync(sourcePath).isFile()) {
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
    
    console.log('  ✅ Restored from backup');
  }
}

// ============================================================================
// ЗАПУСК МИГРАЦИИ
// ============================================================================

if (require.main === module) {
  migrateToUnified().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}

export { migrateToUnified };
