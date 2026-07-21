'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TelegramLoginWidget from '@/components/telegram-login-widget';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FiArrowLeft as ArrowLeft, FiInfo as Info } from 'react-icons/fi';
import Link from 'next/link';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function TelegramWidgetAuthPage() {
  const router = useRouter();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTelegramAuth = async (user: TelegramUser) => {
    try {
      setIsLoading(true);
      setError('');

      console.log('Processing Telegram auth for user:', user);

      const response = await fetch('/api/auth/telegram-widget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('Telegram auth successful:', data.data.user);
        // Перенаправляем на главную страницу
        router.push('/dashboard');
      } else {
        const errorMsg = data.error || 'Ошибка авторизации через Telegram';
        setError(errorMsg);
        console.error('Telegram auth error:', errorMsg);
      }
    } catch (error) {
      const errorMsg = 'Ошибка подключения к серверу';
      setError(errorMsg);
      console.error('Telegram auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = (error: string) => {
    setError(error);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/auth/login" className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться к обычной авторизации
          </Link>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Авторизация через Telegram
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Безопасный вход через ваш Telegram аккаунт
          </p>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            При первом входе через Telegram будет создан новый аккаунт с данными из вашего профиля Telegram.
            Все настройки уведомлений будут автоматически настроены.
          </AlertDescription>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading Alert */}
        {isLoading && (
          <Alert>
            <AlertDescription>
              Обработка авторизации... Пожалуйста, подождите.
            </AlertDescription>
          </Alert>
        )}

        {/* Telegram Login Widget */}
        <TelegramLoginWidget 
          onAuth={handleTelegramAuth}
          onError={handleError}
          botName="SearchLotWB_bot"
          size="large"
          requestAccess="write"
        />

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Используется официальный Telegram Login Widget для безопасной авторизации.
          </p>
        </div>
      </div>
    </div>
  );
}
