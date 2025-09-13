/**
 * Тестовый скрипт для проверки Telegram уведомлений
 * Запуск: node test-telegram-notifications.js
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Тестовые данные
const testData = {
  chatId: process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE', // Замените на ваш Chat ID
  username: 'test_user',
  firstName: 'Test',
  lastName: 'User',
};

async function testTelegramNotifications() {
  console.log('📱 Начинаем тестирование Telegram уведомлений...\n');

  // Проверяем, что Chat ID указан
  if (testData.chatId === 'YOUR_CHAT_ID_HERE') {
    console.error('❌ ОШИБКА: Необходимо указать TELEGRAM_CHAT_ID в переменных окружения или в коде');
    console.error('📝 Как получить Chat ID:');
    console.error('1. Найдите @userinfobot в Telegram');
    console.error('2. Отправьте ему любое сообщение');
    console.error('3. Скопируйте ваш Chat ID');
    console.error('4. Установите переменную: set TELEGRAM_CHAT_ID=YOUR_CHAT_ID');
    console.error('5. Или замените YOUR_CHAT_ID_HERE в коде на ваш Chat ID');
    return;
  }

  try {
    // 1. Регистрация пользователя
    console.log('📝 Шаг 1: Регистрация пользователя для уведомлений');
    const registerResponse = await fetch(`${FRONTEND_URL}/api/notifications/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'register',
        chatId: parseInt(testData.chatId),
        username: testData.username,
        firstName: testData.firstName,
        lastName: testData.lastName,
      }),
    });

    const registerData = await registerResponse.json();

    if (registerData.success) {
      console.log(`✅ Пользователь зарегистрирован: ${registerData.data.message}`);
    } else {
      console.error(`❌ Ошибка регистрации: ${registerData.error}`);
      return;
    }

    // 2. Проверка статуса
    console.log('\n📊 Шаг 2: Проверка статуса уведомлений');
    const statusResponse = await fetch(`${FRONTEND_URL}/api/notifications/telegram`);
    const statusData = await statusResponse.json();

    if (statusData.success) {
      console.log(`📱 Статус бота: ${statusData.data.botInitialized ? 'Инициализирован' : 'Не инициализирован'}`);
      console.log(`👤 Пользователь: ${statusData.data.user ? 'Зарегистрирован' : 'Не зарегистрирован'}`);
      console.log(`📊 Статистика: ${statusData.data.stats.totalUsers} пользователей, ${statusData.data.stats.activeUsers} активных`);
    } else {
      console.error(`❌ Ошибка получения статуса: ${statusData.error}`);
    }

    // 3. Тестовое сообщение
    console.log('\n🧪 Шаг 3: Отправка тестового сообщения');
    const testResponse = await fetch(`${FRONTEND_URL}/api/notifications/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test',
        chatId: parseInt(testData.chatId),
      }),
    });

    const testData = await testResponse.json();

    if (testData.success) {
      console.log(`✅ Тестовое сообщение отправлено: ${testData.data.message}`);
      console.log('📱 Проверьте ваш Telegram - должно прийти тестовое сообщение!');
    } else {
      console.error(`❌ Ошибка отправки тестового сообщения: ${testData.error}`);
    }

    // 4. Тестирование различных типов уведомлений
    console.log('\n📤 Шаг 4: Тестирование типов уведомлений');
    
    const notificationTypes = [
      {
        type: 'slot_found',
        data: {
          supplyName: 'Тестовая поставка #123456',
          supplyId: 'TEST_SUPPLY_123456',
          warehouseName: 'Подольск',
          slotDate: '2024-01-20',
          slotTime: '09:00-18:00',
          coefficient: '5.2',
          taskName: 'Тестовая задача',
        },
      },
      {
        type: 'booking_started',
        data: {
          supplyName: 'Тестовая поставка #123456',
          supplyId: 'TEST_SUPPLY_123456',
          warehouseName: 'Подольск',
          slotDate: '2024-01-20',
          slotTime: '09:00-18:00',
          coefficient: '5.2',
        },
      },
      {
        type: 'booking_success',
        data: {
          supplyName: 'Тестовая поставка #123456',
          supplyId: 'TEST_SUPPLY_123456',
          warehouseName: 'Подольск',
          slotDate: '2024-01-20',
          slotTime: '09:00-18:00',
          coefficient: '5.2',
          bookingId: 'BOOKING_TEST_123456',
          executionTime: '15',
          taskName: 'Тестовая задача',
        },
      },
      {
        type: 'booking_error',
        data: {
          supplyName: 'Тестовая поставка #123456',
          supplyId: 'TEST_SUPPLY_123456',
          warehouseName: 'Подольск',
          slotDate: '2024-01-20',
          slotTime: '09:00-18:00',
          coefficient: '5.2',
          errorMessage: 'Тестовая ошибка бронирования',
          executionTime: '10',
          taskName: 'Тестовая задача',
        },
      },
      {
        type: 'booking_captcha',
        data: {
          supplyName: 'Тестовая поставка #123456',
          supplyId: 'TEST_SUPPLY_123456',
          warehouseName: 'Подольск',
          slotDate: '2024-01-20',
          slotTime: '09:00-18:00',
          coefficient: '5.2',
          taskName: 'Тестовая задача',
        },
      },
    ];

    for (let i = 0; i < notificationTypes.length; i++) {
      const notification = notificationTypes[i];
      console.log(`\n📤 Отправка уведомления: ${notification.type}`);
      
      const sendResponse = await fetch(`${FRONTEND_URL}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: notification.type,
          data: notification.data,
          userId: 'test_user_id', // В реальном тесте это будет ID пользователя
        }),
      });

      const sendData = await sendResponse.json();

      if (sendData.success) {
        console.log(`✅ Уведомление ${notification.type} отправлено`);
        console.log(`📱 Проверьте Telegram - должно прийти уведомление о ${notification.type}`);
      } else {
        console.error(`❌ Ошибка отправки уведомления ${notification.type}: ${sendData.error}`);
      }

      // Пауза между уведомлениями
      if (i < notificationTypes.length - 1) {
        console.log('⏳ Ожидание 3 секунды перед следующим уведомлением...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 5. Тестирование broadcast уведомлений
    console.log('\n📢 Шаг 5: Тестирование broadcast уведомлений');
    const broadcastResponse = await fetch(`${FRONTEND_URL}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'system_error',
        data: {
          component: 'Test Component',
          errorMessage: 'Тестовая системная ошибка',
          timestamp: new Date().toLocaleString('ru-RU'),
          errorDetails: 'Это тестовое уведомление для проверки broadcast функциональности.',
        },
        broadcast: true,
      }),
    });

    const broadcastData = await broadcastResponse.json();

    if (broadcastData.success) {
      console.log(`✅ Broadcast уведомление отправлено: ${broadcastData.data.sent} успешно, ${broadcastData.data.failed} ошибок`);
    } else {
      console.error(`❌ Ошибка отправки broadcast уведомления: ${broadcastData.error}`);
    }

    // 6. Финальная проверка статуса
    console.log('\n📊 Шаг 6: Финальная проверка статуса');
    const finalStatusResponse = await fetch(`${FRONTEND_URL}/api/notifications/telegram`);
    const finalStatusData = await finalStatusResponse.json();

    if (finalStatusData.success) {
      console.log(`📱 Финальный статус:`);
      console.log(`  - Бот инициализирован: ${finalStatusData.data.botInitialized ? 'Да' : 'Нет'}`);
      console.log(`  - Пользователь зарегистрирован: ${finalStatusData.data.user ? 'Да' : 'Нет'}`);
      console.log(`  - Всего пользователей: ${finalStatusData.data.stats.totalUsers}`);
      console.log(`  - Активных пользователей: ${finalStatusData.data.stats.activeUsers}`);
      console.log(`  - Неактивных пользователей: ${finalStatusData.data.stats.inactiveUsers}`);
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error.message);
  }

  console.log('\n📊 Тестирование Telegram уведомлений завершено');
  console.log('💡 Проверьте ваш Telegram - должны прийти все тестовые уведомления!');
  console.log('📝 Если уведомления не приходят, проверьте:');
  console.log('  1. Правильность TELEGRAM_BOT_TOKEN в .env');
  console.log('  2. Правильность Chat ID');
  console.log('  3. Что бот запущен и работает');
  console.log('  4. Логи сервера на предмет ошибок');
}

// Запускаем тест
testTelegramNotifications().catch(console.error);
