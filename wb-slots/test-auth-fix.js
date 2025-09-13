/**
 * Тест исправленной аутентификации
 * Проверяет работу API supplies после исправления JWT токенов
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function testAuthFix() {
  console.log('🔐 Тестирование исправленной аутентификации...\n');

  try {
    // Тест 1: Проверка backend напрямую (должен вернуть 401 без токена)
    console.log('1️⃣ Тестирование backend без токена...');
    const backendResponse = await fetch(`${BACKEND_URL}/supplies?status=draft&limit=10`);
    
    if (backendResponse.status === 401) {
      console.log('✅ Backend правильно требует аутентификацию');
    } else {
      console.log('⚠️  Backend не требует аутентификацию (неожиданно)');
    }

    // Тест 2: Проверка frontend API (должен работать с cookie)
    console.log('\n2️⃣ Тестирование frontend API...');
    const frontendResponse = await fetch(`${FRONTEND_URL}/api/supplies?status=draft&limit=10`, {
      credentials: 'include'
    });
    
    console.log('📊 Frontend API Response:', {
      status: frontendResponse.status,
      statusText: frontendResponse.statusText
    });

    if (frontendResponse.ok) {
      const data = await frontendResponse.json();
      console.log('✅ Frontend API работает!');
      console.log('📦 Поставки загружены:', data.data?.supplies?.length || 0);
      
      if (data.data?.supplies?.length > 0) {
        console.log('\n📋 Примеры поставок:');
        data.data.supplies.slice(0, 3).forEach((supply, index) => {
          console.log(`${index + 1}. ${supply.name} (${supply.status})`);
        });
      }
    } else {
      const errorData = await frontendResponse.json();
      console.log('❌ Frontend API ошибка:', errorData.error);
      
      if (frontendResponse.status === 401) {
        console.log('💡 Возможные причины:');
        console.log('   - Пользователь не авторизован');
        console.log('   - JWT токен истек');
        console.log('   - Неправильный JWT_SECRET');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Возможные причины:');
      console.log('   - Backend не запущен (запустите: cd backend && npm run start:dev)');
      console.log('   - Frontend не запущен (запустите: npm run dev)');
      console.log('   - Неправильные URL в переменных окружения');
    }
  }
}

// Запуск теста
testAuthFix().then(() => {
  console.log('\n🏁 Тестирование завершено');
  console.log('\n📝 Если тесты не прошли:');
  console.log('   1. Убедитесь, что backend запущен: cd backend && npm run start:dev');
  console.log('   2. Убедитесь, что frontend запущен: npm run dev');
  console.log('   3. Проверьте, что пользователь авторизован в браузере');
  console.log('   4. Проверьте файлы .env и .env.local');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
