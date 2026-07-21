async function testPlaywrightAPI() {
  console.log('🧪 Тестирование Playwright API автобронирования...');
  
  try {
    // Тест 1: Проверка статуса API
    console.log('\n1. Проверка статуса API...');
    const statusResponse = await fetch('http://localhost:3000/api/services/auto-booking', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ Статус API:', statusData);
    } else {
      console.log('❌ Ошибка статуса API:', statusResponse.status, statusResponse.statusText);
    }

    // Тест 2: Проверка Playwright модуля
    console.log('\n2. Проверка Playwright модуля...');
    const playwrightResponse = await fetch('http://localhost:3000/api/auto-booking/playwright', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (playwrightResponse.ok) {
      const playwrightData = await playwrightResponse.json();
      console.log('✅ Playwright API:', playwrightData);
    } else {
      console.log('❌ Ошибка Playwright API:', playwrightResponse.status, playwrightResponse.statusText);
    }

    console.log('\n🎉 Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

testPlaywrightAPI();
