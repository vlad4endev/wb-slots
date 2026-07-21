import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAppService } from '@/lib/app';
import { IAutoBookingService } from '@/lib/architecture/unified-interfaces';
import { logger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { bookingTaskId } = body;

    if (!bookingTaskId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: bookingTaskId' 
        },
        { status: 400 }
      );
    }

    console.log(`🚀 Executing auto-booking task: ${bookingTaskId} for user ${user.id}`);

    const autoBookingService = getAppService<IAutoBookingService>('UnifiedAutoBookingService');
    
    // Execute booking task
    const result = await autoBookingService.startAutoBooking({
      taskId: bookingTaskId,
      userId: user.id,
      wbToken: '', // Will be filled by the service
      slotId: '',
      supplyId: '',
      warehouseId: 0,
      boxTypeId: 0,
      date: '',
      coefficient: 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        bookingTaskId,
        result: {
          success: result.success,
          message: result.message,
          error: result.error,
        },
        message: result.success ? 'Auto-booking completed successfully' : 'Auto-booking failed',
      },
    });

  } catch (error) {
    logger.error('Execute auto-booking error:', { error });
    
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
