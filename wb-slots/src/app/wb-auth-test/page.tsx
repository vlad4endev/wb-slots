'use client';
import DebugPageGuard from '@/components/debug-page-guard';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import WbAuthPopup from '@/components/wb-auth-popup';
import {
  FiShield as Shield,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiExternalLink as ExternalLink,
  FiInfo as Info,
  FiAlertTriangle as AlertTriangle
} from 'react-icons/fi';

function WBAuthTestPageContent() {
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkSessionStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/wb-session/status');
      if (response.ok) {
        const result = await response.json();
        setSessionStatus(result.data);
      }
    } catch (error) {
      console.error('Error checking session status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Тест авторизации Wildberries
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Тестирование новой системы авторизации с popup браузером
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Статус сессии
            </CardTitle>
            <CardDescription>
              Текущее состояние авторизации в ЛК Wildberries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {sessionStatus.isActive ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-600 font-medium">Сессия активна</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-600 font-medium">Сессия неактивна</span>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessionStatus.lastLogin && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Последний вход
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(sessionStatus.lastLogin).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  )}

                  {sessionStatus.expiresAt && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Истекает
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(sessionStatus.expiresAt).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  )}

                  {sessionStatus.sessionId && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        ID сессии
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {sessionStatus.sessionId}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Статус
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {sessionStatus.isActive ? 'Готова к автобронированию' : 'Требуется авторизация'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Нажмите "Проверить статус" для загрузки информации</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={checkSessionStatus}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? 'Проверка...' : 'Проверить статус'}
              </Button>
              
              <Button
                onClick={() => setShowAuthPopup(true)}
                className="flex-1"
              >
                <Shield className="w-4 h-4 mr-2" />
                Открыть авторизацию
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              Как работает новая авторизация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Нажмите "Открыть авторизацию"</p>
                  <p className="text-xs text-gray-500">Откроется popup с браузером для входа в ЛК WB</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Войдите в личный кабинет</p>
                  <p className="text-xs text-gray-500">Используйте ваши учетные данные для входа</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Перейдите в раздел поставок</p>
                  <p className="text-xs text-gray-500">Откройте "Поставки" → "Все поставки"</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Сессия сохранена автоматически</p>
                  <p className="text-xs text-gray-500">Система автоматически сохранит данные для автобронирования</p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Важно:</strong> Система отслеживает переход в раздел поставок. 
                Только после этого сессия будет сохранена для использования в автобронировании.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Преимущества новой системы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Автоматическое отслеживание навигации</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Сохранение полной сессии (cookies, localStorage)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Безопасное шифрование данных</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Автоматическое закрытие popup</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Технические детали</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Playwright</Badge>
                <span className="text-sm">Автоматизация браузера</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">AES-256</Badge>
                <span className="text-sm">Шифрование сессии</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">PostgreSQL</Badge>
                <span className="text-sm">Хранение данных</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">24 часа</Badge>
                <span className="text-sm">Время жизни сессии</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Auth Popup */}
      <WbAuthPopup
        isOpen={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        onSuccess={(sessionData) => {
          console.log('Auth success:', sessionData);
          setShowAuthPopup(false);
          checkSessionStatus(); // Обновляем статус после успешной авторизации
        }}
        // userId получится автоматически из сессии
      />
    </div>
  );
}

export default function WBAuthTestPage() {
  return (
    <DebugPageGuard>
      <WBAuthTestPageContent />
    </DebugPageGuard>
  );
}
