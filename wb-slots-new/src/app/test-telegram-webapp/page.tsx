'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Check, X, User, Bot, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          query_id?: string;
          auth_date?: number;
          hash?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        onEvent: (eventType: string, eventHandler: () => void) => void;
        offEvent: (eventType: string, eventHandler: () => void) => void;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        themeParams: any;
        isVerticalSwipesEnabled: boolean;
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        isThemeParamsChanged: boolean;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setParams: (params: any) => void;
        };
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export default function TestTelegramWebAppPage() {
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [webAppData, setWebAppData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      setIsTelegramWebApp(true);
      
      // Инициализируем Telegram Web App
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Получаем данные пользователя
      const user = window.Telegram.WebApp.initDataUnsafe.user;
      const initData = window.Telegram.WebApp.initData;
      
      if (user) {
        setTelegramUser(user);
      }
      
      setWebAppData({
        initData,
        initDataUnsafe: window.Telegram.WebApp.initDataUnsafe,
        version: window.Telegram.WebApp.version,
        platform: window.Telegram.WebApp.platform,
        colorScheme: window.Telegram.WebApp.colorScheme,
        themeParams: window.Telegram.WebApp.themeParams,
        viewportHeight: window.Telegram.WebApp.viewportHeight,
        isExpanded: window.Telegram.WebApp.isExpanded
      });
    }
  }, []);

  const handleTestGetUserId = async () => {
    if (!isTelegramWebApp || !telegramUser) {
      setError('Telegram Web App не доступен или пользователь не найден');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setResult(null);

      const response = await fetch('/api/settings/telegram/get-user-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramData: telegramUser
        }),
      });

      const data = await response.json();
      setResult(data);

      if (!response.ok) {
        setError(data.error || 'Ошибка получения Telegram ID');
      }
    } catch (error) {
      setError('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInTelegram = () => {
    // Создаем ссылку для открытия в Telegram
    const botUsername = 'your_bot_username'; // Замените на username вашего бота
    const webAppUrl = encodeURIComponent(window.location.href);
    const telegramUrl = `https://t.me/${botUsername}?startapp=${webAppUrl}`;
    
    window.open(telegramUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Тест Telegram Web App
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Тестирование интеграции с Telegram Web App
                </p>
              </div>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад к панели
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">

      <div className="grid gap-6 md:grid-cols-2">
        {/* Статус Telegram Web App */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Статус Telegram Web App
            </CardTitle>
            <CardDescription>
              Информация о запуске в Telegram Web App
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {isTelegramWebApp ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <Check className="h-3 w-3 mr-1" />
                  Запущено в Telegram
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <X className="h-3 w-3 mr-1" />
                  Не в Telegram
                </Badge>
              )}
            </div>

            {!isTelegramWebApp && (
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                  <strong>Для тестирования:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Откройте эту страницу в Telegram через бота</li>
                    <li>Или нажмите кнопку ниже для перехода в Telegram</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}

            {!isTelegramWebApp && (
              <Button onClick={handleOpenInTelegram} className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть в Telegram
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Данные пользователя */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Данные пользователя
            </CardTitle>
            <CardDescription>
              Информация о пользователе из Telegram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {telegramUser ? (
              <div className="space-y-2">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">Пользователь найден</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p><strong>ID:</strong> {telegramUser.id}</p>
                    <p><strong>Имя:</strong> {telegramUser.first_name} {telegramUser.last_name || ''}</p>
                    {telegramUser.username && (
                      <p><strong>Username:</strong> @{telegramUser.username}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertDescription>
                  Данные пользователя не найдены
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Тест API */}
      <Card>
        <CardHeader>
          <CardTitle>Тест API получения Telegram ID</CardTitle>
          <CardDescription>
            Тестирование автоматического получения и сохранения Telegram ID
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleTestGetUserId}
            disabled={!isTelegramWebApp || !telegramUser || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <User className="h-4 w-4 mr-2" />
            )}
            {isLoading ? 'Тестирование...' : 'Получить Telegram ID'}
          </Button>

          {result && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Результат API:</h4>
              <pre className="text-sm text-blue-700 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Данные Web App */}
      {webAppData && (
        <Card>
          <CardHeader>
            <CardTitle>Данные Telegram Web App</CardTitle>
            <CardDescription>
              Полная информация о Web App (для отладки)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-auto">
              {JSON.stringify(webAppData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
