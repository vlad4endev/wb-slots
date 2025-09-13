import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: runId } = await params;

    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        task: true,
      },
    });

    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Запуск не найден' },
        { status: 404 }
      );
    }

    if (run.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // Удаляем Run запись и все связанные логи (каскадное удаление)
    await prisma.run.delete({
      where: { id: runId },
    });

    return NextResponse.json({
      success: true,
      message: 'Событие успешно удалено',
    });
  } catch (error) {
    console.error('Delete run error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
