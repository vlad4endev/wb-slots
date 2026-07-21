import { NextRequest, NextResponse } from 'next/server';
import { advancedAuthManager } from '@/lib/auth/advanced-auth-manager';
import { advancedWBAuthService } from '@/lib/auth/advanced-wb-auth-service';
import { Logger } from '@/lib/logging/logger';

const logger = new Logger('INFO', { service: 'AdvancedAuthAPI' });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, config } = body;

    logger.info('🔐 Advanced auth API request', { action, userId });

    switch (action) {
      case 'create-session':
        return await handleCreateSession(request, body);
      
      case 'validate-session':
        return await handleValidateSession(request, body);
      
      case 'start-wb-auth':
        return await handleStartWBAuth(request, body);
      
      case 'force-save-wb-session':
        return await handleForceSaveWBSession(request, body);
      
      case 'close-wb-auth':
        return await handleCloseWBAuth(request, body);
      
      case 'get-security-stats':
        return await handleGetSecurityStats(request, body);
      
      case 'terminate-sessions':
        return await handleTerminateSessions(request, body);
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('❌ Advanced auth API error', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    logger.info('🔍 Advanced auth API GET request', { action, userId });

    switch (action) {
      case 'session-status':
        return await handleGetSessionStatus(request, userId!);
      
      case 'wb-auth-status':
        return await handleGetWBAuthStatus(request);
      
      case 'security-events':
        return await handleGetSecurityEvents(request, userId!);
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('❌ Advanced auth API GET error', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

// ===== HANDLERS =====

async function handleCreateSession(request: NextRequest, body: any) {
  try {
    const { userId, sessionData } = body;

    if (!userId || !sessionData) {
      return NextResponse.json({
        success: false,
        error: 'userId and sessionData are required'
      }, { status: 400 });
    }

    const session = await advancedAuthManager.createSession(userId, sessionData, request);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
        securityLevel: 'HIGH',
      },
      message: 'Session created successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to create session', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleValidateSession(request: NextRequest, body: any) {
  try {
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId is required'
      }, { status: 400 });
    }

    // Сначала нужно найти сессию по sessionId
    const { prisma } = await import('@/lib/prisma');
    const dbSession = await prisma.authSession.findUnique({
      where: { sessionId, isActive: true },
    });

    if (!dbSession) {
      return NextResponse.json({
        success: false,
        error: 'Session not found or expired'
      }, { status: 401 });
    }

    // Проверяем срок действия
    if (dbSession.expiresAt < new Date()) {
      await prisma.authSession.update({
        where: { id: dbSession.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: false,
        error: 'Session expired'
      }, { status: 401 });
    }

    // Обновляем время последнего использования
    await prisma.authSession.update({
      where: { id: dbSession.id },
      data: { lastUsedAt: new Date() },
    });

    const session = {
      id: dbSession.id,
      userId: dbSession.userId,
      sessionId: dbSession.sessionId,
      isActive: dbSession.isActive,
      expiresAt: dbSession.expiresAt,
      lastUsedAt: new Date(),
      ipAddress: dbSession.ipAddress,
      userAgent: dbSession.userAgent,
      deviceFingerprint: dbSession.deviceFingerprint,
      location: dbSession.location ? JSON.parse(dbSession.location) : undefined,
      metadata: dbSession.metadata ? JSON.parse(dbSession.metadata) : undefined,
    };


    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        userId: session.userId,
        expiresAt: session.expiresAt,
        lastUsedAt: session.lastUsedAt,
        securityLevel: 'HIGH',
      },
      message: 'Session validated successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to validate session', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleStartWBAuth(request: NextRequest, body: any) {
  try {
    const { userId, config } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 });
    }

    // Проверяем, не запущен ли уже сервис
    if (advancedWBAuthService.isServiceActive()) {
      return NextResponse.json({
        success: false,
        error: 'WB Auth service is already active'
      }, { status: 409 });
    }

    const authConfig = {
      userId,
      headless: config?.headless ?? false,
      timeout: config?.timeout ?? 30000,
      enableAntiDetection: config?.enableAntiDetection ?? true,
      enableSessionMonitoring: config?.enableSessionMonitoring ?? true,
      enableAutoRefresh: config?.enableAutoRefresh ?? false,
      onProgress: (message: string) => {
        logger.info('📝 WB Auth progress', { userId, message });
      },
      onSuccess: (sessionData: any) => {
        logger.info('✅ WB Auth success', { userId, sessionData });
      },
      onError: (error: string) => {
        logger.error('❌ WB Auth error', { userId, error });
      },
      onSecurityAlert: (alert: any) => {
        logger.warn('🚨 WB Auth security alert', { userId, alert });
      },
    };

    const result = await advancedWBAuthService.startAdvancedAuth(authConfig);

    return NextResponse.json({
      success: result.success,
      data: {
        sessionId: result.sessionId,
        securityAlerts: result.securityAlerts,
        sessionData: result.sessionData,
      },
      error: result.error,
      message: result.success ? 'WB Auth started successfully' : 'WB Auth failed'
    });

  } catch (error) {
    logger.error('❌ Failed to start WB auth', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleForceSaveWBSession(request: NextRequest, body: any) {
  try {
    if (!advancedWBAuthService.isServiceActive()) {
      return NextResponse.json({
        success: false,
        error: 'WB Auth service is not active'
      }, { status: 400 });
    }

    const result = await advancedWBAuthService.forceSaveSession();

    return NextResponse.json({
      success: result.success,
      data: {
        sessionId: result.sessionId,
        sessionData: result.sessionData,
        securityAlerts: result.securityAlerts,
      },
      error: result.error,
      message: result.success ? 'WB session saved successfully' : 'Failed to save WB session'
    });

  } catch (error) {
    logger.error('❌ Failed to force save WB session', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleCloseWBAuth(request: NextRequest, body: any) {
  try {
    if (!advancedWBAuthService.isServiceActive()) {
      return NextResponse.json({
        success: false,
        error: 'WB Auth service is not active'
      }, { status: 400 });
    }

    await advancedWBAuthService.close();

    return NextResponse.json({
      success: true,
      message: 'WB Auth service closed successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to close WB auth', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleGetSecurityStats(request: NextRequest, body: any) {
  try {
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 });
    }

    const stats = await advancedAuthManager.getSecurityStats(userId);

    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Security stats retrieved successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to get security stats', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleTerminateSessions(request: NextRequest, body: any) {
  try {
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 });
    }

    await advancedAuthManager.terminateAllUserSessions(userId, reason);

    return NextResponse.json({
      success: true,
      message: 'All user sessions terminated successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to terminate sessions', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleGetSessionStatus(request: NextRequest, userId: string) {
  try {
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 });
    }

    const wbSession = await advancedAuthManager.getActiveWBSession(userId);

    return NextResponse.json({
      success: true,
      data: {
        hasActiveSession: !!wbSession,
        sessionId: wbSession?.sessionId,
        expiresAt: wbSession?.expiresAt,
        timestamp: wbSession?.timestamp,
      },
      message: 'Session status retrieved successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to get session status', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleGetWBAuthStatus(request: NextRequest) {
  try {
    const isActive = advancedWBAuthService.isServiceActive();
    const securityAlerts = advancedWBAuthService.getSecurityAlerts();
    const sessionMonitor = advancedWBAuthService.getSessionMonitor();

    return NextResponse.json({
      success: true,
      data: {
        isActive,
        securityAlerts,
        sessionMonitor,
      },
      message: 'WB Auth status retrieved successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to get WB auth status', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleGetSecurityEvents(request: NextRequest, userId: string) {
  try {
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 });
    }

    const { prisma } = await import('@/lib/prisma');
    
    const events = await prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: {
        events: events.map(event => ({
          id: event.id,
          type: event.type,
          sessionId: event.sessionId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          details: JSON.parse(event.details),
          timestamp: event.timestamp,
        })),
        total: events.length,
      },
      message: 'Security events retrieved successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to get security events', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
