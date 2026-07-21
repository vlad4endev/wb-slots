// ===== EXAMPLE: REFACTORED API ENDPOINT =====

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createApiHandler } from '@/lib/errors';
import { z } from 'zod';

const exampleSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// ===== BEFORE: Дублирование обработки ошибок =====
/*
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = exampleSchema.parse(body);

    // Бизнес-логика
    const result = await someBusinessLogic(validatedData);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('API error:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
*/

// ===== AFTER: Единая обработка ошибок =====
const postHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);
  const body = await request.json();
  const validatedData = exampleSchema.parse(body);

  // Бизнес-логика
  const result = await someBusinessLogic(validatedData);

  return NextResponse.json({
    success: true,
    data: result,
  });
};

export const POST = createApiHandler(postHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: 'example',
    method: 'POST'
  })
});

// ===== MOCK BUSINESS LOGIC =====
async function someBusinessLogic(data: { name: string; email: string }) {
  // Имитация бизнес-логики
  return {
    id: Date.now(),
    ...data,
    createdAt: new Date().toISOString()
  };
}
