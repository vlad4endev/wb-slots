import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    console.log('🔍 Проверка токенов пользователя:', user.id);
    
    // Получаем все токены пользователя
    const tokens = await prisma.userToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Найдено токенов: ${tokens.length}`);
    
    const tokenStatus = [];
    
    for (const token of tokens) {
      const status = {
        id: token.id,
        category: token.category,
        isActive: token.isActive,
        createdAt: token.createdAt,
        tokenLength: token.tokenEncrypted?.length || 0,
        tokenPreview: token.tokenEncrypted?.substring(0, 50) + '...' || 'undefined',
        decryptionStatus: 'unknown',
        decryptionError: null as string | null,
        decryptedLength: 0
      };
      
      try {
        console.log(`🔓 Проверяем токен ${token.id} (${token.category})...`);
        const decrypted = decrypt(token.tokenEncrypted);
        status.decryptionStatus = 'success';
        status.decryptedLength = decrypted.length;
        console.log(`✅ Токен ${token.id} расшифрован успешно, длина: ${decrypted.length}`);
        
        // Проверяем, является ли токен валидным WB токеном
        if (decrypted === 'YOUR_WB_API_TOKEN_HERE' || decrypted.length < 10) {
          status.decryptionStatus = 'invalid';
          status.decryptionError = 'Token appears to be placeholder or invalid';
        }
      } catch (error) {
        status.decryptionStatus = 'failed';
        status.decryptionError = error instanceof Error ? error.message : String(error);
        console.error(`❌ Ошибка расшифровки токена ${token.id}:`, error);
      }
      
      tokenStatus.push(status);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        totalTokens: tokens.length,
        tokens: tokenStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки токенов:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { tokenId, newToken } = body;
    
    if (!tokenId || !newToken) {
      return NextResponse.json({
        success: false,
        error: 'Token ID and new token are required'
      }, { status: 400 });
    }
    
    console.log('🔄 Обновление токена:', { tokenId, userId: user.id });
    
    // Шифруем новый токен
    const encryptedToken = encrypt(newToken);
    console.log('🔐 Новый токен зашифрован');
    
    // Обновляем токен в базе данных
    const updatedToken = await prisma.userToken.update({
      where: { 
        id: tokenId,
        userId: user.id // Проверяем, что токен принадлежит пользователю
      },
      data: {
        tokenEncrypted: encryptedToken,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Токен обновлен:', updatedToken.id);
    
    return NextResponse.json({
      success: true,
      data: {
        tokenId: updatedToken.id,
        category: updatedToken.category,
        isActive: updatedToken.isActive,
        updatedAt: updatedToken.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления токена:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}
