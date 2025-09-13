import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId } = await params;

    // Находим задачу
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Проверяем, не закрыта ли задача
    if (task.status === 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Task is completed and cannot be restarted. Create a new task instead.' 
      }, { status: 400 });
    }

    // Активируем задачу
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { enabled: true }
    });

    return NextResponse.json({
      success: true,
      message: 'Task started successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error starting task:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
