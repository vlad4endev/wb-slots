import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAppService } from '@/lib/app';
import { ISlotSearchService, SlotSearchConfig } from '@/lib/architecture/unified-interfaces';
import { ServiceError } from '@/lib/errors';
import { logger } from '@/lib/logging';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    
    // Извлекаем параметры фильтрации
    const warehouseIds = searchParams.get('warehouseIds');
    const boxTypeIds = searchParams.get('boxTypeIds');
    const coefficientMin = searchParams.get('coefficientMin');
    const coefficientMax = searchParams.get('coefficientMax');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const isSortingCenter = searchParams.get('isSortingCenter');
    const updateInterval = searchParams.get('updateInterval');

    // Получаем WB токен пользователя
    const userToken = await prisma.userToken.findFirst({
      where: { userId: user.id, category: 'SUPPLIES' },
    });

    if (!userToken) {
      return NextResponse.json(
        { success: false, error: 'WB API token not found for user' },
        { status: 400 }
      );
    }

    // Создаем конфигурацию для поиска слотов
    const searchConfig: SlotSearchConfig = {
      taskId: `search-${Date.now()}`, // Временный ID для одноразового поиска
      userId: user.id,
      wbToken: userToken.token,
      warehouseIds: warehouseIds ? warehouseIds.split(',').map(Number) : [],
      boxTypeIds: boxTypeIds ? boxTypeIds.split(',').map(Number) : [],
      coefficientMin: coefficientMin ? parseFloat(coefficientMin) : 0,
      coefficientMax: coefficientMax ? parseFloat(coefficientMax) : 10,
      dateFrom: dateFrom || new Date().toISOString().split('T')[0],
      dateTo: dateTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 дней
      searchDelay: updateInterval ? parseInt(updateInterval) * 1000 : 30000,
      maxSearchCycles: 1, // Одноразовый поиск
      stopOnFirstFound: false,
      autoBook: false,
    };

    logger.info('Starting slot search via unified service', {
      userId: user.id,
      config: searchConfig,
    });

    // Используем унифицированный сервис поиска слотов
    const slotSearchService = getAppService<ISlotSearchService>('UnifiedSlotSearchService');
    const result = await slotSearchService.searchSlots(searchConfig);

    logger.info('Slot search completed', {
      userId: user.id,
      success: result.success,
      foundSlotsCount: result.foundSlots?.length || 0,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        foundSlots: result.foundSlots || [],
        totalSearches: 1,
        searchTime: 0, // TODO: Add timing
        filters: {
          warehouseIds: searchConfig.warehouseIds,
          boxTypeIds: searchConfig.boxTypeIds,
          coefficientMin: searchConfig.coefficientMin,
          coefficientMax: searchConfig.coefficientMax,
          dateFrom: searchConfig.dateFrom,
          dateTo: searchConfig.dateTo,
        },
        timestamp: new Date().toISOString(),
        updateInterval: searchConfig.searchDelay / 1000,
      },
      message: result.message || `Found ${result.foundSlots?.length || 0} slots`,
    });

  } catch (error) {
    logger.error('Search slots error:', { error });
    
    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
