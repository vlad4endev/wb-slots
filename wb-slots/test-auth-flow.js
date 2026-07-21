// Тест исправленного процесса авторизации
const testAuthFlow = async () => {
  try {
    console.log('🧪 Тестирование исправленного процесса авторизации...');
    
    // Тест 1: Запуск popup авторизации
    console.log('\n1️⃣ Запуск popup авторизации...');
    const startResponse = await fetch('http://localhost:3000/api/wb-auth/popup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      },
      body: JSON.stringify({ action: 'start' })
    });
    
    console.log('Status:', startResponse.status);
    const startData = await startResponse.json();
    console.log('Response:', JSON.stringify(startData, null, 2));
    
    if (startData.success) {
      console.log('✅ Popup авторизации запущен успешно');
      
      // Ждем 5 секунд, чтобы браузер успел открыться
      console.log('\n⏳ Ожидание 5 секунд для открытия браузера...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Тест 2: Проверка статуса popup
      console.log('\n2️⃣ Проверка статуса popup...');
      const statusResponse = await fetch('http://localhost:3000/api/wb-auth/popup', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token' // Замените на реальный токен
        }
      });
      
      console.log('Status:', statusResponse.status);
      const statusData = await statusResponse.json();
      console.log('Response:', JSON.stringify(statusData, null, 2));
      
      if (statusData.success && statusData.data.isActive) {
        console.log('✅ Popup активен - браузер должен быть открыт');
        
        // Тест 3: Принудительное сохранение сессии (имитация)
        console.log('\n3️⃣ Тест принудительного сохранения сессии...');
        const forceSaveResponse = await fetch('http://localhost:3000/api/wb-auth/popup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token' // Замените на реальный токен
          },
          body: JSON.stringify({ action: 'force-save' })
        });
        
        console.log('Status:', forceSaveResponse.status);
        const forceSaveData = await forceSaveResponse.json();
        console.log('Response:', JSON.stringify(forceSaveData, null, 2));
        
        if (forceSaveData.success) {
          console.log('✅ Принудительное сохранение сессии работает');
        } else {
          console.log('⚠️ Принудительное сохранение не удалось:', forceSaveData.error);
        }
        
        // Тест 4: Закрытие popup
        console.log('\n4️⃣ Закрытие popup...');
        const closeResponse = await fetch('http://localhost:3000/api/wb-auth/popup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token' // Замените на реальный токен
          },
          body: JSON.stringify({ action: 'close' })
        });
        
        console.log('Status:', closeResponse.status);
        const closeData = await closeResponse.json();
        console.log('Response:', JSON.stringify(closeData, null, 2));
        
        if (closeData.success) {
          console.log('✅ Popup закрыт успешно');
        }
        
      } else {
        console.log('❌ Popup не активен');
      }
      
    } else {
      console.log('❌ Не удалось запустить popup:', startData.error);
    }
    
    // Тест 5: Проверка статуса сессии
    console.log('\n5️⃣ Проверка статуса сессии...');
    const sessionResponse = await fetch('http://localhost:3000/api/wb-session/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Замените на реальный токен
      }
    });
    
    console.log('Status:', sessionResponse.status);
    const sessionData = await sessionResponse.json();
    console.log('Response:', JSON.stringify(sessionData, null, 2));
    
    console.log('\n🎉 Тестирование завершено!');
    console.log('\n📋 Результаты:');
    console.log('- Popup авторизации:', startData.success ? '✅ Работает' : '❌ Не работает');
    console.log('- Браузер остается открытым:', statusData.success && statusData.data.isActive ? '✅ Да' : '❌ Нет');
    console.log('- Принудительное сохранение:', forceSaveData.success ? '✅ Работает' : '❌ Не работает');
    console.log('- Закрытие popup:', closeData.success ? '✅ Работает' : '❌ Не работает');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
};

// Запускаем тест через 3 секунды (даем время серверу запуститься)
setTimeout(testAuthFlow, 3000);
