/**
 * Тестовый скрипт для демонстрации работы мини-браузера авторизации
 * 
 * Запуск: node test-mini-browser-auth.js
 */

const { AutoBookingService } = require('./src/lib/services/auto-booking-service');

async function testMiniBrowserAuth() {
  console.log('🚀 Starting mini browser authentication test...');
  
  try {
    const service = new AutoBookingService();
    
    // Тестовые данные для бронирования
    const testConfig = {
      taskId: 'test-task-123',
      userId: 'test-user-456',
      runId: 'test-run-789',
      slotId: 'test-slot-001',
      supplyId: 'test-supply-002',
      warehouseId: 'test-warehouse-003',
      boxTypeId: 'test-box-004',
      date: '2025-01-15',
      coefficient: 1.0
    };
    
    console.log('📋 Test configuration:', testConfig);
    
    // Запускаем процесс бронирования
    // Система автоматически откроет мини-браузер если нужна авторизация
    const result = await service.startBooking(testConfig);
    
    console.log('✅ Booking result:', result);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Запускаем тест
testMiniBrowserAuth().catch(console.error);
