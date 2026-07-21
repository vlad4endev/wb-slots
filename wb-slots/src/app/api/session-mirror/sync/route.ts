import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSessionMirrorService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const tokens = extractTokens(body);
    if (!tokens || Object.keys(tokens).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'tokens payload is required'
        },
        { status: 400 }
      );
    }

    const service = getSessionMirrorService();
    await service.ingestCookies(user.id, {
      tokens,
      timestamp: body.timestamp ?? new Date().toISOString(),
      fingerprint: body.fingerprint,
      expiresAt: body.expiresAt
    });

    const snapshot = await service.getSessionSnapshot(user.id);

    return NextResponse.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Session mirror sync error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

function extractTokens(body: any): Record<string, string> | null {
  if (body?.tokens && typeof body.tokens === 'object') {
    return body.tokens;
  }

  if (Array.isArray(body?.cookies)) {
    return body.cookies.reduce((acc: Record<string, string>, cookie: any) => {
      if (cookie?.name && cookie?.value) {
        acc[cookie.name] = cookie.value;
      }
      return acc;
    }, {});
  }

  return null;
}

