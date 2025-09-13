/**
 * Тестовый скрипт для проверки безопасности и стабильности
 * Запуск: node test-security-stability.js
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Тестовые данные
const testData = {
  userId: 'test_user_security',
  apiKey: 'test_api_key_12345',
  wbToken: 'test_wb_token_67890',
  telegramToken: 'test_telegram_token_11111',
  cookies: 'test_cookies_data_22222',
};

async function testSecurityStability() {
  console.log('🔒 Начинаем тестирование безопасности и стабильности...\n');

  try {
    // 1. Тест шифрования API ключей
    console.log('🔐 Тест 1: Шифрование API ключей');
    await testApiKeyEncryption();

    // 2. Тест rate limiting
    console.log('\n⏱️ Тест 2: Rate Limiting');
    await testRateLimiting();

    // 3. Тест обработки капчи
    console.log('\n🤖 Тест 3: Обработка капчи');
    await testCaptchaHandling();

    // 4. Тест retry логики
    console.log('\n🔄 Тест 4: Retry логика');
    await testRetryLogic();

    // 5. Тест интеграции безопасности
    console.log('\n🛡️ Тест 5: Интеграция безопасности');
    await testSecurityIntegration();

  } catch (error) {
    console.error('❌ Ошибка при выполнении тестов:', error.message);
  }

  console.log('\n✅ Тестирование безопасности и стабильности завершено');
}

async function testApiKeyEncryption() {
  try {
    // Тест сохранения зашифрованного API ключа
    const response = await fetch(`${FRONTEND_URL}/api/security/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testData.userId,
        keyType: 'wb_api',
        keyName: 'test_key',
        keyValue: testData.wbToken,
        description: 'Test API key for security testing',
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ API ключ успешно зашифрован и сохранен');
      
      // Проверяем, что ключ зашифрован в БД
      const getResponse = await fetch(`${FRONTEND_URL}/api/security/api-keys?userId=${testData.userId}`);
      const getData = await getResponse.json();
      
      if (getData.success && getData.data.length > 0) {
        const storedKey = getData.data[0];
        if (storedKey.encryptedData && typeof storedKey.encryptedData === 'object') {
          console.log('✅ Ключ хранится в зашифрованном виде');
        } else {
          console.error('❌ Ключ не зашифрован в БД');
        }
      }
    } else {
      console.error('❌ Ошибка сохранения API ключа:', data.error);
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования шифрования:', error.message);
  }
}

async function testRateLimiting() {
  try {
    const requests = [];
    const maxRequests = 5;

    // Отправляем несколько запросов подряд для проверки rate limiting
    for (let i = 0; i < maxRequests; i++) {
      requests.push(
        fetch(`${FRONTEND_URL}/api/security/rate-limit-test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': testData.userId,
          },
          body: JSON.stringify({
            test: true,
            requestNumber: i + 1,
          }),
        })
      );
    }

    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.json()));

    let successCount = 0;
    let rateLimitedCount = 0;

    results.forEach((result, index) => {
      if (result.success) {
        successCount++;
        console.log(`✅ Запрос ${index + 1}: Успешно`);
      } else if (result.error && result.error.includes('rate limit')) {
        rateLimitedCount++;
        console.log(`⏱️ Запрос ${index + 1}: Rate limited`);
      } else {
        console.log(`❌ Запрос ${index + 1}: Ошибка - ${result.error}`);
      }
    });

    console.log(`📊 Результаты: ${successCount} успешных, ${rateLimitedCount} rate limited`);

    if (rateLimitedCount > 0) {
      console.log('✅ Rate limiting работает корректно');
    } else {
      console.log('⚠️ Rate limiting может не работать (все запросы прошли)');
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования rate limiting:', error.message);
  }
}

async function testCaptchaHandling() {
  try {
    // Тест обнаружения капчи
    const response = await fetch(`${FRONTEND_URL}/api/security/captcha-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testData.userId,
        taskName: 'Test Task',
        supplyName: 'Test Supply',
        supplyId: 'TEST_SUPPLY_123',
        warehouseName: 'Test Warehouse',
        slotDate: '2024-01-20',
        slotTime: '09:00-18:00',
        coefficient: 5.2,
        captchaType: 'image',
        captchaUrl: 'https://example.com/captcha.jpg',
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Обработка капчи работает корректно');
      console.log(`📱 Уведомление отправлено: ${data.data.notificationSent ? 'Да' : 'Нет'}`);
    } else {
      console.error('❌ Ошибка обработки капчи:', data.error);
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования капчи:', error.message);
  }
}

async function testRetryLogic() {
  try {
    // Тест retry логики с имитацией ошибок
    const response = await fetch(`${FRONTEND_URL}/api/security/retry-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testData.userId,
        taskName: 'Test Retry Task',
        supplyName: 'Test Supply',
        supplyId: 'TEST_SUPPLY_456',
        warehouseName: 'Test Warehouse',
        slotDate: '2024-01-20',
        slotTime: '09:00-18:00',
        coefficient: 5.2,
        simulateErrors: true,
        maxRetries: 3,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Retry логика работает корректно');
      console.log(`🔄 Попыток выполнено: ${data.data.attempts}`);
      console.log(`⏱️ Общее время: ${data.data.totalTime}ms`);
      console.log(`📱 Уведомлений отправлено: ${data.data.notificationsSent}`);
    } else {
      console.error('❌ Ошибка retry логики:', data.error);
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования retry:', error.message);
  }
}

async function testSecurityIntegration() {
  try {
    // Тест полной интеграции безопасности
    const response = await fetch(`${FRONTEND_URL}/api/security/integration-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': testData.userId,
      },
      body: JSON.stringify({
        userId: testData.userId,
        taskName: 'Security Integration Test',
        supplyName: 'Test Supply',
        supplyId: 'TEST_SUPPLY_789',
        warehouseName: 'Test Warehouse',
        slotDate: '2024-01-20',
        slotTime: '09:00-18:00',
        coefficient: 5.2,
        testEncryption: true,
        testRateLimit: true,
        testCaptcha: true,
        testRetry: true,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Интеграция безопасности работает корректно');
      console.log(`🔐 Шифрование: ${data.data.encryption ? '✅' : '❌'}`);
      console.log(`⏱️ Rate Limiting: ${data.data.rateLimit ? '✅' : '❌'}`);
      console.log(`🤖 Капча: ${data.data.captcha ? '✅' : '❌'}`);
      console.log(`🔄 Retry: ${data.data.retry ? '✅' : '❌'}`);
      console.log(`📱 Уведомления: ${data.data.notifications ? '✅' : '❌'}`);
    } else {
      console.error('❌ Ошибка интеграции безопасности:', data.error);
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования интеграции:', error.message);
  }
}

// Дополнительные утилиты для тестирования
async function testPerformance() {
  console.log('\n⚡ Тест производительности');
  
  const startTime = Date.now();
  const requests = [];
  
  // Отправляем 10 параллельных запросов
  for (let i = 0; i < 10; i++) {
    requests.push(
      fetch(`${FRONTEND_URL}/api/security/performance-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': `test_user_${i}`,
        },
        body: JSON.stringify({
          test: true,
          requestId: i,
        }),
      })
    );
  }
  
  const responses = await Promise.all(requests);
  const endTime = Date.now();
  
  const successCount = responses.filter(r => r.ok).length;
  const avgResponseTime = (endTime - startTime) / requests.length;
  
  console.log(`📊 Производительность: ${successCount}/${requests.length} успешных запросов`);
  console.log(`⏱️ Среднее время ответа: ${avgResponseTime.toFixed(2)}ms`);
  
  if (avgResponseTime < 1000) {
    console.log('✅ Производительность в норме');
  } else {
    console.log('⚠️ Производительность может быть улучшена');
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Тест обработки ошибок');
  
  const errorTests = [
    { name: 'Неверный API ключ', data: { keyType: 'invalid', keyValue: 'invalid' } },
    { name: 'Пустые данные', data: {} },
    { name: 'Некорректный JSON', data: 'invalid json' },
    { name: 'Превышение лимитов', data: { largeData: 'x'.repeat(10000) } },
  ];
  
  for (const test of errorTests) {
    try {
      const response = await fetch(`${FRONTEND_URL}/api/security/error-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(test.data),
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`❌ ${test.name}: Ошибка не обработана`);
      } else {
        console.log(`✅ ${test.name}: Ошибка обработана корректно`);
      }
    } catch (error) {
      console.log(`✅ ${test.name}: Ошибка перехвачена`);
    }
  }
}

// Запускаем тесты
testSecurityStability()
  .then(() => testPerformance())
  .then(() => testErrorHandling())
  .catch(console.error);
