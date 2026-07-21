// Скрипт для создания тестовой сессии WB
const createTestSession = async () => {
  try {
    console.log('🔧 Создание тестовой сессии WB...');
    
    // Создаем тестовую сессию
    const response = await fetch('http://localhost:3000/api/wb-auth/create-session', {
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
    
    console.log('📊 Результат создания сессии:');
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Сессия успешно создана!');
      console.log('Session ID:', data.data?.sessionId);
      
      // Проверяем статус сессии
      console.log('\n🔍 Проверка статуса сессии...');
      const statusResponse = await fetch('http://localhost:3000/api/wb-session/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token' // Замените на реальный токен
        }
      });
      
      console.log('Status:', statusResponse.status);
      const statusData = await statusResponse.json();
      console.log('Status Data:', JSON.stringify(statusData, null, 2));
      
      if (statusData.data?.isActive) {
        console.log('\n🎉 Сессия активна и работает корректно!');
      } else {
        console.log('\n⚠️ Сессия неактивна или есть проблемы');
      }
    } else {
      console.log('\n❌ Ошибка создания сессии:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
};

// Запускаем через 5 секунд (даем время серверу запуститься)
setTimeout(createTestSession, 5000);
