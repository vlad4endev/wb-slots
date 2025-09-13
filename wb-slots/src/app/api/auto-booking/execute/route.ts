import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { autoBookingService } from '@/lib/auto-booking/auto-booking-service';

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

    // Check if task exists and belongs to user
    const task = await autoBookingService.getBookingTask(bookingTaskId);
    if (!task) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Booking task not found' 
        },
        { status: 404 }
      );
    }

    if (task.userId !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied' 
        },
        { status: 403 }
      );
    }

    if (task.status !== 'pending') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Task is not in pending status: ${task.status}` 
        },
        { status: 400 }
      );
    }

    // Execute booking task
    const result = await autoBookingService.executeBookingTask(bookingTaskId);

    return NextResponse.json({
      success: true,
      data: {
        bookingTaskId,
        result: {
          success: result.success,
          bookingId: result.bookingId,
          error: result.error,
          executionTime: result.executionTime,
          screenshots: result.screenshots,
          logs: result.logs,
        },
        message: result.success ? 'Auto-booking completed successfully' : 'Auto-booking failed',
      },
    });

  } catch (error) {
    console.error('Execute auto-booking error:', error);
    
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
