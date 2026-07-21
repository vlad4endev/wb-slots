'use client';
import DebugPageGuard from '@/components/debug-page-guard';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

function WbAuthDebugPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const startAuth = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    setStatus('Запуск браузера...');

    try {
      const response = await fetch('/api/wb-auth/popup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus('Браузер запущен. Ожидание...');
        setSuccess('Браузер успешно открыт!');
        
        // Начинаем мониторинг статуса
        monitorStatus();
      } else {
        setError(result.error || 'Ошибка запуска браузера');
      }
    } catch (error) {
      setError('Ошибка запуска браузера');
    } finally {
      setIsLoading(false);
    }
  };

  const forceSave = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/wb-auth/popup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'force-save' }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Сессия сохранена принудительно!');
        setStatus('Готово');
      } else {
        setError(result.error || 'Ошибка сохранения сессии');
      }
    } catch (error) {
      setError('Ошибка сохранения сессии');
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/wb-auth/popup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'status' }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus(result.data.isActive ? 'Браузер активен' : 'Браузер неактивен');
      }
    } catch (error) {
      setError('Ошибка проверки статуса');
    }
  };

  const monitorStatus = () => {
    const interval = setInterval(async () => {
      await checkStatus();
    }, 2000);

    // Останавливаем мониторинг через 5 минут
    setTimeout(() => {
      clearInterval(interval);
    }, 300000);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Отладка авторизации WB
          </CardTitle>
          <CardDescription>
            Тестовая страница для отладки системы авторизации Wildberries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Статус */}
          {status && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}

          {/* Успех */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Ошибка */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Кнопки */}
          <div className="flex gap-2">
            <Button
              onClick={startAuth}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Запуск...
                </>
              ) : (
                'Открыть браузер'
              )}
            </Button>

            <Button
              onClick={forceSave}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Принудительно сохранить'
              )}
            </Button>

            <Button
              onClick={checkStatus}
              disabled={isLoading}
              variant="outline"
            >
              Проверить статус
            </Button>
          </div>

          {/* Инструкции */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Инструкции:</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Нажмите "Открыть браузер"</li>
              <li>2. Браузер откроется на странице поставок WB</li>
              <li>3. Если нужна авторизация - войдите в ЛК</li>
              <li>4. Сессия сохранится автоматически</li>
              <li>5. Если не сработало - нажмите "Принудительно сохранить"</li>
            </ol>
          </div>

          {/* Логи */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Отладочная информация:</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>• Статус: {status || 'Не определен'}</p>
              <p>• Ошибки: {error || 'Нет'}</p>
              <p>• Успех: {success || 'Нет'}</p>
              <p>• Загрузка: {isLoading ? 'Да' : 'Нет'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WbAuthDebugPage() {
  return (
    <DebugPageGuard>
      <WbAuthDebugPageContent />
    </DebugPageGuard>
  );
}
