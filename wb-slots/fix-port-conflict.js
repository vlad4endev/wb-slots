/**
 * Исправление конфликта портов
 * Останавливает процесс, занимающий порт 3001, и перезапускает backend
 */

const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function fixPortConflict() {
  console.log('🔧 Исправление конфликта портов...\n');

  try {
    // Шаг 1: Проверка занятости порта 3001
    console.log('1️⃣ Проверка порта 3001...');
    const { stdout } = await execAsync('netstat -ano | findstr :3001');
    
    if (stdout.trim()) {
      console.log('⚠️  Порт 3001 занят. Найденные процессы:');
      console.log(stdout);
      
      // Извлекаем PID из вывода
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const match = line.match(/\s+(\d+)$/);
        if (match) {
          pids.add(match[1]);
        }
      });
      
      // Останавливаем процессы
      console.log('\n2️⃣ Остановка процессов...');
      for (const pid of pids) {
        try {
          console.log(`🛑 Останавливаем процесс PID ${pid}...`);
          await execAsync(`taskkill /PID ${pid} /F`);
          console.log(`✅ Процесс ${pid} остановлен`);
        } catch (error) {
          console.log(`⚠️  Не удалось остановить процесс ${pid}: ${error.message}`);
        }
      }
      
      // Ждем немного
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Проверяем, что порт освободился
      console.log('\n3️⃣ Проверка освобождения порта...');
      const { stdout: checkOutput } = await execAsync('netstat -ano | findstr :3001');
      
      if (checkOutput.trim()) {
        console.log('❌ Порт 3001 все еще занят');
        console.log(checkOutput);
      } else {
        console.log('✅ Порт 3001 освобожден');
      }
    } else {
      console.log('✅ Порт 3001 свободен');
    }

    // Шаг 4: Инструкции по запуску
    console.log('\n4️⃣ Инструкции по запуску:');
    console.log('📝 Теперь можно запустить backend:');
    console.log('   cd backend && npm run start:dev');
    console.log('');
    console.log('📝 Или запустить frontend:');
    console.log('   npm run dev');

  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error.message);
  }
}

// Запуск исправления
fixPortConflict().then(() => {
  console.log('\n🏁 Исправление конфликта портов завершено');
  console.log('\n🚀 Следующие шаги:');
  console.log('   1. Запустите backend: cd backend && npm run start:dev');
  console.log('   2. Запустите frontend: npm run dev');
  console.log('   3. Откройте http://localhost:3000 в браузере');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
