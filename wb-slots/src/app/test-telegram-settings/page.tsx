'use client';
import DebugPageGuard from '@/components/debug-page-guard';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiLoader as Loader2,
  FiMessageSquare as MessageSquare,
  FiCheck as Check,
  FiX as X,
  FiSettings as Settings
} from 'react-icons/fi';
import Link from 'next/link';

function TestTelegramSettingsPageContent() {
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/telegram');
      const data = await response.json();

      if (data.success) {
        setChatId(data.data.chatId);
        setEnabled(data.data.enabled);
        setError('');
      } else {
        setError(data.error || 'Ошибка загрузки настроек');
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

      const response = await fetch('/api/settings/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, enabled }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Настройки сохранены успешно');
        setError('');
      } else {
        setError(data.error || 'Ошибка сохранения настроек');
      }
    } catch (error) {
      setError('Ошибка сохранения настроек');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setIsLoading(true);
      setError('');
      setTestResult(null);

      const response = await fetch('/api/services/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '🧪 Тестовое уведомление!\n\n✅ Настройки Telegram работают корректно\n📅 ' + new Date().toLocaleString(),
          type: 'TASK_COMPLETED',
        }),
      });

      const data = await response.json();
      setTestResult(data);
      
      if (data.success) {
        setSuccess('Тестовое уведомление отправлено успешно');
      } else {
        setError(data.message || 'Ошибка отправки уведомления');
      }
    } catch (error) {
      setError('Ошибка отправки тестового уведомления');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setIsLoading(true);
      setError('');
      setTestResult(null);

      const response = await fetch('/api/services/telegram');
      const data = await response.json();
      
      setTestResult(data);
      
      if (data.success) {
        setSuccess('Статус получен успешно');
      } else {
        setError(data.error || 'Ошибка получения статуса');
      }
    } catch (error) {
      setError('Ошибка получения статуса');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Тестирование настроек Telegram</h1>
        <p className="text-muted-foreground">
          Проверка корректности работы TelegramService с настройками пользователя
        </p>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>
            {error}
            {error.includes('Telegram Bot Token не настроен') && (
              <div className="mt-2">
                <Link href="/telegram-setup" className="text-blue-600 hover:underline">
                  Перейти к инструкции по настройке Telegram →
                </Link>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6" variant="default">
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Настройки Telegram */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Настройки Telegram
            </CardTitle>
            <CardDescription>
              Управление настройками уведомлений
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chatId">Chat ID *</Label>
              <Input
                id="chatId"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Введите ваш Telegram Chat ID"
                required
              />
              <p className="text-sm text-gray-500">
                Для получения Chat ID напишите боту @userinfobot
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300"
                title="Включить уведомления"
              />
              <Label htmlFor="enabled">Включить уведомления</Label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !chatId}
                className="flex-1"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Сохранить
              </Button>
              <Button
                onClick={loadSettings}
                variant="outline"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                Загрузить
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Тестирование */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Тестирование
            </CardTitle>
            <CardDescription>
              Проверка работы TelegramService
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Статус:</span>
                <Badge variant={enabled && chatId ? "default" : "secondary"}>
                  {enabled && chatId ? "Настроен" : "Не настроен"}
                </Badge>
              </div>
              {chatId && (
                <div className="text-sm text-muted-foreground">
                  Chat ID: {chatId}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleTestNotification}
                disabled={isLoading || !enabled || !chatId}
                className="w-full"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                Отправить тестовое уведомление
              </Button>

              <Button
                onClick={handleCheckStatus}
                variant="outline"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Проверить статус
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Результаты тестирования */}
      {testResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Результаты тестирования</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Ссылки */}
      <div className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Link href="/settings/telegram">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Перейти к настройкам Telegram
                </Button>
              </Link>
              <Link href="/test-services">
                <Button variant="outline">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Тестирование сервисов
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function TestTelegramSettingsPage() {
  return (
    <DebugPageGuard>
      <TestTelegramSettingsPageContent />
    </DebugPageGuard>
  );
}
