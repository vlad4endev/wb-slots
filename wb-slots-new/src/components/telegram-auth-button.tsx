'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Check, X, User } from 'lucide-react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramAuthButtonProps {
  onSuccess: (telegramId: string, userInfo: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
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

export default function TelegramAuthButton({ onSuccess, onError, disabled = false }: TelegramAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
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
      if (user) {
        setTelegramUser(user);
      }
    }
  }, []);

  const handleGetTelegramId = async () => {
    if (!isTelegramWebApp) {
      onError('Эта функция доступна только в Telegram Web App');
      return;
    }

    if (!telegramUser) {
      onError('Данные пользователя Telegram не найдены');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

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

      if (response.ok) {
        onSuccess(data.telegramId, data.userInfo);
      } else {
        onError(data.error || 'Ошибка получения Telegram ID');
      }
    } catch (error) {
      onError('Ошибка подключения к серверу');
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

  if (!isTelegramWebApp) {
    return (
      <div className="space-y-4">
        <Alert>
          <MessageSquare className="h-4 w-4" />
          <AlertDescription>
            <strong>Для автоматического получения Telegram ID:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Откройте эту страницу в Telegram через бота</li>
              <li>Или нажмите кнопку ниже для перехода в Telegram</li>
            </ol>
          </AlertDescription>
        </Alert>
        
        <Button 
          onClick={handleOpenInTelegram}
          disabled={disabled}
          className="w-full"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Открыть в Telegram
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {telegramUser ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-800">Пользователь Telegram найден</span>
          </div>
          <div className="space-y-1 text-sm">
            <p><strong>Имя:</strong> {telegramUser.first_name} {telegramUser.last_name || ''}</p>
            {telegramUser.username && (
              <p><strong>Username:</strong> @{telegramUser.username}</p>
            )}
            <p><strong>ID:</strong> {telegramUser.id}</p>
          </div>
        </div>
      ) : (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>
            Данные пользователя Telegram не найдены. Убедитесь, что вы открыли страницу через бота.
          </AlertDescription>
        </Alert>
      )}

      <Button 
        onClick={handleGetTelegramId}
        disabled={disabled || isLoading || !telegramUser}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <User className="h-4 w-4 mr-2" />
        )}
        {isLoading ? 'Получение ID...' : 'Получить Telegram ID автоматически'}
      </Button>

      {error && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
