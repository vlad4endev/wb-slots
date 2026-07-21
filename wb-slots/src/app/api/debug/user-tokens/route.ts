import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    console.log(`🔍 Проверка токенов для пользователя: ${user.id}`);
    
    // Получаем все токены пользователя
    const userTokens = await prisma.userToken.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        category: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`📋 Найдено токенов: ${userTokens.length}`);
    
    // Проверяем наличие токена MARKETPLACE
    const marketplaceToken = userTokens.find(t => t.category === 'MARKETPLACE');
    
    const result = {
      userId: user.id,
      userEmail: user.email,
      totalTokens: userTokens.length,
      hasMarketplaceToken: !!marketplaceToken,
      marketplaceTokenInfo: marketplaceToken ? {
        id: marketplaceToken.id,
        isActive: marketplaceToken.isActive,
        createdAt: marketplaceToken.createdAt,
        lastUsedAt: marketplaceToken.lastUsedAt,
        updatedAt: marketplaceToken.updatedAt,
      } : null,
      allTokens: userTokens.map(token => ({
        category: token.category,
        isActive: token.isActive,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
      })),
    };
    
    console.log('📊 Результат проверки токенов:', {
      totalTokens: result.totalTokens,
      hasMarketplaceToken: result.hasMarketplaceToken,
      categories: result.allTokens.map(t => t.category),
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      message: result.hasMarketplaceToken 
        ? 'Токен MARKETPLACE найден - можно получать склады из API'
        : 'Токен MARKETPLACE не найден - будут использоваться fallback данные',
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки токенов:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка проверки токенов пользователя',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
