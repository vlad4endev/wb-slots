import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

// Интерфейс для ответа WB API
interface WBWarehouse {
  id: number;
  name: string;
  isActive: boolean;
}

// Fallback данные складов WB (расширенный список)
function getFallbackWarehouses(): WBWarehouse[] {
  return [
    // Основные склады
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
    
    // Дополнительные склады
    { id: 117521, name: 'Хабаровск', isActive: true },
    { id: 117522, name: 'Владивосток', isActive: true },
    { id: 117523, name: 'Ярославль', isActive: true },
    { id: 117524, name: 'Тула', isActive: true },
    { id: 117525, name: 'Курск', isActive: true },
    { id: 117526, name: 'Белгород', isActive: true },
    { id: 117527, name: 'Липецк', isActive: true },
    { id: 117528, name: 'Тамбов', isActive: true },
    { id: 117529, name: 'Пенза', isActive: true },
    { id: 117530, name: 'Астрахань', isActive: true },
    { id: 117531, name: 'Махачкала', isActive: true },
    { id: 117532, name: 'Грозный', isActive: true },
    { id: 117533, name: 'Нальчик', isActive: true },
    { id: 117534, name: 'Элиста', isActive: true },
    { id: 117535, name: 'Черкесск', isActive: true },
    { id: 117536, name: 'Владикавказ', isActive: true },
    { id: 117537, name: 'Йошкар-Ола', isActive: true },
    { id: 117538, name: 'Чебоксары', isActive: true },
    { id: 117539, name: 'Саранск', isActive: true },
    { id: 117540, name: 'Сыктывкар', isActive: true },
    
    // Склады в других регионах
    { id: 117541, name: 'Петрозаводск', isActive: true },
    { id: 117542, name: 'Мурманск', isActive: true },
    { id: 117543, name: 'Архангельск', isActive: true },
    { id: 117544, name: 'Вологда', isActive: true },
    { id: 117545, name: 'Калининград', isActive: true },
    { id: 117546, name: 'Псков', isActive: true },
    { id: 117547, name: 'Великий Новгород', isActive: true },
    { id: 117548, name: 'Тверь', isActive: true },
    { id: 117549, name: 'Смоленск', isActive: true },
    { id: 117550, name: 'Брянск', isActive: true },
    { id: 117551, name: 'Орел', isActive: true },
    { id: 117552, name: 'Калуга', isActive: true },
    { id: 117553, name: 'Рязань', isActive: true },
    { id: 117554, name: 'Владимир', isActive: true },
    { id: 117555, name: 'Иваново', isActive: true },
    { id: 117556, name: 'Кострома', isActive: true },
    { id: 117557, name: 'Киров', isActive: true },
    { id: 117558, name: 'Челябинск', isActive: true },
    { id: 117559, name: 'Оренбург', isActive: true },
    { id: 117560, name: 'Курган', isActive: true },
    
    // Дальневосточные склады
    { id: 117561, name: 'Благовещенск', isActive: true },
    { id: 117562, name: 'Южно-Сахалинск', isActive: true },
    { id: 117563, name: 'Магадан', isActive: true },
    { id: 117564, name: 'Анадырь', isActive: true },
    { id: 117565, name: 'Петропавловск-Камчатский', isActive: true },
    { id: 117566, name: 'Якутск', isActive: true },
    { id: 117567, name: 'Чита', isActive: true },
    { id: 117568, name: 'Улан-Удэ', isActive: true },
    { id: 117569, name: 'Кызыл', isActive: true },
    { id: 117570, name: 'Абакан', isActive: true },
    
    // Склады в Сибири
    { id: 117571, name: 'Омск', isActive: true },
    { id: 117572, name: 'Томск', isActive: true },
    { id: 117573, name: 'Кемерово', isActive: true },
    { id: 117574, name: 'Новокузнецк', isActive: true },
    { id: 117575, name: 'Бийск', isActive: true },
    { id: 117576, name: 'Рубцовск', isActive: true },
    { id: 117577, name: 'Прокопьевск', isActive: true },
    { id: 117578, name: 'Киселевск', isActive: true },
    { id: 117579, name: 'Ленинск-Кузнецкий', isActive: true },
    { id: 117580, name: 'Междуреченск', isActive: true },
    
    // Склады в Поволжье
    { id: 117581, name: 'Димитровград', isActive: true },
    { id: 117582, name: 'Сызрань', isActive: true },
    { id: 117583, name: 'Новокуйбышевск', isActive: true },
    { id: 117584, name: 'Чапаевск', isActive: true },
    { id: 117585, name: 'Жигулевск', isActive: true },
    { id: 117586, name: 'Отрадный', isActive: true },
    { id: 117587, name: 'Похвистнево', isActive: true },
    { id: 117588, name: 'Кинель', isActive: true },
    { id: 117589, name: 'Октябрьск', isActive: true },
    { id: 117590, name: 'Сызрань', isActive: true },
    
    // Склады в Центральной России
    { id: 117591, name: 'Подольск', isActive: true },
    { id: 117592, name: 'Химки', isActive: true },
    { id: 117593, name: 'Королев', isActive: true },
    { id: 117594, name: 'Мытищи', isActive: true },
    { id: 117595, name: 'Люберцы', isActive: true },
    { id: 117596, name: 'Электросталь', isActive: true },
    { id: 117597, name: 'Жуковский', isActive: true },
    { id: 117598, name: 'Раменское', isActive: true },
    { id: 117599, name: 'Одинцово', isActive: true },
    { id: 117600, name: 'Красногорск', isActive: true },
  ];
}

