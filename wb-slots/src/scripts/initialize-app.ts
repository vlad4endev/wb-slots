/**
 * 🏗️ Скрипт инициализации приложения
 * Запускает все сервисы и проверяет их состояние
 */

import { initializeApp, startApp, getAppHealth } from '../lib/app';

async function main() {
  console.log('🚀 Starting WB Slots Application initialization...');
  
  try {
    // Инициализируем приложение
    console.log('📋 Initializing application...');
    const app = await initializeApp();
    console.log('✅ Application initialized');
    
    // Запускаем приложение
    console.log('🚀 Starting application...');
    await app.start();
    console.log('✅ Application started');
    
    // Проверяем здоровье системы
    console.log('💓 Checking system health...');
    const health = await app.healthCheck();
    console.log('📊 System health:', health.status);
    
    if (health.status === 'healthy') {
      console.log('🎉 Application is running successfully!');
      console.log('📈 Services summary:', health.services.summary);
    } else {
      console.warn('⚠️ Application has health issues:', health);
    }
    
    // Выводим информацию о сервисах
    const status = await app.getStatus();
    console.log('📋 Application status:');
    console.log(`  - Initialized: ${status.initialized}`);
    console.log(`  - Running: ${status.running}`);
    console.log(`  - Total services: ${status.summary.totalServices}`);
    console.log(`  - Healthy services: ${status.summary.healthyServices}`);
    console.log(`  - Degraded services: ${status.summary.degradedServices}`);
    console.log(`  - Unhealthy services: ${status.summary.unhealthyServices}`);
    
    console.log('\n🎯 Application is ready to serve requests!');
    
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    process.exit(1);
  }
}

// Запускаем инициализацию
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { main as initializeApplication };
