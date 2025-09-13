/**
 * Запуск frontend с проверкой
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Запуск frontend...\n');

// Проверяем, что мы в правильной директории
const currentDir = process.cwd();
const packageJsonPath = path.join(currentDir, 'package.json');

const fs = require('fs');
if (!fs.existsSync(packageJsonPath)) {
  console.log('❌ Ошибка: package.json не найден');
  console.log('💡 Убедитесь, что вы находитесь в корневой папке проекта');
  process.exit(1);
}

console.log('📁 Текущая директория:', currentDir);
console.log('📦 package.json найден');

// Запускаем frontend
console.log('\n🔄 Запуск frontend...');
console.log('💡 После запуска откройте http://localhost:3000 в браузере');
console.log('💡 Войдите в систему или зарегистрируйтесь');
console.log('💡 Проверьте загрузку поставок в форме создания задачи\n');

const frontendProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: currentDir
});

frontendProcess.on('error', (error) => {
  console.error('❌ Ошибка запуска frontend:', error.message);
  console.log('\n💡 Попробуйте запустить вручную:');
  console.log('   npm run dev');
});

frontendProcess.on('close', (code) => {
  console.log(`\n🔄 Frontend завершен с кодом ${code}`);
  if (code !== 0) {
    console.log('❌ Frontend завершился с ошибкой');
    console.log('💡 Проверьте логи выше для диагностики');
  }
});

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Остановка frontend...');
  frontendProcess.kill('SIGINT');
  process.exit(0);
});

console.log('✅ Frontend запущен!');
console.log('🌐 Откройте http://localhost:3000 в браузере');
console.log('🔐 Войдите в систему для тестирования загрузки поставок');
console.log('\n💡 Для остановки нажмите Ctrl+C');
