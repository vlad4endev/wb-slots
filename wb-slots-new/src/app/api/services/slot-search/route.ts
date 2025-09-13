import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { slotSearchService } from '@/lib/services/slot-search-service';
import { z } from 'zod';

const slotSearchSchema = z.object({
  taskId: z.string(),
  warehouseIds: z.array(z.number()),
  boxTypeIds: z.array(z.number()),
  coefficientMin: z.number().default(0),
  coefficientMax: z.number().default(0),
  dateFrom: z.string(),
  dateTo: z.string(),
  stopOnFirstFound: z.boolean().default(true),
  isSortingCenter: z.boolean().default(false),
  maxSearchCycles: z.number().default(10),
  searchDelay: z.number().default(10000),
  maxExecutionTime: z.number().default(3 * 24 * 60 * 60 * 1000),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = slotSearchSchema.parse(body);

    // Проверяем, не запущен ли уже поиск
    if (slotSearchService.isSearchInProgress()) {
      return NextResponse.json({
        success: false,
        error: 'Поиск уже запущен',
      }, { status: 409 });
    }

    // Создаем конфигурацию поиска
    const searchConfig = {
      ...validatedData,
      userId: user.id,
    };

    // Запускаем поиск
    const result = await slotSearchService.startSearch(searchConfig);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Поиск слотов завершен',
    });

  } catch (error) {
    console.error('Slot search API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    return NextResponse.json({
      success: true,
      data: {
        isSearchInProgress: slotSearchService.isSearchInProgress(),
        isStopRequested: slotSearchService.isStopRequested(),
      },
    });

  } catch (error) {
    console.error('Slot search status API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Останавливаем поиск
    await slotSearchService.stopSearch();

    return NextResponse.json({
      success: true,
      message: 'Поиск остановлен',
    });

  } catch (error) {
    console.error('Stop slot search API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
