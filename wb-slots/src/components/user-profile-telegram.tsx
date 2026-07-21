'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiUser as User,
  FiMessageCircle as MessageCircle,
  FiMail as Mail,
  FiPhone as Phone,
  FiGlobe as Globe,
  FiShield as Shield,
  FiCheckCircle as CheckCircle,
  FiClock as Clock,
  FiStar as Star,
  FiLoader as Loader2,
} from 'react-icons/fi';

interface TelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  timezone: string;
  role: string;
  createdAt: string;
  telegramUser?: TelegramUser;
}

interface UserProfileTelegramProps {
  className?: string;
}

export default function UserProfileTelegram({ className }: UserProfileTelegramProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch('/api/auth/profile');
      const data = await response.json();

      if (response.ok && data.success) {
        setProfile(data.data.user);
      } else {
        setError(data.error || 'Ошибка загрузки профиля');
      }
    } catch (error) {
      setError('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Загрузка профиля...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>Профиль не найден</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      USER: { label: 'Пользователь', variant: 'secondary' as const },
      ADMIN: { label: 'Администратор', variant: 'destructive' as const },
      DEVELOPER: { label: 'Разработчик', variant: 'default' as const },
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.USER;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Основная информация */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Информация о профиле
          </CardTitle>
          <CardDescription>
            Основные данные вашего аккаунта
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Имя
              </label>
              <p className="text-sm font-medium">
                {profile.name || 'Не указано'}
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email
              </label>
              <p className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {profile.email}
              </p>
            </div>
            
            {profile.phone && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Телефон
                </label>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {profile.phone}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Часовой пояс
              </label>
              <p className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {profile.timezone}
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Роль
              </label>
              <div>
                {getRoleBadge(profile.role)}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Дата регистрации
              </label>
              <p className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatDate(profile.createdAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telegram информация */}
      {profile.telegramUser ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              Telegram аккаунт
            </CardTitle>
            <CardDescription>
              Информация о подключенном Telegram аккаунте
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200">
                  Telegram аккаунт подключен
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Имя в Telegram
                  </label>
                  <p className="text-sm font-medium">
                    {profile.telegramUser.firstName} {profile.telegramUser.lastName || ''}
                  </p>
                </div>
                
                {profile.telegramUser.username && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Username
                    </label>
                    <p className="text-sm font-medium">
                      @{profile.telegramUser.username}
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    ID в Telegram
                  </label>
                  <p className="text-sm font-medium font-mono">
                    {profile.telegramUser.id}
                  </p>
                </div>
                
                {profile.telegramUser.languageCode && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Язык
                    </label>
                    <p className="text-sm font-medium">
                      {profile.telegramUser.languageCode}
                    </p>
                  </div>
                )}
                
                {profile.telegramUser.isPremium && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Статус
                    </label>
                    <div>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <Star className="w-3 h-3" />
                        Premium
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-gray-400" />
              Telegram аккаунт
            </CardTitle>
            <CardDescription>
              Подключите Telegram для удобных уведомлений
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Telegram аккаунт не подключен. Перейдите в настройки Telegram для подключения.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
