import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { autoBookingService } from '@/lib/auto-booking/auto-booking-service';
import { BookingParams } from '@/lib/auto-booking/config';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const {
      taskId,
      supplyId,
      slotFilters,
      credentials,
      config = {},
    } = body;

    // Validate required fields
    if (!taskId || !supplyId || !slotFilters) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: taskId, supplyId, slotFilters' 
        },
        { status: 400 }
      );
    }

    // Validate slot filters
    const requiredFilterFields = ['warehouseIds', 'boxTypeIds', 'coefficientMin', 'coefficientMax', 'dateFrom', 'dateTo'];
    const missingFields = requiredFilterFields.filter(field => !slotFilters[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing slot filter fields: ${missingFields.join(', ')}` 
        },
        { status: 400 }
      );
    }

    console.log(`📦 Creating auto-booking task for user ${user.id}`, {
      taskId,
      supplyId,
      slotFilters,
      hasCredentials: !!credentials,
    });

    // Create booking task
    const bookingTaskId = await autoBookingService.createBookingTask(
      user.id,
      taskId,
      supplyId,
      slotFilters,
      credentials,
      config
    );

    return NextResponse.json({
      success: true,
      data: {
        bookingTaskId,
        status: 'pending',
        message: 'Auto-booking task created successfully',
      },
    });

  } catch (error) {
    console.error('Auto-booking creation error:', error);
    
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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');

    console.log(`📋 Getting auto-booking tasks for user ${user.id}`, { taskId, status });

    let tasks;
    
    if (taskId) {
      tasks = await autoBookingService.getBookingTasksByTask(taskId);
    } else {
      tasks = await autoBookingService.getBookingTasksByUser(user.id);
    }

    // Filter by status if provided
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }

    // Sort by creation date (newest first)
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      success: true,
      data: {
        tasks: tasks.map(task => ({
          id: task.id,
          taskId: task.taskId,
          supplyId: task.supplyId,
          status: task.status,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          result: task.result ? {
            success: task.result.success,
            bookingId: task.result.bookingId,
            error: task.result.error,
            executionTime: task.result.executionTime,
            screenshotsCount: task.result.screenshots?.length || 0,
            logsCount: task.result.logs?.length || 0,
          } : null,
        })),
        stats: autoBookingService.getStats(),
      },
    });

  } catch (error) {
    console.error('Get auto-booking tasks error:', error);
    
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
