// Тест автобронирования с исправленной сессией

async function testAutoBooking() {
  try {
    console.log('🧪 Тестирование автобронирования...');
    
    const baseUrl = 'http://localhost:3000';
    
    // Тестовые данные (согласно схеме API)
    const bookingData = {
      taskId: 'test-task-id',
      runId: 'test-run-id',
      slotId: 'test-slot-id',
      supplyId: 'test-supply-id',
      warehouseId: 301983,
      boxTypeId: 2,
      date: '2025-09-30',
      coefficient: 1.5
    };
    
    console.log('📋 Данные для бронирования:', bookingData);
    
    const response = await fetch(`${baseUrl}/api/services/auto-booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWZ2bWxmNHgwMDAwcG1qc21kM2VvdWh1IiwiZW1haWwiOiJ2bDRlbi45NUB5YW5kZXgucnUiLCJyb2xlIjoiREVWRUxPUEVSIiwiaWF0IjoxNzU5MTE0MjMzLCJleHAiOjE3NTk3MTkwMzN9.qNF-jANlYJQuMKhdCEyGC5qnrV2rpkbU0Aphy1DjE7Q'
      },
      body: JSON.stringify(bookingData)
    });
    
    console.log('📊 Статус ответа:', response.status);
    
    const result = await response.json();
    console.log('📋 Результат:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Автобронирование успешно!');
    } else {
      console.log('❌ Ошибка автобронирования:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

testAutoBooking();
