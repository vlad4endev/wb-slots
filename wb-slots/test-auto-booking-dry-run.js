/**
 * Тестовый скрипт для dry-run тестирования auto-booking worker
 * Запуск: node test-auto-booking-dry-run.js
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Тестовые данные для dry-run
const testBookingData = {
  taskId: 'test_task_' + Date.now(),
  supplyId: 'TEST_SUPPLY_123456789',
  slotFilters: {
    warehouseIds: [117501], // Подольск
    boxTypeIds: [2, 5], // Короба и Монопаллеты
    coefficientMin: 0,
    coefficientMax: 10,
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  credentials: {
    email: 'test@example.com',
    password: 'test_password',
  },
  config: {
    headless: true,
    dryRun: true, // ВАЖНО: dry-run режим
    screenshots: {
      enabled: true,
      path: './test-screenshots',
      onError: true,
      onSuccess: true,
      onStep: true,
    },
    logging: {
      level: 'debug',
      console: true,
      file: true,
      filePath: './test-logs/auto-booking-dry-run.log',
    },
    timeouts: {
      pageLoad: 10000,
      elementWait: 5000,
      actionDelay: 500,
      screenshotDelay: 200,
    },
  },
};

async function testDryRunBooking() {
  console.log('🧪 Начинаем dry-run тестирование auto-booking worker...\n');

  try {
    // 1. Создаем задачу автобронирования
    console.log('📦 Шаг 1: Создание задачи автобронирования');
    const createResponse = await fetch(`${FRONTEND_URL}/api/auto-booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBookingData),
    });

    const createData = await createResponse.json();

    if (!createData.success) {
      console.error(`❌ Ошибка создания задачи: ${createData.error}`);
      if (createData.details) {
        console.error(`📋 Детали: ${createData.details}`);
      }
      return;
    }

    const bookingTaskId = createData.data.bookingTaskId;
    console.log(`✅ Задача создана: ${bookingTaskId}`);

    // 2. Получаем информацию о задаче
    console.log('\n📋 Шаг 2: Получение информации о задаче');
    const taskResponse = await fetch(`${FRONTEND_URL}/api/auto-booking/${bookingTaskId}`);
    const taskData = await taskResponse.json();

    if (taskData.success) {
      console.log(`📊 Статус задачи: ${taskData.data.status}`);
      console.log(`📦 ID поставки: ${taskData.data.supplyId}`);
      console.log(`🎯 Фильтры слотов:`, taskData.data.slotFilters);
    } else {
      console.error(`❌ Ошибка получения задачи: ${taskData.error}`);
    }

    // 3. Выполняем dry-run бронирование
    console.log('\n🚀 Шаг 3: Выполнение dry-run бронирования');
    console.log('⚠️  ВНИМАНИЕ: Это dry-run тест - реального бронирования не будет!');
    
    const executeResponse = await fetch(`${FRONTEND_URL}/api/auto-booking/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookingTaskId }),
    });

    const executeData = await executeResponse.json();

    if (executeData.success) {
      const result = executeData.data.result;
      console.log(`✅ Dry-run выполнен успешно!`);
      console.log(`📊 Результат:`);
      console.log(`  - Успех: ${result.success}`);
      console.log(`  - ID бронирования: ${result.bookingId}`);
      console.log(`  - Время выполнения: ${result.executionTime}ms`);
      console.log(`  - Скриншотов: ${result.screenshots?.length || 0}`);
      console.log(`  - Логов: ${result.logs?.length || 0}`);

      if (result.error) {
        console.log(`  - Ошибка: ${result.error}`);
      }

      // Показываем последние логи
      if (result.logs && result.logs.length > 0) {
        console.log(`\n📝 Последние логи:`);
        result.logs.slice(-5).forEach(log => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          console.log(`  [${timestamp}] [${log.level.toUpperCase()}] [${log.step}] ${log.message}`);
        });
      }

      // Показываем скриншоты
      if (result.screenshots && result.screenshots.length > 0) {
        console.log(`\n📸 Скриншоты:`);
        result.screenshots.forEach(screenshot => {
          console.log(`  - ${screenshot}`);
        });
      }

    } else {
      console.error(`❌ Ошибка выполнения dry-run: ${executeData.error}`);
      if (executeData.details) {
        console.error(`📋 Детали: ${executeData.details}`);
      }
    }

    // 4. Получаем финальный статус задачи
    console.log('\n📊 Шаг 4: Финальный статус задачи');
    const finalTaskResponse = await fetch(`${FRONTEND_URL}/api/auto-booking/${bookingTaskId}`);
    const finalTaskData = await finalTaskResponse.json();

    if (finalTaskData.success) {
      const task = finalTaskData.data;
      console.log(`📊 Финальный статус: ${task.status}`);
      console.log(`⏰ Создана: ${new Date(task.createdAt).toLocaleString()}`);
      if (task.startedAt) {
        console.log(`🚀 Начата: ${new Date(task.startedAt).toLocaleString()}`);
      }
      if (task.completedAt) {
        console.log(`✅ Завершена: ${new Date(task.completedAt).toLocaleString()}`);
      }
    }

    // 5. Получаем статистику
    console.log('\n📈 Шаг 5: Статистика сервиса');
    const statsResponse = await fetch(`${FRONTEND_URL}/api/auto-booking`);
    const statsData = await statsResponse.json();

    if (statsData.success) {
      const stats = statsData.data.stats;
      console.log(`📊 Статистика auto-booking сервиса:`);
      console.log(`  - Всего задач: ${stats.total}`);
      console.log(`  - Ожидают: ${stats.pending}`);
      console.log(`  - Выполняются: ${stats.running}`);
      console.log(`  - Завершены: ${stats.completed}`);
      console.log(`  - Ошибки: ${stats.failed}`);
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении dry-run теста:', error.message);
  }

  console.log('\n📊 Dry-run тестирование завершено');
  console.log('💡 Проверьте папки test-screenshots и test-logs для деталей');
}

// Запускаем тест
testDryRunBooking().catch(console.error);
