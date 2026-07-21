/**
 * Пример использования модуля автобронирования на основе Playwright
 * 
 * Этот файл демонстрирует основные возможности модуля:
 * - Авторизация в Wildberries
 * - Бронирование слотов
 * - Обработка ошибок
 * - Использование сохраненных сессий
 */

import { PlaywrightAutoBooking, BookingCredentials, BookingParams } from '@/lib/playwright-auto-booking';
import { PlaywrightAutoBookingService } from '@/lib/services/playwright-auto-booking-service';

// Пример 1: Базовое использование PlaywrightAutoBooking
async function basicBookingExample() {
  console.log('🚀 Пример базового бронирования...');

  const playwright = new PlaywrightAutoBooking();
  
  try {
    // Инициализация браузера
    await playwright.init();
    console.log('✅ Браузер инициализирован');

    // Учетные данные для авторизации
    const credentials: BookingCredentials = {
      email: 'your@email.com',
      password: 'your_password',
      phone: '+79999999999', // Опционально, для 2FA
    };

    // Авторизация
    console.log('🔐 Выполняем авторизацию...');
    const isLoggedIn = await playwright.login(credentials);
    
    if (isLoggedIn) {
      console.log('✅ Авторизация успешна');

      // Параметры бронирования
      const bookingParams: BookingParams = {
        warehouseId: 1,
        warehouseName: 'Склад 1',
        date: '2024-01-15',
        timeSlot: '10:00-12:00',
        boxTypes: ['Короба'],
        supplyId: 'SUPPLY123',
        coefficient: 1.5,
      };

      // Бронирование слота
      console.log('📅 Выполняем бронирование...');
      const result = await playwright.bookSlot(bookingParams);

      if (result.success) {
        console.log(`✅ Бронирование успешно! ID: ${result.bookingId}`);
        console.log('📋 Детали:', result.details);
      } else {
        console.error(`❌ Ошибка бронирования: ${result.error}`);
        if (result.screenshot) {
          console.log('📸 Скриншот сохранен для отладки');
        }
      }
    } else {
      console.error('❌ Ошибка авторизации');
    }

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
  } finally {
    // Закрываем браузер
    await playwright.close();
    console.log('🔒 Браузер закрыт');
  }
}

// Пример 2: Использование через сервисный слой
async function serviceBookingExample() {
  console.log('🚀 Пример бронирования через сервис...');

  const service = new PlaywrightAutoBookingService('user123', 'task123', 'supply123');

  try {
    // Проверяем доступность сервиса
    const isAvailable = await service.isServiceAvailable();
    if (!isAvailable) {
      console.error('❌ Сервис недоступен');
      return;
    }

    console.log('✅ Сервис доступен');

    // Данные слота для бронирования
    const slot = {
      warehouseId: 1,
      warehouseName: 'Склад 1',
      date: '2024-01-15',
      timeSlot: '10:00-12:00',
      coefficient: 1.5,
      boxTypes: ['Короба'],
      foundAt: new Date(),
    };

    // Выполняем бронирование
    console.log('📅 Выполняем бронирование через сервис...');
    const result = await service.bookSlot(slot);

    if (result.success) {
      console.log(`✅ Бронирование успешно! ID: ${result.bookingId}`);
      console.log(`⏱️ Время выполнения: ${result.executionTime}ms`);
      console.log(`🔄 Количество попыток: ${result.retryCount}`);
    } else {
      console.error(`❌ Ошибка бронирования: ${result.error}`);
    }

    // Получаем статистику
    const stats = await service.getBookingStats();
    console.log('📊 Статистика бронирований:');
    console.log(`   Всего: ${stats.totalBookings}`);
    console.log(`   Успешных: ${stats.successfulBookings}`);
    console.log(`   Неудачных: ${stats.failedBookings}`);
    console.log(`   Процент успеха: ${stats.successRate}%`);

  } catch (error) {
    console.error('💥 Ошибка сервиса:', error);
  }
}

// Пример 3: Использование сохраненной сессии
async function savedSessionExample() {
  console.log('🚀 Пример использования сохраненной сессии...');

  const playwright = new PlaywrightAutoBooking();
  
  try {
    await playwright.init();

    // Пытаемся использовать сохраненную сессию
    const isAuthenticated = await playwright.useSavedSession('user123');
    
    if (isAuthenticated) {
      console.log('✅ Сессия восстановлена успешно');
      
      // Проверяем статус авторизации
      const isStillLoggedIn = await playwright.isAuthenticated();
      console.log(`🔐 Статус авторизации: ${isStillLoggedIn ? 'Авторизован' : 'Не авторизован'}`);
      
    } else {
      console.log('⚠️ Сохраненная сессия не найдена или недействительна');
      console.log('💡 Необходимо выполнить полную авторизацию');
    }

  } catch (error) {
    console.error('💥 Ошибка работы с сессией:', error);
  } finally {
    await playwright.close();
  }
}

// Пример 4: Обработка ошибок и повторные попытки
async function errorHandlingExample() {
  console.log('🚀 Пример обработки ошибок...');

  const service = new PlaywrightAutoBookingService('user123', 'task123', 'supply123');

  const slot = {
    warehouseId: 999, // Несуществующий склад
    warehouseName: 'Несуществующий склад',
    date: '2024-01-15',
    timeSlot: '10:00-12:00',
    coefficient: 1.5,
    boxTypes: ['Короба'],
    foundAt: new Date(),
  };

  try {
    console.log('📅 Пытаемся забронировать слот с несуществующим складом...');
    const result = await service.bookSlot(slot);

    if (result.success) {
      console.log('✅ Бронирование неожиданно успешно');
    } else {
      console.log(`❌ Ошибка бронирования (ожидаемо): ${result.error}`);
      console.log(`🔄 Количество попыток: ${result.retryCount}`);
      console.log(`⏱️ Время выполнения: ${result.executionTime}ms`);
    }

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
  }
}

// Пример 5: Настройка SMS-провайдера
async function smsProviderExample() {
  console.log('🚀 Пример настройки SMS-провайдера...');

  const credentials: BookingCredentials = {
    email: 'your@email.com',
    password: 'your_password',
    phone: '+79999999999',
  };

  const smsProvider = {
    apiKey: 'your_sms_api_key',
    serviceId: 'your_service_id',
    phone: '+79999999999',
  };

  const playwright = new PlaywrightAutoBooking(credentials, smsProvider);
  
  try {
    await playwright.init();
    console.log('✅ Браузер инициализирован с SMS-провайдером');

    // При авторизации будет автоматически использован SMS-провайдер для получения кода
    const isLoggedIn = await playwright.login(credentials);
    
    if (isLoggedIn) {
      console.log('✅ Авторизация с SMS-кодом успешна');
    } else {
      console.error('❌ Ошибка авторизации с SMS');
    }

  } catch (error) {
    console.error('💥 Ошибка SMS-авторизации:', error);
  } finally {
    await playwright.close();
  }
}

// Запуск примеров
async function runExamples() {
  console.log('🎯 Запуск примеров модуля автобронирования Playwright\n');

  try {
    await basicBookingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await serviceBookingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await savedSessionExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await errorHandlingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await smsProviderExample();
    
    console.log('\n✅ Все примеры выполнены');
  } catch (error) {
    console.error('💥 Ошибка выполнения примеров:', error);
  }
}

// Экспорт для использования в других модулях
export {
  basicBookingExample,
  serviceBookingExample,
  savedSessionExample,
  errorHandlingExample,
  smsProviderExample,
  runExamples,
};

// Запуск, если файл выполняется напрямую
if (require.main === module) {
  runExamples();
}