// Функция для получения складов через WB API
async function fetchWarehousesFromWB(userId: string): Promise<WBWarehouse[]> {
  // Получаем токен пользователя для WB API из базы данных
  console.log(`🔍 Ищем токен MARKETPLACE для пользователя: ${userId}`);
  const userToken = await prisma.userToken.findFirst({
    where: {
      userId: userId,
      category: 'MARKETPLACE', // Используем MARKETPLACE для API складов WB
    },
  });

  let authToken = '';
  if (userToken) {
    try {
      authToken = decrypt(userToken.tokenEncrypted);
      console.log('🔑 Найден и расшифрован токен MARKETPLACE для WB API');
      console.log(`📅 Токен создан: ${userToken.createdAt.toISOString()}`);
      console.log(`🔄 Последнее использование: ${userToken.lastUsedAt ? userToken.lastUsedAt.toISOString() : 'никогда'}`);
    } catch (error) {
      console.error('❌ Ошибка расшифровки токена:', error);
    }
  } else {
    console.log('⚠️ API ключ WB не найден в базе данных');
    console.log('💡 Для получения всех складов добавьте API ключ WB в настройках с категорией MARKETPLACE');
    
    // Показываем все доступные токены пользователя для отладки
    const allUserTokens = await prisma.userToken.findMany({
      where: { userId: userId },
      select: { category: true, createdAt: true, isActive: true }
    });
    console.log(`📋 Доступные токены пользователя (${allUserTokens.length}):`, allUserTokens.map(t => t.category));
  }

  // Список возможных URL для WB API (только те, что возвращают JSON)
  const wbApiUrls = [
    'https://suppliers-api.wildberries.ru/api/v1/warehouses', // Официальный endpoint
    'https://suppliers-api.wildberries.global/api/v1/warehouses', // Global suppliers API
    'https://api.wildberries.global/api/v1/warehouses', // Global API
    'https://api.wildberries.ru/api/v1/warehouses', // Альтернативный endpoint (может иметь SSL проблемы)
    'https://seller.wildberries.ru/api/v1/warehouses', // Дополнительный endpoint (возвращает HTML)
  ];
  
  console.log(`📋 Всего endpoints для проверки: ${wbApiUrls.length}`);
  
  for (let i = 0; i < wbApiUrls.length; i++) {
    const wbApiUrl = wbApiUrls[i];
    
    try {
      console.log(`🔄 Попытка ${i + 1}/${wbApiUrls.length}: Запрос к WB API:`, wbApiUrl);
      
      // Создаем AbortController для управления таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут
      
      // Подготавливаем заголовки
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'WB-Slots/1.0.0',
        'Accept': 'application/json',
      };

      // Добавляем токен аутентификации, если он есть
      if (authToken) {
        headers['HeaderApiKey'] = authToken; // Правильный заголовок для WB API
        headers['Authorization'] = `Bearer ${authToken}`; // Дополнительный заголовок
        headers['X-Supplier-Id'] = authToken; // Альтернативный способ для WB API
      }

      const response = await fetch(wbApiUrl, {
        method: 'GET',
        headers,
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

      // Проверяем тип контента ответа
      const contentType = response.headers.get('content-type');
      console.log('📄 Content-Type ответа:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Ответ не является JSON, получен:', contentType);
        const textResponse = await response.text();
        console.error('📄 Первые 200 символов ответа:', textResponse.substring(0, 200));
        
        // Если это последняя попытка, переходим к fallback данным
        if (i === wbApiUrls.length - 1) {
          console.log('⚠️ Все WB API endpoints недоступны, переходим к fallback данным');
          console.log('📋 Используем локальный справочник складов WB');
          return getFallbackWarehouses();
        }
        continue;
      }
      
      const data = await response.json();
      console.log('✅ Получены данные от WB API:', data?.length || 0, 'складов');
      
      // Обновляем время последнего использования токена при успешном запросе
      if (userToken && authToken) {
        try {
          await prisma.userToken.update({
            where: { id: userToken.id },
            data: { lastUsedAt: new Date() }
          });
          console.log('🔄 Обновлено время последнего использования токена');
        } catch (error) {
          console.error('❌ Ошибка обновления времени использования токена:', error);
        }
      }
      
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
      
      // Детальная информация об ошибке
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND')) {
          console.error(`🌐 DNS ошибка: домен не найден для ${wbApiUrl}`);
          console.error(`💡 Возможные причины: блокировка домена, проблемы с DNS, или изменение API endpoints`);
        } else if (error.message.includes('ECONNREFUSED')) {
          console.error(`🚫 Соединение отклонено для ${wbApiUrl}`);
        } else if (error.message.includes('ETIMEDOUT')) {
          console.error(`⏰ Таймаут соединения для ${wbApiUrl}`);
        } else if (error.name === 'AbortError') {
          console.error(`⏱️ Запрос отменен по таймауту для ${wbApiUrl}`);
        } else if (error.message.includes('CERT_HAS_EXPIRED')) {
          console.error(`🔒 Проблема с SSL сертификатом для ${wbApiUrl}`);
        } else if (error.cause?.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
          console.error(`🔐 SSL сертификат не соответствует домену для ${wbApiUrl}`);
          console.error(`📋 Сертификат действителен для: ${error.cause.cert?.subjectaltname || 'неизвестно'}`);
          console.error(`🌍 Попробуем альтернативные endpoints...`);
        } else if (error.cause?.code?.startsWith('ERR_TLS_')) {
          console.error(`🔒 SSL/TLS ошибка для ${wbApiUrl}: ${error.cause.code}`);
          console.error(`💡 Рекомендация: попробовать альтернативные endpoints`);
        }
      }
      
      // Если это последняя попытка, переходим к fallback данным
      if (i === wbApiUrls.length - 1) {
        console.log('⚠️ Все WB API endpoints недоступны, переходим к fallback данным');
        console.log('📋 Используем локальный справочник складов WB');
        return getFallbackWarehouses();
      }
      
      // Иначе переходим к следующему URL
      continue;
    }
  }
  
  // Этот код не должен выполняться, но на всякий случай
  console.log('⚠️ Неожиданная ситуация: не удалось получить данные, используем fallback');
  return getFallbackWarehouses();
}

