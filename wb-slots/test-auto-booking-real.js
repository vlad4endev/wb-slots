/**
 * Тестовый скрипт для реального тестирования auto-booking worker
 * ВНИМАНИЕ: Этот скрипт выполняет реальное бронирование!
 * Запуск: node test-auto-booking-real.js
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ВАЖНО: Замените на реальные данные для тестирования
const REAL_TEST_DATA = {
  taskId: 'real_test_task_' + Date.now(),
  supplyId: 'REAL_SUPPLY_ID_HERE', // Замените на реальный ID поставки
  slotFilters: {
    warehouseIds: [117501], // Подольск
    boxTypeIds: [2, 5], // Короба и Монопаллеты
    coefficientMin: 0,
    coefficientMax: 10,
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  credentials: {
    email: 'YOUR_EMAIL@example.com', // Замените на реальный email
    password: 'YOUR_PASSWORD', // Замените на реальный пароль
  },
  config: {
    headless: false, // Показываем браузер для отладки
    dryRun: false, // РЕАЛЬНОЕ бронирование!
    screenshots: {
      enabled: true,
      path: './real-test-screenshots',
      onError: true,
      onSuccess: true,
      onStep: true,
    },
    logging: {
      level: 'debug',
      console: true,
      file: true,
      filePath: './real-test-logs/auto-booking-real.log',
    },
    timeouts: {
      pageLoad: 30000,
      elementWait: 15000,
      actionDelay: 2000,
      screenshotDelay: 1000,
    },
  },
};

async function testRealBooking() {
  console.log('🚨 ВНИМАНИЕ: Это тест РЕАЛЬНОГО бронирования!');
  console.log('🚨 Убедитесь, что вы используете тестовый аккаунт!');
  console.log('🚨 Проверьте данные перед продолжением...\n');

  // Проверяем, что данные изменены
  if (REAL_TEST_DATA.supplyId === 'REAL_SUPPLY_ID_HERE' || 
      REAL_TEST_DATA.credentials.email === 'YOUR_EMAIL@example.com') {
    console.error('❌ ОШИБКА: Необходимо указать реальные данные для тестирования!');
    console.error('📝 Отредактируйте файл test-auto-booking-real.js и укажите:');
    console.error('   - Реальный ID поставки');
    console.error('   - Реальный email и пароль');
    return;
  }

  console.log('📋 Данные для тестирования:');
  console.log(`  - ID поставки: ${REAL_TEST_DATA.supplyId}`);
  console.log(`  - Email: ${REAL_TEST_DATA.credentials.email}`);
  console.log(`  - Склады: ${REAL_TEST_DATA.slotFilters.warehouseIds.join(', ')}`);
  console.log(`  - Типы коробов: ${REAL_TEST_DATA.slotFilters.boxTypeIds.join(', ')}`);
  console.log(`  - Диапазон коэффициентов: ${REAL_TEST_DATA.slotFilters.coefficientMin}-${REAL_TEST_DATA.slotFilters.coefficientMax}`);
  console.log(`  - Период: ${REAL_TEST_DATA.slotFilters.dateFrom} - ${REAL_TEST_DATA.slotFilters.dateTo}\n`);

  // Подтверждение от пользователя
  console.log('⚠️  Продолжить с реальным бронированием? (y/N)');
  
  // В реальном скрипте здесь был бы readline или prompt
  // Для автоматизации пропускаем подтверждение
  const shouldContinue = process.env.AUTO_CONFIRM === 'true';
  
  if (!shouldContinue) {
    console.log('❌ Тест отменен пользователем');
    return;
  }

  try {
    // 1. Создаем задачу автобронирования
    console.log('📦 Шаг 1: Создание задачи автобронирования');
    const createResponse = await fetch(`${FRONTEND_URL}/api/auto-booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(REAL_TEST_DATA),
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

    // 2. Выполняем реальное бронирование
    console.log('\n🚀 Шаг 2: Выполнение РЕАЛЬНОГО бронирования');
    console.log('⚠️  ВНИМАНИЕ: Это реальное бронирование - слот будет забронирован!');
    
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
      console.log(`✅ Бронирование выполнено!`);
      console.log(`📊 Результат:`);
      console.log(`  - Успех: ${result.success}`);
      console.log(`  - ID бронирования: ${result.bookingId}`);
      console.log(`  - Время выполнения: ${result.executionTime}ms`);
      console.log(`  - Скриншотов: ${result.screenshots?.length || 0}`);
      console.log(`  - Логов: ${result.logs?.length || 0}`);

      if (result.success) {
        console.log(`\n🎉 УСПЕХ! Слот успешно забронирован!`);
        console.log(`📦 ID бронирования: ${result.bookingId}`);
      } else {
        console.log(`\n❌ Бронирование не удалось: ${result.error}`);
      }

      // Показываем детальные логи
      if (result.logs && result.logs.length > 0) {
        console.log(`\n📝 Детальные логи:`);
        result.logs.forEach(log => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          const level = log.level.toUpperCase().padEnd(5);
          const step = log.step.padEnd(20);
          console.log(`  [${timestamp}] [${level}] [${step}] ${log.message}`);
        });
      }

      // Показываем скриншоты
      if (result.screenshots && result.screenshots.length > 0) {
        console.log(`\n📸 Скриншоты процесса:`);
        result.screenshots.forEach((screenshot, index) => {
          console.log(`  ${index + 1}. ${screenshot}`);
        });
      }

    } else {
      console.error(`❌ Ошибка выполнения бронирования: ${executeData.error}`);
      if (executeData.details) {
        console.error(`📋 Детали: ${executeData.details}`);
      }
    }

    // 3. Получаем финальный статус
    console.log('\n📊 Шаг 3: Финальный статус задачи');
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

  } catch (error) {
    console.error('❌ Ошибка при выполнении реального теста:', error.message);
  }

  console.log('\n📊 Реальное тестирование завершено');
  console.log('💡 Проверьте папки real-test-screenshots и real-test-logs для деталей');
}

// Запускаем тест
testRealBooking().catch(console.error);
