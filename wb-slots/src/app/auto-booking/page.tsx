'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiZap as Zap,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiClock as Clock,
  FiAlertTriangle as AlertTriangle,
  FiActivity as Activity,
  FiTrendingUp as TrendingUp,
  FiUsers as Users,
  FiTarget as Target,
  FiRefreshCw as RefreshCw,
  FiLoader as Loader2,
  FiExternalLink as ExternalLink,
  FiShield as Shield,
  FiKey as Key,
  FiDatabase as Database,
  FiCalendar as Calendar,
  FiDollarSign as DollarSign,
  FiPackage as Package,
  FiTruck as Truck,
  FiAlertCircle as AlertCircle,
  FiInfo as Info
} from 'react-icons/fi';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';
import WbAuthPopup from '@/components/wb-auth-popup';

interface WBAuthStatus {
  isAuthenticated: boolean;
  lastLogin?: string;
  sessionExpires?: string;
  userInfo?: {
    name: string;
    email: string;
    role: string;
  };
}

interface BookingStats {
  totalAttempts: number;
  successfulBookings: number;
  failedBookings: number;
  successRate: number;
  totalSlotsBooked: number;
  averageBookingTime: number;
  lastBooking?: string;
  todayBookings: number;
  thisWeekBookings: number;
  thisMonthBookings: number;
}

interface BookingLog {
  id: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  taskName: string;
  slotInfo: {
    warehouse: string;
    date: string;
    time: string;
    coefficient: number;
  };
  message: string;
  details?: any;
}

