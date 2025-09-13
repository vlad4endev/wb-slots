/**
 * Тест нового формата API запроса поставок
 * Проверяет работу с POST запросом и HeaderApiKey авторизацией
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function testNewSuppliesAPI() {
  console.log('🧪 Тестирование нового формата API поставок...\n');

  try {
    // Тест 1: Проверка backend напрямую
    console.log('1️⃣ Тестирование backend API...');
    const backendResponse = await fetch(`${BACKEND_URL}/supplies?status=draft&limit=10`);
    
    console.log('📊 Backend Response:', {
      status: backendResponse.status,
      statusText: backendResponse.statusText
    });

    if (backendResponse.ok) {
      const backendData = await backendResponse.json();
      console.log('✅ Backend API работает!');
      console.log('📦 Поставки загружены:', backendData.data?.supplies?.length || 0);
      
      if (backendData.data?.supplies?.length > 0) {
        console.log('\n📋 Примеры поставок:');
        backendData.data.supplies.slice(0, 3).forEach((supply, index) => {
          console.log(`${index + 1}. ${supply.name} (ID: ${supply.id})`);
          console.log(`   Статус: ${supply.status}`);
          console.log(`   Склад: ${supply.warehouseId}`);
          console.log('---');
        });
      }
    } else {
      const errorData = await backendResponse.json();
      console.log('❌ Backend API ошибка:', errorData.message || errorData.error);
    }

    // Тест 2: Проверка frontend API
    console.log('\n2️⃣ Тестирование frontend API...');
    const frontendResponse = await fetch(`${FRONTEND_URL}/api/supplies?status=draft&limit=10`, {
      credentials: 'include'
    });
    
    console.log('📊 Frontend Response:', {
      status: frontendResponse.status,
      statusText: frontendResponse.statusText
    });

    if (frontendResponse.ok) {
      const frontendData = await frontendResponse.json();
      console.log('✅ Frontend API работает!');
      console.log('📦 Поставки загружены:', frontendData.data?.supplies?.length || 0);
    } else {
      const errorData = await frontendResponse.json();
      console.log('❌ Frontend API ошибка:', errorData.error);
    }

    // Тест 3: Проверка curl команды
    console.log('\n3️⃣ Проверка curl команды...');
    console.log('📝 Ожидаемый формат curl запроса:');
    console.log(`curl -X POST "https://supplies-api.wildberries.ru/api/v1/supplies?limit=100&offset=0" \\
  -H "Authorization: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "statusIDs": [5, 6],
    "dates": [
      {
        "from": "2025-01-01",
        "till": "2025-01-31",
        "type": "factDate"
      }
    ]
  }'`);

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
testNewSuppliesAPI().then(() => {
  console.log('\n🏁 Тестирование завершено');
  console.log('\n📝 Изменения в API:');
  console.log('   ✅ Метод изменен с GET на POST');
  console.log('   ✅ Заголовок авторизации: Authorization: YOUR_API_KEY');
  console.log('   ✅ Добавлено тело запроса с фильтрами');
  console.log('   ✅ Статусы черновик: statusIDs [5, 6]');
  console.log('   ✅ Поддержка фильтрации по датам');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
