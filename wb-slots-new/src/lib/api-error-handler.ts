import { NextResponse } from 'next/server';
import { AuthError } from './auth';

export function handleApiError(error: unknown, context: string = 'API') {
  console.error(`${context} error:`, error);

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

  // Проверяем, является ли ошибка ошибкой доступа
  if (error instanceof Error && error.name === 'AuthError' && (error as AuthError).statusCode === 403) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  // Обрабатываем все остальные ошибки как внутренние ошибки сервера
  return NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  );
}

export function handleApiErrorWithDetails(error: unknown, context: string = 'API', customMessage?: string) {
  console.error(`${context} error:`, error);

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

  // Проверяем, является ли ошибка ошибкой доступа
  if (error instanceof Error && error.name === 'AuthError' && (error as AuthError).statusCode === 403) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  // Обрабатываем все остальные ошибки как внутренние ошибки сервера
  return NextResponse.json(
    { success: false, error: customMessage || 'Internal server error' },
    { status: 500 }
  );
}
