import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createApiHandler } from '@/lib/errors/error-handling-middleware';

// Отключаем prerendering для этого API route
export const dynamic = 'force-dynamic';

// GET handler без try-catch
const getHandler = async (request: NextRequest) => {
  const user = await requireAuth(request);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || user.id;

  // Mock data for now - in real implementation, this would come from database
  const alerts = [
    {
      id: '1',
        ruleId: 'rule-1',
        ruleName: 'Высокая загрузка CPU',
        message: 'Загрузка CPU превысила 90%',
        severity: 'critical',
        status: 'active',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        metadata: { cpu: 92.5, threshold: 90 }
      },
      {
        id: '2',
        ruleId: 'rule-2',
        ruleName: 'Медленный ответ API',
        message: 'Время ответа API превысило 2 секунды',
        severity: 'warning',
        status: 'acknowledged',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        acknowledgedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        acknowledgedBy: user.id,
        metadata: { responseTime: 2500, threshold: 2000 }
      },
      {
        id: '3',
        ruleId: 'rule-3',
        ruleName: 'Высокий процент ошибок',
        message: 'Процент ошибок превысил 5%',
        severity: 'warning',
        status: 'resolved',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      metadata: { errorRate: 6.2, threshold: 5 }
    }
  ];

  const rules = [
    {
        id: 'rule-1',
        name: 'Высокая загрузка CPU',
        description: 'Мониторинг загрузки процессора',
        metric: 'cpu_usage',
        condition: 'greater_than',
        threshold: 90,
        severity: 'critical',
        enabled: true,
        channels: [
          { id: 'email-1', type: 'email', name: 'Email уведомления', config: {}, enabled: true },
          { id: 'telegram-1', type: 'telegram', name: 'Telegram бот', config: {}, enabled: true }
        ],
        cooldown: 15,
        lastTriggered: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        triggerCount: 3
      },
      {
        id: 'rule-2',
        name: 'Медленный ответ API',
        description: 'Мониторинг времени ответа API',
        metric: 'api_response_time',
        condition: 'greater_than',
        threshold: 2000,
        severity: 'warning',
        enabled: true,
        channels: [
          { id: 'email-1', type: 'email', name: 'Email уведомления', config: {}, enabled: true }
        ],
        cooldown: 10,
        lastTriggered: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        triggerCount: 7
      },
      {
        id: 'rule-3',
        name: 'Высокий процент ошибок',
        description: 'Мониторинг процента ошибок',
        metric: 'error_rate',
        condition: 'greater_than',
        threshold: 5,
        severity: 'warning',
        enabled: true,
        channels: [
          { id: 'telegram-1', type: 'telegram', name: 'Telegram бот', config: {}, enabled: true },
          { id: 'webhook-1', type: 'webhook', name: 'Webhook', config: {}, enabled: true }
        ],
        cooldown: 5,
        lastTriggered: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      triggerCount: 12
    }
  ];

  const channels = [
    {
        id: 'email-1',
        type: 'email',
        name: 'Email уведомления',
        config: { email: 'admin@example.com' },
        enabled: true
      },
      {
        id: 'telegram-1',
        type: 'telegram',
        name: 'Telegram бот',
        config: { chatId: '@admin_chat' },
        enabled: true
      },
      {
        id: 'webhook-1',
        type: 'webhook',
        name: 'Webhook',
        config: { url: 'https://hooks.slack.com/...' },
        enabled: false
      },
      {
        id: 'browser-1',
        type: 'browser',
        name: 'Браузерные уведомления',
        config: {},
      enabled: true
    }
  ];

  return NextResponse.json({
    success: true,
    alerts,
    rules,
    channels
  });
};

export const GET = createApiHandler(getHandler, {
  contextProvider: (request: NextRequest) => ({
    endpoint: '/api/alerts',
    method: 'GET'
  })
});
