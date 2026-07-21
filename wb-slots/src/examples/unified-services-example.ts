// ===== UNIFIED SERVICES USAGE EXAMPLE =====

import { 
  createService, 
  createAndStartService,
  serviceRegistry,
  UnifiedAutoBookingService,
  UnifiedNotificationService,
  UnifiedSlotSearchService,
  IAutoBookingService,
  ISlotSearchService,
  INotificationService
} from '../lib/services/core';

// ===== BASIC USAGE EXAMPLE =====

async function basicUsageExample() {
  console.log('🚀 Starting Unified Services Example');

  try {
    // 1. Create and start services
    const autoBookingService = await createAndStartService<IAutoBookingService>('UnifiedAutoBookingService');
    const notificationService = await createAndStartService<INotificationService>('UnifiedNotificationService');
    const slotSearchService = await createAndStartService<ISlotSearchService>('UnifiedSlotSearchService');

    console.log('✅ All services created and started');

    // 2. Check service status
    const registryStatus = serviceRegistry.getRegistryStatus();
    console.log('📊 Registry Status:', {
      totalServices: registryStatus.totalServices,
      runningServices: registryStatus.runningServices,
      healthyServices: registryStatus.healthyServices
    });

    // 3. Get service metrics
    const autoBookingMetrics = autoBookingService.getMetrics();
    console.log('📈 Auto Booking Metrics:', autoBookingMetrics);

    const notificationMetrics = notificationService.getMetrics();
    console.log('📈 Notification Metrics:', notificationMetrics);

    const slotSearchMetrics = slotSearchService.getMetrics();
    console.log('📈 Slot Search Metrics:', slotSearchMetrics);

    // 4. Perform health checks
    const autoBookingHealth = autoBookingService.getHealth();
    console.log('🏥 Auto Booking Health:', autoBookingHealth);

    const notificationHealth = notificationService.getHealth();
    console.log('🏥 Notification Health:', notificationHealth);

    const slotSearchHealth = slotSearchService.getHealth();
    console.log('🏥 Slot Search Health:', slotSearchHealth);

    // 5. Stop all services
    await serviceRegistry.stopAllServices();
    console.log('🛑 All services stopped');

  } catch (error) {
    console.error('❌ Error in basic usage example:', error);
  }
}

// ===== SLOT SEARCH EXAMPLE =====

async function slotSearchExample() {
  console.log('🔍 Starting Slot Search Example');

  try {
    // Create slot search service
    const slotSearchService = await createAndStartService<ISlotSearchService>('UnifiedSlotSearchService');

    // Configure search
    const searchConfig = {
      taskId: 'task-123',
      userId: 'user-456',
      warehouseIds: [1, 2, 3],
      boxTypeIds: [2, 5],
      coefficientMin: 0,
      coefficientMax: 10,
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      stopOnFirstFound: false,
      isSortingCenter: false,
      autoBook: false,
      autoBookSupplyId: undefined
    };

    console.log('🔍 Starting slot search...');
    const result = await slotSearchService.searchSlots(searchConfig);

    console.log('✅ Slot search completed:', {
      foundSlots: result.foundSlots.length,
      totalChecked: result.totalChecked,
      searchTime: result.searchTime,
      errors: result.errors.length,
      stoppedEarly: result.stoppedEarly
    });

    // Get search history
    const history = slotSearchService.getSearchHistory();
    console.log('📚 Search History:', history);

    // Stop service
    await slotSearchService.stop();

  } catch (error) {
    console.error('❌ Error in slot search example:', error);
  }
}

// ===== AUTO BOOKING EXAMPLE =====

async function autoBookingExample() {
  console.log('📅 Starting Auto Booking Example');

  try {
    // Create auto booking service
    const autoBookingService = await createAndStartService<IAutoBookingService>('UnifiedAutoBookingService');

    // Configure booking
    const bookingConfig = {
      taskId: 'task-123',
      userId: 'user-456',
      runId: 'run-789',
      slotId: 'slot-101',
      supplyId: 'supply-202',
      warehouseId: 1,
      boxTypeId: 2,
      date: '2024-01-15',
      coefficient: 1.5
    };

    console.log('📅 Starting slot booking...');
    const result = await autoBookingService.bookSlot(bookingConfig);

    console.log('✅ Booking completed:', {
      success: result.success,
      bookingId: result.bookingId,
      error: result.error,
      attemptCount: result.attemptCount,
      executionTime: result.executionTime
    });

    // Get booking history
    const history = autoBookingService.getBookingHistory();
    console.log('📚 Booking History:', history);

    // Stop service
    await autoBookingService.stop();

  } catch (error) {
    console.error('❌ Error in auto booking example:', error);
  }
}

// ===== NOTIFICATION EXAMPLE =====

