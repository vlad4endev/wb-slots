'use client';
import DebugPageGuard from '@/components/debug-page-guard';

import { useState, useEffect } from 'react';

// Отключаем prerendering для этой страницы
export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  FiMonitor as Monitor,
  FiActivity as Activity,
  FiServer as Server,
  FiDatabase as Database,
  FiClock as Clock,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiAlertTriangle as AlertTriangle,
  FiArrowLeft as ArrowLeft,
  FiRefreshCw as RefreshCw,
  FiLoader as Loader2,
  FiTrendingUp as TrendingUp,
  FiUsers as Users,
  FiZap as Zap
} from 'react-icons/fi';
import Link from 'next/link';

interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    status: 'connected' | 'disconnected' | 'error';
    responseTime: number;
  };
  services: {
    name: string;
    status: 'running' | 'stopped' | 'error';
    lastCheck: string;
  }[];
}

function TestMonitoringPageContent() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchSystemStatus, 5000); // Обновляем каждые 5 секунд
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchSystemStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Симуляция получения данных о системе
      const mockStatus: SystemStatus = {
        status: Math.random() > 0.1 ? 'healthy' : 'warning',
        uptime: Math.floor(Math.random() * 86400 * 7), // До 7 дней
        memory: {
          used: Math.floor(Math.random() * 8) + 2, // 2-10 GB
          total: 16,
          percentage: Math.floor(Math.random() * 60) + 20, // 20-80%
        },
        cpu: {
          usage: Math.floor(Math.random() * 80) + 10, // 10-90%
        },
        database: {
          status: Math.random() > 0.05 ? 'connected' : 'error',
          responseTime: Math.floor(Math.random() * 100) + 10, // 10-110ms
        },
        services: [
          {
            name: 'API Server',
            status: Math.random() > 0.1 ? 'running' : 'error',
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'Database',
            status: Math.random() > 0.05 ? 'running' : 'error',
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'Task Scheduler',
            status: Math.random() > 0.15 ? 'running' : 'stopped',
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'Telegram Bot',
            status: Math.random() > 0.2 ? 'running' : 'stopped',
            lastCheck: new Date().toISOString(),
          },
        ],
      };

      setSystemStatus(mockStatus);
    } catch (error) {
      setError('Ошибка получения данных мониторинга');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'error':
      case 'stopped':
      case 'disconnected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
      case 'stopped':
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}д ${hours}ч ${minutes}м`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Мониторинг системы
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Отслеживание состояния системы и сервисов
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
              >
                <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
                {autoRefresh ? 'Автообновление' : 'Включить автообновление'}
              </Button>
              <Button
                onClick={fetchSystemStatus}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Назад к панели
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {systemStatus && (
          <>
            {/* Overall Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Общее состояние системы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(systemStatus.status)}
                    <Badge
                      variant="outline"
                      className={getStatusColor(systemStatus.status)}
                    >
                      {systemStatus.status === 'healthy' ? 'Работает нормально' : 
                       systemStatus.status === 'warning' ? 'Предупреждение' : 'Ошибка'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Время работы: {formatUptime(systemStatus.uptime)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Использование памяти
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {systemStatus.memory.used} GB / {systemStatus.memory.total} GB
                      </span>
                      <span className="text-sm text-gray-500">
                        {systemStatus.memory.percentage}%
                      </span>
                    </div>
                    <Progress value={systemStatus.memory.percentage} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Использование CPU
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {systemStatus.cpu.usage}%
                      </span>
                    </div>
                    <Progress value={systemStatus.cpu.usage} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Database Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  База данных
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(systemStatus.database.status)}
                    <Badge
                      variant="outline"
                      className={getStatusColor(systemStatus.database.status)}
                    >
                      {systemStatus.database.status === 'connected' ? 'Подключена' : 
                       systemStatus.database.status === 'disconnected' ? 'Отключена' : 'Ошибка'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Время отклика: {systemStatus.database.responseTime}ms
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Сервисы
                </CardTitle>
                <CardDescription>
                  Состояние всех системных сервисов
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemStatus.services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(service.status)}
                        <span className="font-medium">{service.name}</span>
                        <Badge
                          variant="outline"
                          className={getStatusColor(service.status)}
                        >
                          {service.status === 'running' ? 'Запущен' : 
                           service.status === 'stopped' ? 'Остановлен' : 'Ошибка'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(service.lastCheck).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {isLoading && !systemStatus && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
              <p className="text-gray-600 dark:text-gray-400">Загрузка данных мониторинга...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default function TestMonitoringPage() {
  return (
    <DebugPageGuard>
      <TestMonitoringPageContent />
    </DebugPageGuard>
  );
}
