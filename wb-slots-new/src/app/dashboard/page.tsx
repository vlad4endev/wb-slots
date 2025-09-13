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
  Warehouse,
  Zap,
  Eye,
  Loader2,
  MessageSquare,
  TrendingUp,
  Target,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';

interface Task {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
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

interface Event {
  id: string;
  type: string;
  taskName: string;
  status: string;
  timestamp: string;
  icon: string;
  color: string;
  foundSlots?: number;
}

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const successRate = stats.totalRuns > 0 ? (stats.successfulRuns / stats.totalRuns) * 100 : 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">Загрузка панели управления...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Панель управления
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Мониторинг и управление задачами поиска слотов
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={fetchDashboardData}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Всего задач</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalTasks}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Активные задачи</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.activeTasks}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Всего запусков</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.totalRuns}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Найдено слотов</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.foundSlots}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Success Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Успешность выполнения
              </CardTitle>
              <CardDescription>
                Процент успешных запусков задач
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {successRate.toFixed(1)}% успешных запусков
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {stats.successfulRuns} из {stats.totalRuns}
                  </span>
                </div>
                <Progress value={successRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Задачи поиска слотов
              </CardTitle>
              <CardDescription>
                Управление и мониторинг ваших задач
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Нет задач
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Создайте первую задачу для поиска слотов используя кнопку в сайдбаре
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {task.name}
                          </h3>
                          <Badge
                            variant={task.enabled ? "default" : "secondary"}
                            className={task.enabled ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" : ""}
                          >
                            {task.enabled ? "Активна" : "Неактивна"}
                          </Badge>
                          {task.autoBook && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                              <Zap className="w-3 h-3 mr-1" />
                              Автобронирование
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
                        {task.enabled ? (
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
                            className="text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link href="/settings/telegram">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Telegram</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Настройка уведомлений</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link href="/settings">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Настройки</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Конфигурация системы</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}