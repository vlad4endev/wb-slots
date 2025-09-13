const axios = require('axios');

async function testWBApi() {
  try {
    console.log('🧪 Тестирование Wildberries API...');
    
    // Тестируем с реальными параметрами из логов
    const requestBody = {
      warehouseIDs: [301809], // Склад из логов
      dateFrom: '2025-09-13T00:41:00.000Z',
      dateTo: '2025-10-30T00:41:00.000Z',
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
      console.error('Заголовки:', error.response.headers);
    }
  }
}

testWBApi();
