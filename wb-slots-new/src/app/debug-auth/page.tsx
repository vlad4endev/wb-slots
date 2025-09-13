'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, RefreshCw } from 'lucide-react';

export default function DebugAuthPage() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cookies, setCookies] = useState<string>('');

  useEffect(() => {
    // Получаем cookies из браузера
    setCookies(document.cookie);
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setAuthStatus({ response, data });
    } catch (error) {
      setAuthStatus({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const testTelegramUserAPI = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/telegram/user');
      const data = await response.json();
      setAuthStatus(prev => ({ ...prev, telegramUser: { response: response.status, data } }));
    } catch (error) {
      setAuthStatus(prev => ({ ...prev, telegramUser: { error: error.message } }));
    } finally {
      setIsLoading(false);
    }
  };

  const testTelegramAdminAPI = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/telegram/admin');
      const data = await response.json();
      setAuthStatus(prev => ({ ...prev, telegramAdmin: { response: response.status, data } }));
    } catch (error) {
      setAuthStatus(prev => ({ ...prev, telegramAdmin: { error: error.message } }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Debug Authentication</h1>
        <p className="text-muted-foreground">
          Отладочная страница для проверки состояния аутентификации
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cookies</CardTitle>
            <CardDescription>Текущие cookies в браузере</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
              {cookies || 'Нет cookies'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Tests</CardTitle>
            <CardDescription>Тестирование API endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button onClick={checkAuth} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Проверить /api/auth/me
              </Button>
              <Button onClick={testTelegramUserAPI} disabled={isLoading} variant="outline">
                Тест /api/settings/telegram/user
              </Button>
              <Button onClick={testTelegramAdminAPI} disabled={isLoading} variant="outline">
                Тест /api/settings/telegram/admin
              </Button>
            </div>

            {authStatus && (
              <div className="space-y-4">
                {authStatus.response && (
                  <div>
                    <h4 className="font-medium mb-2">Auth Status:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={authStatus.response.ok ? "default" : "destructive"}>
                          {authStatus.response.status} {authStatus.response.statusText}
                        </Badge>
                        {authStatus.response.ok ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                      </div>
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                        {JSON.stringify(authStatus.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {authStatus.telegramUser && (
                  <div>
                    <h4 className="font-medium mb-2">Telegram User API:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={authStatus.telegramUser.response === 200 ? "default" : "destructive"}>
                          {authStatus.telegramUser.response}
                        </Badge>
                        {authStatus.telegramUser.response === 200 ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                      </div>
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                        {JSON.stringify(authStatus.telegramUser.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {authStatus.telegramAdmin && (
                  <div>
                    <h4 className="font-medium mb-2">Telegram Admin API:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={authStatus.telegramAdmin.response === 200 ? "default" : "destructive"}>
                          {authStatus.telegramAdmin.response}
                        </Badge>
                        {authStatus.telegramAdmin.response === 200 ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                      </div>
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                        {JSON.stringify(authStatus.telegramAdmin.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {authStatus.error && (
                  <Alert variant="destructive">
                    <X className="h-4 w-4" />
                    <AlertDescription>{authStatus.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
