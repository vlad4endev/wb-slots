import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { autoBookingService } from '@/lib/auto-booking/auto-booking-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: bookingTaskId } = await params;

    console.log(`📋 Getting auto-booking task: ${bookingTaskId} for user ${user.id}`);

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

    return NextResponse.json({
      success: true,
      data: {
        id: task.id,
        taskId: task.taskId,
        supplyId: task.supplyId,
        slotFilters: task.slotFilters,
        status: task.status,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        result: task.result ? {
          success: task.result.success,
          bookingId: task.result.bookingId,
          error: task.result.error,
          executionTime: task.result.executionTime,
          screenshots: task.result.screenshots,
          logs: task.result.logs,
        } : null,
      },
    });

  } catch (error) {
    console.error('Get auto-booking task error:', error);
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: bookingTaskId } = await params;

    console.log(`🛑 Cancelling auto-booking task: ${bookingTaskId} for user ${user.id}`);

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

    const cancelled = await autoBookingService.cancelBookingTask(bookingTaskId);

    if (!cancelled) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to cancel task' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingTaskId,
        status: 'cancelled',
        message: 'Auto-booking task cancelled successfully',
      },
    });

  } catch (error) {
    console.error('Cancel auto-booking task error:', error);
    
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