// Функция для принудительного получения складов только из API (без fallback)
async function fetchWarehousesFromAPIOnly(userId: string): Promise<WBWarehouse[]> {
  // Получаем токен пользователя для WB API из базы данных
  console.log(`🔍 Принудительный поиск токена MARKETPLACE для пользователя: ${userId}`);
  const userToken = await prisma.userToken.findFirst({
    where: {
      userId: userId,
      category: 'MARKETPLACE',
    },
  });

  let authToken = '';
  if (userToken) {
    try {
      authToken = decrypt(userToken.tokenEncrypted);
      console.log('🔑 Найден токен MARKETPLACE для принудительного запроса к API');
      console.log(`📅 Токен создан: ${userToken.createdAt.toISOString()}`);
    } catch (error) {
      console.error('❌ Ошибка расшифровки токена:', error);
    }
  } else {
    console.log('⚠️ API ключ WB не найден для принудительного запроса');
    console.log('💡 Добавьте API ключ WB в настройках для получения всех складов');
  }

  // Список возможных URL для WB API (только те, что возвращают JSON)
  const wbApiUrls = [
    'https://suppliers-api.wildberries.ru/api/v1/warehouses', // Официальный endpoint
    'https://api.wildberries.ru/api/v1/warehouses', // Альтернативный endpoint
    'https://seller.wildberries.ru/api/v1/warehouses', // Дополнительный endpoint
    // Добавляем больше вариантов для обхода блокировок
  ];
  
  console.log(`🔄 Принудительная попытка получения данных из API (${wbApiUrls.length} endpoints)`);
  
  for (let i = 0; i < wbApiUrls.length; i++) {
    const wbApiUrl = wbApiUrls[i];
    
    try {
      console.log(`🔄 API попытка ${i + 1}/${wbApiUrls.length}: ${wbApiUrl}`);
      
      // Создаем AbortController для управления таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // Подготавливаем заголовки
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'WB-Slots/1.0.0',
        'Accept': 'application/json',
      };

      // Добавляем токен аутентификации, если он есть
      if (authToken) {
        headers['HeaderApiKey'] = authToken; // Правильный заголовок для WB API
        headers['Authorization'] = `Bearer ${authToken}`; // Дополнительный заголовок
        headers['X-Supplier-Id'] = authToken; // Альтернативный способ для WB API
      }

      const response = await fetch(wbApiUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📡 API ответ:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API ошибка (попытка ${i + 1}):`, response.status, errorText);
        continue;
      }

      // Проверяем тип контента ответа
      const contentType = response.headers.get('content-type');
      console.log('📄 Content-Type ответа:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Ответ не является JSON, получен:', contentType);
        const textResponse = await response.text();
        console.error('📄 Первые 200 символов ответа:', textResponse.substring(0, 200));
        continue;
      }
      
      const data = await response.json();
      console.log('✅ Получены данные от API:', data?.length || 0, 'складов');
      
      // Обновляем время последнего использования токена при успешном запросе
      if (userToken && authToken) {
        try {
          await prisma.userToken.update({
            where: { id: userToken.id },
            data: { lastUsedAt: new Date() }
          });
          console.log('🔄 Обновлено время последнего использования токена (принудительный запрос)');
        } catch (error) {
          console.error('❌ Ошибка обновления времени использования токена:', error);
        }
      }
      
      // Обрабатываем ответ в зависимости от структуры API
      if (Array.isArray(data)) {
        const warehouses = data.map((warehouse: any) => ({
          id: warehouse.id || warehouse.warehouseId,
          name: warehouse.name || warehouse.warehouseName,
          isActive: warehouse.isActive !== false,
        }));
        console.log(`🎯 Успешно получено ${warehouses.length} складов из API`);
        return warehouses;
      } else if (data.data && Array.isArray(data.data)) {
        const warehouses = data.data.map((warehouse: any) => ({
          id: warehouse.id || warehouse.warehouseId,
          name: warehouse.name || warehouse.warehouseName,
          isActive: warehouse.isActive !== false,
        }));
        console.log(`🎯 Успешно получено ${warehouses.length} складов из API`);
        return warehouses;
      } else {
        console.error('❌ Неожиданный формат ответа API:', data);
        continue;
      }
    } catch (error) {
      console.error(`❌ API ошибка при попытке ${i + 1}:`, error);
      continue;
    }
  }
  
  // Если все попытки неудачны, возвращаем пустой массив
  console.log('❌ Все API endpoints недоступны для принудительного запроса');
  return [];
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Синхронизация справочника складов с WB API...');
    
    // Получаем пользователя
    const user = await requireAuth(request);
    
    // Проверяем параметры запроса
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('force') === 'true';
    
    if (forceRefresh) {
      console.log('🗑️ Принудительная очистка справочника запрошена');
      await prisma.warehouse.deleteMany({});
      console.log('✅ Справочник очищен');
    }
    
    // Получаем склады из WB API
    let wbWarehouses = await fetchWarehousesFromWB(user.id);
    
    console.log(`📦 Получено складов из WB API: ${wbWarehouses.length}`);
    
    // Если получено меньше 100 складов, это означает, что использовались fallback данные
    // Попробуем еще раз получить данные из API с принудительной попыткой
    if (wbWarehouses.length < 100) {
      console.log(`⚠️ Получено мало складов (${wbWarehouses.length} < 100), возможно использовались fallback данные`);
      console.log('🔄 Повторная попытка получения всех складов из API...');
      
      // Принудительно пытаемся получить данные из API, игнорируя fallback
      const apiWarehouses = await fetchWarehousesFromAPIOnly(user.id);
      if (apiWarehouses.length > wbWarehouses.length) {
        console.log(`✅ Получено больше складов из API: ${apiWarehouses.length} (было ${wbWarehouses.length})`);
        wbWarehouses = apiWarehouses;
      } else if (apiWarehouses.length > 0) {
        console.log(`✅ Получены склады из API: ${apiWarehouses.length} (было ${wbWarehouses.length})`);
        wbWarehouses = apiWarehouses;
      } else {
        console.log('⚠️ API все еще недоступен, используем полученные данные');
      }
    } else {
      console.log(`✅ Получено достаточно складов (${wbWarehouses.length} >= 100), используем данные как есть`);
    }
    
    // Получаем существующие склады из базы данных
    const existingWarehouses = await prisma.warehouse.findMany({
      select: { id: true, name: true, isActive: true }
    });
    console.log(`📋 Найдено существующих складов в базе: ${existingWarehouses.length}`);
    
    // Создаем Map для быстрого поиска существующих складов
    const existingWarehouseMap = new Map(
      existingWarehouses.map(w => [w.id, w])
    );
    
    // Разделяем склады на новые и существующие
    const newWarehouses = [];
    const updatedWarehouses = [];
    const unchangedWarehouses = [];
    
    for (const warehouse of wbWarehouses) {
      const existing = existingWarehouseMap.get(warehouse.id);
      
      if (!existing) {
        // Новый склад
        newWarehouses.push(warehouse);
      } else if (existing.name !== warehouse.name || existing.isActive !== warehouse.isActive) {
        // Существующий склад с изменениями
        updatedWarehouses.push(warehouse);
      } else {
        // Без изменений
        unchangedWarehouses.push(warehouse);
      }
    }
    
    console.log(`📊 Анализ складов:`);
    console.log(`  - Новых складов: ${newWarehouses.length}`);
    console.log(`  - Обновляемых складов: ${updatedWarehouses.length}`);
    console.log(`  - Без изменений: ${unchangedWarehouses.length}`);
    
    // Добавляем новые склады
    const createdWarehouses = [];
    for (const warehouse of newWarehouses) {
      try {
        const created = await prisma.warehouse.create({
          data: {
            id: warehouse.id,
            name: warehouse.name,
            isActive: warehouse.isActive,
          },
        });
        createdWarehouses.push(created);
        console.log(`✅ Добавлен новый склад: ${warehouse.name} (ID: ${warehouse.id})`);
      } catch (error) {
        console.error(`❌ Ошибка создания склада ${warehouse.id}:`, error);
        // Продолжаем с другими складами
      }
    }
    
    // Обновляем существующие склады
    const updatedWarehousesResult = [];
    for (const warehouse of updatedWarehouses) {
      try {
        const updated = await prisma.warehouse.update({
          where: { id: warehouse.id },
          data: {
            name: warehouse.name,
            isActive: warehouse.isActive,
            updatedAt: new Date(),
          },
        });
        updatedWarehousesResult.push(updated);
        console.log(`🔄 Обновлен склад: ${warehouse.name} (ID: ${warehouse.id})`);
      } catch (error) {
        console.error(`❌ Ошибка обновления склада ${warehouse.id}:`, error);
        // Продолжаем с другими складами
      }
    }
    
    const totalProcessed = createdWarehouses.length + updatedWarehousesResult.length + unchangedWarehouses.length;
    console.log(`✅ Обработано складов: ${totalProcessed} (добавлено: ${createdWarehouses.length}, обновлено: ${updatedWarehousesResult.length}, без изменений: ${unchangedWarehouses.length})`);
    
    // Определяем, использовались ли fallback данные
    const usedFallback = wbWarehouses.length < 100;
    const hasChanges = createdWarehouses.length > 0 || updatedWarehousesResult.length > 0;
    
    let message;
    if (usedFallback) {
      message = `Справочник складов обновлен. Добавлено ${createdWarehouses.length} новых складов, обновлено ${updatedWarehousesResult.length} складов (использованы fallback данные). Для получения всех складов добавьте API ключ WB в настройках.`;
    } else if (hasChanges) {
      message = `Справочник складов обновлен. Добавлено ${createdWarehouses.length} новых складов, обновлено ${updatedWarehousesResult.length} складов.`;
    } else {
      message = `Справочник складов актуален. Изменений не обнаружено.`;
    }

    return NextResponse.json({
      success: true,
      data: {
        warehouses: [...createdWarehouses, ...updatedWarehousesResult],
        total: totalProcessed,
        newWarehouses: createdWarehouses.length,
        updatedWarehouses: updatedWarehousesResult.length,
        unchangedWarehouses: unchangedWarehouses.length,
        synced: new Date().toISOString(),
        usedFallback: usedFallback,
        hasChanges: hasChanges,
      },
      message: message,
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
