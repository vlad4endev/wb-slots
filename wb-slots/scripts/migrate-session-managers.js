#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Скрипт миграции для замены множественных менеджеров сессий на единый
 */

const MIGRATION_MAP = {
  // Старые импорты -> новые импорты
  "from '@/lib/services/wb-session-manager'": "from '@/lib/session'",
  "from '@/lib/wb-session-manager'": "from '@/lib/session'",
  "from '@/lib/services/enhanced-session-manager'": "from '@/lib/session'",
  "from '@/lib/services/enhanced-wb-session-manager'": "from '@/lib/session'",
  
  // Импорты классов
  "import { WBSessionManager }": "import { WBSessionManager }",
  "import { EnhancedSessionManager }": "import { EnhancedSessionManager }",
  "import { EnhancedWBSessionManager }": "import { EnhancedWBSessionManager }",
  
  // Создание экземпляров
  "new WBSessionManager(": "getUnifiedSessionManager()",
  "new EnhancedSessionManager(": "getUnifiedSessionManager()",
  "new EnhancedWBSessionManager(": "getUnifiedSessionManager()",
};

const FILES_TO_MIGRATE = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'src/**/*.js',
  'src/**/*.jsx'
];

function migrateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Применяем миграции
    for (const [oldPattern, newPattern] of Object.entries(MIGRATION_MAP)) {
      if (content.includes(oldPattern)) {
        content = content.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);
        modified = true;
      }
    }
    
    // Добавляем импорт getUnifiedSessionManager если нужно
    if (content.includes('getUnifiedSessionManager()') && !content.includes('getUnifiedSessionManager')) {
      const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]@\/lib\/session['"]/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(imp => imp.trim());
        if (!imports.includes('getUnifiedSessionManager')) {
          imports.push('getUnifiedSessionManager');
          content = content.replace(
            importMatch[0],
            `import { ${imports.join(', ')} } from '@/lib/session'`
          );
          modified = true;
        }
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Migrated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error.message);
    return false;
  }
}

function findFiles() {
  const files = [];
  
  for (const pattern of FILES_TO_MIGRATE) {
    const matches = glob.sync(pattern, { cwd: process.cwd() });
    files.push(...matches);
  }
  
  return [...new Set(files)]; // Убираем дубликаты
}

function main() {
  console.log('🔄 Starting session manager migration...\n');
  
  const files = findFiles();
  console.log(`📁 Found ${files.length} files to check\n`);
  
  let migratedCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    try {
      if (migrateFile(file)) {
        migratedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`✅ Files migrated: ${migratedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📁 Total files processed: ${files.length}`);
  
  if (migratedCount > 0) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Review the migrated files');
    console.log('2. Test the application');
    console.log('3. Remove old session manager files if no longer needed');
  } else {
    console.log('\nℹ️  No files needed migration');
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateFile, findFiles };
