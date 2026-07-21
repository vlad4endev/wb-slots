'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TelegramAuth from '@/components/telegram-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FiArrowLeft as ArrowLeft, FiInfo as Info } from 'react-icons/fi';
import Link from 'next/link';

export default function TelegramAuthPage() {
  const router = useRouter();
  const [error, setError] = useState<string>('');

  const handleSuccess = (user: any) => {
    console.log('Telegram auth successful:', user);
    // Перенаправляем на главную страницу
    router.push('/dashboard');
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

        {/* Telegram Auth Component */}
        <TelegramAuth 
          onSuccess={handleSuccess}
          onError={handleError}
          redirectTo="/dashboard"
        />

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Не знаете, как открыть в Telegram? Обратитесь к администратору для получения ссылки на бота.
          </p>
        </div>
      </div>
    </div>
  );
}
