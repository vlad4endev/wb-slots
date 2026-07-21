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
    console.log('🔑 Начало создания токена...');
    
    const user = await requireAuth(request);
    console.log(`👤 Пользователь аутентифицирован: ${user.email} (${user.id})`);
    
    const body = await request.json();
    console.log('📥 Получены данные:', { 
      category: body.category, 
      tokenLength: body.token?.length || 0,
      hasToken: !!body.token 
    });
    
    const validatedData = createTokenSchema.parse(body);
    console.log('✅ Данные валидированы:', { 
      category: validatedData.category, 
      tokenLength: validatedData.token.length 
    });

    // Check if token for this category already exists
    console.log(`🔍 Проверяем существующие токены для категории: ${validatedData.category}`);
    const existingToken = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        category: validatedData.category,
      },
    });

    if (existingToken) {
      console.log(`⚠️ Токен для категории ${validatedData.category} уже существует`);
      return NextResponse.json(
        { success: false, error: 'Token for this category already exists' },
        { status: 409 }
      );
    }

    // Encrypt token
    console.log('🔐 Шифруем токен...');
    const encryptedToken = encrypt(validatedData.token);
    console.log(`✅ Токен зашифрован, длина: ${encryptedToken.length}`);

    // Create token
    console.log('💾 Сохраняем токен в базу данных...');
    const token = await prisma.userToken.create({
      data: {
        userId: user.id,
        category: validatedData.category,
        tokenEncrypted: encryptedToken,
      },
    });

    console.log(`✅ Токен создан успешно: ID ${token.id}`);

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
    console.error('❌ Create token error:', error);

    // Проверяем, является ли ошибка ошибкой аутентификации
    if (error instanceof Error && error.name === 'AuthError') {
      console.log('🔒 Ошибка аутентификации');
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      console.log('📝 Ошибка валидации:', error.message);
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }

    console.log('💥 Внутренняя ошибка сервера');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
