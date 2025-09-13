/**
 * Диагностика проблемы с аутентификацией при загрузке поставок
 * Проверяет все этапы аутентификации и загрузки данных
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function debugAuthSupplies() {
  console.log('🔍 Диагностика проблемы с аутентификацией поставок...\n');

  try {
    // Тест 1: Проверка аутентификации пользователя
    console.log('1️⃣ Проверка аутентификации пользователя...');
    const authResponse = await fetch(`${FRONTEND_URL}/api/auth/me`, {
      credentials: 'include'
    });
    
    console.log('📊 Auth Response:', {
      status: authResponse.status,
      statusText: authResponse.statusText
    });

    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('✅ Пользователь авторизован:', {
        id: authData.data?.user?.id,
        email: authData.data?.user?.email,
        role: authData.data?.user?.role
      });
    } else {
      const authError = await authResponse.json();
      console.log('❌ Пользователь НЕ авторизован:', authError.error);
      console.log('💡 Решение: Войдите в систему через браузер');
      return;
    }

    // Тест 2: Проверка API поставок с аутентификацией
    console.log('\n2️⃣ Проверка API поставок...');
    const suppliesResponse = await fetch(`${FRONTEND_URL}/api/supplies?status=draft&limit=10`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📊 Supplies Response:', {
      status: suppliesResponse.status,
      statusText: suppliesResponse.statusText
    });

    if (suppliesResponse.ok) {
      const suppliesData = await suppliesResponse.json();
      console.log('✅ Поставки загружены успешно!');
      console.log('📦 Количество поставок:', suppliesData.data?.supplies?.length || 0);
      
      if (suppliesData.data?.supplies?.length > 0) {
        console.log('\n📋 Примеры поставок:');
        suppliesData.data.supplies.slice(0, 3).forEach((supply, index) => {
          console.log(`${index + 1}. ${supply.name} (ID: ${supply.id})`);
          console.log(`   Статус: ${supply.status}`);
          console.log('---');
        });
      }
    } else {
      const suppliesError = await suppliesResponse.json();
      console.log('❌ Ошибка загрузки поставок:', suppliesError.error);
      
      if (suppliesResponse.status === 401) {
        console.log('\n💡 Возможные причины ошибки 401:');
        console.log('   1. JWT токен не найден в cookies');
        console.log('   2. JWT токен истек');
        console.log('   3. Неправильный JWT_SECRET в .env файлах');
        console.log('   4. Backend не запущен');
        console.log('   5. Проблемы с передачей токена в backend');
      }
    }

    // Тест 3: Проверка backend напрямую
    console.log('\n3️⃣ Проверка backend API...');
    const backendResponse = await fetch(`${BACKEND_URL}/supplies?status=draft&limit=10`);
    
    console.log('📊 Backend Response:', {
      status: backendResponse.status,
      statusText: backendResponse.statusText
    });

    if (backendResponse.status === 401) {
      console.log('✅ Backend правильно требует аутентификацию');
    } else {
      console.log('⚠️  Backend не требует аутентификацию (неожиданно)');
    }

  } catch (error) {
    console.error('❌ Ошибка при диагностике:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Возможные причины:');
      console.log('   1. Frontend не запущен (запустите: npm run dev)');
      console.log('   2. Backend не запущен (запустите: cd backend && npm run start:dev)');
      console.log('   3. Неправильные URL в переменных окружения');
    }
  }
}

// Запуск диагностики
debugAuthSupplies().then(() => {
  console.log('\n🏁 Диагностика завершена');
  console.log('\n📝 Рекомендации:');
  console.log('   1. Убедитесь, что пользователь авторизован в браузере');
  console.log('   2. Проверьте, что backend и frontend запущены');
  console.log('   3. Проверьте файлы .env и .env.local');
  console.log('   4. Очистите cookies и авторизуйтесь заново');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
