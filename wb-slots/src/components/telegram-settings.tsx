'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FiMessageCircle as MessageCircle,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiSettings as Settings,
  FiSend as Send,
  FiUser as User,
  FiClock as Clock,
  FiAlertTriangle as AlertTriangle,
  FiInfo as Info,
  FiLoader as Loader2,
  FiSave as Save,
  FiPlus as Plus,
  FiEdit as Edit,
  FiTrash2 as Trash2,
  FiMessageSquare as Bot,
  FiShield as Shield,
  FiRefreshCw as RefreshCw,
  FiEye as Eye,
  FiEyeOff as EyeOff,
  FiCheck as Check,
  FiX as X,
} from 'react-icons/fi';

interface TelegramUser {
  chatId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  registeredAt: string;
}

interface TelegramStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  botInitialized: boolean;
}

interface TelegramSettings {
  chatId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  notificationTypes: string[];
  testMode: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  language: string;
  timezone: string;
}

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

interface TelegramSettingsProps {
  showAdminSettings?: boolean;
  compact?: boolean;
}

export default function TelegramSettings({ showAdminSettings = false, compact = false }: TelegramSettingsProps) {
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
  const [skipValidation, setSkipValidation] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    type: 'SLOT_FOUND',
    template: '',
    variables: {}
  });

  // Legacy state for compatibility
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [stats, setStats] = useState<TelegramStats | null>(null);
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Additional state for compatibility
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const loadAdminSettings = useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      const response = await fetch('/api/settings/telegram/admin');
      const data = await response.json();
      
      if (response.ok) {
        setBotToken(data.botToken || '');
        setTemplates(data.templates || []);
        
        // Check if bot is configured
        if (data.botTokenConfigured) {
          try {
            const testResponse = await fetch('/api/settings/telegram/test-bot');
            const testData = await testResponse.json();
            
            if (testData.success) {
              setBotInfo({
                valid: true,
                botInfo: testData.botInfo
              });
            } else {
              setBotInfo({
                valid: false,
                error: testData.error || 'Bot test failed'
              });
            }
          } catch (error) {
            setBotInfo({
              valid: false,
              error: 'Failed to test bot connection'
            });
          }
        } else {
          setBotInfo({
            valid: false,
            error: 'Bot token not configured'
          });
        }
      } else {
        setError(data.error || 'Ошибка загрузки административных настроек');
      }
    } catch (error) {
      console.error('Error loading admin settings:', error);
      setError('Ошибка загрузки административных настроек');
    }
  }, [isAdmin]);

  const checkAdminAccess = useCallback(async () => {
    if (!showAdminSettings) return;
    
    try {
      const response = await fetch('/api/settings/telegram/admin');
      if (response.ok) {
        setIsAdmin(true);
        loadAdminSettings();
      }
    } catch (error) {
      console.log('User is not admin');
    }
  }, [showAdminSettings, loadAdminSettings]);

  const loadUserSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Try new API first
      const response = await fetch('/api/settings/telegram/user');
      const data = await response.json();

      if (response.ok) {
        setChatId(data.chatId || '');
        setEnabled(data.enabled || false);
        setTelegramUserInfo(data.userInfo || null);
        
        // Also try legacy API for compatibility
        try {
          const legacyResponse = await fetch('/api/notifications/telegram');
          const legacyData = await legacyResponse.json();
          
          if (legacyData.success) {
            setUser(legacyData.data.user);
            setStats(legacyData.data.stats);
            setSettings(legacyData.data.settings);
          }
        } catch (legacyError) {
          console.log('Legacy API not available');
        }
      } else {
        setError(data.error || 'Ошибка загрузки настроек');
      }
    } catch (error) {
      setError('Ошибка загрузки настроек');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserSettings();
    checkAdminAccess();
  }, [loadUserSettings, checkAdminAccess]);

  const handleSaveUserSettings = async () => {
    try {
      setIsSaving(true);
    setError('');
    setSuccess('');

      // Get Telegram user info if chatId is provided
      let userInfo = null;
      if (chatId) {
        try {
          const userInfoResponse = await fetch('/api/settings/telegram/get-user-info', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatId }),
          });

          if (userInfoResponse.ok) {
            const userInfoData = await userInfoResponse.json();
            if (userInfoData.success) {
              userInfo = userInfoData.userInfo;
            }
          }
        } catch (error) {
          console.warn('Failed to get user info:', error);
        }
      }

      const response = await fetch('/api/settings/telegram/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId || null,
          enabled,
          userInfo
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Настройки сохранены успешно');
        await loadUserSettings();
      } else {
        setError(data.error || 'Ошибка сохранения настроек');
      }
    } catch (error) {
      console.error('Error saving user settings:', error);
      setError('Ошибка сохранения настроек');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChatIdChange = async (newChatId: string) => {
    setChatId(newChatId);
    
    // Auto-fetch user info when chatId is entered
    if (newChatId && newChatId.length > 5) {
      try {
        const userInfoResponse = await fetch('/api/settings/telegram/get-user-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chatId: newChatId }),
        });

        if (userInfoResponse.ok) {
          const userInfoData = await userInfoResponse.json();
          if (userInfoData.success) {
            setTelegramUserInfo(userInfoData.userInfo);
          } else {
            setTelegramUserInfo(null);
          }
        }
      } catch (error) {
        console.warn('Failed to get Telegram user info:', error);
        setTelegramUserInfo(null);
      }
    } else {
      setTelegramUserInfo(null);
    }
  };

  const handleTestNotification = async () => {
    if (!chatId) {
      setError('Chat ID обязателен для тестового сообщения');
      return;
    }

    setIsTestLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Тестовое сообщение отправлено! Проверьте Telegram.');
      } else {
        setError(data.error || 'Ошибка отправки тестового сообщения');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setError('Ошибка отправки тестового сообщения');
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleTestIntegration = async (testType: string) => {
    setIsTestLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/settings/telegram/test-integration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Тестовое уведомление отправлено! Проверьте Telegram.');
      } else {
        setError(data.error || 'Ошибка отправки тестового уведомления');
      }
    } catch (error) {
      console.error('Error sending test integration notification:', error);
      setError('Ошибка отправки тестового уведомления');
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleSaveBotToken = async () => {
    if (!botToken) {
      setError('Токен бота обязателен');
      return;
    }

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
          action: 'update_bot_token',
          data: { botToken }
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Токен бота сохранен успешно');
        await loadAdminSettings();
      } else {
        setError(data.error || 'Ошибка сохранения токена бота');
      }
    } catch (error) {
      console.error('Error saving bot token:', error);
      setError('Ошибка сохранения токена бота');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.template) {
      setError('Название и шаблон обязательны');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/settings/telegram/templates', {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...templateForm,
          id: editingTemplate?.id
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(editingTemplate ? 'Шаблон обновлен успешно' : 'Шаблон создан успешно');
        setShowTemplateForm(false);
        setEditingTemplate(null);
        setTemplateForm({
          name: '',
          description: '',
          type: 'SLOT_FOUND',
          template: '',
          variables: {}
        });
        await loadAdminSettings();
      } else {
        setError(data.error || 'Ошибка сохранения шаблона');
      }
    } catch (error) {
      console.error('Error saving template:', error);
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

      const response = await fetch(`/api/settings/telegram/templates/${templateId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Шаблон удален успешно');
        await loadAdminSettings();
      } else {
        setError(data.error || 'Ошибка удаления шаблона');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
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

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Quick Status */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Telegram уведомления</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {telegramUserInfo ? `Настроено (${telegramUserInfo.first_name || 'Пользователь'})` : 'Не настроено'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {telegramUserInfo ? (
              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Активно
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="w-3 h-3 mr-1" />
                Неактивно
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        {telegramUserInfo ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={handleTestNotification}
                disabled={isTestLoading}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {isTestLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Тест
              </Button>
              <Button
                onClick={handleSaveUserSettings}
                disabled={isSaving}
                size="sm"
                className="flex-1"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Сохранить
              </Button>
            </div>
            
            {/* Integration Test Buttons */}
            <div className="flex gap-1">
              <Button
                onClick={() => handleTestIntegration('slots')}
                disabled={isTestLoading}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                {isTestLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <MessageCircle className="w-3 h-3 mr-1" />
                )}
                Слоты
              </Button>
              <Button
                onClick={() => handleTestIntegration('booking-success')}
                disabled={isTestLoading}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                {isTestLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3 mr-1" />
                )}
                Успех
              </Button>
              <Button
                onClick={() => handleTestIntegration('booking-error')}
                disabled={isTestLoading}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                {isTestLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Ошибка
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={chatId}
              onChange={(e) => handleChatIdChange(e.target.value)}
              placeholder="Введите Chat ID"
            />
            <Button
              onClick={handleSaveUserSettings}
              disabled={isSaving || !chatId}
              size="sm"
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <User className="w-4 h-4 mr-2" />
              )}
              Настроить
            </Button>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="user" className="space-y-6">
        <TabsList>
          <TabsTrigger value="user" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Пользовательские настройки
          </TabsTrigger>
          {isAdmin && showAdminSettings && (
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Настройки разработчика
            </TabsTrigger>
          )}
        </TabsList>

        {/* User Settings Tab */}
        <TabsContent value="user" className="space-y-6">
          {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Статус Telegram уведомлений
          </CardTitle>
          <CardDescription>
            Управление настройками уведомлений в Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Статус бота</Label>
              <div className="flex items-center gap-2">
                    {botInfo?.valid ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-600">Инициализирован</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600">Не инициализирован</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Ваш статус</Label>
              <div className="flex items-center gap-2">
                    {telegramUserInfo ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-600">Настроено</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">Не настроено</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {stats && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium mb-2">Статистика</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Всего пользователей:</span>
                  <span className="ml-2 font-medium">{stats.totalUsers}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Активных:</span>
                  <span className="ml-2 font-medium text-green-600">{stats.activeUsers}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Неактивных:</span>
                  <span className="ml-2 font-medium text-gray-600">{stats.inactiveUsers}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

          {/* User Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
                Настройки уведомлений
            </CardTitle>
            <CardDescription>
                Настройте получение уведомлений в Telegram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chatId">Chat ID *</Label>
                <div className="flex gap-2">
                  <Input
                    id="chatId"
                    value={chatId}
                    onChange={(e) => handleChatIdChange(e.target.value)}
                    placeholder="Ваш Chat ID в Telegram"
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open('https://t.me/chatIDrobot', '_blank')}
                    className="shrink-0"
                    title="Получить Chat ID"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Получить ID
                  </Button>
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <p className="font-medium">Как получить Chat ID:</p>
                    <ol className="list-decimal list-inside space-y-0.5 ml-2">
                      <li>Нажмите кнопку "Получить ID"</li>
                      <li>Откроется бот @chatIDrobot в Telegram</li>
                      <li>Нажмите START или отправьте любое сообщение</li>
                      <li>Бот отправит вам ваш Chat ID</li>
                      <li>Скопируйте число и вставьте в поле выше</li>
                    </ol>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                  <Label>Включить уведомления</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="rounded border-gray-300"
                      title="Включить уведомления"
                    />
                    <Label htmlFor="enabled" className="text-sm">
                      Получать уведомления о найденных слотах
                    </Label>
              </div>
            </div>
              </div>
              
              {telegramUserInfo && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-800 dark:text-green-300">
                      Информация о пользователе
                    </span>
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-400">
                    <p>Chat ID: {telegramUserInfo.id}</p>
                    {telegramUserInfo.username && <p>Username: @{telegramUserInfo.username}</p>}
                    {telegramUserInfo.first_name && (
                      <p>Имя: {telegramUserInfo.first_name} {telegramUserInfo.last_name}</p>
                    )}
              </div>
            </div>
              )}

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveUserSettings}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить настройки
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleTestNotification}
                    disabled={isTestLoading || !chatId}
                    variant="outline"
                  >
                    {isTestLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Тестовое сообщение
                      </>
                    )}
                  </Button>
                </div>

                {/* Integration Test Buttons */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Тестирование интеграции:
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleTestIntegration('slots')}
                      disabled={isTestLoading}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {isTestLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <MessageCircle className="w-4 h-4 mr-2" />
                      )}
                      Тест слотов
                    </Button>
                    <Button
                      onClick={() => handleTestIntegration('booking-success')}
                      disabled={isTestLoading}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {isTestLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Тест успеха
                    </Button>
                    <Button
                      onClick={() => handleTestIntegration('booking-error')}
                      disabled={isTestLoading}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {isTestLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Тест ошибки
                    </Button>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>

          {/* Notification Types Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Типы уведомлений
          </CardTitle>
          <CardDescription>
            Какие уведомления вы будете получать
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600">🎯</Badge>
                <span className="text-sm">Слот найден</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-blue-600">🚀</Badge>
                <span className="text-sm">Начало бронирования</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600">✅</Badge>
                <span className="text-sm">Успешная бронь</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-red-600">❌</Badge>
                <span className="text-sm">Ошибка бронирования</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-yellow-600">🤖</Badge>
                <span className="text-sm">Нужна капча</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-gray-600">📋</Badge>
                <span className="text-sm">Статус задач</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Admin Settings Tab */}
        {isAdmin && showAdminSettings && (
          <TabsContent value="admin" className="space-y-6">
            {/* Bot Token Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Настройка бота
                </CardTitle>
                <CardDescription>
                  Настройте токен бота от @BotFather
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="botToken">Токен бота</Label>
                  <Input
                    id="botToken"
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  />
                  <p className="text-xs text-gray-500">
                    Получите токен у @BotFather в Telegram
                  </p>
                </div>

                {botInfo && (
                  <div className={`p-4 rounded-lg ${
                    botInfo.valid 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {botInfo.valid ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className={`font-medium ${
                        botInfo.valid 
                          ? 'text-green-800 dark:text-green-300'
                          : 'text-red-800 dark:text-red-300'
                      }`}>
                        {botInfo.valid ? 'Бот настроен корректно' : 'Ошибка настройки бота'}
                      </span>
                    </div>
                    {botInfo.valid && botInfo.botInfo && (
                      <div className="text-sm text-green-700 dark:text-green-400">
                        <p>Имя: {botInfo.botInfo.first_name}</p>
                        <p>Username: @{botInfo.botInfo.username}</p>
                      </div>
                    )}
                    {!botInfo.valid && botInfo.error && (
                      <div className="text-sm text-red-700 dark:text-red-400">
                        <p>Ошибка: {botInfo.error}</p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleSaveBotToken}
                  disabled={isSaving || !botToken}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Сохранить токен
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Templates Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Шаблоны уведомлений
                </CardTitle>
                <CardDescription>
                  Управление шаблонами сообщений
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Список шаблонов</h4>
                  <Button
                    onClick={() => setShowTemplateForm(true)}
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить шаблон
                  </Button>
                </div>

                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex-1">
                        <h5 className="font-medium">{template.name}</h5>
                        <p className="text-sm text-gray-500">{template.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{template.type}</Badge>
                          <Badge variant={template.isActive ? "default" : "secondary"}>
                            {template.isActive ? "Активен" : "Неактивен"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleEditTemplate(template)}
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteTemplate(template.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Template Form */}
                {showTemplateForm && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                    <h5 className="font-medium">
                      {editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="templateName">Название</Label>
                        <Input
                          id="templateName"
                          value={templateForm.name}
                          onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Название шаблона"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="templateType">Тип</Label>
                        <select
                          id="templateType"
                          value={templateForm.type}
                          onChange={(e) => setTemplateForm(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          title="Выберите тип шаблона"
                        >
                          <option value="SLOT_FOUND">Слот найден</option>
                          <option value="BOOKING_STARTED">Начало бронирования</option>
                          <option value="BOOKING_SUCCESS">Успешная бронь</option>
                          <option value="BOOKING_ERROR">Ошибка бронирования</option>
                          <option value="CAPTCHA_REQUIRED">Нужна капча</option>
                          <option value="TASK_STATUS">Статус задачи</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="templateDescription">Описание</Label>
                      <Input
                        id="templateDescription"
                        value={templateForm.description}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Описание шаблона"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="templateContent">Шаблон сообщения</Label>
                      <Textarea
                        id="templateContent"
                        value={templateForm.template}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, template: e.target.value }))}
                        placeholder="Введите шаблон сообщения..."
                        rows={4}
                      />
                      <p className="text-xs text-gray-500">
                        Используйте переменные: {['{slotId}', '{warehouseName}', '{date}', '{time}'].join(', ')}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveTemplate}
                        disabled={isSaving || !templateForm.name || !templateForm.template}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {editingTemplate ? 'Обновить' : 'Создать'}
                      </Button>
                      <Button
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
                        variant="outline"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
