// Тест продвинутой системы авторизации
const testAdvancedAuth = async () => {
  try {
    console.log('🧪 Тестирование продвинутой системы авторизации...');
    
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    const baseUrl = 'http://localhost:3000';
    
    // Тест 1: Создание сессии
    console.log('\n1️⃣ Создание продвинутой сессии...');
    const createSessionResponse = await fetch(`${baseUrl}/api/auth/advanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      },
      body: JSON.stringify({
        action: 'create-session',
        userId: userId,
        sessionData: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ipAddress: '127.0.0.1',
          deviceFingerprint: 'test-fingerprint-123',
          location: {
            country: 'Russia',
            city: 'Moscow',
            timezone: 'Europe/Moscow'
          },
          metadata: {
            source: 'test',
            version: '1.0.0'
          }
        }
      })
    });
    
    console.log('Status:', createSessionResponse.status);
    const createSessionData = await createSessionResponse.json();
    console.log('Response:', JSON.stringify(createSessionData, null, 2));
    
    if (createSessionData.success) {
      console.log('✅ Продвинутая сессия создана успешно');
      
      // Тест 2: Валидация сессии
      console.log('\n2️⃣ Валидация сессии...');
      const validateSessionResponse = await fetch(`${baseUrl}/api/auth/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          action: 'validate-session',
          sessionId: createSessionData.data.sessionId
        })
      });
      
      console.log('Status:', validateSessionResponse.status);
      const validateSessionData = await validateSessionResponse.json();
      console.log('Response:', JSON.stringify(validateSessionData, null, 2));
      
      if (validateSessionData.success) {
        console.log('✅ Сессия валидирована успешно');
      } else {
        console.log('⚠️ Валидация сессии не удалась:', validateSessionData.error);
      }
    }
    
    // Тест 3: Статус WB авторизации
    console.log('\n3️⃣ Статус WB авторизации...');
    const wbAuthStatusResponse = await fetch(`${baseUrl}/api/auth/advanced?action=wb-auth-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Status:', wbAuthStatusResponse.status);
    const wbAuthStatusData = await wbAuthStatusResponse.json();
    console.log('Response:', JSON.stringify(wbAuthStatusData, null, 2));
    
    // Тест 4: Статус сессии пользователя
    console.log('\n4️⃣ Статус сессии пользователя...');
    const sessionStatusResponse = await fetch(`${baseUrl}/api/auth/advanced?action=session-status&userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Status:', sessionStatusResponse.status);
    const sessionStatusData = await sessionStatusResponse.json();
    console.log('Response:', JSON.stringify(sessionStatusData, null, 2));
    
    // Тест 5: Статистика безопасности
    console.log('\n5️⃣ Статистика безопасности...');
    const securityStatsResponse = await fetch(`${baseUrl}/api/auth/advanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        action: 'get-security-stats',
        userId: userId
      })
    });
    
    console.log('Status:', securityStatsResponse.status);
    const securityStatsData = await securityStatsResponse.json();
    console.log('Response:', JSON.stringify(securityStatsData, null, 2));
    
    // Тест 6: События безопасности
    console.log('\n6️⃣ События безопасности...');
    const securityEventsResponse = await fetch(`${baseUrl}/api/auth/advanced?action=security-events&userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Status:', securityEventsResponse.status);
    const securityEventsData = await securityEventsResponse.json();
    console.log('Response:', JSON.stringify(securityEventsData, null, 2));
    
    console.log('\n🎉 Тестирование продвинутой системы авторизации завершено!');
    console.log('\n📋 Результаты:');
    console.log('- Создание сессии:', createSessionData.success ? '✅ Работает' : '❌ Не работает');
    console.log('- Валидация сессии:', validateSessionData.success ? '✅ Работает' : '❌ Не работает');
    console.log('- WB Auth статус:', wbAuthStatusData.success ? '✅ Работает' : '❌ Не работает');
    console.log('- Статус сессии:', sessionStatusData.success ? '✅ Работает' : '❌ Не работает');
    console.log('- Статистика безопасности:', securityStatsData.success ? '✅ Работает' : '❌ Не работает');
    console.log('- События безопасности:', securityEventsData.success ? '✅ Работает' : '❌ Не работает');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
};

// Запускаем тест через 3 секунды (даем время серверу запуститься)
setTimeout(testAdvancedAuth, 3000);
