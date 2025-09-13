import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    
    // Параметры для фильтрации поставок
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    console.log(`📦 Frontend API: Fetching supplies for user ${user.id}`, {
      limit,
      offset,
    });

    // Извлекаем JWT токен из cookie для передачи в backend
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      console.error('❌ No auth token found in cookies');
      return NextResponse.json(
        { success: false, error: 'Authentication token not found' },
        { status: 401 }
      );
    }

    // Выполняем запрос к backend
    const backendUrl = new URL(`${BACKEND_URL}/supplies`);
    backendUrl.searchParams.set('limit', limit);
    backendUrl.searchParams.set('offset', offset);

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }).catch((error) => {
      console.error('❌ Backend connection error:', error);
      throw new Error(`Backend connection failed: ${error.message}`);
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
      suppliesCount: backendData.data?.supplies?.length || 0,
    });

    // Возвращаем структурированный JSON ответ
    return NextResponse.json({
      success: true,
      data: {
        supplies: backendData.data?.supplies || [],
        pagination: backendData.data?.pagination || {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: 0,
          hasMore: false,
        },
      },
      message: `Found ${backendData.data?.supplies?.length || 0} supplies`,
    });

  } catch (error) {
    console.error('Get supplies error:', error);
    
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
