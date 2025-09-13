import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { TaskScheduler } from '@/lib/scheduler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;

    // Check if task exists and belongs to user
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
      },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    if (!task.enabled) {
      return NextResponse.json(
        { success: false, error: 'Task is disabled' },
        { status: 400 }
      );
    }

    // Run task immediately
    const scheduler = TaskScheduler.getInstance();
    const runId = await scheduler.runTaskNow(taskId, user.id);

    return NextResponse.json({
      success: true,
      data: { runId },
      message: 'Task queued for immediate execution',
    });
  } catch (error) {
    console.error('Run task error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
