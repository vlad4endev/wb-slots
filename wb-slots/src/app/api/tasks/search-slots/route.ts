import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

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

    // Строим URL для backend API
    const backendUrl = new URL(`${BACKEND_URL}/tasks/search-slots`);
    
    // Добавляем параметры запроса
    if (warehouseIds) backendUrl.searchParams.set('warehouseIds', warehouseIds);
    if (boxTypeIds) backendUrl.searchParams.set('boxTypeIds', boxTypeIds);
    if (coefficientMin) backendUrl.searchParams.set('coefficientMin', coefficientMin);
    if (coefficientMax) backendUrl.searchParams.set('coefficientMax', coefficientMax);
    if (dateFrom) backendUrl.searchParams.set('dateFrom', dateFrom);
    if (dateTo) backendUrl.searchParams.set('dateTo', dateTo);
    if (isSortingCenter) backendUrl.searchParams.set('isSortingCenter', isSortingCenter);
    if (updateInterval) backendUrl.searchParams.set('updateInterval', updateInterval);

    console.log(`🔍 Frontend API: Forwarding slot search request to backend`, {
      backendUrl: backendUrl.toString(),
      userId: user.id,
      params: {
        warehouseIds,
        boxTypeIds,
        coefficientMin,
        coefficientMax,
        dateFrom,
        dateTo,
        isSortingCenter,
        updateInterval,
      }
    });

    // Выполняем запрос к backend
    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.jwtToken}`, // Предполагаем, что у нас есть JWT токен
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error(`❌ Backend API error: ${backendResponse.status}`, errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Backend API error: ${backendResponse.status}`,
          details: errorText 
        },
        { status: backendResponse.status }
      );
    }

    const backendData = await backendResponse.json();
    
    console.log(`✅ Backend API response received`, {
      success: backendData.success,
      foundSlotsCount: backendData.foundSlots?.length || 0,
      searchTime: backendData.searchTime,
      timestamp: backendData.timestamp,
    });

    // Возвращаем структурированный JSON ответ
    return NextResponse.json({
      success: true,
      data: {
        foundSlots: backendData.foundSlots || [],
        totalSearches: backendData.totalSearches || 0,
        searchTime: backendData.searchTime || 0,
        filters: backendData.filters || {},
        timestamp: backendData.timestamp || new Date().toISOString(),
        updateInterval: updateInterval ? parseInt(updateInterval) : 30,
      },
      message: `Found ${backendData.foundSlots?.length || 0} slots`,
    });

  } catch (error) {
    console.error('Search slots error:', error);
    
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
