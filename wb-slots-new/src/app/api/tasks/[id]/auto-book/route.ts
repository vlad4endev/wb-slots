import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addJob } from '@/lib/queue';
import { z } from 'zod';

const autoBookSchema = z.object({
  wbCredentials: z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(1, 'Пароль обязателен'),
  }),
  maxBookingAttempts: z.number().int().min(1).max(10).default(3),
  bookingDelay: z.number().int().min(1000).max(30000).default(5000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: taskId } = await params;
    const body = await request.json();
    const validatedData = autoBookSchema.parse(body);

    // Проверяем существование задачи
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Задача не найдена' },
        { status: 404 }
      );
    }

    if (task.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      );
    }

    // Проверяем, что автобронирование включено
    if (!task.autoBook) {
      return NextResponse.json(
        { success: false, error: 'Автобронирование не включено для этой задачи' },
        { status: 400 }
      );
    }

    // Проверяем наличие ID поставки
    if (!task.autoBookSupplyId) {
      return NextResponse.json(
        { success: false, error: 'Не указан ID поставки для автобронирования' },
        { status: 400 }
      );
    }

    // Подготавливаем параметры поиска из фильтров задачи
    const searchParams = {
      warehouseIds: task.filters.warehouseIds || [],
      dateFrom: task.filters.dates?.from || new Date().toISOString(),
      dateTo: task.filters.dates?.to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      coefficientMin: task.filters.coefficientMin || 0,
      coefficientMax: task.filters.coefficientMax || 20,
      allowUnload: task.filters.allowUnload || true,
      boxTypeIds: task.filters.boxTypeIds || [5, 6],
      supplyId: task.autoBookSupplyId,
    };

    // Добавляем задачу в очередь автобронирования
    const job = await addJob('auto-booking', {
      taskId,
      userId: user.id,
      wbCredentials: validatedData.wbCredentials,
      searchParams,
      maxBookingAttempts: validatedData.maxBookingAttempts,
      bookingDelay: validatedData.bookingDelay,
      useSavedSession: true, // По умолчанию используем сохраненную сессию
    });

    return NextResponse.json({
      success: true,
      message: 'Задача автобронирования добавлена в очередь',
      data: {
        jobId: job.id,
        taskId,
        estimatedStartTime: new Date(Date.now() + 5000).toISOString(), // Примерно через 5 секунд
      },
    });

  } catch (error) {
    console.error('Auto-book error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Ошибка валидации данных' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
