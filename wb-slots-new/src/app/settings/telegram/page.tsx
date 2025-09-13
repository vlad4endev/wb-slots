'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, ArrowLeft, Check, X, Settings, Bot, MessageSquare, Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import TelegramAuthButton from '@/components/telegram-auth-button';
import DashboardLayout from '@/app/dashboard-layout';

interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  template: string;
  variables: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TelegramSettingsPage() {
  // User settings state
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [telegramUserInfo, setTelegramUserInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Admin settings state
  const [botToken, setBotToken] = useState('');
  const [botInfo, setBotInfo] = useState<any>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    type: 'SLOT_FOUND',
    template: '',
    variables: {}
  });

  useEffect(() => {
    loadUserSettings();
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const response = await fetch('/api/settings/telegram/admin');
      if (response.ok) {
        setIsAdmin(true);
        loadAdminSettings();
      }
    } catch (error) {
      console.log('User is not admin');
    }
  };

  const loadUserSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/telegram/user');
      const data = await response.json();

      if (response.ok) {
        setChatId(data.chatId || '');
        setEnabled(data.enabled || false);
        setTelegramUserInfo(data.userInfo || null);
      } else {
        setError(data.error || 'Ошибка загрузки настроек');
      }
    } catch (error) {
      setError('Ошибка загрузки настроек');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminSettings = async () => {
    try {
      const response = await fetch('/api/settings/telegram/admin');
      const data = await response.json();

      if (response.ok) {
        setBotToken(data.botToken || '');
        setTemplates(data.templates || []);
      } else {
        setError(data.error || 'Ошибка загрузки административных настроек');
      }

      // Загружаем информацию о боте
      const botResponse = await fetch('/api/settings/telegram/bot-token');
      if (botResponse.ok) {
        const botData = await botResponse.json();
        setBotInfo(botData);
      }
    } catch (error) {
      console.error('Error loading admin settings:', error);
      setError('Ошибка загрузки административных настроек');
    }
  };

  const handleSaveUserSettings = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/settings/telegram/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          enabled,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Настройки Telegram сохранены');
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
      setIsSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Тестовое уведомление отправлено');
      } else {
        setError(data.error || 'Ошибка отправки тестового уведомления');
      }
    } catch (error) {
      setError('Ошибка отправки тестового уведомления');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTelegramAuthSuccess = (telegramId: string, userInfo: any) => {
    setChatId(telegramId);
    setEnabled(true);
    setTelegramUserInfo(userInfo);
    setSuccess('Telegram ID получен и сохранен автоматически!');
    setError('');
  };

  const handleTelegramAuthError = (error: string) => {
    setError(error);
    setSuccess('');
  };

  const handleUpdateBotToken = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/settings/telegram/bot-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botToken,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setBotInfo(data.botInfo);
        // Перезагружаем страницу для применения нового токена
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(data.error || 'Ошибка обновления токена бота');
      }
    } catch (error) {
      setError('Ошибка обновления токена бота');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const action = editingTemplate ? 'update_template' : 'create_template';
      const data = editingTemplate 
        ? { id: editingTemplate.id, ...templateForm }
        : templateForm;

      const response = await fetch('/api/settings/telegram/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          data
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(result.message);
        setShowTemplateForm(false);
        setEditingTemplate(null);
        setTemplateForm({
          name: '',
          description: '',
          type: 'SLOT_FOUND',
          template: '',
          variables: {}
        });
        loadAdminSettings();
      } else {
        setError(result.error || 'Ошибка сохранения шаблона');
      }
    } catch (error) {
      setError('Ошибка сохранения шаблона');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) return;

    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/settings/telegram/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete_template',
          data: { templateId }
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(result.message);
        loadAdminSettings();
      } else {
        setError(result.error || 'Ошибка удаления шаблона');
      }
    } catch (error) {
      setError('Ошибка удаления шаблона');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      type: template.type,
      template: template.template,
      variables: template.variables || {}
    });
    setShowTemplateForm(true);
  };

  const templateTypes = [
    { value: 'SLOT_FOUND', label: 'Слот найден' },
    { value: 'BOOKING_SUCCESS', label: 'Бронирование успешно' },
    { value: 'BOOKING_FAILED', label: 'Ошибка бронирования' },
    { value: 'TASK_STARTED', label: 'Задача запущена' },
    { value: 'TASK_COMPLETED', label: 'Задача завершена' },
    { value: 'TASK_FAILED', label: 'Задача провалена' },
    { value: 'TASK_STOPPED', label: 'Задача остановлена' }
  ];

  const availableVariables = {
    SLOT_FOUND: ['taskName', 'warehouseName', 'boxTypeName', 'coefficient', 'date', 'time'],
    BOOKING_SUCCESS: ['taskName', 'supplyId', 'warehouseName', 'boxTypeName', 'date', 'time'],
    BOOKING_FAILED: ['taskName', 'error', 'warehouseName', 'boxTypeName', 'date', 'time'],
    TASK_STARTED: ['taskName', 'userId', 'date', 'time'],
    TASK_COMPLETED: ['taskName', 'foundSlots', 'bookedSlots', 'date', 'time'],
    TASK_FAILED: ['taskName', 'error', 'date', 'time'],
    TASK_STOPPED: ['taskName', 'reason', 'date', 'time']
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/settings">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Назад к настройкам
                  </Button>
                </Link>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Настройки Telegram
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Управление уведомлениями и ботом
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">

        {error && (
          <Alert className="mb-6" variant="destructive">
            <X className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6" variant="default">
            <Check className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="user" className="space-y-6">
          <TabsList>
            <TabsTrigger value="user" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Пользовательские настройки
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Настройки разработчика
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="user" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Telegram уведомления</CardTitle>
                <CardDescription>
                  Настройте получение уведомлений о найденных слотах и бронировании
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Информация о Telegram пользователе */}
                {telegramUserInfo && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">Telegram пользователь</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Имя:</strong> {telegramUserInfo.firstName} {telegramUserInfo.lastName || ''}</p>
                      {telegramUserInfo.username && (
                        <p><strong>Username:</strong> @{telegramUserInfo.username}</p>
                      )}
                      <p><strong>Chat ID:</strong> {chatId}</p>
                    </div>
                  </div>
                )}

                {/* Автоматическое получение Telegram ID */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Автоматическое получение Telegram ID</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Получите ваш Telegram ID автоматически через Telegram Web App
                    </p>
                    <TelegramAuthButton
                      onSuccess={handleTelegramAuthSuccess}
                      onError={handleTelegramAuthError}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Или введите вручную</span>
                  </div>
                </div>

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

                <div className="flex gap-3">
                  <Button onClick={handleSaveUserSettings} disabled={isSaving || !chatId}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Сохранить
                  </Button>

                  {chatId && (
                    <Button variant="outline" onClick={handleTestNotification} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Тест
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Инструкция по настройке</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">1. Получение Chat ID</h4>
                  <p className="text-sm text-gray-600">
                    Напишите боту @userinfobot в Telegram и отправьте любое сообщение. 
                    Бот вернет ваш Chat ID.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">2. Типы уведомлений</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>• <Badge variant="outline">Слот найден</Badge> - когда найден подходящий слот</div>
                    <div>• <Badge variant="outline">Бронирование начато</Badge> - когда начинается авто-бронирование</div>
                    <div>• <Badge variant="outline">Бронирование завершено</Badge> - когда слот успешно забронирован</div>
                    <div>• <Badge variant="outline">Ошибка бронирования</Badge> - при ошибках в процессе</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Настройки бота
                  </CardTitle>
                  <CardDescription>
                    Управление токеном бота и глобальными настройками
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {botInfo && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-2">Текущий бот:</h4>
                      {botInfo.valid ? (
                        <div className="space-y-1">
                          <p className="text-sm"><strong>Имя:</strong> {botInfo.botInfo?.firstName}</p>
                          <p className="text-sm"><strong>Username:</strong> @{botInfo.botInfo?.username}</p>
                          <p className="text-sm"><strong>ID:</strong> {botInfo.botInfo?.id}</p>
                          <Badge variant="default" className="mt-2">✅ Активен</Badge>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm text-red-600">❌ Токен недействителен</p>
                          <Badge variant="destructive" className="mt-2">Неактивен</Badge>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="botToken">Новый Bot Token</Label>
                    <Input
                      id="botToken"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="Введите новый токен бота от @BotFather"
                      type="password"
                    />
                    <p className="text-sm text-gray-500">
                      Токен будет автоматически сохранен в .env.local и применен
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleUpdateBotToken}
                      disabled={isSaving || !botToken}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Обновить токен
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setBotToken('');
                        setError('');
                        setSuccess('');
                      }}
                    >
                      Очистить
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Шаблоны уведомлений
                    </div>
                    <Button onClick={() => setShowTemplateForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Создать шаблон
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Управление шаблонами сообщений для различных типов уведомлений
                  </CardDescription>
                </CardHeader>
                {error && error.includes('NotificationTemplate table not found') && (
                  <div className="px-6 pb-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Требуется миграция базы данных:</strong> Таблица NotificationTemplate не найдена. 
                        Выполните команду <code className="bg-gray-100 px-1 rounded">npx prisma migrate dev</code> для создания таблицы шаблонов.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                <CardContent>
                  {templates.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Нет созданных шаблонов</p>
                  ) : (
                    <div className="space-y-4">
                      {templates.map((template) => (
                        <div key={template.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-sm text-gray-500">{template.description}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTemplate(template)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTemplate(template.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Badge variant="outline">
                              {templateTypes.find(t => t.value === template.type)?.label || template.type}
                            </Badge>
                            <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                              {template.template}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {showTemplateForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="templateName">Название</Label>
                        <Input
                          id="templateName"
                          value={templateForm.name}
                          onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                          placeholder="Название шаблона"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="templateType">Тип</Label>
                        <select
                          id="templateType"
                          value={templateForm.type}
                          onChange={(e) => setTemplateForm({...templateForm, type: e.target.value})}
                          className="w-full p-2 border rounded-md"
                          title="Выберите тип шаблона"
                        >
                          {templateTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="templateDescription">Описание</Label>
                      <Input
                        id="templateDescription"
                        value={templateForm.description}
                        onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                        placeholder="Описание шаблона"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="templateContent">Шаблон сообщения</Label>
                      <Textarea
                        id="templateContent"
                        value={templateForm.template}
                        onChange={(e) => setTemplateForm({...templateForm, template: e.target.value})}
                        placeholder="HTML шаблон с переменными"
                        rows={6}
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Доступные переменные:</p>
                        <div className="flex flex-wrap gap-1">
                          {availableVariables[templateForm.type as keyof typeof availableVariables]?.map(variable => (
                            <Badge key={variable} variant="secondary" className="text-xs">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button onClick={handleSaveTemplate} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {editingTemplate ? 'Обновить' : 'Создать'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowTemplateForm(false);
                          setEditingTemplate(null);
                          setTemplateForm({
                            name: '',
                            description: '',
                            type: 'SLOT_FOUND',
                            template: '',
                            variables: {}
                          });
                        }}
                      >
                        Отмена
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}