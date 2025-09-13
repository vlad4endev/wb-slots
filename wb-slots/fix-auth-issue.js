/**
 * Исправление проблемы с аутентификацией
 * Проверяет и исправляет проблемы с JWT токенами и аутентификацией
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function fixAuthIssue() {
  console.log('🔧 Исправление проблемы с аутентификацией...\n');

  try {
    // Шаг 1: Проверка доступности frontend
    console.log('1️⃣ Проверка доступности frontend...');
    const healthResponse = await fetch(`${FRONTEND_URL}/api/auth/me`);
    console.log('📊 Frontend доступен:', healthResponse.status !== 0);

    if (healthResponse.status === 0) {
      console.log('❌ Frontend недоступен. Запустите: npm run dev');
      return;
    }

    // Шаг 2: Проверка JWT_SECRET в переменных окружения
    console.log('\n2️⃣ Проверка переменных окружения...');
    console.log('💡 Убедитесь, что файлы .env и .env.local созданы:');
    console.log('   - .env.local в корне проекта');
    console.log('   - backend/.env в папке backend');
    console.log('   - JWT_SECRET должен быть одинаковым в обоих файлах');

    // Шаг 3: Инструкции по исправлению
    console.log('\n3️⃣ Инструкции по исправлению:');
    console.log('📝 Выполните следующие шаги:');
    console.log('');
    console.log('   1. Убедитесь, что frontend запущен:');
    console.log('      npm run dev');
    console.log('');
    console.log('   2. Убедитесь, что backend запущен:');
    console.log('      cd backend && npm run start:dev');
    console.log('');
    console.log('   3. Откройте браузер и перейдите на:');
    console.log('      http://localhost:3000');
    console.log('');
    console.log('   4. Войдите в систему или зарегистрируйтесь');
    console.log('');
    console.log('   5. После входа проверьте загрузку поставок');

    // Шаг 4: Проверка файлов конфигурации
    console.log('\n4️⃣ Проверка конфигурации...');
    console.log('📁 Проверьте наличие файлов:');
    console.log('   ✅ .env.local (создан скриптом setup-frontend-env.js)');
    console.log('   ✅ backend/.env (создан скриптом setup-backend-env.js)');
    console.log('');
    console.log('🔑 JWT_SECRET должен быть: "wb-slots-super-secret-jwt-key-2024"');

    // Шаг 5: Тест после исправления
    console.log('\n5️⃣ Тест после исправления:');
    console.log('После выполнения всех шагов запустите:');
    console.log('   node debug-auth-supplies.js');

  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error.message);
  }
}

// Запуск исправления
fixAuthIssue().then(() => {
  console.log('\n🏁 Инструкции по исправлению завершены');
  console.log('\n🚀 Следующие шаги:');
  console.log('   1. Запустите frontend: npm run dev');
  console.log('   2. Запустите backend: cd backend && npm run start:dev');
  console.log('   3. Откройте http://localhost:3000 в браузере');
  console.log('   4. Войдите в систему');
  console.log('   5. Проверьте загрузку поставок');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
