import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createTokenSchema } from '@/lib/validation';
import { encrypt, maskToken } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const tokens = await prisma.userToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Mask tokens for security
    const maskedTokens = tokens.map(token => ({
      ...token,
      tokenEncrypted: maskToken(token.tokenEncrypted),
    }));

    return NextResponse.json({
      success: true,
      data: { tokens: maskedTokens },
    });
  } catch (error) {
    console.error('Get tokens error:', error);
    
    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = createTokenSchema.parse(body);

    // Check if token for this category already exists
    const existingToken = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        category: validatedData.category,
      },
    });

    if (existingToken) {
      return NextResponse.json(
        { success: false, error: 'Token for this category already exists' },
        { status: 409 }
      );
    }

    // Encrypt token
    const encryptedToken = encrypt(validatedData.token);

    // Create token
    const token = await prisma.userToken.create({
      data: {
        userId: user.id,
        category: validatedData.category,
        tokenEncrypted: encryptedToken,
      },
    });

    return NextResponse.json({
      success: true,
      data: { 
        token: {
          ...token,
          tokenEncrypted: maskToken(token.tokenEncrypted),
        }
      },
      message: 'Token created successfully',
    });
  } catch (error) {
    console.error('Create token error:', error);

    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

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
