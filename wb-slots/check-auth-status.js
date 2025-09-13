/**
 * Проверка статуса аутентификации
 * Диагностирует проблемы с аутентификацией и предлагает решения
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function checkAuthStatus() {
  console.log('🔍 Проверка статуса аутентификации...\n');

  try {
    // Проверка 1: Frontend доступен
    console.log('1️⃣ Проверка доступности frontend...');
    try {
      const frontendResponse = await fetch(`${FRONTEND_URL}/api/auth/me`);
      console.log(`📊 Frontend статус: ${frontendResponse.status}`);
      
      if (frontendResponse.status === 401) {
        console.log('❌ Пользователь не авторизован');
        console.log('💡 Решение: Войдите в систему через браузер');
        console.log('   - Откройте http://localhost:3000');
        console.log('   - Войдите в систему или зарегистрируйтесь');
        console.log('   - Проверьте, что cookies сохраняются');
      } else if (frontendResponse.ok) {
        const data = await frontendResponse.json();
        console.log('✅ Пользователь авторизован:', data.data?.user?.email);
      }
    } catch (error) {
      console.log('❌ Frontend недоступен:', error.message);
      console.log('💡 Решение: Запустите frontend - npm run dev');
    }

    // Проверка 2: Backend доступен
    console.log('\n2️⃣ Проверка доступности backend...');
    try {
      const backendResponse = await fetch(`${BACKEND_URL}/supplies`);
      console.log(`📊 Backend статус: ${backendResponse.status}`);
      
      if (backendResponse.status === 401) {
        console.log('✅ Backend работает и требует аутентификацию');
      } else {
        console.log('⚠️  Backend не требует аутентификацию (неожиданно)');
      }
    } catch (error) {
      console.log('❌ Backend недоступен:', error.message);
      console.log('💡 Решение: Запустите backend - cd backend && npm run start:dev');
    }

    // Проверка 3: Файлы конфигурации
    console.log('\n3️⃣ Проверка файлов конфигурации...');
    const fs = require('fs');
    
    const frontendEnv = fs.existsSync('.env.local');
    const backendEnv = fs.existsSync('backend/.env');
    
    console.log(`📁 .env.local: ${frontendEnv ? '✅' : '❌'}`);
    console.log(`📁 backend/.env: ${backendEnv ? '✅' : '❌'}`);
    
    if (!frontendEnv || !backendEnv) {
      console.log('\n💡 Создание файлов конфигурации...');
      if (!frontendEnv) {
        console.log('Создаем .env.local...');
        const { exec } = require('child_process');
        exec('node setup-frontend-env.js', (error, stdout, stderr) => {
          if (error) {
            console.log('❌ Ошибка создания .env.local:', error.message);
          } else {
            console.log('✅ .env.local создан');
          }
        });
      }
      if (!backendEnv) {
        console.log('Создаем backend/.env...');
        const { exec } = require('child_process');
        exec('node setup-backend-env.js', (error, stdout, stderr) => {
          if (error) {
            console.log('❌ Ошибка создания backend/.env:', error.message);
          } else {
            console.log('✅ backend/.env создан');
          }
        });
      }
    }

    // Проверка 4: Инструкции по решению
    console.log('\n4️⃣ Инструкции по решению проблемы:');
    console.log('📝 Выполните следующие шаги:');
    console.log('');
    console.log('   1. Убедитесь, что backend запущен:');
    console.log('      cd backend && npm run start:dev');
    console.log('');
    console.log('   2. Убедитесь, что frontend запущен:');
    console.log('      npm run dev');
    console.log('');
    console.log('   3. Откройте браузер и перейдите на:');
    console.log('      http://localhost:3000');
    console.log('');
    console.log('   4. Войдите в систему или зарегистрируйтесь');
    console.log('');
    console.log('   5. После входа проверьте загрузку поставок');
    console.log('');
    console.log('   6. Если проблема остается, очистите cookies браузера');

  } catch (error) {
    console.error('❌ Ошибка при проверке:', error.message);
  }
}

// Запуск проверки
checkAuthStatus().then(() => {
  console.log('\n🏁 Проверка завершена');
  console.log('\n📋 Следующие шаги:');
  console.log('   1. Запустите frontend: npm run dev');
  console.log('   2. Откройте http://localhost:3000 в браузере');
  console.log('   3. Войдите в систему');
  console.log('   4. Проверьте загрузку поставок');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
