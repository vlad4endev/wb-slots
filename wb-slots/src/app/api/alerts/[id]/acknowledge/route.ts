import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logging';

// Отключаем prerendering для этого API route
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    // In real implementation, this would update the alert in the database
    // For now, we'll just return a success response
    
    logger.info({ alertId: id, userId: userId || user.id }, 'Alert acknowledged');

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error) {
    const resolvedParams = await params;
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      alertId: resolvedParams.id
    }, 'Acknowledge alert API error');
    return NextResponse.json(
      { error: 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
