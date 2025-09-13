import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    // Создаем тестовый токен SUPPLIES
    const testToken = 'test-supplies-token-12345';
    const encryptedToken = encrypt(testToken);
    
    // Удаляем существующие токены SUPPLIES
    await prisma.userToken.deleteMany({
      where: {
        userId: user.id,
        category: 'SUPPLIES'
      }
    });
    
    // Создаем новый токен
    const token = await prisma.userToken.create({
      data: {
        userId: user.id,
        category: 'SUPPLIES',
        tokenEncrypted: encryptedToken,
        isActive: true,
        lastUsedAt: new Date()
      }
    });
    
    return NextResponse.json({
      success: true,
      data: { token },
      message: 'Test SUPPLIES token created successfully'
    });
    
  } catch (error) {
    console.error('Add test token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create test token' },
      { status: 500 }
    );
  }
}
