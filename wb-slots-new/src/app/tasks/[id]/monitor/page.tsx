'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Play,
  Square,
  RefreshCw,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
  Zap,
  Target,
  Settings,
  Filter,
  Download,
  Pause,
  PlayCircle,
  StopCircle,
  AlertTriangle,
  Info,
  Database,
  Cpu,
  MemoryStick,
  Network
} from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';

interface LogEntry {
  id: string;
  level: string;
  message: string;
  meta?: any;
  ts: string;
  run: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
  };
}

interface ActiveRun {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  foundSlots?: number;
  summary?: any;
}

interface TaskMonitorData {
  logs: LogEntry[];
  activeRuns: ActiveRun[];
  taskStatus: string;
  taskEnabled: boolean;
  task: {
    id: string;
    taskNumber: number;
    name: string;
    description?: string;
    filters: any;
    autoBook: boolean;
    priority: number;
  };
  foundSlots?: any[];
  slotsByRun?: Record<string, { run: any; slots: any[] }>;
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalFoundSlots: number;
    avgExecutionTime: number;
  };
}

export default function TaskMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;
  
  const [data, setData] = useState<TaskMonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [logLevelFilter, setLogLevelFilter] = useState('all');

  const loadData = async () => {
    try {
      const [logsResponse, taskResponse, slotsResponse] = await Promise.all([
        fetch(`/api/tasks/${taskId}/logs`),
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/slots`)
      ]);

      const logsResult = await logsResponse.json();
      const taskResult = await taskResponse.json();
      const slotsResult = await slotsResponse.json();

      if (logsResult.success && taskResult.success) {
        const taskData = taskResult.data.task;
        const logsData = logsResult.data;
        const slotsData = slotsResult.success ? slotsResult.data : { foundSlots: [], slotsByRun: {}, totalSlots: 0, totalRuns: 0 };
        
        // Вычисляем статистику
        const stats = {
          totalRuns: taskData.runs?.length || 0,
          successfulRuns: taskData.runs?.filter((run: any) => run.status === 'SUCCESS').length || 0,
          failedRuns: taskData.runs?.filter((run: any) => run.status === 'FAILED').length || 0,
          totalFoundSlots: slotsData.totalSlots || 0,
          avgExecutionTime: 0 // TODO: вычислить среднее время выполнения
        };

        setData({
          ...logsData,
          task: taskData,
          stats,
          foundSlots: slotsData.foundSlots || [],
          slotsByRun: slotsData.slotsByRun || {}
        });
        setError('');
      } else {
        setError(logsResult.error || taskResult.error || 'Ошибка загрузки данных');
      }
    } catch (error) {
      setError('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    
    if (autoRefresh) {
      const interval = setInterval(loadData, 3000); // Обновляем каждые 3 секунды
      return () => clearInterval(interval);
    }
  }, [taskId, autoRefresh]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleTaskAction = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.success) {
        loadData(); // Обновляем данные после действия
      } else {
        if (response.status === 400 && result.error?.includes('completed')) {
          setError('Задача завершена и не может быть перезапущена. Создайте новую задачу.');
        } else {
          setError(result.error || 'Ошибка выполнения действия');
        }
      }
    } catch (error) {
      setError('Ошибка выполнения действия');
    }
  };

  const exportLogs = () => {
    if (!data?.logs) return;
    
    const logsText = data.logs.map(log => 
      `[${new Date(log.ts).toISOString()}] ${log.level}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-${data.task?.taskNumber || taskId}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="default" className="bg-green-100 text-green-800">Успешно</Badge>;
      case 'RUNNING':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Выполняется</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Ошибка</Badge>;
      case 'QUEUED':
        return <Badge variant="secondary">В очереди</Badge>;
      case 'BOOKING':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Бронирование</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Завершено</Badge>;
      case 'STOPPED':
        return <Badge variant="secondary">Остановлено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'WARN':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'INFO':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'DEBUG':
        return <Activity className="w-4 h-4 text-gray-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'WARN':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'INFO':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'DEBUG':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredLogs = data?.logs.filter(log => {
    if (!showDebugLogs && log.level === 'DEBUG') return false;
    if (logLevelFilter !== 'all' && log.level !== logLevelFilter) return false;
    return true;
  }) || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-gray-600 dark:text-gray-400">Загрузка данных мониторинга...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Ошибка загрузки
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <Button onClick={handleRefresh} className="mr-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Попробовать снова
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Обработка случая, когда задача не найдена
  if (data?.taskStatus === 'NOT_FOUND') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Задача не найдена
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Задача с ID "{taskId}" не существует или была удалена.
            </p>
            <div className="space-x-4">
              <Button onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Обновить
              </Button>
              <Button variant="outline" onClick={() => router.push('/tasks')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Вернуться к задачам
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Заголовок и действия */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Мониторинг задачи #{data?.task?.taskNumber || 'N/A'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {data?.task?.name || 'Загрузка...'} • Логи и статус в реальном времени
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-50 text-green-700 border-green-200' : ''}
            >
              {autoRefresh ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
              {autoRefresh ? 'Авто-обновление' : 'Обновление отключено'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Всего запусков</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data?.stats?.totalRuns || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Успешных</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data?.stats?.successfulRuns || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ошибок</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data?.stats?.failedRuns || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Найдено слотов</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data?.stats?.totalFoundSlots || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Найденные слоты */}
        {data?.foundSlots && data.foundSlots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-green-500" />
                <span>Найденные слоты</span>
                <Badge variant="outline" className="ml-2">
                  {data.foundSlots.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Слоты, найденные согласно параметрам задачи
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data.slotsByRun || {}).map(([runId, runData]) => (
                  <div key={runId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                        Запуск {runId.slice(-8)}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant={runData.run.status === 'SUCCESS' ? 'default' : 'secondary'}>
                          {runData.run.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(runData.run.startedAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {runData.slots.map((slot: any, index: number) => (
                        <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                {index + 1}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">
                                {slot.warehouseName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {slot.date} • {slot.timeSlot}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Коэффициент: {slot.coefficient}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Типы коробок: {Array.isArray(slot.boxTypes) ? slot.boxTypes.join(', ') : 'N/A'}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {slot.isBooked ? (
                                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                                  Забронирован
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  Доступен
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Статус задачи и управление */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Управление задачей</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Статус:</span>
                  {getStatusBadge(data?.taskStatus || 'PENDING')}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Активна:</span>
                  <Badge variant={data?.taskEnabled ? 'default' : 'secondary'}>
                    {data?.taskEnabled ? 'Да' : 'Нет'}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Активных запусков:</span>
                  <Badge variant="outline">
                    {data?.activeRuns?.length || 0}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {data?.taskStatus === 'COMPLETED' ? (
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                      Задача завершена
                    </Badge>
                    <p className="text-sm text-gray-500">
                      Создайте новую задачу для продолжения поиска
                    </p>
                  </div>
                ) : data?.taskEnabled ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleTaskAction('stop')}
                    disabled={isRefreshing}
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    Остановить
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleTaskAction('start')}
                    disabled={isRefreshing}
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Запустить
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Активные запуски */}
        {data?.activeRuns && data.activeRuns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-green-500" />
                <span>Активные запуски</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.activeRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center space-x-4">
                      <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Запуск {run.id.slice(-8)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Начат: {new Date(run.startedAt).toLocaleString('ru-RU')}
                        </p>
                        {run.foundSlots && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Найдено слотов: {run.foundSlots}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Вкладки с логами */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Логи выполнения</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDebugLogs(!showDebugLogs)}
                >
                  {showDebugLogs ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {showDebugLogs ? 'Скрыть DEBUG' : 'Показать DEBUG'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportLogs}
                  disabled={!data?.logs?.length}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт
                </Button>
              </div>
            </div>
            <CardDescription>
              Последние {filteredLogs.length} записей
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                <TabsTrigger value="logs">Логи</TabsTrigger>
                <TabsTrigger value="details">Детали</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">Информация о задаче</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600 dark:text-gray-400">Номер:</span> #{data?.task?.taskNumber}</p>
                      <p><span className="text-gray-600 dark:text-gray-400">Название:</span> {data?.task?.name}</p>
                      <p><span className="text-gray-600 dark:text-gray-400">Приоритет:</span> {data?.task?.priority}</p>
                      <p><span className="text-gray-600 dark:text-gray-400">Автобронирование:</span> {data?.task?.autoBook ? 'Да' : 'Нет'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">Статистика</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600 dark:text-gray-400">Успешность:</span> {data?.stats?.totalRuns ? Math.round((data.stats.successfulRuns / data.stats.totalRuns) * 100) : 0}%</p>
                      <p><span className="text-gray-600 dark:text-gray-400">Среднее время:</span> {data?.stats?.avgExecutionTime || 0}с</p>
                      <p><span className="text-gray-600 dark:text-gray-400">Последнее обновление:</span> {new Date().toLocaleTimeString('ru-RU')}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="logs" className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Filter className="w-4 h-4" />
                  <select
                    value={logLevelFilter}
                    onChange={(e) => setLogLevelFilter(e.target.value)}
                    className="px-3 py-1 border rounded-md text-sm"
                    title="Фильтр по уровню логов"
                  >
                    <option value="all">Все уровни</option>
                    <option value="ERROR">Ошибки</option>
                    <option value="WARN">Предупреждения</option>
                    <option value="INFO">Информация</option>
                    <option value="DEBUG">Отладка</option>
                  </select>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-8 h-8 mx-auto mb-2" />
                      <p>Логи не найдены</p>
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border ${getLogLevelColor(log.level)}`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getLogLevelIcon(log.level)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-medium uppercase">
                                {log.level}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(log.ts).toLocaleString('ru-RU')}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {log.run.status}
                              </Badge>
                            </div>
                            <p className="text-sm">{log.message}</p>
                            {log.meta && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer">
                                  Детали
                                </summary>
                                <pre className="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                                  {JSON.stringify(log.meta, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Фильтры задачи</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <pre className="text-sm overflow-x-auto">
                        {JSON.stringify(data?.task?.filters || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  {data?.activeRuns && data.activeRuns.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Активные запуски</h4>
                      <div className="space-y-2">
                        {data.activeRuns.map((run) => (
                          <div key={run.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            <div className="text-sm">
                              <p><strong>ID:</strong> {run.id}</p>
                              <p><strong>Статус:</strong> {run.status}</p>
                              <p><strong>Начат:</strong> {new Date(run.startedAt).toLocaleString('ru-RU')}</p>
                              {run.finishedAt && (
                                <p><strong>Завершен:</strong> {new Date(run.finishedAt).toLocaleString('ru-RU')}</p>
                              )}
                              {run.foundSlots && (
                                <p><strong>Найдено слотов:</strong> {run.foundSlots}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
