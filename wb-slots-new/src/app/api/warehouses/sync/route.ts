import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Интерфейс для ответа WB API
interface WBWarehouse {
  id: number;
  name: string;
  isActive: boolean;
}

// Fallback данные складов WB
function getFallbackWarehouses(): WBWarehouse[] {
  return [
    { id: 117501, name: 'Казань', isActive: true },
    { id: 117502, name: 'Санкт-Петербург', isActive: true },
    { id: 117503, name: 'Екатеринбург', isActive: true },
    { id: 117504, name: 'Новосибирск', isActive: true },
    { id: 117505, name: 'Краснодар', isActive: true },
    { id: 117506, name: 'Нижний Новгород', isActive: true },
    { id: 117507, name: 'Ростов-на-Дону', isActive: true },
    { id: 117508, name: 'Самара', isActive: true },
    { id: 117509, name: 'Воронеж', isActive: true },
    { id: 117510, name: 'Уфа', isActive: true },
    { id: 117511, name: 'Пермь', isActive: true },
    { id: 117512, name: 'Волгоград', isActive: true },
    { id: 117513, name: 'Красноярск', isActive: true },
    { id: 117514, name: 'Саратов', isActive: true },
    { id: 117515, name: 'Тюмень', isActive: true },
    { id: 117516, name: 'Тольятти', isActive: true },
    { id: 117517, name: 'Ижевск', isActive: true },
    { id: 117518, name: 'Барнаул', isActive: true },
    { id: 117519, name: 'Ульяновск', isActive: true },
    { id: 117520, name: 'Иркутск', isActive: true },
  ];
}

// Функция для получения складов через WB API
async function fetchWarehousesFromWB(): Promise<WBWarehouse[]> {
  // Список возможных URL для WB API
  const wbApiUrls = [
    'https://suppliers-api.wildberries.ru/api/v3/warehouses',
    'https://suppliers-api.wildberries.ru/api/v2/warehouses',
    'https://suppliers-api.wildberries.ru/warehouses',
  ];
  
  for (let i = 0; i < wbApiUrls.length; i++) {
    const wbApiUrl = wbApiUrls[i];
    
    try {
      console.log(`🔄 Попытка ${i + 1}/${wbApiUrls.length}: Запрос к WB API:`, wbApiUrl);
      
      // Создаем AbortController для управления таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут
      
      const response = await fetch(wbApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WB-Slots/1.0.0',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📡 Ответ WB API:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ошибка WB API (попытка ${i + 1}):`, response.status, errorText);
        
        // Если это последняя попытка, выбрасываем ошибку
        if (i === wbApiUrls.length - 1) {
          throw new Error(`WB API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        // Иначе переходим к следующему URL
        continue;
      }

      const data = await response.json();
      console.log('✅ Получены данные от WB API:', data?.length || 0, 'складов');
      
      // Обрабатываем ответ в зависимости от структуры API
      if (Array.isArray(data)) {
        return data.map((warehouse: any) => ({
          id: warehouse.id || warehouse.warehouseId,
          name: warehouse.name || warehouse.warehouseName,
          isActive: warehouse.isActive !== false,
        }));
      } else if (data.data && Array.isArray(data.data)) {
        return data.data.map((warehouse: any) => ({
          id: warehouse.id || warehouse.warehouseId,
          name: warehouse.name || warehouse.warehouseName,
          isActive: warehouse.isActive !== false,
        }));
      } else {
        console.error('❌ Неожиданный формат ответа API:', data);
        if (i === wbApiUrls.length - 1) {
          throw new Error('Unexpected API response format');
        }
        continue;
      }
    } catch (error) {
      console.error(`❌ Ошибка при попытке ${i + 1}:`, error);
      
      // Если это последняя попытка, выбрасываем ошибку
      if (i === wbApiUrls.length - 1) {
        throw error;
      }
      
      // Иначе переходим к следующему URL
      continue;
    }
  }
  
  // Если все попытки неудачны, используем fallback данные
  console.log('⚠️ WB API недоступен, используем fallback данные');
  return getFallbackWarehouses();
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Синхронизация справочника складов с WB API...');
    
    // Получаем склады из WB API
    const wbWarehouses = await fetchWarehousesFromWB();
    
    console.log(`📦 Получено складов из WB API: ${wbWarehouses.length}`);
    
    // Очищаем существующий справочник
    await prisma.warehouse.deleteMany({});
    console.log('🗑️  Очищен существующий справочник');
    
    // Добавляем новые склады
    const createdWarehouses = [];
    for (const warehouse of wbWarehouses) {
      try {
        const created = await prisma.warehouse.create({
          data: {
            id: warehouse.id,
            name: warehouse.name,
            isActive: warehouse.isActive,
          },
        });
        createdWarehouses.push(created);
      } catch (error) {
        console.error(`Ошибка создания склада ${warehouse.id}:`, error);
        // Продолжаем с другими складами
      }
    }
    
    console.log(`✅ Создано складов в базе: ${createdWarehouses.length}`);
    
    return NextResponse.json({
      success: true,
      data: {
        warehouses: createdWarehouses,
        total: createdWarehouses.length,
        synced: new Date().toISOString(),
      },
      message: `Справочник складов обновлен. Добавлено ${createdWarehouses.length} складов`,
    });
    
  } catch (error) {
    console.error('Sync warehouses error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка синхронизации справочника складов',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET метод для проверки статуса синхронизации
export async function GET(request: NextRequest) {
  try {
    const warehouseCount = await prisma.warehouse.count();
    const lastWarehouse = await prisma.warehouse.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        totalWarehouses: warehouseCount,
        lastSync: lastWarehouse?.createdAt || null,
        status: warehouseCount > 0 ? 'synced' : 'empty'
      }
    });
    
  } catch (error) {
    console.error('Get sync status error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Ошибка получения статуса синхронизации' },
      { status: 500 }
    );
  }
}
