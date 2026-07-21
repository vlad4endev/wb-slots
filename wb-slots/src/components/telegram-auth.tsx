'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  FiMessageCircle as MessageCircle,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiLoader as Loader2,
  FiUser as User,
  FiShield as Shield,
  FiExternalLink as ExternalLink,
} from 'react-icons/fi';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramWebApp {
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
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramAuthProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
}

export default function TelegramAuth({ onSuccess, onError, redirectTo }: TelegramAuthProps) {
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      setIsTelegramWebApp(true);
      
      // Инициализируем Telegram Web App
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Получаем данные пользователя
      const user = window.Telegram.WebApp.initDataUnsafe.user;
      if (user) {
        setTelegramUser(user);
      }
    }
  }, []);

  const handleTelegramAuth = async () => {
    if (!isTelegramWebApp) {
      const errorMsg = 'Эта функция доступна только в Telegram Web App';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!telegramUser) {
      const errorMsg = 'Данные пользователя Telegram не найдены';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData: window.Telegram.WebApp.initData,
          initDataUnsafe: window.Telegram.WebApp.initDataUnsafe,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Авторизация через Telegram успешна!');
        onSuccess?.(data.data.user);
        
        // Перенаправляем пользователя
        if (redirectTo) {
          window.location.href = redirectTo;
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        const errorMsg = data.error || 'Ошибка авторизации через Telegram';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (error) {
      const errorMsg = 'Ошибка подключения к серверу';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInTelegram = async () => {
    try {
      // Проверяем статус бота
      const response = await fetch('/api/settings/telegram/admin');
      const data = await response.json();
      
      if (!response.ok || !data.botTokenConfigured) {
        alert('Токен бота @SearchLotWB_bot не настроен. Обратитесь к администратору для настройки.');
        return;
      }
      
      // Используем существующего бота @SearchLotWB_bot
      const botUsername = 'SearchLotWB_bot';
      const webAppUrl = `${window.location.origin}/auth/telegram`;
      const telegramUrl = `https://t.me/${botUsername}?startapp=${encodeURIComponent(webAppUrl)}`;
      
      window.open(telegramUrl, '_blank');
    } catch (error) {
      alert('Ошибка проверки статуса бота. Обратитесь к администратору.');
    }
  };

  if (!isTelegramWebApp) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle>Авторизация через Telegram</CardTitle>
          <CardDescription>
            Для авторизации через Telegram откройте это приложение в Telegram Web App
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Авторизация через Telegram доступна только в Telegram Web App для обеспечения безопасности
            </AlertDescription>
          </Alert>
          
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-2">Как авторизоваться через Telegram:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Найдите бота @SearchLotWB_bot в Telegram</li>
                <li>Нажмите "Запустить" или /start</li>
                <li>Выберите "Открыть Web App"</li>
                <li>Авторизуйтесь в приложении</li>
              </ol>
            </div>
            
            <Button 
              onClick={handleOpenInTelegram}
              className="w-full"
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Открыть в Telegram
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle>Telegram Web App</CardTitle>
        <CardDescription>
          Приложение запущено в Telegram Web App
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {telegramUser && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {telegramUser.first_name} {telegramUser.last_name}
                </p>
                {telegramUser.username && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    @{telegramUser.username}
                  </p>
                )}
                {telegramUser.is_premium && (
                  <Badge variant="secondary" className="mt-1">
                    Premium
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={handleTelegramAuth}
          disabled={isLoading || !telegramUser}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Авторизация...
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4 mr-2" />
              Войти через Telegram
            </>
          )}
        </Button>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Безопасная авторизация через Telegram</p>
          <p>Ваши данные защищены</p>
        </div>
      </CardContent>
    </Card>
  );
}
