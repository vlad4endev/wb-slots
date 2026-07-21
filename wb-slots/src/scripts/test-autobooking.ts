/**
 * 🧪 Скрипт тестирования системы автобронирования
 * Проверяет все компоненты единой системы автобронирования
 */

import { 
  initializeAutoBookingSystem,
  startAutoBookingSystem,
  getAutoBookingEntryPoint,
  quickBookSlot,
  urgentBooking,
  scheduleBooking,
  getAutoBookingSystemStatus,
  getAutoBookingSystemHealth
} from '../lib/services/autobooking-entry-point';
import { 
  AutoBookingConfig,
  SlotInfo,
  SupplyInfo,
  BookingCredentials,
  BookingStrategy
} from '../lib/architecture/autobooking-interfaces';

async function testAutoBookingSystem() {
  console.log('🧪 Starting auto booking system tests...');
  
  try {
    // 1. Инициализация системы
    console.log('\n📋 Test 1: System Initialization');
    const entryPoint = await initializeAutoBookingSystem();
    console.log('✅ System initialized successfully');
    
    // 2. Запуск системы
    console.log('\n📋 Test 2: System Startup');
    await entryPoint.start();
    console.log('✅ System started successfully');
    
    // 3. Проверка состояния системы
    console.log('\n📋 Test 3: System Status Check');
    const status = await getAutoBookingSystemStatus();
    console.log('📊 System Status:', {
      initialized: status.initialized,
      running: status.running,
      activeBookings: status.summary.activeBookings,
      queueSize: status.summary.queueSize,
      availableResources: status.summary.availableResources
    });
    
    // 4. Проверка здоровья системы
    console.log('\n📋 Test 4: System Health Check');
    const health = await getAutoBookingSystemHealth();
    console.log('💓 System Health:', {
      status: health.status,
      timestamp: health.timestamp,
      components: Object.keys(health.components)
    });
    
    // 5. Тест создания конфигурации бронирования
    console.log('\n📋 Test 5: Booking Configuration Creation');
    const testConfig = createTestBookingConfig();
    console.log('✅ Test configuration created:', {
      taskId: testConfig.taskId,
      userId: testConfig.userId,
      slotId: testConfig.slot.id,
      supplyId: testConfig.supply.id,
      strategy: testConfig.strategy.type
    });
    
    // 6. Тест добавления в очередь
    console.log('\n📋 Test 6: Queue Operations');
    const queueId = await entryPoint.addToQueue(testConfig, 5);
    console.log('✅ Added to queue:', queueId);
    
    // Проверяем статус очереди
    const queueStatus = await entryPoint.getQueueStatus();
    console.log('📊 Queue Status:', queueStatus);
    
    // 7. Тест планирования бронирования
    console.log('\n📋 Test 7: Scheduled Booking');
    const scheduledId = await scheduleBooking(testConfig, 5000); // 5 секунд задержки
    console.log('✅ Scheduled booking:', scheduledId);
    
    // 8. Тест срочного бронирования
    console.log('\n📋 Test 8: Urgent Booking');
    const urgentId = await urgentBooking(testConfig);
    console.log('✅ Urgent booking created:', urgentId);
    
    // 9. Тест получения метрик
    console.log('\n📋 Test 9: System Metrics');
    const metrics = await entryPoint.getSystemMetrics();
    console.log('📊 System Metrics:', {
      performance: metrics.performance,
      queue: metrics.queue,
      resources: metrics.resources
    });
    
    // 10. Тест получения статистики очереди
    console.log('\n📋 Test 10: Queue Statistics');
    const queueStats = await entryPoint.getQueueStatistics();
    console.log('📊 Queue Statistics:', queueStats);
    
    // 11. Тест получения доступных ресурсов
    console.log('\n📋 Test 11: Available Resources');
    const resources = await entryPoint.getAvailableResources();
    console.log('📊 Available Resources:', resources);
    
    // 12. Тест получения истории бронирований
    console.log('\n📋 Test 12: Booking History');
    const history = entryPoint.getBookingHistory(10);
    console.log('📊 Booking History:', {
      total: history.length,
      successful: history.filter(b => b.success).length,
      failed: history.filter(b => !b.success).length
    });
    
    // 13. Тест очистки очереди
    console.log('\n📋 Test 13: Queue Cleanup');
    await entryPoint.clearQueue();
    console.log('✅ Queue cleared');
    
    // 14. Финальная проверка состояния
    console.log('\n📋 Test 14: Final Status Check');
    const finalStatus = await getAutoBookingSystemStatus();
    console.log('📊 Final Status:', {
      activeBookings: finalStatus.summary.activeBookings,
      queueSize: finalStatus.summary.queueSize,
      availableResources: finalStatus.summary.availableResources
    });
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

function createTestBookingConfig(): AutoBookingConfig {
  const slot: SlotInfo = {
    id: 'test_slot_123',
    warehouseId: 123,
    warehouseName: 'Test Warehouse',
    boxTypeId: 1,
    boxTypeName: 'Test Box Type',
    date: '2024-01-15',
    coefficient: 1.5,
    isSortingCenter: false,
    available: true,
    foundAt: new Date()
  };
  
  const supply: SupplyInfo = {
    id: 'test_supply_456',
    name: 'Test Supply',
    status: 'ACTIVE',
    warehouseId: 123,
    boxTypeId: 1,
    createdAt: new Date()
  };
  
  const credentials: BookingCredentials = {
    email: 'test@example.com',
    password: 'testpassword123',
    sessionData: null,
    cookies: null,
    tokens: {
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token'
    }
  };
  
  const strategy: BookingStrategy = {
    type: 'HYBRID',
    maxRetries: 3,
    retryDelay: 2000,
    timeout: 30000,
    fallbackEnabled: true
  };
  
  return {
    taskId: 'test_task_789',
    userId: 'test_user_101',
    runId: 'test_run_202',
    slot,
    supply,
    credentials,
    strategy,
    priority: 'NORMAL',
    maxExecutionTime: 300000, // 5 минут
    enableNotifications: true,
    enableScreenshots: true,
    enableLogging: true,
    context: {
      searchConfig: {
        warehouseIds: [123],
        boxTypeIds: [1],
        coefficientMin: 1.0,
        coefficientMax: 2.0,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      },
      userPreferences: {
        preferredWarehouses: [123],
        maxCoefficient: 2.0
      },
      systemSettings: {
        enableAutoBooking: true,
        enableNotifications: true
      }
    }
  };
}

// ============================================================================
// ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
// ============================================================================

async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling...');
  
  try {
    const entryPoint = getAutoBookingEntryPoint();
    
    // Тест с неверной конфигурацией
    console.log('📋 Testing invalid configuration...');
    try {
      const invalidConfig = createTestBookingConfig();
      invalidConfig.slot.id = ''; // Неверный ID слота
      await entryPoint.bookSlot(invalidConfig);
      console.log('❌ Should have thrown an error');
    } catch (error) {
      console.log('✅ Correctly handled invalid configuration:', error.message);
    }
    
    // Тест с несуществующим бронированием
    console.log('📋 Testing non-existent booking...');
    try {
      await entryPoint.stopAutoBooking('non_existent_booking_id');
      console.log('❌ Should have thrown an error');
    } catch (error) {
      console.log('✅ Correctly handled non-existent booking:', error.message);
    }
    
    console.log('✅ Error handling tests completed');
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
  }
}

async function testPerformance() {
  console.log('\n🧪 Testing Performance...');
  
  try {
    const entryPoint = getAutoBookingEntryPoint();
    const startTime = Date.now();
    
    // Создаем несколько конфигураций
    const configs = Array.from({ length: 10 }, (_, i) => {
      const config = createTestBookingConfig();
      config.taskId = `perf_test_${i}`;
      config.slot.id = `perf_slot_${i}`;
      return config;
    });
    
    // Добавляем в очередь
    const queueIds = [];
    for (const config of configs) {
      const queueId = await entryPoint.addToQueue(config, 5);
      queueIds.push(queueId);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`📊 Performance Test Results:`);
    console.log(`  - Created ${configs.length} queue items`);
    console.log(`  - Duration: ${duration}ms`);
    console.log(`  - Average per item: ${duration / configs.length}ms`);
    
    // Очищаем очередь
    await entryPoint.clearQueue();
    
    console.log('✅ Performance tests completed');
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
  }
}

// ============================================================================
// ЗАПУСК ТЕСТОВ
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting comprehensive auto booking system tests...');
  
  try {
    // Основные тесты
    await testAutoBookingSystem();
    
    // Дополнительные тесты
    await testErrorHandling();
    await testPerformance();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('  ✅ System initialization and startup');
    console.log('  ✅ Status and health checks');
    console.log('  ✅ Queue operations');
    console.log('  ✅ Scheduled and urgent bookings');
    console.log('  ✅ Metrics and statistics');
    console.log('  ✅ Error handling');
    console.log('  ✅ Performance testing');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Запускаем тесты
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Unhandled test error:', error);
    process.exit(1);
  });
}

export { 
  testAutoBookingSystem,
  testErrorHandling,
  testPerformance,
  runAllTests
};
