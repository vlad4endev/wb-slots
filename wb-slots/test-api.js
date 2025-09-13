const axios = require('axios');

async function testWBApi() {
  try {
    console.log('🧪 Тестирование Wildberries API...');
    
    const requestBody = {
      warehouseIDs: [117866],
      dateFrom: new Date().toISOString(),
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isSortingCenter: false
    };
    
    console.log('📋 Тело запроса:', JSON.stringify(requestBody, null, 2));
    
    const response = await axios.post(
      'https://supplies-api.wildberries.ru/api/v1/acceptance/coefficients',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE' // Замените на реальный токен
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Ответ получен:');
    console.log('Статус:', response.status);
    console.log('Данные:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

testWBApi();
