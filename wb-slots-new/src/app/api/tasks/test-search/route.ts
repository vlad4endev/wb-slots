import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WBSlotSearch } from '@/lib/wb-slot-search';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    // Проверяем, что это тестовый пользователь
    if (user.id !== 'cmf8sg2w8000085vkomhit4hv') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { warehouseIds, boxTypeIds, coefficientMin, coefficientMax, dateFrom, dateTo, isSortingCenter } = body;

    if (!warehouseIds || !Array.isArray(warehouseIds) || warehouseIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Warehouse IDs are required' },
        { status: 400 }
      );
    }

    if (!boxTypeIds || !Array.isArray(boxTypeIds) || boxTypeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Box type IDs are required' },
        { status: 400 }
      );
    }

    // Сначала проверим наличие токена
    const { prisma } = await import('@/lib/prisma');
    const { decrypt } = await import('@/lib/encryption');
    
    const suppliesToken = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        category: 'SUPPLIES',
        isActive: true,
      },
    });

    if (!suppliesToken) {
      return NextResponse.json({
        success: false,
        error: 'WB API токен не найден',
        details: {
          message: 'Для работы поиска слотов необходимо добавить токен WB API',
          solution: 'Перейдите в настройки → Токены WB API → Добавить токен',
          tokenCategory: 'SUPPLIES',
          userId: user.id,
        },
        config: {
          warehouseIds,
          boxTypeIds,
          coefficientMin,
          coefficientMax,
          dateFrom,
          dateTo,
        },
      });
    }

    // Создаем временную задачу для тестового поиска с уникальным ID
    const testTaskId = `test-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let testTask;
    let run;
    
    try {
      testTask = await prisma.task.create({
        data: {
          id: testTaskId,
          userId: user.id,
          name: 'Тестовый поиск слотов',
          enabled: false,
          filters: {
            warehouseIds,
            boxTypeIds,
            coefficientMin: coefficientMin || -1,
            coefficientMax: coefficientMax || -1,
            dates: {
              from: dateFrom || new Date().toISOString(),
              to: dateTo || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
          priority: 1,
          retryPolicy: {
            maxRetries: 3,
            retryDelay: 5000,
          },
        },
      });

      // Создаем Run запись для тестового поиска
      run = await prisma.run.create({
        data: {
          taskId: testTask.id,
          userId: user.id,
          status: 'RUNNING',
          startedAt: new Date(),
          summary: {
            testSearch: true,
          },
        },
      });
    } catch (dbError) {
      console.error('Ошибка создания тестовой задачи или Run записи:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Ошибка создания тестовых данных',
        details: {
          message: dbError instanceof Error ? dbError.message : 'Неизвестная ошибка базы данных',
          taskId: testTaskId,
          userId: user.id,
        },
      }, { status: 500 });
    }

    // Создаем конфигурацию для тестового поиска
    const searchConfig = {
      userId: user.id,
      taskId: testTask.id, // Тестовый ID задачи
      warehouseIds,
      boxTypeIds,
      coefficientMin: coefficientMin || -1,
      coefficientMax: coefficientMax || -1,
      dateFrom: dateFrom || new Date().toISOString(),
      dateTo: dateTo || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      stopOnFirstFound: false, // Не останавливаемся на первом найденном
      isSortingCenter: isSortingCenter !== undefined ? isSortingCenter : false, // По умолчанию false
      runId: run.id, // Передаем runId для логирования
    };

    console.log('🧪 Starting test search with config:', searchConfig);
    console.log('📅 Date details:', {
      dateFrom: searchConfig.dateFrom,
      dateTo: searchConfig.dateTo,
      dateFromParsed: new Date(searchConfig.dateFrom).toISOString(),
      dateToParsed: new Date(searchConfig.dateTo).toISOString(),
    });

    console.log(`📝 Создана Run запись для тестового поиска: ${run.id}`);

    // Создаем экземпляр поиска слотов
    const slotSearch = new WBSlotSearch(searchConfig);

    // Выполняем поиск
    console.log('🔍 Выполняем тестовый поиск слотов...');
    const result = await slotSearch.searchSlots();
    console.log('📊 Результат поиска:', {
      foundSlots: result.foundSlots.length,
      totalChecked: result.totalChecked,
      errors: result.errors.length,
      stoppedEarly: result.stoppedEarly
    });

    console.log('🧪 Test search completed:', {
      foundSlots: result.foundSlots.length,
      totalChecked: result.totalChecked,
      searchTime: result.searchTime,
      errors: result.errors.length,
    });

    // Очищаем тестовую задачу и Run запись
    try {
      await prisma.run.delete({
        where: { id: run.id },
      });
      await prisma.task.delete({
        where: { id: testTask.id },
      });
      console.log('🧹 Тестовая задача и Run запись очищены');
    } catch (cleanupError) {
      console.warn('⚠️ Ошибка при очистке тестовых данных:', cleanupError);
    }

    return NextResponse.json({
      success: true,
      data: {
        foundSlots: result.foundSlots.length,
        totalChecked: result.totalChecked,
        searchTime: result.searchTime,
        errors: result.errors,
        stoppedEarly: result.stoppedEarly,
        slots: result.foundSlots.slice(0, 10), // Показываем только первые 10 слотов
        runId: run.id, // Возвращаем runId для получения логов (до очистки)
        config: {
          warehouseIds,
          boxTypeIds,
          coefficientMin,
          coefficientMax,
          dateFrom,
          dateTo,
          isSortingCenter: isSortingCenter !== undefined ? isSortingCenter : false,
        },
        tokenInfo: {
          hasToken: true,
          tokenId: suppliesToken.id,
          tokenCategory: suppliesToken.category,
          isActive: suppliesToken.isActive,
          lastUsedAt: suppliesToken.lastUsedAt,
        },
      },
      message: 'Test search completed successfully',
    });

  } catch (error) {
    console.error('Test search error:', error);
    
    // Очищаем тестовые данные в случае ошибки
    try {
      if (typeof run !== 'undefined' && run?.id) {
        await prisma.run.delete({
          where: { id: run.id },
        });
      }
      if (typeof testTask !== 'undefined' && testTask?.id) {
        await prisma.task.delete({
          where: { id: testTask.id },
        });
      }
      console.log('🧹 Тестовые данные очищены после ошибки');
    } catch (cleanupError) {
      console.warn('⚠️ Ошибка при очистке тестовых данных после ошибки:', cleanupError);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
