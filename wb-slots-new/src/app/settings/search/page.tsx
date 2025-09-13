'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  ArrowLeft, 
  Save, 
  Clock,
  RefreshCw,
  Settings
} from 'lucide-react';
import Link from 'next/link';

interface SearchSettings {
  checkInterval: number; // Интервал проверки в секундах
  maxAttempts: number; // Максимальное количество попыток
  apiRateLimit: number; // Лимит запросов в минуту
  stopOnFirstFound: boolean; // Остановка при первом найденном слоте
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  priority: number;
  enabled: boolean;
}

export default function SearchSettingsPage() {
  const [settings, setSettings] = useState<SearchSettings>({
    checkInterval: 10, // 10 секунд (6 запросов в минуту)
    maxAttempts: 100,
    apiRateLimit: 6, // 6 запросов в минуту по правилам WB
    stopOnFirstFound: true,
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 5000,
    },
    priority: 5,
    enabled: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/search');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      setError('Ошибка загрузки настроек');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/settings/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('Настройки поиска сохранены');
      } else {
        setError(data.error || 'Ошибка сохранения настроек');
      }
    } catch (error) {
      setError('Ошибка сохранения настроек');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('retryPolicy.')) {
      const field = name.split('.')[1];
      setSettings(prev => ({
        ...prev,
        retryPolicy: {
          ...prev.retryPolicy,
          [field]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value),
        },
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value),
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Search className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Настройки поиска
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Технические параметры поиска слотов
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Основные настройки */}
          <Card>
            <CardHeader>
              <CardTitle>Основные настройки</CardTitle>
              <CardDescription>
                Базовые параметры поиска слотов
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="checkInterval">Интервал проверки (секунды)</Label>
                <Input
                  id="checkInterval"
                  name="checkInterval"
                  type="number"
                  min="10"
                  max="60"
                  value={settings.checkInterval}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-500">
                  Минимум 10 секунд (6 запросов в минуту по правилам WB)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxAttempts">Максимум попыток</Label>
                <Input
                  id="maxAttempts"
                  name="maxAttempts"
                  type="number"
                  min="10"
                  max="1000"
                  value={settings.maxAttempts}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-500">
                  Максимальное количество проверок перед остановкой
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiRateLimit">Лимит API (запросов/минуту)</Label>
                <Input
                  id="apiRateLimit"
                  name="apiRateLimit"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.apiRateLimit}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-500">
                  Согласно правилам WB: максимум 6 запросов в минуту
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="stopOnFirstFound"
                    checked={settings.stopOnFirstFound}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Остановить поиск при первом найденном слоте</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Политика повторов */}
          <Card>
            <CardHeader>
              <CardTitle>Политика повторов</CardTitle>
              <CardDescription>
                Настройки повторных попыток при ошибках
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="retryPolicy.maxRetries">Максимум повторов</Label>
                <Input
                  id="retryPolicy.maxRetries"
                  name="retryPolicy.maxRetries"
                  type="number"
                  min="0"
                  max="10"
                  value={settings.retryPolicy.maxRetries}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retryPolicy.backoffMs">Задержка между повторами (мс)</Label>
                <Input
                  id="retryPolicy.backoffMs"
                  name="retryPolicy.backoffMs"
                  type="number"
                  min="1000"
                  max="60000"
                  value={settings.retryPolicy.backoffMs}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Приоритет и статус */}
          <Card>
            <CardHeader>
              <CardTitle>Приоритет и статус</CardTitle>
              <CardDescription>
                Управление приоритетом и активностью
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Приоритет (0-10)</Label>
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  min="0"
                  max="10"
                  value={settings.priority}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-500">
                  Чем выше приоритет, тем раньше выполняется задача
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={settings.enabled}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Поиск активен</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Информация о лимитах */}
          <Card>
            <CardHeader>
              <CardTitle>Информация о лимитах</CardTitle>
              <CardDescription>
                Текущие ограничения и рекомендации
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">
                    <strong>WB API:</strong> Максимум 6 запросов в минуту
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-green-500" />
                  <span className="text-sm">
                    <strong>Рекомендуемый интервал:</strong> 10-15 секунд
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-orange-500" />
                  <span className="text-sm">
                    <strong>Автоостановка:</strong> При первом найденном слоте
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 mt-8">
          <Button
            variant="outline"
            onClick={fetchSettings}
            disabled={isSaving}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
