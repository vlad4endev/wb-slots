import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logging';

// Отключаем prerendering для этого API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    // Mock performance metrics - in real implementation, these would come from actual system monitoring
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
        network: Math.random() * 100
      },
      application: {
        responseTime: Math.random() * 2000 + 100,
        throughput: Math.random() * 200 + 50,
        errorRate: Math.random() * 10,
        activeConnections: Math.floor(Math.random() * 100) + 10
      },
      database: {
        connectionPool: Math.random() * 100,
        queryTime: Math.random() * 500 + 10,
        cacheHitRate: Math.random() * 40 + 60,
        activeQueries: Math.floor(Math.random() * 50) + 5
      },
      external: {
        wbApiLatency: Math.random() * 3000 + 500,
        telegramLatency: Math.random() * 1000 + 100,
        redisLatency: Math.random() * 50 + 1,
        queueSize: Math.floor(Math.random() * 200) + 10
      }
    };

    // Generate alerts based on metrics
    const alerts = generateAlerts(metrics);

    return NextResponse.json({
      success: true,
      metrics,
      alerts
    });

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Performance monitoring API error');
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

function generateAlerts(metrics: any) {
  const alerts = [];

  // System alerts
  if (metrics.system.cpu > 90) {
    alerts.push({
      id: 'cpu-high',
      type: 'critical',
      message: 'Высокая загрузка CPU',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'CPU',
      value: metrics.system.cpu,
      threshold: 90
    });
  }

  if (metrics.system.memory > 95) {
    alerts.push({
      id: 'memory-high',
      type: 'critical',
      message: 'Критическое использование памяти',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'Memory',
      value: metrics.system.memory,
      threshold: 95
    });
  }

  // Application alerts
  if (metrics.application.responseTime > 2000) {
    alerts.push({
      id: 'response-time-high',
      type: 'warning',
      message: 'Медленное время ответа API',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'Response Time',
      value: metrics.application.responseTime,
      threshold: 2000
    });
  }

  if (metrics.application.errorRate > 5) {
    alerts.push({
      id: 'error-rate-high',
      type: 'warning',
      message: 'Высокий процент ошибок',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'Error Rate',
      value: metrics.application.errorRate,
      threshold: 5
    });
  }

  // Database alerts
  if (metrics.database.connectionPool > 90) {
    alerts.push({
      id: 'db-connections-high',
      type: 'warning',
      message: 'Высокое использование пула соединений БД',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'DB Connection Pool',
      value: metrics.database.connectionPool,
      threshold: 90
    });
  }

  if (metrics.database.queryTime > 500) {
    alerts.push({
      id: 'db-query-slow',
      type: 'warning',
      message: 'Медленные запросы к базе данных',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'DB Query Time',
      value: metrics.database.queryTime,
      threshold: 500
    });
  }

  // External service alerts
  if (metrics.external.wbApiLatency > 5000) {
    alerts.push({
      id: 'wb-api-slow',
      type: 'warning',
      message: 'Медленный ответ WB API',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'WB API Latency',
      value: metrics.external.wbApiLatency,
      threshold: 5000
    });
  }

  if (metrics.external.queueSize > 500) {
    alerts.push({
      id: 'queue-size-large',
      type: 'info',
      message: 'Большой размер очереди задач',
      timestamp: new Date().toISOString(),
      resolved: false,
      metric: 'Queue Size',
      value: metrics.external.queueSize,
      threshold: 500
    });
  }

  return alerts;
}