export default function AutoBookingPage() {
  const [wbAuthStatus, setWbAuthStatus] = useState<WBAuthStatus>({
    isAuthenticated: false
  });
  const [bookingStats, setBookingStats] = useState<BookingStats>({
    totalAttempts: 0,
    successfulBookings: 0,
    failedBookings: 0,
    successRate: 0,
    totalSlotsBooked: 0,
    averageBookingTime: 0,
    todayBookings: 0,
    thisWeekBookings: 0,
    thisMonthBookings: 0
  });
  const [bookingLogs, setBookingLogs] = useState<BookingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthPopup, setShowAuthPopup] = useState(false);

  useEffect(() => {
    fetchAutoBookingData();
  }, []);

  const fetchAutoBookingData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Получаем данные из реальных API
      const [wbAuthResponse, statsResponse, logsResponse] = await Promise.all([
        fetch('/api/wb-session/status'),
        fetch('/api/auto-booking/stats'),
        fetch('/api/auto-booking/logs?limit=20')
      ]);

      // Обрабатываем ответ авторизации WB
      if (wbAuthResponse.ok) {
        const wbAuthData = await wbAuthResponse.json();
        if (wbAuthData.success) {
          setWbAuthStatus({
            isAuthenticated: wbAuthData.data.isActive,
            lastLogin: wbAuthData.data.lastLogin,
            sessionExpires: wbAuthData.data.expiresAt
          });
        }
      }

      // Обрабатываем ответ статистики
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setBookingStats(statsData.data);
        }
      }

      // Обрабатываем ответ логов
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        if (logsData.success) {
          setBookingLogs(logsData.data.logs);
        }
      }

    } catch (error) {
      console.error('Error fetching auto-booking data:', error);
      setError('Ошибка загрузки данных автобронирования');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Успешно';
      case 'failed':
        return 'Ошибка';
      case 'pending':
        return 'Ожидание';
      default:
        return 'Неизвестно';
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Загрузка данных автобронирования...</p>
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Автобронирование
                  </h1>
                  <p className="text-muted-foreground">
                    Управление автоматическим бронированием слотов
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={fetchAutoBookingData}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAuthPopup(true)}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  WB Авторизация
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* WB Auth Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Статус авторизации в ЛК WB
              </CardTitle>
              <CardDescription>
                Состояние подключения к личному кабинету Wildberries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {wbAuthStatus.isAuthenticated ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">
                      {wbAuthStatus.isAuthenticated ? 'Авторизован' : 'Не авторизован'}
                    </p>
                    {wbAuthStatus.userInfo && (
                      <p className="text-sm text-muted-foreground">
                        {wbAuthStatus.userInfo.name} ({wbAuthStatus.userInfo.role})
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {wbAuthStatus.lastLogin && (
                    <p className="text-sm text-muted-foreground">
                      Последний вход: {new Date(wbAuthStatus.lastLogin).toLocaleString('ru-RU')}
                    </p>
                  )}
                  {wbAuthStatus.sessionExpires && (
                    <p className="text-sm text-muted-foreground">
                      Сессия до: {new Date(wbAuthStatus.sessionExpires).toLocaleString('ru-RU')}
                    </p>
                  )}
                </div>
              </div>
              
              {!wbAuthStatus.isAuthenticated && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Для работы автобронирования необходимо авторизоваться в ЛК WB. 
                    <button 
                      onClick={() => setShowAuthPopup(true)}
                      className="text-primary hover:underline ml-1"
                    >
                      Перейти к авторизации
                    </button>
                  </AlertDescription>
                </Alert>
              )}

              {wbAuthStatus.isAuthenticated && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    <strong>Сессия активна</strong> - автобронирование готово к работе
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Успешные бронирования</p>
                    <p className="text-2xl font-bold text-foreground">{bookingStats.successfulBookings}</p>
                    <p className="text-xs text-muted-foreground">
                      {bookingStats.successRate.toFixed(1)}% успешности
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Всего попыток</p>
                    <p className="text-2xl font-bold text-foreground">{bookingStats.totalAttempts}</p>
                    <p className="text-xs text-muted-foreground">
                      {bookingStats.failedBookings} неудачных
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Забронировано слотов</p>
                    <p className="text-2xl font-bold text-foreground">{bookingStats.totalSlotsBooked}</p>
                    <p className="text-xs text-muted-foreground">
                      {bookingStats.averageBookingTime}с среднее время
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Сегодня</p>
                    <p className="text-2xl font-bold text-foreground">{bookingStats.todayBookings}</p>
                    <p className="text-xs text-muted-foreground">
                      {bookingStats.thisWeekBookings} за неделю
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Success Rate Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Эффективность автобронирования
              </CardTitle>
              <CardDescription>
                Процент успешных бронирований
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {bookingStats.successRate.toFixed(1)}% успешных бронирований
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {bookingStats.successfulBookings} из {bookingStats.totalAttempts}
                  </span>
                </div>
                <Progress value={bookingStats.successRate} className="h-3" />
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{bookingStats.successfulBookings}</p>
                    <p className="text-xs text-muted-foreground">Успешно</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{bookingStats.failedBookings}</p>
                    <p className="text-xs text-muted-foreground">Ошибки</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{bookingStats.totalSlotsBooked}</p>
                    <p className="text-xs text-muted-foreground">Слотов</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Лог автобронирования
              </CardTitle>
              <CardDescription>
                История попыток автоматического бронирования слотов
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bookingLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Нет записей
                  </h3>
                  <p className="text-muted-foreground">
                    Логи автобронирования появятся после выполнения задач
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookingLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border/60"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(log.status)}
                          <h3 className="font-medium text-foreground">
                            {log.taskName}
                          </h3>
                          <Badge
                            variant="outline"
                            className={getStatusColor(log.status)}
                          >
                            {getStatusText(log.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {log.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {log.slotInfo.warehouse}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {log.slotInfo.date} {log.slotInfo.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Коэффициент: {log.slotInfo.coefficient}
                          </span>
                        </div>
                        {log.details && (
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            {log.details.supplyId && (
                              <div>ID приемки: {log.details.supplyId}</div>
                            )}
                            {log.details.bookingStatus && (
                              <div>Статус бронирования: {log.details.bookingStatus}</div>
                            )}
                            {log.details.error && (
                              <div className="text-red-500">Ошибка: {log.details.error}</div>
                            )}
                            {log.details.foundSlots > 0 && (
                              <div>Найдено слотов: {log.details.foundSlots}</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  Как работает автобронирование
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Поиск слотов</p>
                    <p className="text-xs text-muted-foreground">Система автоматически ищет доступные слоты по заданным критериям</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Анализ коэффициентов</p>
                    <p className="text-xs text-muted-foreground">Выбираются слоты с наилучшими коэффициентами</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Автоматическое бронирование</p>
                    <p className="text-xs text-muted-foreground">Система автоматически бронирует найденные слоты</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Важные замечания
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>Авторизация в ЛК WB</strong> - обязательна для работы автобронирования
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg border border-border/60">
                  <p className="text-sm text-foreground">
                    <strong>Коэффициенты</strong> - чем меньше, тем выгоднее слот
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg border border-border/60">
                  <p className="text-sm text-foreground">
                    <strong>Уведомления</strong> - все результаты приходят в Telegram
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* WB Auth Popup */}
      <WbAuthPopup
        isOpen={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        onSuccess={(sessionData) => {
          console.log('Auth success:', sessionData);
          setShowAuthPopup(false);
          fetchAutoBookingData(); // Обновляем данные после успешной авторизации
        }}
        // userId получится автоматически из сессии
      />
    </DashboardLayout>
  );
}