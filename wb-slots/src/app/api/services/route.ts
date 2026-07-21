/**
 * 🏗️ API для управления унифицированными сервисами
 * Единая точка входа для всех операций с сервисами
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getApp, 
  getAppStatus, 
  getAppHealth,
  getAppService 
} from '@/lib/app';
import { 
  getService,
  checkServicesHealth,
  getAllServicesMetrics,
  getAllServicesStatus 
} from '@/lib/services';

// ============================================================================
// GET /api/services - Получение информации о сервисах
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    switch (action) {
      case 'status':
        return await getServicesStatus();
      
      case 'health':
        return await getServicesHealth();
      
      case 'metrics':
        return await getServicesMetrics();
      
      case 'app-status':
        return await getApplicationStatus();
      
      case 'app-health':
        return await getApplicationHealth();
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Services API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/services - Выполнение операций с сервисами
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, service, ...params } = body;
    
    switch (action) {
      case 'search-slots':
        return await searchSlots(params);
      
      case 'book-slot':
        return await bookSlot(params);
      
      case 'send-notification':
        return await sendNotification(params);
      
      case 'create-wb-client':
        return await createWBClient(params);
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Services API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/services - Остановка операций
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    
    if (!action || !id) {
      return NextResponse.json(
        { success: false, error: 'Action and ID are required' },
        { status: 400 }
      );
    }
    
    switch (action) {
      case 'stop-search':
        return await stopSearch(id);
      
      case 'stop-booking':
        return await stopBooking(id);
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Services API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

async function getServicesStatus() {
  try {
    const status = await getAllServicesStatus();
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get services status: ${error}`);
  }
}

async function getServicesHealth() {
  try {
    const health = await checkServicesHealth();
    return NextResponse.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get services health: ${error}`);
  }
}

async function getServicesMetrics() {
  try {
    const metrics = await getAllServicesMetrics();
    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get services metrics: ${error}`);
  }
}

async function getApplicationStatus() {
  try {
    const status = await getAppStatus();
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get application status: ${error}`);
  }
}

async function getApplicationHealth() {
  try {
    const health = await getAppHealth();
    return NextResponse.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get application health: ${error}`);
  }
}

async function searchSlots(params: any) {
  try {
    const slotSearchService = getAppService('slotSearch');
    const result = await slotSearchService.searchSlots(params);
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to search slots: ${error}`);
  }
}

async function bookSlot(params: any) {
  try {
    const autoBookingService = getAppService('autoBooking');
    const result = await autoBookingService.bookSlot(params);
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to book slot: ${error}`);
  }
}

async function sendNotification(params: any) {
  try {
    const notificationService = getAppService('notifications');
    const result = await notificationService.sendNotification(params.userId, params.message);
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to send notification: ${error}`);
  }
}

async function createWBClient(params: any) {
  try {
    const { createWBAPIClientForUser } = await import('@/lib/services');
    const client = await createWBAPIClientForUser(params.userId, params.token, params.category);
    
    return NextResponse.json({
      success: true,
      data: {
        clientId: `client_${Date.now()}`,
        category: params.category,
        status: 'active'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to create WB client: ${error}`);
  }
}

async function stopSearch(searchId: string) {
  try {
    const slotSearchService = getAppService('slotSearch');
    await slotSearchService.stopContinuousSearch(searchId);
    
    return NextResponse.json({
      success: true,
      data: { searchId, status: 'stopped' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to stop search: ${error}`);
  }
}

async function stopBooking(bookingId: string) {
  try {
    const autoBookingService = getAppService('autoBooking');
    await autoBookingService.stopAutoBooking(bookingId);
    
    return NextResponse.json({
      success: true,
      data: { bookingId, status: 'stopped' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to stop booking: ${error}`);
  }
}
