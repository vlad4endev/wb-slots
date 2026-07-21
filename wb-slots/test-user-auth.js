// Тест для проверки авторизации пользователя
const testUserAuth = async () => {
  try {
    console.log('🧪 Тестирование авторизации пользователя...');
    
    // Тест 1: Проверка статуса пользователя
    const authResponse = await fetch('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      }
    });
    
    console.log('📊 Статус авторизации:');
    console.log('Status:', authResponse.status);
    const authData = await authResponse.json();
    console.log('Data:', JSON.stringify(authData, null, 2));
    
    // Тест 2: Проверка WB Auth Popup
    const wbAuthResponse = await fetch('http://localhost:3000/api/wb-auth/popup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      },
      body: JSON.stringify({
        userId: 'cmfvmlf4x0000pmjsmd3eouhu'
      })
    });
    
    console.log('\n🔐 WB Auth Popup:');
    console.log('Status:', wbAuthResponse.status);
    const wbAuthData = await wbAuthResponse.json();
    console.log('Data:', JSON.stringify(wbAuthData, null, 2));
    
    // Тест 3: Проверка статуса сессии
    const sessionResponse = await fetch('http://localhost:3000/api/wb-session/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      }
    });
    
    console.log('\n📋 Статус сессии:');
    console.log('Status:', sessionResponse.status);
    const sessionData = await sessionResponse.json();
    console.log('Data:', JSON.stringify(sessionData, null, 2));
    
    if (authData.user && wbAuthResponse.status === 200) {
      console.log('\n🎉 Авторизация работает корректно!');
      console.log('Пользователь:', authData.user.email);
      console.log('Роль:', authData.user.role);
    } else {
      console.log('\n⚠️ Есть проблемы с авторизацией');
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования авторизации:', error.message);
  }
};

// Запускаем тест через 3 секунды (даем время серверу запуститься)
setTimeout(testUserAuth, 3000);
