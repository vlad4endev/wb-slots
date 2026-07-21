'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiSearch as Search,
  FiPlus as Plus,
  FiPlay as Play,
  FiPause as Pause,
  FiSquare as Square,
  FiEdit as Edit,
  FiTrash2 as Trash2,
  FiEye as Eye,
  FiFilter as Filter,
  FiRefreshCw as RefreshCw,
  FiLoader as Loader2,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiClock as Clock,
  FiAlertTriangle as AlertTriangle,
  FiActivity as Activity,
  FiBarChart as BarChart3,
  FiCalendar as Calendar,
  FiMapPin as Warehouse,
  FiZap as Zap,
  FiTarget as Target,
  FiTrendingUp as TrendingUp,
  FiUsers as Users,
  FiSettings as Settings,
  FiMoreHorizontal as MoreHorizontal
} from 'react-icons/fi';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';
import CreateTaskModal from '@/components/create-task-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SlotSearch from '@/components/slot-search';

interface Task {
  id: string;
  taskNumber: number;
  name: string;
  description?: string;
  enabled: boolean;
  status: string;
  scheduleCron?: string;
  autoBook: boolean;
  filters: any;
  priority: number;
  successCount: number;
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

interface TaskStats {
  total: number;
  active: number;
  successful: number;
  failed: number;
  stopped: number;
  totalRuns: number;
  foundSlots: number;
  totalSuccessCount: number;
}

type FilterStatus = 'all' | 'active' | 'inactive' | 'successful' | 'failed' | 'stopped' | 'running';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    active: 0,
    successful: 0,
    failed: 0,
    stopped: 0,
    totalRuns: 0,
    foundSlots: 0,
    totalSuccessCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  const filterTasks = useCallback(() => {
    let filtered = tasks || [];

    // Фильтр по поисковому запросу
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Фильтр по статусу
    switch (statusFilter) {
      case 'active':
        filtered = filtered.filter(task => task.enabled && task.status !== 'COMPLETED');
        break;
      case 'inactive':
        filtered = filtered.filter(task => !task.enabled || task.status === 'COMPLETED');
        break;
      case 'successful':
        filtered = filtered.filter(task => 
          task.status === 'COMPLETED' || 
          (task.runs.length > 0 && (task.runs[0].status === 'completed' || task.runs[0].status === 'SUCCESS'))
        );
        break;
      case 'failed':
        filtered = filtered.filter(task => 
          task.status === 'FAILED' ||
          (task.runs.length > 0 && (task.runs[0].status === 'failed' || task.runs[0].status === 'FAILED'))
        );
        break;
      case 'running':
        filtered = filtered.filter(task => 
          task.status === 'RUNNING' ||
          (task.runs.length > 0 && (task.runs[0].status === 'running' || task.runs[0].status === 'RUNNING'))
        );
        break;
    }

    setFilteredTasks(filtered);
  }, [tasks, searchQuery, statusFilter]);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [tasksResponse, statsResponse] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/dashboard/stats')
      ]);

      const tasksData = await tasksResponse.json();
      const statsData = await statsResponse.json();

      if (tasksData.success) {
        setTasks(tasksData.data.tasks || []);
      }

      if (statsData.success) {
        const taskStats = calculateTaskStats(tasksData.data.tasks || []);
        setStats(taskStats);
      }
    } catch (error) {
      setError('Ошибка загрузки задач');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const calculateTaskStats = (tasks: Task[]): TaskStats => {
    const stats = {
      total: tasks.length,
      active: 0,
      successful: 0,
      failed: 0,
      stopped: 0,
      totalRuns: 0,
      foundSlots: 0,
      totalSuccessCount: 0
    };

    tasks.forEach(task => {
      if (task.enabled) {
        stats.active++;
      } else {
        stats.stopped++;
      }

      stats.totalRuns += task._count.runs;
      stats.totalSuccessCount += task.successCount || 0;

      // Анализируем статус задачи
      if (task.status === 'COMPLETED') {
        stats.successful++;
      } else if (task.status === 'FAILED') {
        stats.failed++;
      } else if (task.runs.length > 0) {
        const lastRun = task.runs[0];
        if (lastRun.status === 'completed' || lastRun.status === 'SUCCESS') {
          stats.successful++;
        } else if (lastRun.status === 'failed' || lastRun.status === 'FAILED') {
          stats.failed++;
        }
      }
    });

    return stats;
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    filterTasks();
  }, [filterTasks]);

  const handleTaskAction = async (taskId: string, action: 'start' | 'stop' | 'delete') => {
    setActionLoading(taskId);
    try {
      if (action === 'delete') {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          await fetchTasks();
        }
      } else {
        const response = await fetch(`/api/tasks/${taskId}/${action}`, {
          method: 'POST',
        });
        
        if (response.ok) {
          await fetchTasks();
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing task:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (task: Task) => {
    if (task.enabled) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (task: Task) => {
    if (task.enabled) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    } else {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getLastRunStatus = (task: Task) => {
    // Если задача завершена, показываем "Завершена"
    if (task.status === 'COMPLETED') {
      return { icon: <CheckCircle className="w-4 h-4 text-green-500" />, text: 'Завершена', color: 'text-green-600' };
    }
    
    if (task.runs.length === 0) return null;
    const lastRun = task.runs[0];
    
    switch (lastRun.status) {
      case 'completed':
      case 'SUCCESS':
        return { icon: <CheckCircle className="w-4 h-4 text-green-500" />, text: 'Успешно', color: 'text-green-600' };
      case 'failed':
      case 'FAILED':
        return { icon: <XCircle className="w-4 h-4 text-red-500" />, text: 'Ошибка', color: 'text-red-600' };
      case 'running':
      case 'RUNNING':
        return { icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />, text: 'Выполняется', color: 'text-blue-600' };
      default:
        return { icon: <Clock className="w-4 h-4 text-gray-500" />, text: 'Ожидание', color: 'text-gray-600' };
    }
  };

  const successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">Загрузка задач...</p>
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
                  Поиск слотов Wildberries
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Управление задачами и поиск доступных слотов
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={fetchTasks}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать задачу
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tasks">Мои задачи</TabsTrigger>
              <TabsTrigger value="search">Быстрый поиск</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-6">
              {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Всего задач</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
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
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Активные</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.active}</p>
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
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Успешные</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.successful}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Всего запусков</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.totalRuns}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Успешные поиски</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.totalSuccessCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Success Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Успешность выполнения
              </CardTitle>
              <CardDescription>
                Процент успешных задач
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {successRate.toFixed(1)}% успешных задач
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {stats.successful} из {stats.total}
                  </span>
                </div>
                <Progress value={successRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Фильтры и поиск
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Поиск по названию или описанию..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[
                    { key: 'all', label: 'Все', count: stats.total },
                    { key: 'active', label: 'Активные', count: stats.active },
                    { key: 'inactive', label: 'Неактивные', count: stats.stopped },
                    { key: 'successful', label: 'Успешные', count: stats.successful },
                    { key: 'failed', label: 'С ошибками', count: stats.failed }
                  ].map((filter) => (
                    <Button
                      key={filter.key}
                      variant={statusFilter === filter.key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(filter.key as FilterStatus)}
                    >
                      {filter.label}
                      <Badge variant="secondary" className="ml-2">
                        {filter.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Задачи поиска слотов
              </CardTitle>
              <CardDescription>
                {filteredTasks.length} из {tasks.length} задач
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {searchQuery || statusFilter !== 'all' ? 'Задачи не найдены' : 'Нет задач'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'Попробуйте изменить фильтры или поисковый запрос'
                      : 'Создайте первую задачу для поиска слотов'
                    }
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать задачу
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map((task) => {
                    const lastRunStatus = getLastRunStatus(task);
                    
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              #{task.taskNumber} {task.name}
                            </h3>
                            <Badge
                              variant={task.enabled ? "default" : "secondary"}
                              className={task.enabled ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" : ""}
                            >
                              {getStatusIcon(task)}
                              {task.enabled ? "Активна" : "Неактивна"}
                            </Badge>
                            {task.autoBook && (
                              <Badge variant="outline" className="text-blue-600 border-blue-200">
                                <Zap className="w-3 h-3 mr-1" />
                                Автобронирование
                              </Badge>
                            )}
                            {lastRunStatus && (
                              <Badge variant="outline" className={lastRunStatus.color}>
                                {lastRunStatus.icon}
                                {lastRunStatus.text}
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
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Создана: {new Date(task.createdAt).toLocaleDateString('ru-RU')}
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
                          <Link href={`/tasks/${task.id}/monitor`}>
                            <Button variant="outline" size="sm">
                              <Activity className="w-4 h-4 mr-1" />
                              Мониторинг
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
                          ) : task.status === 'COMPLETED' || task.status === 'SUCCESS' ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Завершена
                            </div>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTaskAction(task.id, 'delete')}
                            disabled={actionLoading === task.id}
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                          >
                            {actionLoading === task.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="search" className="space-y-6">
              <SlotSearch />
            </TabsContent>
          </Tabs>
        </div>

        {/* Create Task Modal */}
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            fetchTasks();
            setIsCreateModalOpen(false);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
