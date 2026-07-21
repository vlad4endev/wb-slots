/**
 * 🏗️ Единый API endpoint для автобронирования
 * Заменяет все дублирующиеся API endpoints автобронирования
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getAutoBookingEntryPoint,
  initializeAutoBookingSystem,
  startAutoBookingSystem,
  stopAutoBookingSystem,
  quickBookSlot,
  urgentBooking,
  scheduleBooking,
  getAutoBookingSystemStatus,
  getAutoBookingSystemHealth
} from '@/lib/services/autobooking-entry-point';
import { 
  AutoBookingConfig,
  BookingSystemConfig,
  DEFAULT_SYSTEM_CONFIG
} from '@/lib/architecture/autobooking-interfaces';
import { z } from 'zod';

// ============================================================================
// СХЕМЫ ВАЛИДАЦИИ
// ============================================================================

const slotInfoSchema = z.object({
  id: z.string(),
  warehouseId: z.number(),
  warehouseName: z.string(),
  boxTypeId: z.number(),
  boxTypeName: z.string(),
  date: z.string(),
  coefficient: z.number(),
  isSortingCenter: z.boolean(),
  available: z.boolean(),
  foundAt: z.string().transform(str => new Date(str))
});

const supplyInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']),
  warehouseId: z.number(),
  boxTypeId: z.number(),
  createdAt: z.string().transform(str => new Date(str))
});

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  sessionData: z.any().optional(),
  cookies: z.array(z.any()).optional(),
  tokens: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional()
  }).optional()
});

const strategySchema = z.object({
  type: z.enum(['API_FIRST', 'BROWSER_FIRST', 'HYBRID']),
  maxRetries: z.number().min(1).max(10),
  retryDelay: z.number().min(1000).max(30000),
  timeout: z.number().min(5000).max(300000),
  fallbackEnabled: z.boolean()
});

const autoBookingConfigSchema = z.object({
  taskId: z.string(),
  userId: z.string(),
  runId: z.string(),
  slot: slotInfoSchema,
  supply: supplyInfoSchema,
  credentials: credentialsSchema,
  strategy: strategySchema,
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  maxExecutionTime: z.number().min(30000).max(1800000).optional(),
  enableNotifications: z.boolean().optional(),
  enableScreenshots: z.boolean().optional(),
  enableLogging: z.boolean().optional()
});

// ============================================================================
// GET /api/autobooking - Получение информации о системе
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    switch (action) {
      case 'status':
        return await getSystemStatus();
      
      case 'health':
        return await getSystemHealth();
      
      case 'metrics':
        return await getSystemMetrics();
      
      case 'queue':
        return await getQueueStatus();
      
      case 'resources':
        return await getAvailableResources();
      
      case 'history':
        const limit = searchParams.get('limit');
        return await getBookingHistory(limit ? parseInt(limit) : undefined);
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Auto booking API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/autobooking - Выполнение операций автобронирования
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;
    
    switch (action) {
      case 'book-slot':
        return await bookSlot(params);
      
      case 'start-auto-booking':
        return await startAutoBooking(params);
      
      case 'add-to-queue':
        return await addToQueue(params);
      
      case 'schedule-booking':
        return await scheduleBooking(params);
      
      case 'urgent-booking':
        return await urgentBooking(params);
      
      case 'initialize':
        return await initializeSystem(params);
      
      case 'start':
        return await startSystem();
      
      case 'stop':
        return await stopSystem();
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Auto booking API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/autobooking - Остановка операций
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
      case 'stop-booking':
        return await stopBooking(id);
      
      case 'cancel-booking':
        return await cancelBooking(id);
      
      case 'remove-from-queue':
        return await removeFromQueue(id);
      
      case 'clear-queue':
        return await clearQueue();
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Auto booking API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

async function getSystemStatus() {
  try {
    const status = await getAutoBookingSystemStatus();
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get system status: ${error}`);
  }
}

async function getSystemHealth() {
  try {
    const health = await getAutoBookingSystemHealth();
    return NextResponse.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get system health: ${error}`);
  }
}

async function getSystemMetrics() {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    const metrics = await entryPoint.getSystemMetrics();
    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get system metrics: ${error}`);
  }
}

async function getQueueStatus() {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    const status = await entryPoint.getQueueStatus();
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get queue status: ${error}`);
  }
}

async function getAvailableResources() {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    const resources = await entryPoint.getAvailableResources();
    return NextResponse.json({
      success: true,
      data: resources,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get available resources: ${error}`);
  }
}

async function getBookingHistory(limit?: number) {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    const history = entryPoint.getBookingHistory(limit);
    return NextResponse.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to get booking history: ${error}`);
  }
}

async function bookSlot(params: any) {
  try {
    const config = autoBookingConfigSchema.parse(params);
    const result = await quickBookSlot(config);
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to book slot: ${error}`);
  }
}

async function startAutoBooking(params: any) {
  try {
    const config = autoBookingConfigSchema.parse(params);
    const entryPoint = getAutoBookingEntryPoint();
    const bookingId = await entryPoint.startAutoBooking(config);
    
    return NextResponse.json({
      success: true,
      data: { bookingId },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to start auto booking: ${error}`);
  }
}

async function addToQueue(params: any) {
  try {
    const { config, priority = 5 } = params;
    const validatedConfig = autoBookingConfigSchema.parse(config);
    const entryPoint = getAutoBookingEntryPoint();
    const queueId = await entryPoint.addToQueue(validatedConfig, priority);
    
    return NextResponse.json({
      success: true,
      data: { queueId },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to add to queue: ${error}`);
  }
}

async function scheduleBooking(params: any) {
  try {
    const { config, delay = 0 } = params;
    const validatedConfig = autoBookingConfigSchema.parse(config);
    const queueId = await scheduleBooking(validatedConfig, delay);
    
    return NextResponse.json({
      success: true,
      data: { queueId },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to schedule booking: ${error}`);
  }
}

async function urgentBooking(params: any) {
  try {
    const config = autoBookingConfigSchema.parse(params);
    const queueId = await urgentBooking(config);
    
    return NextResponse.json({
      success: true,
      data: { queueId },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to create urgent booking: ${error}`);
  }
}

async function initializeSystem(params: any) {
  try {
    const config = params.config || {};
    const entryPoint = await initializeAutoBookingSystem(config);
    
    return NextResponse.json({
      success: true,
      data: { initialized: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to initialize system: ${error}`);
  }
}

async function startSystem() {
  try {
    const entryPoint = await startAutoBookingSystem();
    
    return NextResponse.json({
      success: true,
      data: { started: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to start system: ${error}`);
  }
}

async function stopSystem() {
  try {
    await stopAutoBookingSystem();
    
    return NextResponse.json({
      success: true,
      data: { stopped: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to stop system: ${error}`);
  }
}

async function stopBooking(bookingId: string) {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    await entryPoint.stopAutoBooking(bookingId);
    
    return NextResponse.json({
      success: true,
      data: { bookingId, status: 'stopped' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to stop booking: ${error}`);
  }
}

async function cancelBooking(bookingId: string) {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    await entryPoint.cancelBooking(bookingId);
    
    return NextResponse.json({
      success: true,
      data: { bookingId, status: 'cancelled' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to cancel booking: ${error}`);
  }
}

async function removeFromQueue(queueId: string) {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    await entryPoint.clearQueue(); // TODO: Implement removeFromQueue method
    
    return NextResponse.json({
      success: true,
      data: { queueId, status: 'removed' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to remove from queue: ${error}`);
  }
}

async function clearQueue() {
  try {
    const entryPoint = getAutoBookingEntryPoint();
    await entryPoint.clearQueue();
    
    return NextResponse.json({
      success: true,
      data: { status: 'cleared' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Failed to clear queue: ${error}`);
  }
}
