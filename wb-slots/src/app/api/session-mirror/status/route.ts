import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSessionMirrorService } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const service = getSessionMirrorService();
    const snapshot = await service.getSessionSnapshot(user.id);

    return NextResponse.json({
      success: true,
      data: snapshot ?? {
        userId: user.id,
        status: 'STALE',
        isAuthorized: false,
        message: 'Session mirror snapshot not found'
      }
    });
  } catch (error) {
    console.error('Session mirror status error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

