/**
 * Тестовый скрипт для проверки работы фильтрации слотов
 * Запуск: node test-slot-search.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Тестовые данные
const testCases = [
  {
    name: 'Тест 1: Поиск по складу Подольск',
    filters: {
      warehouseIds: '117501',
      boxTypeIds: '2,5',
      coefficientMin: '0',
      coefficientMax: '10',
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isSortingCenter: 'false',
      updateInterval: '30',
    },
    expected: {
      shouldHaveResults: true,
      maxCoefficient: 10,
    }
  },
  {
    name: 'Тест 2: Поиск с высоким коэффициентом (должен быть пустой)',
    filters: {
      warehouseIds: '117501',
      boxTypeIds: '2,5',
      coefficientMin: '50',
      coefficientMax: '100',
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isSortingCenter: 'false',
      updateInterval: '30',
    },
    expected: {
      shouldHaveResults: false,
      maxCoefficient: 100,
    }
  },
  {
    name: 'Тест 3: Поиск по нескольким складам',
    filters: {
      warehouseIds: '117501,130744,130745',
      boxTypeIds: '2,5',
      coefficientMin: '0',
      coefficientMax: '20',
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isSortingCenter: 'false',
      updateInterval: '30',
    },
    expected: {
      shouldHaveResults: true,
      maxCoefficient: 20,
    }
  },
  {
    name: 'Тест 4: Поиск только коробов',
    filters: {
      warehouseIds: '117501',
      boxTypeIds: '2',
      coefficientMin: '0',
      coefficientMax: '15',
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isSortingCenter: 'false',
      updateInterval: '30',
    },
    expected: {
      shouldHaveResults: true,
      maxCoefficient: 15,
    }
  },
  {
    name: 'Тест 5: Поиск в прошлом (должен быть пустой)',
    filters: {
      warehouseIds: '117501',
      boxTypeIds: '2,5',
      coefficientMin: '0',
      coefficientMax: '20',
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dateTo: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isSortingCenter: 'false',
      updateInterval: '30',
    },
    expected: {
      shouldHaveResults: false,
      maxCoefficient: 20,
    }
  }
];

async function testSlotSearch() {
  console.log('🧪 Начинаем тестирование фильтрации слотов...\n');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`🔍 Фильтры:`, testCase.filters);

    try {
      // Тестируем backend API
      const backendUrl = new URL(`${BACKEND_URL}/tasks/search-slots`);
      Object.entries(testCase.filters).forEach(([key, value]) => {
        backendUrl.searchParams.set(key, value);
      });

      console.log(`🌐 Backend URL: ${backendUrl.toString()}`);

      const backendResponse = await fetch(backendUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Добавьте авторизацию если нужно
          // 'Authorization': 'Bearer YOUR_TOKEN',
        },
      });

      if (!backendResponse.ok) {
        console.log(`❌ Backend API error: ${backendResponse.status}`);
        continue;
      }

      const backendData = await backendResponse.json();
      console.log(`📊 Backend response:`, {
        success: backendData.success,
        foundSlots: backendData.foundSlots?.length || 0,
        searchTime: backendData.searchTime,
        error: backendData.error,
      });

      // Проверяем результаты
      const hasResults = backendData.foundSlots && backendData.foundSlots.length > 0;
      const expectedResults = testCase.expected.shouldHaveResults;

      if (hasResults === expectedResults) {
        console.log(`✅ Тест пройден: ${hasResults ? 'найдены слоты' : 'слоты не найдены'} (как ожидалось)`);
        
        // Дополнительные проверки для найденных слотов
        if (hasResults) {
          const maxCoeff = Math.max(...backendData.foundSlots.map(slot => slot.coefficient));
          if (maxCoeff <= testCase.expected.maxCoefficient) {
            console.log(`✅ Коэффициенты в пределах ожидаемого диапазона: ${maxCoeff} <= ${testCase.expected.maxCoefficient}`);
          } else {
            console.log(`⚠️ Коэффициент превышает ожидаемый: ${maxCoeff} > ${testCase.expected.maxCoefficient}`);
          }
        }
        
        passedTests++;
      } else {
        console.log(`❌ Тест не пройден: ожидалось ${expectedResults ? 'найти слоты' : 'не найти слоты'}, получено ${hasResults ? 'найдены слоты' : 'слоты не найдены'}`);
      }

    } catch (error) {
      console.log(`❌ Ошибка при выполнении теста:`, error.message);
    }

    // Небольшая пауза между тестами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Результаты тестирования:`);
  console.log(`✅ Пройдено: ${passedTests}/${totalTests}`);
  console.log(`❌ Не пройдено: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 Успешность: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log(`\n🎉 Все тесты пройдены успешно!`);
  } else {
    console.log(`\n⚠️ Некоторые тесты не пройдены. Проверьте логи выше.`);
  }
}

// Запускаем тесты
testSlotSearch().catch(console.error);
