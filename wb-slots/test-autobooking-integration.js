/**
 * Тестовый скрипт для проверки интеграции автобронирования и выбора поставки
 * Запуск: node test-autobooking-integration.js
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Тестовые данные для создания задачи с автобронированием
const testTaskData = {
  name: 'Тестовая задача с автобронированием',
  description: 'Тестовая задача для проверки интеграции автобронирования',
  autoBook: true,
  autoBookSupplyId: 'TEST_SUPPLY_123',
  chosenSupplyId: 'TEST_SUPPLY_123',
  filters: {
    warehouseIds: [117501],
    boxTypeIds: [2, 5],
    coefficientMin: 0,
    coefficientMax: 10,
    dates: {
      from: new Date().toISOString().slice(0, 16),
      to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    },
  },
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 5000,
  },
  priority: 1,
};

async function testAutobookingIntegration() {
  console.log('🧪 Начинаем тестирование интеграции автобронирования...\n');

  try {
    // 1. Тестируем получение поставок
    console.log('📦 Тест 1: Получение списка поставок');
    const suppliesResponse = await fetch(`${FRONTEND_URL}/api/supplies?limit=10&status=active`);
    const suppliesData = await suppliesResponse.json();
    
    if (suppliesData.success) {
      console.log(`✅ Поставки получены: ${suppliesData.data.supplies.length} шт.`);
      if (suppliesData.data.supplies.length > 0) {
        const firstSupply = suppliesData.data.supplies[0];
        testTaskData.autoBookSupplyId = firstSupply.id;
        testTaskData.chosenSupplyId = firstSupply.id;
        console.log(`📋 Используем поставку: ${firstSupply.name} (${firstSupply.id})`);
      }
    } else {
      console.log(`❌ Ошибка получения поставок: ${suppliesData.error}`);
    }

    // 2. Тестируем создание задачи с автобронированием
    console.log('\n🎯 Тест 2: Создание задачи с автобронированием');
    console.log('📋 Данные задачи:', {
      name: testTaskData.name,
      autoBook: testTaskData.autoBook,
      autoBookSupplyId: testTaskData.autoBookSupplyId,
      chosenSupplyId: testTaskData.chosenSupplyId,
    });

    const createTaskResponse = await fetch(`${FRONTEND_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testTaskData),
    });

    const createTaskData = await createTaskResponse.json();

    if (createTaskData.success) {
      console.log(`✅ Задача создана успешно: #${createTaskData.data.task.taskNumber}`);
      console.log(`📊 ID задачи: ${createTaskData.data.task.id}`);
      console.log(`🔧 Автобронирование: ${createTaskData.data.task.autoBook ? 'Включено' : 'Выключено'}`);
      console.log(`📦 ID поставки: ${createTaskData.data.task.autoBookSupplyId}`);
      console.log(`🎯 Выбранная поставка: ${createTaskData.data.task.chosenSupplyId}`);

      // 3. Проверяем, что задача сохранилась в БД с правильными данными
      console.log('\n💾 Тест 3: Проверка сохранения в БД');
      const taskId = createTaskData.data.task.id;
      
      // Проверяем через backend API
      const backendTaskResponse = await fetch(`${BACKEND_URL}/tasks/${taskId}`, {
        headers: {
          'Authorization': 'Bearer test-token', // В реальном тесте нужен настоящий токен
        },
      });

      if (backendTaskResponse.ok) {
        const backendTaskData = await backendTaskResponse.json();
        console.log(`✅ Задача найдена в БД: ${backendTaskData.name}`);
        console.log(`🔧 Автобронирование в БД: ${backendTaskData.autoBook ? 'Включено' : 'Выключено'}`);
        console.log(`📦 ID поставки в БД: ${backendTaskData.autoBookSupplyId}`);
        console.log(`🎯 Выбранная поставка в БД: ${backendTaskData.chosenSupplyId}`);

        // Проверяем соответствие данных
        if (backendTaskData.autoBook === testTaskData.autoBook &&
            backendTaskData.autoBookSupplyId === testTaskData.autoBookSupplyId &&
            backendTaskData.chosenSupplyId === testTaskData.chosenSupplyId) {
          console.log(`✅ Данные в БД соответствуют отправленным данным`);
        } else {
          console.log(`❌ Данные в БД не соответствуют отправленным данным`);
        }
      } else {
        console.log(`❌ Ошибка получения задачи из БД: ${backendTaskResponse.status}`);
      }

      // 4. Проверяем логи
      console.log('\n📝 Тест 4: Проверка логов');
      const logsResponse = await fetch(`${BACKEND_URL}/tasks/${taskId}/logs`, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        console.log(`✅ Логи получены: ${logsData.length} записей`);
        
        // Ищем логи с информацией о выбранной поставке
        const supplyLogs = logsData.filter(log => 
          log.message.includes('chosenSupplyId') || 
          log.message.includes('supply') ||
          log.meta?.chosenSupplyId
        );
        
        if (supplyLogs.length > 0) {
          console.log(`✅ Найдены логи с информацией о поставке: ${supplyLogs.length} записей`);
          supplyLogs.forEach(log => {
            console.log(`  📝 ${log.level}: ${log.message}`);
            if (log.meta?.chosenSupplyId) {
              console.log(`    🎯 Выбранная поставка в логах: ${log.meta.chosenSupplyId}`);
            }
          });
        } else {
          console.log(`⚠️ Логи с информацией о поставке не найдены`);
        }
      } else {
        console.log(`❌ Ошибка получения логов: ${logsResponse.status}`);
      }

    } else {
      console.log(`❌ Ошибка создания задачи: ${createTaskData.error}`);
      if (createTaskData.details) {
        console.log(`📋 Детали ошибки: ${createTaskData.details}`);
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error.message);
  }

  console.log('\n📊 Тестирование завершено');
}

// Запускаем тесты
testAutobookingIntegration().catch(console.error);
