'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Monitor, Wifi, WifiOff, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface BrowserStatus {
  isConnected: boolean;
  browserCount: number;
  contextCount: number;
  pageCount: number;
  lastCheck: string;
}

interface BrowserData {
  isOpen: boolean;
  hasData: boolean;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  dataSummary: {
    cookiesCount: number;
    localStorageKeys: number;
    sessionStorageKeys: number;
  };
}

interface ActiveSession {
  id: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  lastValidated?: string;
}

interface BrowserConnectionManagerProps {
  onSessionConnected?: (sessionId: string) => void;
  onDataExtracted?: (data: any) => void;
}

export function BrowserConnectionManager({ 
  onSessionConnected, 
  onDataExtracted 
}: BrowserConnectionManagerProps) {
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [browserData, setBrowserData] = useState<BrowserData | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Проверка статуса браузера
  const checkBrowserStatus = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const response = await fetch('/api/browser/connect');
      const data = await response.json();
      
      if (data.success) {
        setBrowserStatus(data.browserStatus);
        setActiveSession(data.activeSession);
      } else {
        setError(data.error || 'Failed to check browser status');
      }
    } catch (err) {
      setError('Failed to check browser status');
    } finally {
      setIsChecking(false);
    }
  };

  // Проверка доступности данных браузера
  const checkBrowserData = async () => {
    try {
      const response = await fetch('/api/browser/extract');
      const data = await response.json();
      
      if (data.success) {
        setBrowserData(data);
      }
    } catch (err) {
      // Игнорируем ошибки при проверке данных
    }
  };

  // Подключение к браузеру
  const connectToBrowser = async () => {
    setIsConnecting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/browser/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          headless: false,
          timeout: 10000,
          retryAttempts: 3,
          saveSession: true
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        if (data.sessionId && onSessionConnected) {
          onSessionConnected(data.sessionId);
        }
        // Обновляем статус после подключения
        await checkBrowserStatus();
      } else {
        setError(data.error || 'Failed to connect to browser');
      }
    } catch (err) {
      setError('Failed to connect to browser');
    } finally {
      setIsConnecting(false);
    }
  };

  // Извлечение данных из браузера
  const extractBrowserData = async () => {
    setIsExtracting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/browser/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          saveToDatabase: true,
          includeCookies: true,
          includeLocalStorage: true,
          includeSessionStorage: true
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        if (data.data && onDataExtracted) {
          onDataExtracted(data.data);
        }
        // Обновляем статус после извлечения
        await checkBrowserStatus();
        await checkBrowserData();
      } else {
        setError(data.error || 'Failed to extract browser data');
      }
    } catch (err) {
      setError('Failed to extract browser data');
    } finally {
      setIsExtracting(false);
    }
  };

  // Автоматическая проверка статуса при загрузке
  useEffect(() => {
    checkBrowserStatus();
    checkBrowserData();
    
    // Периодическая проверка статуса
    const interval = setInterval(() => {
      checkBrowserStatus();
      checkBrowserData();
    }, 10000); // Каждые 10 секунд
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (browserStatus?.isConnected) {
      return <Wifi className="h-4 w-4 text-green-500" />;
    }
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getDataStatusIcon = () => {
    if (browserData?.hasData) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (browserData?.isOpen) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Управление подключением к браузеру
          </CardTitle>
          <CardDescription>
            Подключение к открытому браузеру и извлечение данных сессии
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Статус браузера */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <p className="font-medium">Статус браузера</p>
                <p className="text-sm text-muted-foreground">
                  {browserStatus?.isConnected ? 'Подключен' : 'Не подключен'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant={browserStatus?.isConnected ? 'default' : 'secondary'}>
                {browserStatus?.browserCount || 0} браузеров
              </Badge>
              <Badge variant="outline">
                {browserStatus?.pageCount || 0} страниц
              </Badge>
            </div>
          </div>

          {/* Доступность данных */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {getDataStatusIcon()}
              <div>
                <p className="font-medium">Доступность данных</p>
                <p className="text-sm text-muted-foreground">
                  {browserData?.hasData ? 'Данные доступны' : 
                   browserData?.isOpen ? 'Браузер открыт, но данных нет' : 'Браузер не найден'}
                </p>
              </div>
            </div>
            {browserData?.dataSummary && (
              <div className="flex gap-2">
                <Badge variant="outline">
                  {browserData.dataSummary.cookiesCount} cookies
                </Badge>
                <Badge variant="outline">
                  {browserData.dataSummary.localStorageKeys} localStorage
                </Badge>
                <Badge variant="outline">
                  {browserData.dataSummary.sessionStorageKeys} sessionStorage
                </Badge>
              </div>
            )}
          </div>

          {/* Активная сессия */}
          {activeSession && (
            <div className="p-4 border rounded-lg bg-green-50">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="font-medium text-green-800">Активная сессия найдена</p>
                  <p className="text-sm text-green-600">
                    Создана: {new Date(activeSession.createdAt).toLocaleString()}
                  </p>
                  {activeSession.lastUsedAt && (
                    <p className="text-sm text-green-600">
                      Последнее использование: {new Date(activeSession.lastUsedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* URL браузера */}
          {browserData?.url && (
            <div className="p-4 border rounded-lg">
              <p className="font-medium">Текущий URL:</p>
              <p className="text-sm text-muted-foreground break-all">{browserData.url}</p>
            </div>
          )}

          {/* Сообщения об ошибках и успехе */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Кнопки управления */}
          <div className="flex gap-2">
            <Button
              onClick={checkBrowserStatus}
              disabled={isChecking}
              variant="outline"
              className="flex-1"
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Monitor className="h-4 w-4 mr-2" />
              )}
              Проверить статус
            </Button>

            <Button
              onClick={connectToBrowser}
              disabled={isConnecting || isExtracting}
              className="flex-1"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Подключиться
            </Button>

            <Button
              onClick={extractBrowserData}
              disabled={isExtracting || isConnecting || !browserData?.hasData}
              variant="secondary"
              className="flex-1"
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Извлечь данные
            </Button>
          </div>

          {/* Инструкции */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Инструкции:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Откройте браузер и перейдите на сайт Wildberries</li>
              <li>2. Войдите в свой аккаунт</li>
              <li>3. Нажмите "Проверить статус" для обнаружения браузера</li>
              <li>4. Нажмите "Подключиться" для сохранения сессии</li>
              <li>5. Или "Извлечь данные" для получения данных без сохранения</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
