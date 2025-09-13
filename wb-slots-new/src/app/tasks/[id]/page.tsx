'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  RefreshCw,
  Loader2,
  AlertTriangle,
  Search,
  BookOpen,
  Calendar,
  MapPin,
  Zap,
  Target,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';
import ContinuousSearchStatus from '@/components/continuous-search-status';

interface Task {
  id: string;
  taskNumber: number;
  name: string;
  description?: string;
  enabled: boolean;
  status: string;
  scheduleCron?: string;
  autoBook: boolean;
  autoBookSupplyId?: string;
  filters: any;
  priority: number;
  createdAt: string;
  updatedAt: string;
  runs: Array<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    foundSlots?: number;
    summary?: any;
  }>;
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загружаем данные задачи
  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      const data = await response.json();
      
      if (data.success) {
        setTask(data.data);
      } else {
        setError(data.error || 'Failed to load task');
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      setError('Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  // Удаляем задачу
  const deleteTask = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        router.push('/tasks');
      } else {
        alert(data.error || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Загрузка задачи...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !task) {
    return (
      <DashboardLayout>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Задача не найдена'}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'SUCCESS':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'STOPPED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      case 'BOOKING':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'Выполняется';
      case 'SUCCESS':
        return 'Успешно';
      case 'FAILED':
        return 'Ошибка';
      case 'PENDING':
        return 'Ожидает';
      case 'STOPPED':
        return 'Остановлена';
      case 'BOOKING':
        return 'Бронирование';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Заголовок и навигация */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tasks">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к задачам
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Задача #{task.taskNumber}: {task.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Создана {formatDate(task.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Редактировать
            </Button>
            <Button variant="destructive" size="sm" onClick={deleteTask}>
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить
            </Button>
          </div>
        </div>

        {/* Основная информация о задаче */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Статус и настройки */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Настройки задачи
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Статус</label>
                    <div className="mt-1">
                      <Badge className={getStatusColor(task.status)}>
                        {getStatusText(task.status)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Приоритет</label>
                    <div className="mt-1 text-sm">{task.priority}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Активна</label>
                    <div className="mt-1">
                      <Badge variant={task.enabled ? "default" : "secondary"}>
                        {task.enabled ? 'Да' : 'Нет'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Автобронирование</label>
                    <div className="mt-1">
                      <Badge variant={task.autoBook ? "default" : "secondary"}>
                        {task.autoBook ? 'Включено' : 'Отключено'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {task.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Описание</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {task.description}
                    </p>
                  </div>
                )}

                {task.autoBookSupplyId && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID поставки для бронирования</label>
                    <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                      {task.autoBookSupplyId}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Параметры поиска */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Параметры поиска
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Склады</p>
                      <p className="text-sm text-gray-600">
                        {task.filters?.warehouseIds?.length || 0} выбрано
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Коэффициент</p>
                      <p className="text-sm text-gray-600">
                        {task.filters?.coefficientMin || 0} - {task.filters?.coefficientMax || 20}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Период</p>
                      <p className="text-sm text-gray-600">
                        {task.filters?.dates?.from ? 
                          new Date(task.filters.dates.from).toLocaleDateString('ru-RU') : 
                          'Не указан'
                        } - {
                          task.filters?.dates?.to ? 
                            new Date(task.filters.dates.to).toLocaleDateString('ru-RU') : 
                            'Не указан'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Типы коробок</p>
                      <p className="text-sm text-gray-600">
                        {task.filters?.boxTypeIds?.length || 0} выбрано
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Непрерывный поиск слотов */}
            <ContinuousSearchStatus
              taskId={task.id}
              taskNumber={task.taskNumber}
              taskName={task.name}
              autoBook={task.autoBook}
              autoBookSupplyId={task.autoBookSupplyId}
              filters={task.filters || {}}
            />
          </div>

          {/* Боковая панель с статистикой */}
          <div className="space-y-6">
            {/* Статистика запусков */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Статистика
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Всего запусков:</span>
                    <span className="font-medium">{task.runs?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Успешных:</span>
                    <span className="font-medium text-green-600">
                      {task.runs?.filter(run => run.status === 'SUCCESS').length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">С ошибками:</span>
                    <span className="font-medium text-red-600">
                      {task.runs?.filter(run => run.status === 'FAILED').length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Всего слотов найдено:</span>
                    <span className="font-medium">
                      {task.runs?.reduce((sum, run) => sum + (run.foundSlots || 0), 0) || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Последние запуски */}
            <Card>
              <CardHeader>
                <CardTitle>Последние запуски</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(task.runs || []).slice(0, 5).map((run) => (
                    <div key={run.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(run.status)}>
                          {getStatusText(run.status)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatDate(run.startedAt)}
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {run.foundSlots || 0} слотов
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}