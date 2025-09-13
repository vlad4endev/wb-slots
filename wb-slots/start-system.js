/**
 * Скрипт для запуска системы
 * Проверяет порты и запускает backend и frontend
 */

const { exec, spawn } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function startSystem() {
  console.log('🚀 Запуск системы WB Slots...\n');

  try {
    // Шаг 1: Проверка портов
    console.log('1️⃣ Проверка портов...');
    
    const checkPort = async (port) => {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        return stdout.trim() !== '';
      } catch {
        return false;
      }
    };

    const port3000 = await checkPort(3000);
    const port3001 = await checkPort(3001);

    console.log(`📊 Порт 3000 (frontend): ${port3000 ? '❌ Занят' : '✅ Свободен'}`);
    console.log(`📊 Порт 3001 (backend): ${port3001 ? '❌ Занят' : '✅ Свободен'}`);

    // Шаг 2: Очистка портов если нужно
    if (port3000 || port3001) {
      console.log('\n2️⃣ Очистка портов...');
      
      if (port3000) {
        console.log('🛑 Очищаем порт 3000...');
        try {
          await execAsync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :3000\') do taskkill /PID %a /F');
        } catch (e) {
          console.log('⚠️  Не удалось очистить порт 3000');
        }
      }
      
      if (port3001) {
        console.log('🛑 Очищаем порт 3001...');
        try {
          await execAsync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :3001\') do taskkill /PID %a /F');
        } catch (e) {
          console.log('⚠️  Не удалось очистить порт 3001');
        }
      }
      
      // Ждем
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Шаг 3: Инструкции по запуску
    console.log('\n3️⃣ Инструкции по запуску:');
    console.log('📝 Откройте два терминала и выполните:');
    console.log('');
    console.log('Терминал 1 (Backend):');
    console.log('  cd backend');
    console.log('  npm run start:dev');
    console.log('');
    console.log('Терминал 2 (Frontend):');
    console.log('  npm run dev');
    console.log('');
    console.log('После запуска откройте: http://localhost:3000');

    // Шаг 4: Проверка файлов конфигурации
    console.log('\n4️⃣ Проверка конфигурации...');
    const fs = require('fs');
    const path = require('path');
    
    const frontendEnv = fs.existsSync('.env.local');
    const backendEnv = fs.existsSync('backend/.env');
    
    console.log(`📁 .env.local: ${frontendEnv ? '✅' : '❌'}`);
    console.log(`📁 backend/.env: ${backendEnv ? '✅' : '❌'}`);
    
    if (!frontendEnv || !backendEnv) {
      console.log('\n💡 Создание файлов конфигурации...');
      if (!frontendEnv) {
        console.log('Создаем .env.local...');
        await execAsync('node setup-frontend-env.js');
      }
      if (!backendEnv) {
        console.log('Создаем backend/.env...');
        await execAsync('node setup-backend-env.js');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при запуске системы:', error.message);
  }
}

// Запуск
startSystem().then(() => {
  console.log('\n🏁 Система готова к запуску!');
  console.log('\n📋 Следующие шаги:');
  console.log('   1. Запустите backend в отдельном терминале');
  console.log('   2. Запустите frontend в другом терминале');
  console.log('   3. Откройте http://localhost:3000');
  console.log('   4. Войдите в систему');
  console.log('   5. Проверьте загрузку поставок');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
