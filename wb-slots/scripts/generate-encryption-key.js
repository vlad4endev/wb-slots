#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Генератор ключа шифрования для системы сессий WB
 */

function generateEncryptionKey() {
  // Генерируем 32-байтный ключ
  const key = crypto.randomBytes(32);
  
  // Возвращаем в разных форматах
  return {
    hex: key.toString('hex'),
    base64: key.toString('base64'),
    buffer: key
  };
}

function updateEnvFile(key) {
  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    let envContent = '';
    
    // Читаем существующий .env файл
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Обновляем или добавляем ENCRYPTION_KEY
    const keyRegex = /^ENCRYPTION_KEY=.*$/m;
    const newKeyLine = `ENCRYPTION_KEY="${key.base64}"`;
    
    if (keyRegex.test(envContent)) {
      envContent = envContent.replace(keyRegex, newKeyLine);
    } else {
      envContent += `\n# Encryption key for WB sessions\n${newKeyLine}\n`;
    }
    
    // Записываем обновленный файл
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ ENCRYPTION_KEY updated in .env file');
    return true;
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
    return false;
  }
}

function main() {
  console.log('🔐 Generating encryption key for WB sessions...\n');
  
  const key = generateEncryptionKey();
  
  console.log('Generated encryption key:');
  console.log(`  Hex format: ${key.hex}`);
  console.log(`  Base64 format: ${key.base64}`);
  console.log(`  Length: ${key.buffer.length} bytes\n`);
  
  // Обновляем .env файл
  if (updateEnvFile(key)) {
    console.log('🎉 Encryption key generated and configured successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart your application to load the new key');
    console.log('2. Test the enhanced session management system');
    console.log('3. Verify that sessions are working correctly');
  } else {
    console.log('\n⚠️  Please manually add the following to your .env file:');
    console.log(`ENCRYPTION_KEY="${key.base64}"`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateEncryptionKey, updateEnvFile };
