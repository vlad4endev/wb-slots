import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logging';

// Отключаем prerendering для этого API route
export const dynamic = 'force-dynamic';

export async function PATCH(
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
    const { enabled } = body;

    // In real implementation, this would update the rule in the database
    // For now, we'll just return a success response
    
    logger.info({ ruleId: id, enabled, userId: user.id }, `Rule ${enabled ? 'enabled' : 'disabled'}`);

    return NextResponse.json({
      success: true,
      message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    const resolvedParams = await params;
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      ruleId: resolvedParams.id
    }, 'Update rule API error');
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    );
  }
}
