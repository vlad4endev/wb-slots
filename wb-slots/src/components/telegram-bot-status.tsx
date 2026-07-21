'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  FiMessageCircle as MessageCircle,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiAlertTriangle as AlertTriangle,
  FiSettings as Settings,
  FiExternalLink as ExternalLink,
  FiInfo as Info,
  FiLoader as Loader2,
} from 'react-icons/fi';

interface BotStatus {
  configured: boolean;
  botUsername?: string;
  webAppUrl?: string;
  error?: string;
}

export default function TelegramBotStatus() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkBotStatus();
  }, []);

  const checkBotStatus = async () => {
    try {
      setIsLoading(true);
      
      // Проверяем статус бота через API
      const response = await fetch('/api/settings/telegram/admin');
      const data = await response.json();
      
      const webAppUrl = `${window.location.origin}/auth/telegram`;
      
      if (response.ok && data.botTokenConfigured) {
        setStatus({
          configured: true,
          botUsername: 'SearchLotWB_bot', // Используем существующего бота
          webAppUrl
        });
      } else {
        setStatus({
          configured: false,
          error: 'Токен бота @SearchLotWB_bot не настроен. Обратитесь к администратору.'
        });
      }
    } catch (error) {
      setStatus({
        configured: false,
        error: 'Ошибка проверки статуса бота'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBot = () => {
    if (status?.botUsername) {
      window.open(`https://t.me/${status.botUsername}`, '_blank');
    }
  };

  const handleOpenWebApp = () => {
    if (status?.botUsername && status?.webAppUrl) {
      const telegramUrl = `https://t.me/${status.botUsername}?startapp=${encodeURIComponent(status.webAppUrl)}`;
      window.open(telegramUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Проверка статуса бота...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Не удалось проверить статус Telegram бота
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Статус Telegram бота
        </CardTitle>
        <CardDescription>
          Информация о настройке авторизации через Telegram
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {status.configured ? (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">
                Telegram бот настроен
              </span>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Username бота:
                  </span>
                  <Badge variant="secondary">@{status.botUsername}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Web App URL:
                  </span>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {status.webAppUrl}
                  </code>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleOpenBot}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Открыть бота
              </Button>
              
              <Button 
                onClick={handleOpenWebApp}
                size="sm"
                className="flex-1"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Авторизация
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800 dark:text-red-200">
                Telegram бот не настроен
              </span>
            </div>
            
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {status.error}
              </AlertDescription>
            </Alert>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Для настройки Telegram бота:
                  </p>
                  <ol className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-decimal list-inside">
                    <li>Создайте бота в @BotFather</li>
                    <li>Настройте Web App</li>
                    <li>Добавьте переменные окружения</li>
                    <li>Перезапустите приложение</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={checkBotStatus}
              variant="outline"
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              Проверить снова
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
