import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSessionMirrorService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    if (!body?.type) {
      return NextResponse.json(
        { success: false, error: 'event type is required' },
        { status: 400 }
      );
    }

    const service = getSessionMirrorService();
    const timestamp = body.timestamp ?? new Date().toISOString();

    switch (body.type) {
      case 'HEARTBEAT':
        await service.recordHeartbeat(user.id, timestamp);
        break;
      case 'SESSION_EXTENDED':
        await service.markExtended(user.id, body.expiresAt);
        break;
      case 'USER_REAUTH_REQUIRED':
        await service.requireReauth(user.id, body.reason);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported event type: ${body.type}` },
          { status: 400 }
        );
    }

    const snapshot = await service.getSessionSnapshot(user.id);

    return NextResponse.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Session mirror event error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

