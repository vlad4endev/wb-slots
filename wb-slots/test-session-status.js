// Тест для проверки статуса сессии WB
const testSessionStatus = async () => {
  try {
    console.log('🧪 Тестирование статуса сессии WB...');
    
    // Тест 1: Проверка статуса сессии
    const statusResponse = await fetch('http://localhost:3000/api/wb-session/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      }
    });
    
    console.log('📊 Статус сессии:');
    console.log('Status:', statusResponse.status);
    const statusData = await statusResponse.json();
    console.log('Data:', JSON.stringify(statusData, null, 2));
    
    // Тест 2: Проверка WB Auth статуса
    const wbAuthResponse = await fetch('http://localhost:3000/api/auto-booking/wb-auth', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      }
    });
    
    console.log('\n🔐 WB Auth статус:');
    console.log('Status:', wbAuthResponse.status);
    const wbAuthData = await wbAuthResponse.json();
    console.log('Data:', JSON.stringify(wbAuthData, null, 2));
    
    // Тест 3: Создание тестовой сессии
    console.log('\n📝 Создание тестовой сессии...');
    const createSessionResponse = await fetch('http://localhost:3000/api/wb-auth/create-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      },
      body: JSON.stringify({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: '127.0.0.1',
        cookies: 'WBToken=test-token-123; x-supplier-id=test-supplier; SessionId=test-session-456'
      })
    });
    
    console.log('Status:', createSessionResponse.status);
    const createSessionData = await createSessionResponse.json();
    console.log('Data:', JSON.stringify(createSessionData, null, 2));
    
    // Тест 4: Повторная проверка статуса после создания сессии
    if (createSessionData.success) {
      console.log('\n🔄 Повторная проверка статуса после создания сессии...');
      const statusResponse2 = await fetch('http://localhost:3000/api/wb-session/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token' // Замените на реальный токен
        }
      });
      
      console.log('Status:', statusResponse2.status);
      const statusData2 = await statusResponse2.json();
      console.log('Data:', JSON.stringify(statusData2, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования сессии:', error.message);
  }
};

// Запускаем тест через 3 секунды (даем время серверу запуститься)
setTimeout(testSessionStatus, 3000);
