/**
 * Тест загрузки поставок со статусом "черновик"
 * Проверяет работу API для получения поставок со статусом draft
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function testDraftSupplies() {
  console.log('🧪 Тестирование загрузки поставок со статусом "черновик"...\n');

  try {
    // Тест 1: Проверка API endpoint
    console.log('1️⃣ Тестирование API endpoint...');
    const response = await fetch(`${BACKEND_URL}/supplies?status=draft&limit=10`);
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ API Response received');
    console.log('📊 Response structure:', {
      success: data.success,
      suppliesCount: data.data?.supplies?.length || 0,
      hasError: !!data.error
    });

    if (data.success && data.data?.supplies) {
      console.log('\n📦 Поставки со статусом "черновик":');
      data.data.supplies.forEach((supply, index) => {
        console.log(`${index + 1}. ID: ${supply.id}`);
        console.log(`   Название: ${supply.name}`);
        console.log(`   Статус: ${supply.status}`);
        console.log(`   Склад: ${supply.warehouseId}`);
        console.log(`   Тип короба: ${supply.boxTypeId}`);
        console.log(`   Создана: ${supply.createdAt}`);
        console.log('---');
      });

      // Проверяем, что все поставки имеют статус "черновик"
      const nonDraftSupplies = data.data.supplies.filter(supply => 
        !supply.status.toLowerCase().includes('draft') && 
        supply.status !== 'черновик' &&
        supply.status !== 'DRAFT'
      );

      if (nonDraftSupplies.length > 0) {
        console.log('⚠️  Найдены поставки не со статусом "черновик":');
        nonDraftSupplies.forEach(supply => {
          console.log(`   - ${supply.id}: ${supply.status}`);
        });
      } else {
        console.log('✅ Все поставки имеют статус "черновик"');
      }
    } else {
      console.log('ℹ️  Поставки не найдены или произошла ошибка');
      if (data.error) {
        console.log('❌ Ошибка:', data.error);
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

// Запуск теста
testDraftSupplies().then(() => {
  console.log('\n🏁 Тестирование завершено');
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
});
