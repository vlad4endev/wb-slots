'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiMessageCircle as MessageCircle,
  FiCheckCircle as CheckCircle,
  FiAlertTriangle as AlertTriangle,
  FiShield as Shield,
} from 'react-icons/fi';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginWidgetProps {
  onAuth: (user: TelegramUser) => void;
  onError?: (error: string) => void;
  botName?: string;
  size?: 'small' | 'medium' | 'large';
  requestAccess?: 'write' | 'read';
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export default function TelegramLoginWidget({ 
  onAuth, 
  onError, 
  botName = 'SearchLotWB_bot',
  size = 'large',
  requestAccess = 'write'
}: TelegramLoginWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Создаем глобальную функцию для обработки авторизации
    window.onTelegramAuth = (user: TelegramUser) => {
      try {
        console.log('Telegram auth received:', user);
        onAuth(user);
      } catch (error) {
        console.error('Error processing Telegram auth:', error);
        onError?.(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Загружаем скрипт Telegram Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', size);
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', requestAccess);

    // Сохраняем ref в переменную для cleanup функции
    const currentWidget = widgetRef.current;

    // Добавляем скрипт в контейнер
    if (currentWidget) {
      currentWidget.appendChild(script);
    }

    // Очистка при размонтировании
    return () => {
      if (currentWidget && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete window.onTelegramAuth;
    };
  }, [botName, size, requestAccess, onAuth, onError]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <CardTitle>Авторизация через Telegram</CardTitle>
        <CardDescription>
          Войдите в систему используя ваш Telegram аккаунт
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Безопасная авторизация через официальный Telegram Login Widget
          </AlertDescription>
        </Alert>
        
        <div className="text-center">
          <div 
            ref={widgetRef}
            className="flex justify-center"
          />
        </div>
        
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Нажмите кнопку выше для авторизации через Telegram</p>
          <p>Бот: @{botName}</p>
        </div>
      </CardContent>
    </Card>
  );
}
