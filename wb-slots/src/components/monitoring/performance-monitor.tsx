"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AnimatedContainer } from '@/components/ui/animated-container';
import { ResponsiveGrid, useScreenSize } from '@/components/ui/mobile-optimized';
import { 
  Activity, 
  Cpu, 
  Database, 
  Globe, 
  MemoryStick, 
  Network, 
  Server, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

interface PerformanceMetrics {
  timestamp: string;
  system: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  application: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    activeConnections: number;
  };
  database: {
    connectionPool: number;
    queryTime: number;
    cacheHitRate: number;
    activeQueries: number;
  };
  external: {
    wbApiLatency: number;
    telegramLatency: number;
    redisLatency: number;
    queueSize: number;
  };
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
  metric: string;
  value: number;
  threshold: number;
}

interface PerformanceMonitorProps {
  refreshInterval?: number;
  showDetails?: boolean;
  userId?: string;
}

export function PerformanceMonitor({ 
  refreshInterval = 5000, 
  showDetails = true,
  userId 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealTime, setIsRealTime] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const screenSize = useScreenSize();

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitoring/performance?userId=${userId || ''}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setAlerts(data.alerts || []);
        setError(null);
      } else {
        throw new Error('Failed to fetch metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMetrics();

    if (isRealTime) {
      intervalRef.current = setInterval(fetchMetrics, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRealTime, refreshInterval, fetchMetrics]);

  const toggleRealTime = () => {
    setIsRealTime(!isRealTime);
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600 bg-red-100 dark:bg-red-900/20';
    if (value >= thresholds.warning) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    return 'text-green-600 bg-green-100 dark:bg-green-900/20';
  };

  const getStatusIcon = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return <AlertTriangle className="w-4 h-4" />;
    if (value >= thresholds.warning) return <Clock className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const MetricCard = ({ 
    title, 
    value, 
    unit, 
    icon: Icon, 
    thresholds, 
    trend,
    description 
  }: {
    title: string;
    value: number;
    unit: string;
    icon: React.ComponentType<{ className?: string }>;
    thresholds: { warning: number; critical: number };
    trend?: 'up' | 'down' | 'stable';
    description?: string;
  }) => (
    <AnimatedContainer animation="scaleIn" trigger="onScroll">
      <Card className="hover-lift">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
            </div>
            <div className="flex items-center gap-1">
              {trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
              {getStatusIcon(value, thresholds)}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${getStatusColor(value, thresholds).split(' ')[0]}`}>
              {value.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">{unit}</span>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          <div className="mt-2">
            <Progress 
              value={Math.min((value / thresholds.critical) * 100, 100)} 
              className="h-1"
            />
          </div>
        </CardContent>
      </Card>
    </AnimatedContainer>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ошибка мониторинга</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchMetrics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Попробовать снова
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Activity className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Нет данных</h3>
          <p className="text-muted-foreground">
            Метрики производительности недоступны
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Мониторинг производительности</h2>
          <p className="text-muted-foreground">
            Отслеживание системы в реальном времени
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isRealTime ? "default" : "outline"}
            size="sm"
            onClick={toggleRealTime}
          >
            {isRealTime ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {isRealTime ? 'Реальное время' : 'Пауза'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
          {showDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {showAdvanced ? 'Скрыть' : 'Детали'}
            </Button>
          )}
        </div>
      </div>

      {/* System Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" />
          Системные ресурсы
        </h3>
        <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
          <MetricCard
            title="CPU"
            value={metrics.system.cpu}
            unit="%"
            icon={Cpu}
            thresholds={{ warning: 70, critical: 90 }}
            trend="up"
            description="Использование процессора"
          />
          <MetricCard
            title="Память"
            value={metrics.system.memory}
            unit="%"
            icon={MemoryStick}
            thresholds={{ warning: 80, critical: 95 }}
            trend="stable"
            description="Использование RAM"
          />
          <MetricCard
            title="Диск"
            value={metrics.system.disk}
            unit="%"
            icon={Database}
            thresholds={{ warning: 85, critical: 95 }}
            trend="down"
            description="Использование диска"
          />
          <MetricCard
            title="Сеть"
            value={metrics.system.network}
            unit="Mbps"
            icon={Network}
            thresholds={{ warning: 80, critical: 95 }}
            trend="up"
            description="Сетевая активность"
          />
        </ResponsiveGrid>
      </div>

      {/* Application Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Приложение
        </h3>
        <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
          <MetricCard
            title="Время ответа"
            value={metrics.application.responseTime}
            unit="ms"
            icon={Clock}
            thresholds={{ warning: 1000, critical: 2000 }}
            trend="down"
            description="Среднее время ответа API"
          />
          <MetricCard
            title="Пропускная способность"
            value={metrics.application.throughput}
            unit="req/s"
            icon={Activity}
            thresholds={{ warning: 100, critical: 200 }}
            trend="up"
            description="Запросов в секунду"
          />
          <MetricCard
            title="Ошибки"
            value={metrics.application.errorRate}
            unit="%"
            icon={AlertTriangle}
            thresholds={{ warning: 5, critical: 10 }}
            trend="down"
            description="Процент ошибок"
          />
          <MetricCard
            title="Соединения"
            value={metrics.application.activeConnections}
            unit=""
            icon={Globe}
            thresholds={{ warning: 50, critical: 100 }}
            trend="stable"
            description="Активные соединения"
          />
        </ResponsiveGrid>
      </div>

      {/* Database Metrics */}
      {showAdvanced && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            База данных
          </h3>
          <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
            <MetricCard
              title="Пул соединений"
              value={metrics.database.connectionPool}
              unit="%"
              icon={Database}
              thresholds={{ warning: 80, critical: 95 }}
              description="Использование пула соединений"
            />
            <MetricCard
              title="Время запроса"
              value={metrics.database.queryTime}
              unit="ms"
              icon={Clock}
              thresholds={{ warning: 100, critical: 500 }}
              description="Среднее время выполнения запроса"
            />
            <MetricCard
              title="Кэш"
              value={metrics.database.cacheHitRate}
              unit="%"
              icon={MemoryStick}
              thresholds={{ warning: 70, critical: 50 }}
              description="Hit rate кэша"
            />
            <MetricCard
              title="Активные запросы"
              value={metrics.database.activeQueries}
              unit=""
              icon={Activity}
              thresholds={{ warning: 20, critical: 50 }}
              description="Количество активных запросов"
            />
          </ResponsiveGrid>
        </div>
      )}

      {/* External Services */}
      {showAdvanced && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Внешние сервисы
          </h3>
          <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
            <MetricCard
              title="WB API"
              value={metrics.external.wbApiLatency}
              unit="ms"
              icon={Globe}
              thresholds={{ warning: 2000, critical: 5000 }}
              description="Задержка WB API"
            />
            <MetricCard
              title="Telegram"
              value={metrics.external.telegramLatency}
              unit="ms"
              icon={Globe}
              thresholds={{ warning: 1000, critical: 3000 }}
              description="Задержка Telegram API"
            />
            <MetricCard
              title="Redis"
              value={metrics.external.redisLatency}
              unit="ms"
              icon={Database}
              thresholds={{ warning: 10, critical: 50 }}
              description="Задержка Redis"
            />
            <MetricCard
              title="Очередь"
              value={metrics.external.queueSize}
              unit=""
              icon={Activity}
              thresholds={{ warning: 100, critical: 500 }}
              description="Размер очереди задач"
            />
          </ResponsiveGrid>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Активные алерты
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AnimatedContainer key={alert.id} animation="slideInLeft" trigger="onScroll">
                <Card className={`border-l-4 ${
                  alert.type === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                  alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                  'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={
                            alert.type === 'critical' ? 'destructive' :
                            alert.type === 'warning' ? 'secondary' : 'default'
                          }>
                            {alert.type === 'critical' ? 'Критический' :
                             alert.type === 'warning' ? 'Предупреждение' : 'Информация'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {alert.metric}: {alert.value} (порог: {alert.threshold})
                          </span>
                        </div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {alert.resolved ? (
                          <Badge variant="secondary">Решено</Badge>
                        ) : (
                          <Badge variant="destructive">Активно</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedContainer>
            ))}
          </div>
        </div>
      )}

      {/* Last Update */}
      <div className="text-center text-sm text-muted-foreground">
        Последнее обновление: {new Date(metrics.timestamp).toLocaleString()}
        {isRealTime && <span className="ml-2 text-green-600">●</span>}
      </div>
    </div>
  );
}
