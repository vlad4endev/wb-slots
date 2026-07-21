'use client';
import DebugPageGuard from '@/components/debug-page-guard';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiDatabase as Database,
  FiPlay as Play,
  FiSquare as Square,
  FiLoader as Loader2,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiArrowLeft as ArrowLeft,
  FiRefreshCw as RefreshCw,
  FiFileText as FileText,
  FiClock as Clock
} from 'react-icons/fi';
import Link from 'next/link';

interface LogEntry {
  id: string;
  level: string;
  message: string;
  meta?: any;
  timestamp: string;
  service: string;
}

function TestLoggingPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('Тестовое сообщение для логирования');
  const [logLevel, setLogLevel] = useState('info');

  const handleTestLogging = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/test-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testMessage,
          level: logLevel,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Получаем логи после тестирования
        await fetchLogs();
      } else {
        setError(data.error || 'Ошибка тестирования логирования');
      }
    } catch (error) {
      setError('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/test-logs');
      const data = await response.json();

      if (response.ok) {
        setLogs(data.logs || []);
      } else {
        setError(data.error || 'Ошибка получения логов');
      }
    } catch (error) {
      setError('Ошибка получения логов');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'warn':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'debug':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'debug':
        return <Database className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Тест логирования
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Тестирование системы логирования
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={fetchLogs}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Назад к панели
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Тестирование логирования
            </CardTitle>
            <CardDescription>
              Отправьте тестовое сообщение в систему логирования
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testMessage">Тестовое сообщение</Label>
                <Input
                  id="testMessage"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Введите тестовое сообщение"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logLevel">Уровень логирования</Label>
                <select
                  id="logLevel"
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  title="Выберите уровень логирования"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>

            <Button
              onClick={handleTestLogging}
              disabled={isLoading || !testMessage}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Тестирование...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Отправить тестовое сообщение
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Logs Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Логи системы
            </CardTitle>
            <CardDescription>
              Последние записи в системе логирования
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Нет логов
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Отправьте тестовое сообщение для просмотра логов
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getLevelIcon(log.level)}
                        <Badge
                          variant="outline"
                          className={getLevelColor(log.level)}
                        >
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {log.service}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.timestamp).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white mb-2">
                      {log.message}
                    </p>
                    {log.meta && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                          Метаданные
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 overflow-x-auto">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
export default function TestLoggingPage() {
  return (
    <DebugPageGuard>
      <TestLoggingPageContent />
    </DebugPageGuard>
  );
}
