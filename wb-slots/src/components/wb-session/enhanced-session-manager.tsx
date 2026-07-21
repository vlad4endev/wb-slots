'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  FiRefreshCw as RefreshIcon,
  FiCheckCircle as CheckIcon,
  FiXCircle as XIcon,
  FiClock as ClockIcon,
  FiUser as UserIcon,
  FiShield as ShieldIcon,
  FiAlertTriangle as WarningIcon,
  FiInfo as InfoIcon
} from 'react-icons/fi';

interface SessionStats {
  activeSessions: number;
  totalSessions: number;
  lastLoginAt?: Date;
  averageSessionDuration?: number;
}

interface EnhancedSessionManagerProps {
  userId?: string;
  onSessionUpdate?: (sessionId: string) => void;
}

export default function EnhancedSessionManager({ 
  userId, 
  onSessionUpdate 
}: EnhancedSessionManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const loadSessionStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/wb-session/enhanced/status?userId=${userId || ''}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data.stats);
        setCurrentSessionId(data.data.hasActiveSession ? 'active' : null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load session stats' });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `Error loading session stats: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  }, [userId]);

  // Загружаем статистику сессий при монтировании
  useEffect(() => {
    loadSessionStats();
  }, [loadSessionStats]);

  const handleAction = async (action: string, options?: any) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/wb-auth/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          userId,
          options
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `${action} completed successfully` 
        });
        
        if (data.data?.sessionId) {
          setCurrentSessionId(data.data.sessionId);
          onSessionUpdate?.(data.data.sessionId);
        }
        
        // Обновляем статистику
        await loadSessionStats();
      } else {
        setMessage({ 
          type: 'error', 
          text: data.error || `${action} failed` 
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `Error during ${action}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('ru-RU');
  };

  const formatDuration = (hours?: number) => {
    if (!hours) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)} мин`;
    return `${Math.round(hours)} ч`;
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldIcon className="h-5 w-5" />
            Управление сессиями WB (Enhanced)
          </CardTitle>
          <CardDescription>
            Улучшенная система управления сессиями с полной поддержкой localStorage, sessionStorage и защитой от состояний гонки
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Статистика сессий */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Статистика сессий
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.activeSessions}</div>
                <div className="text-sm text-gray-600">Активные</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalSessions}</div>
                <div className="text-sm text-gray-600">Всего</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.lastLoginAt ? formatDate(stats.lastLoginAt) : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Последний вход</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatDuration(stats.averageSessionDuration)}
                </div>
                <div className="text-sm text-gray-600">Средняя длительность</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Статус текущей сессии */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Текущая сессия
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentSessionId ? (
                <>
                  <CheckIcon className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">Сессия активна</span>
                  <Badge variant="secondary">{currentSessionId}</Badge>
                </>
              ) : (
                <>
                  <XIcon className="h-5 w-5 text-red-500" />
                  <span className="text-red-600 font-medium">Сессия не активна</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Действия с сессией */}
      <Card>
        <CardHeader>
          <CardTitle>Действия с сессией</CardTitle>
          <CardDescription>
            Управление сессиями WB с улучшенной архитектурой
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handleAction('authenticate', { headless: false, timeout: 120000 })}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <RefreshIcon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserIcon className="h-4 w-4 mr-2" />
              )}
              Авторизация
            </Button>

            <Button
              onClick={() => handleAction('restore')}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <RefreshIcon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshIcon className="h-4 w-4 mr-2" />
              )}
              Восстановить
            </Button>

            <Button
              onClick={() => handleAction('refresh')}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <RefreshIcon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshIcon className="h-4 w-4 mr-2" />
              )}
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Сообщения */}
      {message && (
        <Alert className={`
          ${message.type === 'success' ? 'border-green-200 bg-green-50' : ''}
          ${message.type === 'error' ? 'border-red-200 bg-red-50' : ''}
          ${message.type === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}
          ${message.type === 'info' ? 'border-blue-200 bg-blue-50' : ''}
        `}>
          <AlertDescription className="flex items-center gap-2">
            {message.type === 'success' && <CheckIcon className="h-4 w-4 text-green-600" />}
            {message.type === 'error' && <XIcon className="h-4 w-4 text-red-600" />}
            {message.type === 'warning' && <WarningIcon className="h-4 w-4 text-yellow-600" />}
            {message.type === 'info' && <InfoIcon className="h-4 w-4 text-blue-600" />}
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Информация о новой архитектуре */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InfoIcon className="h-5 w-5" />
            Новая архитектура сессий
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              Полная поддержка localStorage и sessionStorage
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              Защита от состояний гонки
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              Улучшенное шифрование данных
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              Автоматическая валидация сессий
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              Стабильное восстановление сессий
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
