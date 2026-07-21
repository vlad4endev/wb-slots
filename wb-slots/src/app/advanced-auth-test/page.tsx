'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  User, 
  Lock, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';

interface AuthSession {
  sessionId: string;
  expiresAt: string;
  securityLevel: string;
}

interface SecurityStats {
  activeSessions: number;
  totalSessions: number;
  lastLogin: string | null;
  suspiciousActivities: number;
  securityScore: number;
}

interface SecurityEvent {
  id: string;
  type: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: any;
  timestamp: string;
}

export default function AdvancedAuthTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState('cmfvmlf4x0000pmjsmd3eouhu');
  const [sessionId, setSessionId] = useState('');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [wbAuthStatus, setWbAuthStatus] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Создание продвинутой сессии
  const createAdvancedSession = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-session',
          userId: userId,
          sessionData: {
            userAgent: navigator.userAgent,
            ipAddress: '127.0.0.1',
            deviceFingerprint: `test-fingerprint-${Date.now()}`,
            location: {
              country: 'Russia',
              city: 'Moscow',
              timezone: 'Europe/Moscow'
            },
            metadata: {
              source: 'advanced-auth-test',
              version: '1.0.0',
              timestamp: new Date().toISOString()
            }
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setAuthSession(data.data);
        setSessionId(data.data.sessionId);
        setSuccess('Продвинутая сессия создана успешно!');
        await loadSecurityStats();
        await loadSecurityEvents();
      } else {
        setError(data.error || 'Ошибка создания сессии');
      }
    } catch (error) {
      setError('Ошибка создания сессии: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Валидация сессии
  const validateSession = async () => {
    if (!sessionId) {
      setError('Введите ID сессии');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'validate-session',
          sessionId: sessionId
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Сессия валидирована успешно!');
        setAuthSession(data.data);
      } else {
        setError(data.error || 'Ошибка валидации сессии');
      }
    } catch (error) {
      setError('Ошибка валидации сессии: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузка статистики безопасности
  const loadSecurityStats = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get-security-stats',
          userId: userId
        })
      });

      const data = await response.json();

      if (data.success) {
        setSecurityStats(data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  }, [userId]);

  // Загрузка событий безопасности
  const loadSecurityEvents = useCallback(async () => {
    try {
      const response = await fetch(`/api/auth/advanced?action=security-events&userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (data.success) {
        setSecurityEvents(data.data.events);
      }
    } catch (error) {
      console.error('Ошибка загрузки событий:', error);
    }
  }, [userId]);

  // Загрузка статуса WB авторизации
  const loadWbAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/advanced?action=wb-auth-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (data.success) {
        setWbAuthStatus(data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса WB:', error);
    }
  };

  // Запуск WB авторизации
  const startWbAuth = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start-wb-auth',
          userId: userId,
          config: {
            headless: false,
            enableAntiDetection: true,
            enableSessionMonitoring: true,
            enableAutoRefresh: false
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('WB авторизация запущена! Браузер должен открыться.');
        await loadWbAuthStatus();
      } else {
        setError(data.error || 'Ошибка запуска WB авторизации');
      }
    } catch (error) {
      setError('Ошибка запуска WB авторизации: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Принудительное сохранение WB сессии
  const forceSaveWbSession = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'force-save-wb-session'
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('WB сессия сохранена принудительно!');
        await loadWbAuthStatus();
      } else {
        setError(data.error || 'Ошибка сохранения WB сессии');
      }
    } catch (error) {
      setError('Ошибка сохранения WB сессии: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Закрытие WB авторизации
  const closeWbAuth = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'close-wb-auth'
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('WB авторизация закрыта!');
        await loadWbAuthStatus();
      } else {
        setError(data.error || 'Ошибка закрытия WB авторизации');
      }
    } catch (error) {
      setError('Ошибка закрытия WB авторизации: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityStats();
    loadSecurityEvents();
    loadWbAuthStatus();
  }, [loadSecurityStats, loadSecurityEvents]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Тест продвинутой системы авторизации</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="session" className="space-y-4">
        <TabsList>
          <TabsTrigger value="session">Управление сессиями</TabsTrigger>
          <TabsTrigger value="wb-auth">WB Авторизация</TabsTrigger>
          <TabsTrigger value="security">Безопасность</TabsTrigger>
          <TabsTrigger value="events">События</TabsTrigger>
        </TabsList>

        <TabsContent value="session" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Управление сессиями
              </CardTitle>
              <CardDescription>
                Создание и валидация продвинутых сессий с расширенной безопасностью
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Введите User ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionId">Session ID</Label>
                  <Input
                    id="sessionId"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Введите Session ID для валидации"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={createAdvancedSession}
                  disabled={isLoading || !userId}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Создать сессию
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={validateSession}
                  disabled={isLoading || !sessionId}
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Валидация...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Валидировать
                    </>
                  )}
                </Button>
              </div>

              {authSession && (
                <Card className="bg-green-50 dark:bg-green-900/20">
                  <CardHeader>
                    <CardTitle className="text-green-800 dark:text-green-300">
                      Активная сессия
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">ID: {authSession.sessionId}</Badge>
                        <Badge variant="secondary">{authSession.securityLevel}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Истекает: {new Date(authSession.expiresAt).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wb-auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                WB Авторизация
              </CardTitle>
              <CardDescription>
                Продвинутая авторизация в Wildberries с антидетектом и мониторингом
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={startWbAuth}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Запуск...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Запустить WB авторизацию
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={forceSaveWbSession}
                  disabled={isLoading || !wbAuthStatus?.isActive}
                  variant="outline"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Сохранить сессию
                </Button>
                
                <Button
                  onClick={closeWbAuth}
                  disabled={isLoading || !wbAuthStatus?.isActive}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Закрыть
                </Button>
              </div>

              {wbAuthStatus && (
                <Card className="bg-blue-50 dark:bg-blue-900/20">
                  <CardHeader>
                    <CardTitle className="text-blue-800 dark:text-blue-300">
                      Статус WB авторизации
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={wbAuthStatus.isActive ? "default" : "secondary"}>
                          {wbAuthStatus.isActive ? "Активна" : "Неактивна"}
                        </Badge>
                        {wbAuthStatus.securityAlerts?.length > 0 && (
                          <Badge variant="destructive">
                            {wbAuthStatus.securityAlerts.length} предупреждений
                          </Badge>
                        )}
                      </div>
                      {wbAuthStatus.sessionMonitor && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Мониторинг: {wbAuthStatus.sessionMonitor.isActive ? "Включен" : "Выключен"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Статистика безопасности
              </CardTitle>
              <CardDescription>
                Мониторинг безопасности и оценка рисков
              </CardDescription>
            </CardHeader>
            <CardContent>
              {securityStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {securityStats.activeSessions}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Активных сессий
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {securityStats.totalSessions}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Всего сессий
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {securityStats.suspiciousActivities}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Подозрительных активностей
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {securityStats.securityScore}/100
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Оценка безопасности
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  Загрузка статистики...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                События безопасности
              </CardTitle>
              <CardDescription>
                Лог всех событий безопасности и подозрительной активности
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {securityEvents.length > 0 ? (
                  securityEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          event.type === 'SUSPICIOUS_ACTIVITY' ? 'destructive' :
                          event.type === 'AUTH_FAILED' ? 'destructive' :
                          event.type === 'SESSION_CREATED' ? 'default' :
                          'secondary'
                        }>
                          {event.type}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">
                            {event.details?.message || event.type}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetails(!showDetails)}
                      >
                        {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    События безопасности не найдены
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
