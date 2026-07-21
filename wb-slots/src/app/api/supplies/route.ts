import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WBSuppliesClient } from '@/lib/wb-client/supplies-client';
import { decrypt } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    
    // Параметры для фильтрации поставок
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || 'all'; // all, draft, active, closed
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    console.log(`📦 Frontend API: Fetching supplies for user ${user.id}`, {
      limit,
      offset,
      status,
      dateFrom,
      dateTo,
    });

    // Получаем токен пользователя
    const suppliesToken = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        category: 'SUPPLIES',
        isActive: true,
      },
    });

    if (!suppliesToken) {
      console.error('❌ No active supplies token found for user:', user.id);
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active supplies token found. Please add a SUPPLIES token in settings.',
          supplies: [],
          pagination: {
            limit,
            offset,
            total: 0,
            hasMore: false,
          }
        },
        { status: 400 }
      );
    }

    // Расшифровываем токен
    const decryptedToken = decrypt(suppliesToken.tokenEncrypted);
    console.log('🔓 Token decrypted successfully');

    // Создаем WB клиент
    const wbClient = new WBSuppliesClient(decryptedToken);

    // Получаем поставки из WB API (API не поддерживает фильтрацию по статусам)
    console.log('🚀 Вызываем wbClient.getSupplies с параметрами:', {
      limit,
      offset,
      dateFrom,
      dateTo
    });
    
    let wbSupplies;
    try {
      wbSupplies = await wbClient.getSupplies(
        limit, 
        offset, 
        [], // Пустой массив статусов - API не поддерживает фильтрацию
        dateFrom,
        dateTo
      );
      
      console.log('✅ WB API ответ получен:', {
        suppliesCount: wbSupplies?.length || 0,
        firstSupply: wbSupplies?.[0] || null
      });
    } catch (wbError) {
      console.error('❌ Ошибка WB API:', wbError);
      const errorMessage = wbError instanceof Error ? wbError.message : String(wbError);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `WB API Error: ${errorMessage}`,
          supplies: [],
          pagination: {
            limit,
            offset,
            total: 0,
            hasMore: false,
          }
        },
        { status: 500 }
      );
    }

    // Преобразуем в наш формат (WB API возвращает другую структуру)
    let supplies = wbSupplies.map(supply => ({
      id: supply.supplyID || supply.preorderID?.toString() || 'unknown',
      name: supply.supplyID ? `Поставка ${supply.supplyID}` : `Предзаказ ${supply.preorderID}`,
      status: supply.statusName || 'unknown',
      warehouseId: 0, // WB API не возвращает warehouseId в этом endpoint
      boxTypeId: 0, // WB API не возвращает boxTypeId в этом endpoint
      supplyDate: supply.supplyDate,
      factDate: supply.factDate,
      createdAt: supply.createDate,
      updatedAt: supply.updatedDate,
      goods: [], // WB API не возвращает товары в списке поставок
      phone: supply.phone,
      preorderID: supply.preorderID,
      supplyID: supply.supplyID,
    }));

    // Фильтруем по статусам на стороне приложения (WB API возвращает текстовые статусы)
    if (status !== 'all') {
      let statusFilter: string[] = [];
      switch (status) {
        case 'draft':
          statusFilter = ['Черновик']; // Черновик
          break;
        case 'active':
          statusFilter = ['Не запланировано']; // Не запланировано
          break;
        case 'closed':
          statusFilter = ['Принято', 'Отгрузка разрешена']; // Закрытые статусы
          break;
      }
      
      if (statusFilter.length > 0) {
        const beforeFilter = supplies.length;
        supplies = supplies.filter(supply => statusFilter.includes(supply.status));
        console.log(`🔍 Фильтрация по статусам ${statusFilter}: ${beforeFilter} → ${supplies.length}`);
      }
    }

    console.log(`✅ Успешно получено поставок: ${supplies.length}`);

    // Возвращаем структурированный JSON ответ
    return NextResponse.json({
      success: true,
      data: {
        supplies,
        pagination: {
          limit,
          offset,
          total: supplies.length,
          hasMore: supplies.length === limit, // Предполагаем, что есть еще, если получили полный лимит
        },
      },
      message: `Found ${supplies.length} supplies`,
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
        details: error instanceof Error ? error.message : 'Unknown error',
        supplies: [],
        pagination: {
          limit: 50,
          offset: 0,
          total: 0,
          hasMore: false,
        }
      },
      { status: 500 }
    );
  }
}