async function notificationExample() {
  console.log('📱 Starting Notification Example');

  try {
    // Create notification service
    const notificationService = await createAndStartService<INotificationService>('UnifiedNotificationService');

    // Send simple notification
    const message = '🎯 Test notification from Unified Services!';
    const success = await notificationService.sendNotification('user-456', message);
    console.log('📱 Simple notification sent:', success);

    // Send templated notification
    const templateSuccess = await notificationService.sendTemplatedNotification(
      'user-456',
      'SLOT_FOUND',
      {
        warehouseName: 'Склад 1',
        boxTypeName: 'Короба',
        date: '2024-01-15',
        coefficient: 1.5,
        allowUnload: true
      }
    );
    console.log('📱 Templated notification sent:', templateSuccess);

    // Check if notifications are configured
    const isConfigured = await notificationService.isNotificationConfigured('user-456');
    console.log('📱 Notifications configured:', isConfigured);

    // Get notification history
    const history = notificationService.getNotificationHistory('user-456');
    console.log('📚 Notification History:', history);

    // Stop service
    await notificationService.stop();

  } catch (error) {
    console.error('❌ Error in notification example:', error);
  }
}

// ===== ADVANCED USAGE EXAMPLE =====

async function advancedUsageExample() {
  console.log('🚀 Starting Advanced Usage Example');

  try {
    // 1. Create multiple services at once
    const services = await serviceRegistry.createAndStartMultipleServices([
      { type: 'UnifiedAutoBookingService' },
      { type: 'UnifiedNotificationService' },
      { type: 'UnifiedSlotSearchService' }
    ]);

    console.log(`✅ Created ${services.length} services`);

    // 2. Perform health check on all services
    const healthStatus = await serviceRegistry.performHealthCheck();
    console.log('🏥 Health Check Results:', healthStatus);

    // 3. Get unhealthy services
    const unhealthyServices = serviceRegistry.getUnhealthyServices();
    console.log('⚠️ Unhealthy Services:', unhealthyServices.map(s => s.name));

    // 4. Get services by status
    const runningServices = serviceRegistry.getServicesByStatus('RUNNING');
    console.log('🏃 Running Services:', runningServices.map(s => s.name));

    // 5. Get total metrics
    const totalMetrics = serviceRegistry.getTotalMetrics();
    console.log('📊 Total Metrics:', totalMetrics);

    // 6. Get detailed service info
    const serviceInfo = serviceRegistry.getAllServiceInfo();
    console.log('ℹ️ Service Info:', serviceInfo);

    // 7. Restart a specific service
    const autoBookingService = serviceRegistry.get('UnifiedAutoBookingService');
    if (autoBookingService) {
      const restartSuccess = await serviceRegistry.restartService('UnifiedAutoBookingService');
      console.log('🔄 Service restart:', restartSuccess);
    }

    // 8. Stop all services
    await serviceRegistry.stopAllServices();
    console.log('🛑 All services stopped');

  } catch (error) {
    console.error('❌ Error in advanced usage example:', error);
  }
}

// ===== ERROR HANDLING EXAMPLE =====

async function errorHandlingExample() {
  console.log('⚠️ Starting Error Handling Example');

  try {
    // Create service with retry
    const service = await serviceRegistry.createServiceWithRetry<IAutoBookingService>(
      'UnifiedAutoBookingService',
      {},
      3
    );

    console.log('✅ Service created with retry logic');

    // Test retry functionality
    const result = await service.retry(async () => {
      // Simulate an operation that might fail
      if (Math.random() > 0.5) {
        throw new Error('Simulated network error');
      }
      return 'Success!';
    }, 'test_operation');

    console.log('🔄 Retry operation result:', result);

    // Get retry configuration
    const retryConfig = service.getRetryConfig();
    console.log('⚙️ Retry Configuration:', retryConfig);

    // Update retry configuration
    service.updateRetryConfig({
      maxAttempts: 5,
      initialDelay: 3000
    });

    console.log('⚙️ Updated retry configuration');

    // Stop service
    await service.stop();

  } catch (error) {
    console.error('❌ Error in error handling example:', error);
  }
}

// ===== MAIN FUNCTION =====

async function main() {
  console.log('🎯 Unified Services Examples');
  console.log('============================');

  try {
    // Run all examples
    await basicUsageExample();
    console.log('\n');

    await slotSearchExample();
    console.log('\n');

    await autoBookingExample();
    console.log('\n');

    await notificationExample();
    console.log('\n');

    await advancedUsageExample();
    console.log('\n');

    await errorHandlingExample();
    console.log('\n');

    console.log('🎉 All examples completed successfully!');

  } catch (error) {
    console.error('💥 Fatal error in examples:', error);
  }
}

// Export examples for individual use
export {
  basicUsageExample,
  slotSearchExample,
  autoBookingExample,
  notificationExample,
  advancedUsageExample,
  errorHandlingExample,
  main
};

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}