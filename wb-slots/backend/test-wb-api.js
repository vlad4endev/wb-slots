const { PrismaClient } = require('@prisma/client');

async function testWBApi() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Тестируем WB API...');
    
    // Найдем пользователя
    const user = await prisma.user.findFirst({
      where: {
        email: 'vl4en.95@yandex.ru'
      }
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }
    
    console.log('👤 Пользователь найден:', user.email);
    
    // Получим токен SUPPLIES
    const token = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        category: 'SUPPLIES',
        isActive: true
      }
    });
    
    if (!token) {
      console.log('❌ Токен SUPPLIES не найден');
      return;
    }
    
    console.log('🔑 Токен найден:', token.id);
    console.log('🔐 Зашифрованный токен:', token.tokenEncrypted.substring(0, 20) + '...');
    
    // Теперь попробуем сделать запрос к WB API
    const fetch = require('node-fetch');
    
    const wbApiUrl = 'https://supplies-api.wildberries.ru/api/v1/supplies';
    const requestBody = {
      statusIDs: [5, 6] // Статусы черновик
    };
    
    console.log('🌐 Отправляем запрос к WB API...');
    console.log('📋 URL:', wbApiUrl);
    console.log('📦 Body:', requestBody);
    
    const response = await fetch(wbApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': token.tokenEncrypted, // Используем токен напрямую
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📊 Статус ответа:', response.status);
    console.log('📋 Заголовки:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Успешный ответ от WB API:');
      console.log('📦 Количество поставок:', data.length || 0);
      if (data.length > 0) {
        console.log('🔍 Первая поставка:', data[0]);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Ошибка WB API:');
      console.log('📋 Статус:', response.status);
      console.log('📋 Текст ошибки:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании WB API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWBApi();
