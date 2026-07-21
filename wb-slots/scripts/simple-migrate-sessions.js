#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Упрощенный скрипт миграции для замены множественных менеджеров сессий на единый
 */

function findTsFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function migrateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Заменяем импорты
    const importReplacements = [
      ["from '@/lib/services/wb-session-manager'", "from '@/lib/session'"],
      ["from '@/lib/wb-session-manager'", "from '@/lib/session'"],
      ["from '@/lib/services/enhanced-session-manager'", "from '@/lib/session'"],
      ["from '@/lib/services/enhanced-wb-session-manager'", "from '@/lib/session'"]
    ];
    
    for (const [old, new_] of importReplacements) {
      if (content.includes(old)) {
        content = content.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), new_);
        modified = true;
      }
    }
    
    // Заменяем создание экземпляров
    const instanceReplacements = [
      ["new WBSessionManager(", "getUnifiedSessionManager()"],
      ["new EnhancedSessionManager(", "getUnifiedSessionManager()"],
      ["new EnhancedWBSessionManager(", "getUnifiedSessionManager()"]
    ];
    
    for (const [old, new_] of instanceReplacements) {
      if (content.includes(old)) {
        content = content.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), new_);
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

function main() {
  console.log('🔄 Starting simple session manager migration...\n');
  
  const srcDir = path.join(process.cwd(), 'src');
  if (!fs.existsSync(srcDir)) {
    console.error('❌ src directory not found');
    return;
  }
  
  const files = findTsFiles(srcDir);
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
