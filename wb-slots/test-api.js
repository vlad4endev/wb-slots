// Простой тест для проверки API автобронирования
const testAutoBookingAPI = async () => {
  try {
    console.log('🧪 Тестирование API автобронирования...');
    
    // Тест GET запроса (проверка статуса)
    const getResponse = await fetch('http://localhost:3000/api/services/auto-booking', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      }
    });
    
    console.log('GET Response status:', getResponse.status);
    const getData = await getResponse.json();
    console.log('GET Response data:', getData);
    
    // Тест POST запроса (запуск бронирования)
    const postData = {
      taskId: 'test-task-123',
      runId: 'test-run-456',
      slotId: 'test-slot-789',
      supplyId: 'test-supply-001',
      warehouseId: 1,
      boxTypeId: 1,
      date: '2024-01-15',
      coefficient: 1.0
    };
    
    const postResponse = await fetch('http://localhost:3000/api/services/auto-booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      },
      body: JSON.stringify(postData)
    });
    
    console.log('POST Response status:', postResponse.status);
    const postResponseData = await postResponse.json();
    console.log('POST Response data:', postResponseData);
    
  } catch (error) {
    console.error('❌ Ошибка тестирования API:', error.message);
  }
};

// Запускаем тест через 5 секунд (даем время серверу запуститься)
setTimeout(testAutoBookingAPI, 5000);