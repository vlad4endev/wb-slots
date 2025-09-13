import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, verifyPassword, hashPassword } from '@/lib/auth';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
  newPassword: z.string().min(8, 'Новый пароль должен содержать минимум 8 символов'),
  confirmPassword: z.string().min(1, 'Подтверждение пароля обязательно'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);

    // Получаем пользователя с хешем пароля
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true }
    });

    if (!userWithPassword) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await verifyPassword(
      validatedData.currentPassword,
      userWithPassword.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Неверный текущий пароль' },
        { status: 400 }
      );
    }

    // Хешируем новый пароль
    const newPasswordHash = await hashPassword(validatedData.newPassword);

    // Обновляем пароль
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash }
    });

    return NextResponse.json({
      success: true,
      message: 'Пароль успешно изменен'
    });

  } catch (error) {
    console.error('Change password error:', error);

    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Проверяем, является ли ошибка ошибкой валидации Zod
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
