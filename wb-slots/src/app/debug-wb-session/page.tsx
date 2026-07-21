'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAutoBookingCheck } from '@/hooks/use-session-check';
import {
  FiRefreshCw as RefreshCw,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiClock as Clock,
  FiInfo as Info,
  FiAlertTriangle as AlertTriangle
} from 'react-icons/fi';

export default function DebugWBSessionPage() {
  const { canAutoBook, isCheckingSession, sessionError, refreshSession } = useAutoBookingCheck();
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [wbSessions, setWbSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchAllSessions();
  }, []);

  const fetchAllSessions = async () => {
    try {
      const response = await fetch('/api/wb-session/list');
      const data = await response.json();
      console.log('📊 Все WB сессии:', data);
      if (data.success && data.data?.sessions) {
        setWbSessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Ошибка получения сессий:', error);
    }
  };

  const checkSessionManually = async () => {
    setIsManualChecking(true);
    try {
      const response = await fetch('/api/wb-session/check');
      const data = await response.json();
      setApiResponse(data);
      console.log('📡 Ручная проверка WB сессии:', data);
    } catch (error) {
      console.error('Ошибка ручной проверки:', error);
      setApiResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsManualChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔍 Отладка WB Сессии для Автобронирования
            </CardTitle>
            <CardDescription>
              Проверка состояния WB сессии и автобронирования
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Статус из хука */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Статус из useAutoBookingCheck():</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Автобронирование доступно:</div>
                  <div className="flex items-center gap-2 mt-1">
                    {canAutoBook ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Да
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Нет
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Идёт проверка:</div>
                  <div className="flex items-center gap-2 mt-1">
                    {isCheckingSession ? (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Clock className="w-3 h-3 mr-1 animate-spin" />
                        Да
                      </Badge>
                    ) : (
                      <Badge variant="outline">Нет</Badge>
                    )}
                  </div>
                </div>
              </div>

              {sessionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Ошибка:</strong> {sessionError}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Ручная проверка API */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Ручная проверка API:</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={checkSessionManually}
                    disabled={isManualChecking}
                    size="sm"
                  >
                    {isManualChecking ? (
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Проверить API
                  </Button>
                  <Button
                    onClick={() => {
                      refreshSession();
                      checkSessionManually();
                      fetchAllSessions();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Обновить всё
                  </Button>
                </div>
              </div>

              {apiResponse && (
                <div className="p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm overflow-auto max-h-96">
                  <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* Список всех WB сессий */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Все WB сессии:</h3>
                <Button onClick={fetchAllSessions} size="sm" variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Обновить
                </Button>
              </div>

              {wbSessions.length === 0 ? (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>Нет WB сессий</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {wbSessions.map((session: any) => (
                    <div
                      key={session.id}
                      className={`p-4 border rounded-lg ${
                        session.isActive
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20'
                          : 'bg-gray-50 border-gray-200 dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">ID: {session.id}</span>
                            {session.isActive ? (
                              <Badge className="bg-green-600 text-white">Активна</Badge>
                            ) : (
                              <Badge variant="outline">Неактивна</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <div>Создана: {new Date(session.createdAt).toLocaleString('ru-RU')}</div>
                            <div>Последняя валидация: {session.lastValidated ? new Date(session.lastValidated).toLocaleString('ru-RU') : 'N/A'}</div>
                            <div>Последнее использование: {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString('ru-RU') : 'N/A'}</div>
                            {session.expiresAt && (
                              <div>Истекает: {new Date(session.expiresAt).toLocaleString('ru-RU')}</div>
                            )}
                            {session.deactivatedAt && (
                              <div>Деактивирована: {new Date(session.deactivatedAt).toLocaleString('ru-RU')}</div>
                            )}
                            {session.deactivationReason && (
                              <div>Причина: {session.deactivationReason}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Инструкции */}
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">Как исправить проблему:</div>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Откройте консоль браузера (F12)</li>
                    <li>Нажмите "Проверить API" и "Обновить всё"</li>
                    <li>Посмотрите логи в консоли с префиксом "🔍 useAutoBookingCheck"</li>
                    <li>Проверьте раздел "Все WB сессии" ниже</li>
                    <li>Если нет активных сессий - перейдите в <a href="/wb-auth" className="underline font-semibold">WB Auth</a></li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>

            {/* Debug info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
              <div className="font-semibold mb-2">Debug информация:</div>
              <div className="space-y-1 font-mono text-xs">
                <div>canAutoBook: {canAutoBook ? '✅ true' : '❌ false'}</div>
                <div>isCheckingSession: {isCheckingSession ? '⏳ true' : '❌ false'}</div>
                <div>sessionError: {sessionError || 'null'}</div>
                <div>Всего WB сессий: {wbSessions.length}</div>
                <div>Активных WB сессий: {wbSessions.filter(s => s.isActive).length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

