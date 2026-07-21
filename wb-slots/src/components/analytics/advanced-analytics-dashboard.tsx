"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AnimatedContainer } from '@/components/ui/animated-container';
import { ResponsiveGrid, useScreenSize } from '@/components/ui/mobile-optimized';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    successRate: number;
    averageResponseTime: number;
    totalSlotsFound: number;
  };
  trends: {
    daily: Array<{ date: string; value: number }>;
    weekly: Array<{ week: string; value: number }>;
    monthly: Array<{ month: string; value: number }>;
  };
  performance: {
    byWarehouse: Array<{ name: string; successRate: number; totalAttempts: number }>;
    byTimeSlot: Array<{ time: string; successRate: number; totalAttempts: number }>;
    byTask: Array<{ name: string; successRate: number; totalAttempts: number }>;
  };
  alerts: Array<{
    id: string;
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

interface AdvancedAnalyticsDashboardProps {
  userId?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

export function AdvancedAnalyticsDashboard({ 
  userId, 
  timeRange: initialTimeRange = 'week' 
}: AdvancedAnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [refreshing, setRefreshing] = useState(false);
  const screenSize = useScreenSize();

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/advanced?timeRange=${timeRange}&userId=${userId || ''}`);
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange, userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Данные недоступны</h3>
          <p className="text-muted-foreground mb-4">
            Не удалось загрузить аналитические данные
          </p>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Попробовать снова
          </Button>
        </CardContent>
      </Card>
    );
  }

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    trend = 'neutral' 
  }: {
    title: string;
    value: string | number;
    change?: number;
    icon: React.ComponentType<{ className?: string }>;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <AnimatedContainer animation="scaleIn" trigger="onScroll">
      <Card className="hover-lift">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {change !== undefined && (
                <div className="flex items-center mt-1">
                  {trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : trend === 'down' ? (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  ) : null}
                  <span className={`text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {change > 0 ? '+' : ''}{change}%
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </AnimatedContainer>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Аналитика</h1>
          <p className="text-muted-foreground">
            Детальная статистика и производительность системы
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">За день</SelectItem>
              <SelectItem value="week">За неделю</SelectItem>
              <SelectItem value="month">За месяц</SelectItem>
              <SelectItem value="year">За год</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
        <StatCard
          title="Всего задач"
          value={data.overview.totalTasks}
          change={12}
          trend="up"
          icon={Target}
        />
        <StatCard
          title="Активные задачи"
          value={data.overview.activeTasks}
          change={-5}
          trend="down"
          icon={Activity}
        />
        <StatCard
          title="Успешность"
          value={`${data.overview.successRate}%`}
          change={8}
          trend="up"
          icon={CheckCircle}
        />
        <StatCard
          title="Найдено слотов"
          value={data.overview.totalSlotsFound}
          change={23}
          trend="up"
          icon={Target}
        />
      </ResponsiveGrid>

      {/* Main Content Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Тренды</TabsTrigger>
          <TabsTrigger value="performance">Производительность</TabsTrigger>
          <TabsTrigger value="alerts">Алерты</TabsTrigger>
          <TabsTrigger value="insights">Инсайты</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <ResponsiveGrid cols={{ mobile: 1, desktop: 2 }}>
            <AnimatedContainer animation="slideInLeft" trigger="onScroll">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5" />
                    Динамика успешности
                  </CardTitle>
                  <CardDescription>
                    Изменение показателей по времени
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 text-muted-foreground/60 mx-auto mb-2" />
                      <p className="text-muted-foreground">График будет здесь</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedContainer>

            <AnimatedContainer animation="slideInRight" trigger="onScroll">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Распределение по складам
                  </CardTitle>
                  <CardDescription>
                    Производительность по складам
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.performance.byWarehouse.map((warehouse, index) => (
                      <div key={warehouse.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{warehouse.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {warehouse.successRate}%
                          </span>
                        </div>
                        <Progress value={warehouse.successRate} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedContainer>
          </ResponsiveGrid>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <ResponsiveGrid cols={{ mobile: 1, desktop: 3 }}>
            <AnimatedContainer animation="scaleIn" trigger="onScroll">
              <Card>
                <CardHeader>
                  <CardTitle>По складам</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.performance.byWarehouse.map((warehouse) => (
                      <div key={warehouse.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{warehouse.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {warehouse.totalAttempts} попыток
                          </p>
                        </div>
                        <Badge variant={warehouse.successRate > 80 ? 'default' : warehouse.successRate > 60 ? 'secondary' : 'destructive'}>
                          {warehouse.successRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedContainer>

            <AnimatedContainer animation="scaleIn" trigger="onScroll" delay={0.1}>
              <Card>
                <CardHeader>
                  <CardTitle>По времени</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.performance.byTimeSlot.map((slot) => (
                      <div key={slot.time} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{slot.time}</p>
                          <p className="text-sm text-muted-foreground">
                            {slot.totalAttempts} попыток
                          </p>
                        </div>
                        <Badge variant={slot.successRate > 80 ? 'default' : slot.successRate > 60 ? 'secondary' : 'destructive'}>
                          {slot.successRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedContainer>

            <AnimatedContainer animation="scaleIn" trigger="onScroll" delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle>По задачам</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.performance.byTask.map((task) => (
                      <div key={task.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.totalAttempts} попыток
                          </p>
                        </div>
                        <Badge variant={task.successRate > 80 ? 'default' : task.successRate > 60 ? 'secondary' : 'destructive'}>
                          {task.successRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedContainer>
          </ResponsiveGrid>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AnimatedContainer animation="fadeIn" trigger="onScroll">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Системные алерты
                </CardTitle>
                <CardDescription>
                  Критические события и уведомления
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        alert.type === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                        alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                        alert.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                        'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm text-muted-foreground mt-1">
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </AnimatedContainer>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <ResponsiveGrid cols={{ mobile: 1, desktop: 2 }}>
            <AnimatedContainer animation="slideInLeft" trigger="onScroll">
              <Card>
                <CardHeader>
                  <CardTitle>Рекомендации</CardTitle>
                  <CardDescription>
                    Оптимизация на основе данных
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border/60">
                      <h4 className="font-medium text-foreground mb-2">
                        Оптимальное время поиска
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Лучшие результаты показывают утренние часы (8:00-10:00)
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg border border-border/60">
                      <h4 className="font-medium text-foreground mb-2">
                        Эффективные склады
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Склады в Москве показывают стабильно высокие результаты
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedContainer>

            <AnimatedContainer animation="slideInRight" trigger="onScroll">
              <Card>
                <CardHeader>
                  <CardTitle>Прогнозы</CardTitle>
                  <CardDescription>
                    Предсказания на основе трендов
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border/60">
                      <h4 className="font-medium text-foreground mb-2">
                        Ожидаемый рост
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        На следующей неделе ожидается увеличение доступных слотов на 15%
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg border border-border/60">
                      <h4 className="font-medium text-foreground mb-2">
                        Пиковая нагрузка
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Пятница 14:00-16:00 - время максимальной активности
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedContainer>
          </ResponsiveGrid>
        </TabsContent>
      </Tabs>
    </div>
  );
}
