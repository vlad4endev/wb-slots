'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { ScrollArea } from '@/components/ui/scroll-area'; // Компонент не найден, используем div
import {
  FiSearch as Search,
  FiPlay as Play,
  FiSquare as Square,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiClock as Clock,
  FiAlertTriangle as AlertTriangle,
  FiRefreshCw as RefreshCw,
  FiBookOpen as BookOpen,
  FiCalendar as Calendar,
  FiMapPin as MapPin,
  FiZap as Zap
} from 'react-icons/fi';

interface ContinuousSearchStatusProps {
  taskId: string;
  taskNumber: number;
  taskName: string;
  autoBook: boolean;
  autoBookSupplyId?: string;
  filters: any;
  taskStatus?: string;
}

interface SearchStatus {
  isInProgress: boolean;
  currentSearchId: string | null;
  isThisTaskSearching: boolean;
}

interface Run {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  foundSlots?: number;
  summary?: any;
  logsCount: number;
  recentLogs: Array<{
    level: string;
    message: string;
    ts: string;
    meta?: any;
  }>;
}

interface SearchData {
  task: {
    id: string;
    taskNumber: number;
    name: string;
    status: string;
    autoBook: boolean;
    autoBookSupplyId?: string;
    filters: any;
  };
  search: SearchStatus;
  runs: Run[];
}

export default function ContinuousSearchStatus({ 
  taskId, 
  taskNumber, 
  taskName, 
  autoBook, 
  autoBookSupplyId,
  filters,
  taskStatus 
}: ContinuousSearchStatusProps) {
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Загружаем данные о поиске
  const fetchSearchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/continuous-search`);
      const data = await response.json();
      
      if (data.success) {
        setSearchData(data.data);
      }
    } catch (error) {
      console.error('Error fetching search status:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Запускаем поиск
  const startSearch = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/continuous-search`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchSearchStatus();
      } else {
        alert(data.error || 'Failed to start search');
      }
    } catch (error) {
      console.error('Error starting search:', error);
      alert('Failed to start search');
    } finally {
      setActionLoading(false);
    }
  };

  // Останавливаем поиск
  const stopSearch = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/continuous-search`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchSearchStatus();
      } else {
        alert(data.error || 'Failed to stop search');
      }
    } catch (error) {
      console.error('Error stopping search:', error);
      alert('Failed to stop search');
    } finally {
      setActionLoading(false);
    }
  };

  // Обновляем статус каждые 5 секунд
  useEffect(() => {
    fetchSearchStatus();
    
    const interval = setInterval(fetchSearchStatus, 5000);
    return () => clearInterval(interval);
  }, [taskId, fetchSearchStatus]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Загрузка статуса поиска...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!searchData) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Не удалось загрузить статус поиска
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { search, runs } = searchData;
  const latestRun = runs[0];
  const isSearching = search.isInProgress && search.isThisTaskSearching;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'QUEUED':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800';
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const formatDuration = (startedAt: string, finishedAt?: string) => {
    const start = new Date(startedAt);
    const end = finishedAt ? new Date(finishedAt) : new Date();
    const diff = end.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Основная информация о задаче */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Задача #{taskNumber}: {taskName}
              </CardTitle>
              <CardDescription>
                Непрерывный поиск слотов с автобронированием
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {taskStatus === 'COMPLETED' || taskStatus === 'SUCCESS' ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Задача завершена
                </div>
              ) : isSearching ? (
                <Button 
                  onClick={stopSearch} 
                  disabled={actionLoading}
                  variant="destructive"
                  size="sm"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Остановить поиск
                </Button>
              ) : (
                <Button 
                  onClick={startSearch} 
                  disabled={actionLoading || search.isInProgress}
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Запустить поиск
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                Склады: {filters.warehouseIds?.length || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                Коэффициент: {filters.coefficientMin}-{filters.coefficientMax}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {autoBook ? (
                <Zap className="h-4 w-4 text-green-500" />
              ) : (
                <Search className="h-4 w-4 text-gray-500" />
              )}
              <span className="text-sm">
                {autoBook ? 'Автобронирование' : 'Только поиск'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статус поиска */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSearching ? (
              <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            Статус поиска
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Текущий статус:</span>
              <Badge className={getStatusColor(latestRun?.status || 'PENDING')}>
                {getStatusIcon(latestRun?.status || 'PENDING')}
                <span className="ml-1">
                  {isSearching ? 'Поиск выполняется' : 'Остановлен'}
                </span>
              </Badge>
            </div>
            
            {latestRun && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Найдено слотов:</span>
                  <span className="font-medium">{latestRun.foundSlots || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Время выполнения:</span>
                  <span className="font-medium">
                    {formatDuration(latestRun.startedAt, latestRun.finishedAt)}
                  </span>
                </div>
                {latestRun.summary && (
                  <div className="text-sm text-gray-600">
                    <p>Всего поисков: {latestRun.summary.totalSearches || 0}</p>
                    {latestRun.summary.stoppedEarly && (
                      <p className="text-yellow-600">Поиск остановлен досрочно</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* История выполнения */}
      <Card>
        <CardHeader>
          <CardTitle>История выполнения</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="runs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="runs">Запуски</TabsTrigger>
              <TabsTrigger value="logs">Логи</TabsTrigger>
            </TabsList>
            
            <TabsContent value="runs" className="space-y-4">
              <div className="h-64 overflow-y-auto border rounded-md p-2">
                <div className="space-y-2">
                  {runs.map((run) => (
                    <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(run.status)}
                        <div>
                          <p className="text-sm font-medium">
                            {formatDate(run.startedAt)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Найдено слотов: {run.foundSlots || 0}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(run.status)}>
                          {run.status}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDuration(run.startedAt, run.finishedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="logs" className="space-y-4">
              <div className="h-64 overflow-y-auto border rounded-md p-2">
                <div className="space-y-2">
                  {latestRun?.recentLogs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 border rounded">
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(log.level)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{log.message}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(log.ts)}
                        </p>
                        {log.meta && Object.keys(log.meta).length > 0 && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-400 cursor-pointer">
                              Детали
                            </summary>
                            <pre className="text-xs text-gray-600 mt-1 overflow-auto">
                              {JSON.stringify(log.meta, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
