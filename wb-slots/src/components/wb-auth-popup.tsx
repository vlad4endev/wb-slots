'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FiShield as Shield,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiAlertTriangle as AlertTriangle,
  FiLoader as Loader2,
  FiEye as Eye,
  FiEyeOff as EyeOff,
  FiExternalLink as ExternalLink,
  FiRefreshCw as RefreshCw,
  FiInfo as Info
} from 'react-icons/fi';

interface WbAuthPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionData: any) => void;
  userId?: string; // Опциональный - если не передан, получим из сессии
}

interface AuthFormData {
  email: string;
  password: string;
  phone?: string;
}

interface SessionStatus {
  isActive: boolean;
  lastLogin?: string;
  expiresAt?: string;
}

export default function WbAuthPopup({ isOpen, onClose, onSuccess, userId: propUserId }: WbAuthPopupProps) {
  const [activeTab, setActiveTab] = useState<'popup' | 'status'>('popup');
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [popupStatus, setPopupStatus] = useState<{
    isActive: boolean;
    progress: string;
  }>({
    isActive: false,
    progress: ''
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null);

  // Функция загрузки статуса сессии (объявлена ДО useEffect)
  const loadSessionStatus = useCallback(async () => {
    if (!currentUserId) {
      console.warn('Cannot load session status: userId is not available');
      return;
    }
    
    try {
      console.log('[loadSessionStatus] Loading status for userId:', currentUserId);
      const response = await fetch(`/api/wb-session/status?userId=${currentUserId}`);
      if (response.ok) {
        const status = await response.json();
        console.log('[loadSessionStatus] Status received:', status.data);
        setSessionStatus(status.data);
        
        if (status.data.isActive) {
          setActiveTab('status');
        }
      }
    } catch (error) {
      console.error('Failed to load session status:', error);
    }
  }, [currentUserId]);

  // Функция проверки статуса popup (объявлена ДО useEffect)
  const checkPopupStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/wb-auth/popup');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPopupStatus(prev => ({
            ...prev,
            isActive: result.data.isActive
          }));
        }
      }
    } catch (error) {
      console.error('Failed to check popup status:', error);
    }
  }, []);

  // Получаем userId из сессии, если не передан как prop
  useEffect(() => {
    if (isOpen && !currentUserId) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data?.success && data?.data?.user?.id) {
            console.log('[WbAuthPopup] Got userId from /api/auth/me:', data.data.user.id);
            setCurrentUserId(data.data.user.id);
          } else {
            console.error('[WbAuthPopup] Failed to get userId from /api/auth/me:', data);
          }
        })
        .catch(error => console.error('Failed to get user session:', error));
    }
  }, [isOpen, currentUserId]);

  // Загружаем статус сессии при открытии
  useEffect(() => {
    if (isOpen && currentUserId) {
      loadSessionStatus();
      checkPopupStatus();
    }
  }, [isOpen, currentUserId, loadSessionStatus, checkPopupStatus]);

  // Проверяем статус popup каждые 2 секунды
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isOpen && popupStatus.isActive) {
      interval = setInterval(checkPopupStatus, 2000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isOpen, popupStatus.isActive, checkPopupStatus]);

  const startPopupAuth = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/wb-auth/popup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });

      const result = await response.json();

      if (result.success) {
        setPopupStatus({
          isActive: true,
          progress: 'Браузер запущен. Выполните авторизацию в открывшемся окне...'
        });
        setSuccess('Браузер запущен! Выполните авторизацию в открывшемся окне.');
      } else {
        setError(result.error || 'Ошибка запуска браузера');
          }
        } catch (error) {
      setError('Ошибка сети. Проверьте подключение к интернету.');
    } finally {
      setIsLoading(false);
    }
  };

  const closePopupAuth = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/wb-auth/popup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'close' }),
      });

      const result = await response.json();

      if (result.success) {
        setPopupStatus({
          isActive: false,
          progress: ''
        });
        setSuccess('Браузер закрыт');
      } else {
        setError(result.error || 'Ошибка закрытия браузера');
      }
    } catch (error) {
      setError('Ошибка закрытия браузера');
    } finally {
      setIsLoading(false);
    }
  };

  const forceSaveSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/wb-auth/popup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'force-save' }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Сессия сохранена! Браузер будет закрыт.');
        setPopupStatus({
          isActive: false,
          progress: ''
        });
        
        // Ждем немного перед обновлением статуса
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Обновляем статус сессии
        await loadSessionStatus();
        
        // Вызываем callback с данными сессии
        onSuccess({ message: 'Сессия сохранена принудительно' });
        
        // Переключаемся на вкладку статуса
        setActiveTab('status');
      } else {
        setError(result.error || 'Ошибка сохранения сессии');
      }
    } catch (error) {
      setError('Ошибка сохранения сессии');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof AuthFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };


  const handleRefreshSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/wb-session/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Сессия обновлена успешно!');
        await loadSessionStatus();
      } else {
        setError(result.error || 'Ошибка обновления сессии');
      }
    } catch (error) {
      setError('Ошибка обновления сессии');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/wb-session/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Сессия завершена');
        setSessionStatus(null);
        setActiveTab('login');
      } else {
        setError(result.error || 'Ошибка завершения сессии');
      }
    } catch (error) {
      setError('Ошибка завершения сессии');
    } finally {
      setIsLoading(false);
    }
  };

  const openWbSeller = () => {
    window.open('https://seller.wildberries.ru/', '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Авторизация Wildberries
          </DialogTitle>
          <DialogDescription>
            Войдите в личный кабинет Wildberries для автоматического бронирования слотов
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'popup' | 'status')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="popup">Авторизация</TabsTrigger>
            <TabsTrigger value="status">Статус сессии</TabsTrigger>
          </TabsList>

          <TabsContent value="popup" className="space-y-4">
            <Card>
        <CardHeader>
                <CardTitle className="text-lg">Авторизация через браузер</CardTitle>
                <CardDescription>
                  Откройте браузер для входа в личный кабинет Wildberries. 
                  Система автоматически сохранит сессию после перехода в раздел поставок.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Статус popup */}
                {popupStatus.isActive && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="font-medium text-blue-800 dark:text-blue-300">
                        Браузер активен
                      </span>
            </div>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      {popupStatus.progress}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={forceSaveSession}
                        size="sm"
                        disabled={isLoading}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Сохранение...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Сохранить сессию
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={closePopupAuth}
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                      >
                        Закрыть браузер
                      </Button>
                    </div>
                  </div>
                )}

                {/* Инструкции */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Нажмите "Открыть браузер"</p>
                      <p className="text-xs text-gray-500">Браузер откроется сразу на странице поставок</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Войдите в личный кабинет (если нужно)</p>
                      <p className="text-xs text-gray-500">Если потребуется авторизация, войдите в ЛК</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Сессия сохранится автоматически</p>
                      <p className="text-xs text-gray-500">Система автоматически сохранит cookies и данные</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Сессия сохранена автоматически</p>
                      <p className="text-xs text-gray-500">Система автоматически сохранит данные для автобронирования</p>
                    </div>
                  </div>

                  {popupStatus.isActive && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-800 dark:text-blue-300">
                          Браузер открыт
                        </span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        Браузер останется открытым до завершения авторизации. 
                        Завершите вход в личный кабинет WB, затем нажмите "Сохранить сессию" 
                        для сохранения данных авторизации.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={startPopupAuth}
                    disabled={isLoading || popupStatus.isActive}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Запуск...
                      </>
                    ) : popupStatus.isActive ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Браузер активен
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Открыть браузер
                      </>
                    )}
                  </Button>
                  
                  {popupStatus.isActive && (
                    <Button
                      variant="outline"
                      onClick={forceSaveSession}
                      disabled={isLoading}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Сохранить сессию
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={openWbSeller}
                    disabled={isLoading}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Открыть WB
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Статус сессии</CardTitle>
          <CardDescription>
                  Информация о текущей сессии авторизации
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
                {sessionStatus ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {sessionStatus.isActive ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-green-600 font-medium">Сессия активна</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-600" />
                          <span className="text-red-600 font-medium">Сессия неактивна</span>
                        </>
                      )}
                    </div>

                    {/* Детальная информация о сессии */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sessionStatus.lastLogin && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Последний вход
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(sessionStatus.lastLogin).toLocaleString('ru-RU')}
                          </div>
            </div>
          )}

                      {sessionStatus.expiresAt && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Истекает
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(sessionStatus.expiresAt).toLocaleString('ru-RU')}
                          </div>
            </div>
          )}

                      {sessionStatus.sessionId && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            ID сессии
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {sessionStatus.sessionId.substring(0, 16)}...
              </div>
            </div>
          )}

                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Статус
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {sessionStatus.isActive ? 'Готова к автобронированию' : (sessionStatus.message || 'Требуется авторизация')}
                        </div>
                      </div>
                    </div>

                    {/* Информация о том, что сессия используется для автобронирования */}
                    {sessionStatus.isActive && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-800 dark:text-green-300">
                            Готова к работе
                          </span>
                        </div>
                        <p className="text-sm text-green-700 dark:text-green-400">
                          Сессия активна и готова для автоматического бронирования слотов. 
                          Система будет использовать сохраненные данные для входа в ЛК WB.
                </p>
              </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleRefreshSession}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Обновить
                      </Button>

                      <Button
                        onClick={handleLogout}
                        disabled={isLoading}
                        variant="destructive"
                        size="sm"
                      >
                        Завершить сессию
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Нет активной сессии
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Для работы автобронирования необходимо авторизоваться в ЛК WB
                    </p>
                    <Button
                      onClick={() => setActiveTab('popup')}
                      variant="outline"
                    >
                      Перейти к авторизации
                    </Button>
            </div>
          )}

                {error && (
            <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

                {success && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
          )}
        </CardContent>
      </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
    </div>
      </DialogContent>
    </Dialog>
  );
}