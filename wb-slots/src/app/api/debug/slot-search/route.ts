import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { WBClientFactory } from '@/lib/wb-client';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    const { warehouseIds, boxTypeIds, dateFrom, dateTo, coefficientMin, coefficientMax } = body;
    
    console.log('🧪 Debug slot search request:', {
      userId: user.id,
      warehouseIds,
      boxTypeIds,
      dateFrom,
      dateTo,
      coefficientMin,
      coefficientMax
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
      return NextResponse.json({
        success: false,
        error: 'No active SUPPLIES token found',
        details: {
          userId: user.id,
          availableTokens: await prisma.userToken.findMany({
            where: { userId: user.id },
            select: { category: true, isActive: true }
          })
        }
      }, { status: 400 });
    }

    // Расшифровываем токен
    const decryptedToken = decrypt(suppliesToken.tokenEncrypted);
    console.log('🔑 Token decrypted successfully');

    // Создаем WB клиент
    const wbClient = WBClientFactory.createSuppliesClient(decryptedToken);
    console.log('🌐 WB Client created');

    // Тестируем поиск слотов
    const startTime = Date.now();
    const searchResult = await wbClient.searchAvailableSlots(
      warehouseIds || [117866],
      boxTypeIds || [2],
      dateFrom || new Date().toISOString(),
      dateTo || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      coefficientMin || 0,
      true
    );
    const searchTime = Date.now() - startTime;

    console.log('✅ Search completed:', {
      foundSlots: searchResult.length,
      searchTime,
      result: searchResult
    });

    return NextResponse.json({
      success: true,
      data: {
        foundSlots: searchResult.length,
        searchTime,
        result: searchResult,
        config: {
          warehouseIds,
          boxTypeIds,
          dateFrom,
          dateTo,
          coefficientMin,
          coefficientMax
        },
        tokenInfo: {
          hasToken: !!suppliesToken,
          tokenCategory: suppliesToken.category,
          isActive: suppliesToken.isActive
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug slot search error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}
