import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Диагностический роут раньше не проверял авторизацию вообще и отдавал
    // список email/ролей всех пользователей любому анонимному запросу.
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied. Developer role required.' }, { status: 403 });
    }

    console.log('🔍 Checking database structure...');
    
    const results: any = {};
    
    // Check if botSettings table exists
    try {
      const botSettings = await prisma.botSettings.findMany();
      results.botSettings = {
        exists: true,
        count: botSettings.length,
        sample: botSettings.slice(0, 2)
      };
      console.log('✅ botSettings table exists, count:', botSettings.length);
    } catch (error) {
      results.botSettings = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log('❌ botSettings table does not exist:', error);
    }
    
    // Check if User table exists and get user info
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true
        }
      });
      results.users = {
        exists: true,
        count: users.length,
        sample: users.slice(0, 3)
      };
      console.log('✅ User table exists, count:', users.length);
    } catch (error) {
      results.users = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log('❌ User table does not exist:', error);
    }
    
    // Check if userToken table exists
    try {
      const userTokens = await prisma.userToken.findMany({
        select: {
          id: true,
          category: true,
          isActive: true,
          createdAt: true
        }
      });
      results.userTokens = {
        exists: true,
        count: userTokens.length,
        sample: userTokens.slice(0, 3)
      };
      console.log('✅ userToken table exists, count:', userTokens.length);
    } catch (error) {
      results.userTokens = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log('❌ userToken table does not exist:', error);
    }
    
    return NextResponse.json({
      success: true,
      database: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking database:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
