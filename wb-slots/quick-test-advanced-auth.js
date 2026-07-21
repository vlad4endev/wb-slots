// Быстрый тест продвинутой системы авторизации
const quickTest = async () => {
  try {
    console.log('🚀 Быстрый тест продвинутой системы авторизации...');
    
    const userId = 'cmfvmlf4x0000pmjsmd3eouhu';
    const baseUrl = 'http://localhost:3000';
    
    // Тест 1: Проверка доступности API
    console.log('\n1️⃣ Проверка доступности API...');
    try {
      const response = await fetch(`${baseUrl}/api/auth/advanced?action=wb-auth-status`);
      if (response.ok) {
        console.log('✅ API доступен');
      } else {
        console.log('❌ API недоступен:', response.status);
        return;
      }
    } catch (error) {
      console.log('❌ Ошибка подключения к API:', error.message);
      console.log('💡 Убедитесь, что сервер запущен: npm run dev');
      return;
    }
    
    // Тест 2: Создание сессии
    console.log('\n2️⃣ Создание продвинутой сессии...');
    const createResponse = await fetch(`${baseUrl}/api/auth/advanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-session',
        userId: userId,
        sessionData: {
          userAgent: 'Test User Agent',
          ipAddress: '127.0.0.1',
          deviceFingerprint: 'test-fingerprint-' + Date.now(),
          location: { country: 'Russia', city: 'Moscow' },
          metadata: { source: 'quick-test' }
        }
      })
    });
    
    const createData = await createResponse.json();
    console.log('Результат:', createData.success ? '✅ Успешно' : '❌ Ошибка');
    if (createData.success) {
      console.log('Session ID:', createData.data.sessionId);
    } else {
      console.log('Ошибка:', createData.error);
    }
    
    // Тест 3: Статистика безопасности
    console.log('\n3️⃣ Статистика безопасности...');
    const statsResponse = await fetch(`${baseUrl}/api/auth/advanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get-security-stats',
        userId: userId
      })
    });
    
    const statsData = await statsResponse.json();
    console.log('Результат:', statsData.success ? '✅ Успешно' : '❌ Ошибка');
    if (statsData.success) {
      console.log('Активных сессий:', statsData.data.activeSessions);
      console.log('Оценка безопасности:', statsData.data.securityScore + '/100');
    }
    
    // Тест 4: События безопасности
    console.log('\n4️⃣ События безопасности...');
    const eventsResponse = await fetch(`${baseUrl}/api/auth/advanced?action=security-events&userId=${userId}`);
    const eventsData = await eventsResponse.json();
    console.log('Результат:', eventsData.success ? '✅ Успешно' : '❌ Ошибка');
    if (eventsData.success) {
      console.log('Событий найдено:', eventsData.data.total);
    }
    
    console.log('\n🎉 Быстрый тест завершен!');
    console.log('\n📋 Результаты:');
    console.log('- API доступность:', createResponse.ok ? '✅' : '❌');
    console.log('- Создание сессии:', createData.success ? '✅' : '❌');
    console.log('- Статистика безопасности:', statsData.success ? '✅' : '❌');
    console.log('- События безопасности:', eventsData.success ? '✅' : '❌');
    
    console.log('\n🌐 Для полного тестирования откройте:');
    console.log('http://localhost:3000/advanced-auth-test');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
};

// Запускаем тест
quickTest();
