'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Square,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  Activity,
  MapPin as Warehouse,
  Zap,
  Eye,
  Loader2,
  TrendingUp,
  Target,
  ArrowRight,
  RefreshCw,
  XCircle,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';

interface Task {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  status: string;
  scheduleCron?: string;
  autoBook: boolean;
  filters: any;
  priority: number;
  createdAt: string;
  updatedAt: string;
  runs: Array<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    summary?: any;
  }>;
  _count: {
    runs: number;
  };
}

interface Stats {
  totalTasks: number;
  activeTasks: number;
  totalRuns: number;
  successfulRuns: number;
  foundSlots: number;
}

const STAT_CARDS = [
  { key: 'totalTasks' as const, label: 'Всего задач', icon: Target, accent: 'text-violet-600 dark:text-violet-400', chip: 'bg-violet-500' },
  { key: 'activeTasks' as const, label: 'Активные задачи', icon: Activity, accent: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500' },
  { key: 'totalRuns' as const, label: 'Всего запусков', icon: BarChart3, accent: 'text-fuchsia-600 dark:text-fuchsia-400', chip: 'bg-fuchsia-500' },
  { key: 'foundSlots' as const, label: 'Найдено слотов', icon: TrendingUp, accent: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-500' },
];

const QUICK_LINKS = [
  { href: '/analytics', icon: BarChart3, title: 'Аналитика', description: 'Статистика и отчеты', chip: 'bg-violet-500' },
  { href: '/monitoring', icon: Activity, title: 'Мониторинг', description: 'Производительность', chip: 'bg-fuchsia-500' },
  { href: '/alerts', icon: Shield, title: 'Алерты', description: 'Уведомления', chip: 'bg-rose-500' },
  { href: '/settings', icon: Settings, title: 'Настройки', description: 'Конфигурация', chip: 'bg-indigo-500' },
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    activeTasks: 0,
    totalRuns: 0,
    successfulRuns: 0,
    foundSlots: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [tasksResponse, statsResponse, userResponse] = await Promise.all([
        fetch('/api/tasks', { credentials: 'include' }),
        fetch('/api/dashboard/stats', { credentials: 'include' }),
        fetch('/api/auth/me', { credentials: 'include' }),
      ]);

      const tasksData = await tasksResponse.json();
      const statsData = await statsResponse.json();
      const userData = await userResponse.json();

      if (tasksData.success) {
        setTasks(tasksData.data.tasks);
      }

      if (statsData.success) {
        setStats(statsData.data);
      }

      if (userData.success) {
        setUser(userData.data.user);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: 'start' | 'stop') => {
    setActionLoading(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error(`Error ${action}ing task:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const successRate = stats.totalRuns > 0 ? (stats.successfulRuns / stats.totalRuns) * 100 : 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Загрузка панели управления...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-card border-b border-border/60">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Панель управления</h1>
                <p className="text-muted-foreground mt-1">
                  Мониторинг и управление задачами поиска слотов
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button onClick={fetchDashboardData} variant="outline" size="sm" disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {STAT_CARDS.map((card) => (
              <Card key={card.key} className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${card.accent}`}>{card.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stats[card.key]}</p>
                    </div>
                    <div className={`w-11 h-11 ${card.chip} rounded-xl flex items-center justify-center shadow-sm`}>
                      <card.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Success Rate */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Успешность выполнения
              </CardTitle>
              <CardDescription>Процент успешных запусков задач</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {successRate.toFixed(1)}% успешных запусков
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stats.successfulRuns} из {stats.totalRuns}
                  </span>
                </div>
                <Progress value={successRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Задачи поиска слотов
              </CardTitle>
              <CardDescription>Управление и мониторинг ваших задач</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Нет задач</h3>
                  <p className="text-muted-foreground">
                    Создайте первую задачу для поиска слотов используя кнопку в сайдбаре
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/60"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-foreground">{task.name}</h3>
                          <Badge
                            variant={task.enabled ? 'default' : 'secondary'}
                            className={task.enabled ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15' : ''}
                          >
                            {task.enabled ? 'Активна' : 'Неактивна'}
                          </Badge>
                          {task.autoBook && (
                            <Badge variant="outline" className="text-primary border-primary/30">
                              <Zap className="w-3 h-3 mr-1" />
                              Автобронирование
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {task.scheduleCron ? 'По расписанию' : 'Ручной запуск'}
                          </span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            {task._count.runs} запусков
                          </span>
                          <span className="flex items-center gap-1">
                            <Warehouse className="w-3 h-3" />
                            Приоритет: {task.priority}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/tasks/${task.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            Просмотр
                          </Button>
                        </Link>
                        {task.status === 'COMPLETED' || task.status === 'SUCCESS' ? (
                          <div className="text-sm text-muted-foreground">Завершена</div>
                        ) : task.enabled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTaskAction(task.id, 'stop')}
                            disabled={actionLoading === task.id}
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                          >
                            {actionLoading === task.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTaskAction(task.id, 'start')}
                            disabled={actionLoading === task.id}
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                          >
                            {actionLoading === task.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {QUICK_LINKS.map((link) => (
              <Card key={link.href} className="border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                <Link href={link.href}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 ${link.chip} rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
                        <link.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground">{link.title}</h3>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0" />
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
