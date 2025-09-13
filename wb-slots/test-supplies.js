// Тест для проверки токенов и запроса к WB API
const fetch = require('node-fetch');

async function testSupplies() {
  try {
    console.log('🔍 Тестируем API поставок...');
    
    // Сначала проверим, есть ли токены
    const tokensResponse = await fetch('http://localhost:3000/api/tokens', {
      headers: {
        'Cookie': 'auth-token=your-token-here' // Нужен реальный токен
      }
    });
    
    console.log('📊 Статус токенов:', tokensResponse.status);
    
    if (tokensResponse.status === 401) {
      console.log('❌ Нужна авторизация. Откройте браузер и войдите в систему');
      return;
    }
    
    const tokens = await tokensResponse.json();
    console.log('🔑 Токены:', tokens);
    
    // Проверим поставки
    const suppliesResponse = await fetch('http://localhost:3000/api/supplies?limit=10&status=draft', {
      headers: {
        'Cookie': 'auth-token=your-token-here' // Нужен реальный токен
      }
    });
    
    console.log('📦 Статус поставок:', suppliesResponse.status);
    
    if (suppliesResponse.status === 200) {
      const supplies = await suppliesResponse.json();
      console.log('✅ Поставки получены:', supplies);
    } else {
      const error = await suppliesResponse.text();
      console.log('❌ Ошибка поставок:', error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка теста:', error);
  }
}

testSupplies();
