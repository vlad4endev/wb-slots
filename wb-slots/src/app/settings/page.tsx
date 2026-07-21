'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProtectedRoute from '@/components/protected-route';
import ChangePasswordForm from '@/components/change-password-form';
import { SaveButton } from '@/components/ui/save-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  FiSettings as Settings, 
  FiKey as Key, 
  FiPackage as Warehouse, 
  FiUser as User, 
  FiPlus as Plus, 
  FiEdit as Edit, 
  FiTrash2 as Trash2,
  FiSave as Save,
  FiEye as Eye,
  FiEyeOff as EyeOff,
  FiArrowLeft as ArrowLeft,
  FiShield as Shield,
  FiSearch as Search,
  FiMessageSquare as MessageSquare,
  FiMessageCircle as MessageCircle,
  FiMessageSquare as Bot,
  FiBell as Bell,
  FiGlobe as Globe,
  FiDatabase as Database,
  FiLock as Lock,
  FiRefreshCw as RefreshCw,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiAlertTriangle as AlertTriangle,
  FiInfo as Info,
  FiActivity as Activity,
  FiBarChart as BarChart3,
  FiZap as Zap,
  FiTarget as Target,
  FiCalendar as Calendar,
  FiClock as Clock,
  FiUsers as Users,
  FiTrendingUp as TrendingUp,
  FiPackage as Package,
  FiDollarSign as DollarSign,
  FiFileText as FileText
} from 'react-icons/fi';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';
import TelegramSettings from '@/components/telegram-settings';
import UserProfileTelegram from '@/components/user-profile-telegram';

interface UserToken {
  id: string;
  category: string;
  tokenEncrypted: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

interface Warehouse {
  id: string;
  warehouseId: number;
  warehouseName: string;
  enabled: boolean;
  boxAllowed: boolean;
  monopalletAllowed: boolean;
  supersafeAllowed: boolean;
}

interface WarehouseReference {
  id: number;
  name: string;
  isActive: boolean;
}

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
  name?: string;
  phone?: string;
  timezone: string;
  role: string;
  isProtected?: boolean;
  isActive?: boolean;
  emailVerified?: boolean;
  telegramUser?: TelegramUser;
}

interface SearchSettings {
  checkInterval: number;
  maxAttempts: number;
  apiRateLimit: number;
  stopOnFirstFound: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  priority: number;
  enabled: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general'); // Изменено: general вместо profile
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRefs, setWarehouseRefs] = useState<WarehouseReference[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingWarehouses, setIsSyncingWarehouses] = useState(false);
  const [warehouseStats, setWarehouseStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [showTelegramSettings, setShowTelegramSettings] = useState(false);
  
  // Настройки поиска
  const [searchSettings, setSearchSettings] = useState<SearchSettings>({
    checkInterval: 10,
    maxAttempts: 100,
    apiRateLimit: 6,
    stopOnFirstFound: true,
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 5000,
    },
    priority: 5,
    enabled: true,
  });
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  
  // Диалоги подтверждения
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'default',
  });

  // Формы
  const [newToken, setNewToken] = useState({
    category: 'SUPPLIES',
    token: '',
  });

  const [newWarehouse, setNewWarehouse] = useState({
    warehouseId: '',
    warehouseName: '',
    enabled: true,
    boxAllowed: true,
    monopalletAllowed: true,
    supersafeAllowed: true,
  });

  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    timezone: 'Europe/Moscow',
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Сначала проверяем аутентификацию и загружаем профиль
      const profileRes = await fetch('/api/auth/profile');
      const profileData = await profileRes.json();
      
      if (!profileData.success) {
        console.log('User not authenticated, redirecting to home page');
        window.location.href = '/';
        return;
      }
      
      setProfile(profileData.data.user);
      
      // Загружаем данные параллельно для ускорения
      const [tokensRes, warehousesRes] = await Promise.allSettled([
        fetch('/api/tokens'),
        fetch('/api/warehouses/user')
      ]);

      // Обрабатываем результаты токенов
      let tokensData = { success: false, error: 'Failed to load' };
      if (tokensRes.status === 'fulfilled') {
        try {
          tokensData = await tokensRes.value.json();
        } catch (error) {
          console.error('Error parsing tokens response:', error);
          tokensData = { success: false, error: 'Parse error' };
        }
      } else {
        console.error('Error loading tokens:', tokensRes.reason);
        tokensData = { success: false, error: 'Network error' };
      }

      // Обрабатываем результаты складов
      let warehousesData = { success: false, error: 'Failed to load' };
      if (warehousesRes.status === 'fulfilled') {
        try {
          warehousesData = await warehousesRes.value.json();
        } catch (error) {
          console.error('Error parsing warehouses response:', error);
          warehousesData = { success: false, error: 'Parse error' };
        }
      } else {
        console.error('Error loading warehouses:', warehousesRes.reason);
        warehousesData = { success: false, error: 'Network error' };
      }

      // Обрабатываем токены
      if (tokensData.success && 'data' in tokensData && tokensData.data) {
        setTokens((tokensData.data as any).tokens || []);
      } else {
        console.error('Error loading tokens:', tokensData.error);
      }

      // Обрабатываем склады пользователя
      if (warehousesData.success && 'data' in warehousesData && warehousesData.data) {
        setWarehouses((warehousesData.data as any).warehouses || []);
      } else {
        console.error('Error loading warehouses:', warehousesData.error);
        // Если ошибка аутентификации, перенаправляем на главную страницу
        if (warehousesData.error === 'Authentication required') {
          window.location.href = '/';
          return;
        }
      }

      // Загружаем справочник складов отдельно
      await fetchWarehouseRefs();

      // Обрабатываем профиль (уже получен выше)
      const userData = profileData.data?.user;
      setProfile(userData);
      setProfileForm({
        name: userData?.name || '',
        phone: userData?.phone || '',
        timezone: userData?.timezone || 'Europe/Moscow',
      });
      
      setIsDataLoaded(true);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Загрузка настроек поиска
  const fetchSearchSettings = useCallback(async () => {
    try {
      setIsLoadingSearch(true);
      const response = await fetch('/api/settings/search');
      const data = await response.json();
      
      if (data.success) {
        setSearchSettings(data.data);
      }
    } catch (error) {
      console.error('Error loading search settings:', error);
    } finally {
      setIsLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    if (!isDataLoaded) {
      fetchData();
    }
    fetchSearchSettings();
  }, [fetchData, isDataLoaded, fetchSearchSettings]);

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация на клиенте
    if (!newToken.token.trim()) {
      setError('Токен не может быть пустым');
      return;
    }
    
    if (!newToken.category) {
      setError('Выберите категорию токена');
      return;
    }
    
    console.log('🔑 Отправляем токен на сервер:', {
      category: newToken.category,
      tokenLength: newToken.token.length,
      hasToken: !!newToken.token
    });
    
    try {
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newToken),
      });

      console.log('📡 Ответ сервера:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📊 Данные ответа:', data);
      
      if (data.success) {
        console.log('✅ Токен успешно добавлен');
        setTokens([...tokens, data.data.token]);
        setNewToken({ category: 'SUPPLIES', token: '' });
        setError('');
      } else {
        console.error('❌ Ошибка добавления токена:', data.error);
        setError(data.error || 'Ошибка добавления токена');
      }
    } catch (error) {
      console.error('💥 Ошибка при отправке запроса:', error);
      setError('Ошибка добавления токена: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    }
  };

  const handleDeleteToken = (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    setConfirmDialog({
      open: true,
      title: 'Удалить токен?',
      description: `Вы уверены, что хотите удалить токен "${tokenCategories.find(cat => cat.value === token?.category)?.label || 'токен'}"? Это действие нельзя отменить.`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/tokens/${tokenId}`, {
            method: 'DELETE',
          });
          const data = await response.json();
          if (data.success) {
            setTokens((tokens || []).filter(token => token.id !== tokenId));
            toast({
              title: 'Токен удален',
              description: 'Токен успешно удален.',
            });
          } else {
            throw new Error(data.error || 'Ошибка удаления токена');
          }
        } catch (error) {
          console.error('Error deleting token:', error);
          toast({
            title: 'Ошибка',
            description: error instanceof Error ? error.message : 'Ошибка удаления токена',
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/warehouses/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarehouse),
      });

      const data = await response.json();
      if (data.success) {
        setWarehouses([...warehouses, data.data.warehouse]);
        setNewWarehouse({
          warehouseId: '',
          warehouseName: '',
          enabled: true,
          boxAllowed: true,
          monopalletAllowed: true,
          supersafeAllowed: true,
        });
        setError('');
      } else {
        setError(data.error || 'Ошибка добавления склада');
      }
    } catch (error) {
      setError('Ошибка добавления склада');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });

      const data = await response.json();
      if (data.success) {
        setProfile({ ...profile!, ...data.data.user });
        setError('');
      } else {
        setError(data.error || 'Ошибка обновления профиля');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Ошибка обновления профиля');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWarehouseToggle = (warehouseId: number) => {
    setSelectedWarehouses(prev => 
      prev.includes(warehouseId) 
        ? prev.filter(id => id !== warehouseId)
        : [...prev, warehouseId]
    );
  };

  const handleAddSelectedWarehouses = async () => {
    try {
      const warehousesToAdd = selectedWarehouses.map(warehouseId => {
        const warehouse = warehouseRefs.find(w => w.id === warehouseId);
        return {
          warehouseId,
          warehouseName: warehouse?.name || `Склад ${warehouseId}`,
          enabled: true,
          boxAllowed: true,
          monopalletAllowed: true,
          supersafeAllowed: true,
        };
      });

      const response = await fetch('/api/warehouses/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouses: warehousesToAdd }),
      });

      const data = await response.json();
      if (data.success) {
        setWarehouses([...warehouses, ...data.data.warehouses]);
        setSelectedWarehouses([]);
        setError('');
      } else {
        setError(data.error || 'Ошибка добавления складов');
      }
    } catch (error) {
      setError('Ошибка добавления складов');
    }
  };

  const handleToggleWarehouse = async (warehouseId: number, enabled: boolean) => {
    try {
      const response = await fetch('/api/warehouses/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId, enabled }),
      });

      const data = await response.json();
      if (data.success) {
        setWarehouses(warehouses.map(w => 
          w.warehouseId === warehouseId 
            ? { ...w, enabled: enabled }
            : w
        ));
        setError('');
      } else {
        setError(data.error || 'Ошибка обновления склада');
      }
    } catch (error) {
      setError('Ошибка обновления склада');
    }
  };

  const handleDeleteWarehouse = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.warehouseId === warehouseId);
    setConfirmDialog({
      open: true,
      title: 'Удалить склад?',
      description: `Вы уверены, что хотите удалить склад "${warehouse?.warehouseName || `ID: ${warehouseId}`}"? Это действие нельзя отменить.`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/warehouses/user/delete?warehouseId=${warehouseId}`, {
            method: 'DELETE',
          });
          const data = await response.json();
          if (data.success) {
            setWarehouses((warehouses || []).filter(w => w.warehouseId !== warehouseId));
            toast({
              title: 'Склад удален',
              description: 'Склад успешно удален.',
            });
          } else {
            throw new Error(data.error || 'Ошибка удаления склада');
          }
        } catch (error) {
          toast({
            title: 'Ошибка',
            description: error instanceof Error ? error.message : 'Ошибка удаления склада',
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleSyncWarehouses = async (forceRefresh = false) => {
    try {
      setIsSyncingWarehouses(true);
      setError('');

      const url = forceRefresh ? '/api/warehouses/sync?force=true' : '/api/warehouses/sync';
      console.log('🔄 Запуск синхронизации складов...', { forceRefresh, url });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      console.log('📊 Результат синхронизации:', data);
      if (data.success) {
        // Обновляем справочник складов
        await fetchWarehouseRefs();
        setError('');
        
        // Показываем детальную статистику
        const stats = data.data;
        let message = `Справочник складов обновлен!\n\n`;
        message += `📊 Статистика:\n`;
        message += `• Всего складов: ${stats.total}\n`;
        message += `• Новых добавлено: ${stats.newWarehouses || 0}\n`;
        message += `• Обновлено: ${stats.updatedWarehouses || 0}\n`;
        message += `• Без изменений: ${stats.unchangedWarehouses || 0}\n`;
        
        if (stats.usedFallback) {
          message += `\n⚠️ Использованы fallback данные (API недоступен)`;
        }
        
        if (!stats.hasChanges) {
          message += `\n✅ Все склады актуальны, изменений не обнаружено`;
        }
        
        alert(message);
      } else {
        setError(data.error || 'Ошибка синхронизации складов');
      }
    } catch (error) {
      console.error('Error syncing warehouses:', error);
      setError('Ошибка синхронизации складов');
    } finally {
      setIsSyncingWarehouses(false);
    }
  };

  const fetchWarehouseRefs = async () => {
    try {
      const response = await fetch('/api/warehouses/reference');
      const data = await response.json();
      
      if (data.success) {
        setWarehouseRefs(data.data?.warehouses || []);
        setWarehouseStats(data.data?.stats || { total: 0, active: 0, inactive: 0 });
      } else {
        console.error('Error loading warehouse refs:', data.error);
      }
    } catch (error) {
      console.error('Error fetching warehouse refs:', error);
    }
  };

  const filteredWarehouses = (warehouseRefs || []).filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tokenCategories = [
    { value: 'SUPPLIES', label: 'Поставки (FBW)', icon: Package },
    { value: 'MARKETPLACE', label: 'Маркетплейс (FBS)', icon: Globe },
    { value: 'STATISTICS', label: 'Статистика', icon: BarChart3 },
    { value: 'ANALYTICS', label: 'Аналитика', icon: TrendingUp },
    { value: 'CONTENT', label: 'Контент', icon: FileText },
    { value: 'PROMOTION', label: 'Продвижение', icon: Zap },
    { value: 'FINANCE', label: 'Финансы', icon: DollarSign },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Загрузка настроек...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen">
        {/* Header */}
        <div className="bg-card border-b border-border/60">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Settings className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Настройки системы
                  </h1>
                  <p className="text-muted-foreground">
                    Управление профилем, токенами, складами и Telegram
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {profile && (
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={profile.role === 'DEVELOPER' ? 'default' : profile.role === 'ADMIN' ? 'destructive' : 'secondary'}
                      className={`px-3 py-1 text-xs font-semibold ${
                        profile.role === 'DEVELOPER' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                          : profile.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {profile.role === 'DEVELOPER' ? 'Разработчик' : 
                       profile.role === 'ADMIN' ? 'Администратор' : 
                       'Пользователь'}
                    </Badge>
                    {profile.isProtected && (
                      <Badge variant="outline" className="px-2 py-1 text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                        <Shield className="w-3 h-3 mr-1" />
                        Защищен
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  onClick={fetchData}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Токены</p>
                    <p className="text-2xl font-bold text-foreground">{tokens.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {(tokens || []).filter(t => t.isActive).length} активных
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Key className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Склады</p>
                    <p className="text-2xl font-bold text-foreground">{warehouses.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {(warehouses || []).filter(w => w.enabled).length} включены
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Warehouse className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Профиль</p>
                    <p className="text-2xl font-bold text-foreground">
                      {profile ? '✓' : '✗'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile ? 'Настроен' : 'Не настроен'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Система</p>
                    <p className="text-2xl font-bold text-foreground">OK</p>
                    <p className="text-xs text-muted-foreground">
                      Все сервисы работают
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Настройки системы
              </CardTitle>
              <CardDescription>
                Управление всеми параметрами системы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2">
                  <TabsTrigger value="general" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">Общие</span>
                  </TabsTrigger>
                  <TabsTrigger value="api" className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    <span className="hidden sm:inline">API</span>
                  </TabsTrigger>
                  <TabsTrigger value="slots" className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4" />
                    <span className="hidden sm:inline">Слоты</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <span className="hidden sm:inline">Уведомления</span>
                  </TabsTrigger>
                </TabsList>

                {/* General Tab (Profile + Security) */}
                <TabsContent value="general" className="space-y-6">
                  {/* Telegram Profile Component */}
                  <UserProfileTelegram />
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Профиль пользователя
                      </CardTitle>
                    <CardDescription>
                      Основная информация о вашем аккаунте
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Информация о роли пользователя */}
                    {profile && (
                      <div className={`mb-6 p-6 rounded-xl border-2 ${
                        profile.role === 'DEVELOPER' 
                          ? 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800'
                          : profile.role === 'ADMIN'
                          ? 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800'
                          : 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-gray-200 dark:border-gray-700'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              profile.role === 'DEVELOPER' 
                                ? 'bg-purple-500'
                                : profile.role === 'ADMIN'
                                ? 'bg-red-500'
                                : 'bg-gray-500'
                            }`}>
                              {profile.role === 'DEVELOPER' ? (
                                <Shield className="w-6 h-6 text-white" />
                              ) : profile.role === 'ADMIN' ? (
                                <Users className="w-6 h-6 text-white" />
                              ) : (
                                <User className="w-6 h-6 text-white" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-xl font-bold text-foreground">
                                {profile.role === 'DEVELOPER' ? 'Разработчик' : 
                                 profile.role === 'ADMIN' ? 'Администратор' : 
                                 'Пользователь'}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {profile.role === 'DEVELOPER' ? 'Максимальные права доступа' :
                                 profile.role === 'ADMIN' ? 'Административные права' :
                                 'Стандартные права пользователя'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={profile.role === 'DEVELOPER' ? 'default' : profile.role === 'ADMIN' ? 'destructive' : 'secondary'}
                              className={`px-4 py-2 text-sm font-semibold ${
                                profile.role === 'DEVELOPER' 
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                                  : profile.role === 'ADMIN'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}
                            >
                              {profile.role}
                            </Badge>
                            {profile.isProtected && (
                              <Badge variant="outline" className="px-3 py-2 text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                <Shield className="w-3 h-3 mr-1" />
                                Защищен
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Детальная информация о правах */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-semibold text-foreground mb-2">Основные права:</h5>
                            <ul className="space-y-1 text-sm">
                              {profile.role === 'DEVELOPER' ? (
                                <>
                                  <li className="flex items-center text-purple-600 dark:text-purple-400">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Полный доступ к системе
                                  </li>
                                  <li className="flex items-center text-purple-600 dark:text-purple-400">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Управление пользователями
                                  </li>
                                  <li className="flex items-center text-purple-600 dark:text-purple-400">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Настройки Telegram
                                  </li>
                                  <li className="flex items-center text-purple-600 dark:text-purple-400">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Расширенная аналитика
                                  </li>
                                </>
                              ) : profile.role === 'ADMIN' ? (
                                <>
                                  <li className="flex items-center text-red-600 dark:text-red-400">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Управление пользователями
                                  </li>
                                  <li className="flex items-center text-red-600 dark:text-red-400">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Настройки системы
                                  </li>
                                  <li className="flex items-center text-red-600 dark:text-red-400">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Мониторинг задач
                                  </li>
                                </>
                              ) : (
                                <>
                                  <li className="flex items-center text-muted-foreground">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Создание задач поиска
                                  </li>
                                  <li className="flex items-center text-muted-foreground">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Управление складами
                                  </li>
                                  <li className="flex items-center text-muted-foreground">
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Настройка уведомлений
                                  </li>
                                </>
                              )}
                            </ul>
                          </div>
                          <div>
                            <h5 className="font-semibold text-foreground mb-2">Статус аккаунта:</h5>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Активен:</span>
                                <Badge variant={profile.isActive ? "default" : "secondary"} className={profile.isActive ? "bg-green-100 text-green-800" : ""}>
                                  {profile.isActive ? 'Да' : 'Нет'}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Защищен:</span>
                                <Badge variant={profile.isProtected ? "default" : "secondary"} className={profile.isProtected ? "bg-blue-100 text-blue-800" : ""}>
                                  {profile.isProtected ? 'Да' : 'Нет'}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Email подтвержден:</span>
                                <Badge variant={profile.emailVerified ? "default" : "secondary"} className={profile.emailVerified ? "bg-green-100 text-green-800" : ""}>
                                  {profile.emailVerified ? 'Да' : 'Нет'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Имя</Label>
                            <Input
                              id="name"
                              value={profileForm.name}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Введите ваше имя"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Телефон</Label>
                            <Input
                              id="phone"
                              value={profileForm.phone}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="+7 (999) 123-45-67"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timezone">Часовой пояс</Label>
                          <select
                            id="timezone"
                            value={profileForm.timezone}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, timezone: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-foreground"
                            title="Выберите часовой пояс"
                          >
                            <option value="Europe/Moscow">Москва (UTC+3)</option>
                            <option value="Europe/Kiev">Киев (UTC+2)</option>
                            <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                            <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
                          </select>
                        </div>
                        <div className="flex justify-end">
                          <SaveButton 
                            type="submit" 
                            isLoading={isSaving}
                          >
                            Сохранить профиль
                          </SaveButton>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                  {/* Security Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5" />
                        Безопасность
                      </CardTitle>
                      <CardDescription>
                        Управление паролем и безопасностью аккаунта
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChangePasswordForm 
                        onSuccess={() => {
                          setError('');
                          toast({
                            title: 'Пароль изменен',
                            description: 'Ваш пароль был успешно изменен.',
                          });
                        }}
                        onError={(error) => {
                          setError(error);
                          toast({
                            title: 'Ошибка',
                            description: error,
                            variant: 'destructive',
                          });
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* API Tab */}
                <TabsContent value="api" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        Токены WB API
                      </CardTitle>
                      <CardDescription>
                        Управление токенами доступа к API Wildberries
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleAddToken} className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="category">Категория токена</Label>
                            <select
                              id="category"
                              value={newToken.category}
                              onChange={(e) => setNewToken(prev => ({ ...prev, category: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-foreground"
                              title="Выберите категорию токена"
                            >
                              {tokenCategories.map((cat) => (
                                <option key={cat.value} value={cat.value}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="token">Токен</Label>
                            <Input
                              id="token"
                              type="password"
                              value={newToken.token}
                              onChange={(e) => setNewToken(prev => ({ ...prev, token: e.target.value }))}
                              placeholder="Введите токен API"
                              required
                            />
                          </div>
                        </div>
                        <Button type="submit">
                          <Plus className="w-4 h-4 mr-2" />
                          Добавить токен
                        </Button>
                      </form>

                      <div className="space-y-4">
                        {tokens.map((token) => (
                          <div
                            key={token.id}
                            className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <h3 className="font-medium text-foreground">
                                  {tokenCategories.find(cat => cat.value === token.category)?.label}
                                </h3>
                                <Badge
                                  variant={token.isActive ? "default" : "secondary"}
                                  className={token.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" : ""}
                                >
                                  {token.isActive ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Активен
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Неактивен
                                    </>
                                  )}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowToken(showToken === token.id ? null : token.id)}
                                >
                                  {showToken === token.id ? (
                                    <>
                                      <EyeOff className="w-4 h-4 mr-1" />
                                      Скрыть
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-4 h-4 mr-1" />
                                      Показать
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteToken(token.id)}
                                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                              Создан: {new Date(token.createdAt).toLocaleDateString('ru-RU')}
                              {token.lastUsedAt && (
                                <span className="ml-2">
                                  • Последнее использование: {new Date(token.lastUsedAt).toLocaleDateString('ru-RU')}
                                </span>
                              )}
                            </p>
                            {showToken === token.id && (
                              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono break-all">
                                {token.tokenEncrypted}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Slots Tab (Warehouses + Search Settings) */}
                <TabsContent value="slots" className="space-y-6">
                  {/* Search Settings Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Настройки поиска слотов
                      </CardTitle>
                      <CardDescription>
                        Технические параметры поиска слотов
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSearch ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Основные настройки */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-sm">Основные настройки</h4>
                            <div className="space-y-2">
                              <Label htmlFor="checkInterval">Интервал проверки (секунды)</Label>
                              <Input
                                id="checkInterval"
                                type="number"
                                min="10"
                                max="60"
                                value={searchSettings.checkInterval}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  checkInterval: parseInt(e.target.value) || 10
                                }))}
                              />
                              <p className="text-xs text-gray-500">
                                Минимум 10 секунд (6 запросов в минуту по правилам WB)
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="maxAttempts">Максимум попыток</Label>
                              <Input
                                id="maxAttempts"
                                type="number"
                                min="10"
                                max="1000"
                                value={searchSettings.maxAttempts}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  maxAttempts: parseInt(e.target.value) || 100
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="apiRateLimit">Лимит API (запросов/минуту)</Label>
                              <Input
                                id="apiRateLimit"
                                type="number"
                                min="1"
                                max="10"
                                value={searchSettings.apiRateLimit}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  apiRateLimit: parseInt(e.target.value) || 6
                                }))}
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="stopOnFirstFound"
                                checked={searchSettings.stopOnFirstFound}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  stopOnFirstFound: e.target.checked
                                }))}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor="stopOnFirstFound" className="text-sm">
                                Остановить поиск при первом найденном слоте
                              </Label>
                            </div>
                          </div>

                          {/* Политика повторов */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-sm">Политика повторов</h4>
                            <div className="space-y-2">
                              <Label htmlFor="maxRetries">Максимум повторов</Label>
                              <Input
                                id="maxRetries"
                                type="number"
                                min="0"
                                max="10"
                                value={searchSettings.retryPolicy.maxRetries}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  retryPolicy: {
                                    ...prev.retryPolicy,
                                    maxRetries: parseInt(e.target.value) || 3
                                  }
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="backoffMs">Задержка между повторами (мс)</Label>
                              <Input
                                id="backoffMs"
                                type="number"
                                min="1000"
                                max="60000"
                                value={searchSettings.retryPolicy.backoffMs}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  retryPolicy: {
                                    ...prev.retryPolicy,
                                    backoffMs: parseInt(e.target.value) || 5000
                                  }
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="priority">Приоритет (0-10)</Label>
                              <Input
                                id="priority"
                                type="number"
                                min="0"
                                max="10"
                                value={searchSettings.priority}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  priority: parseInt(e.target.value) || 5
                                }))}
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="searchEnabled"
                                checked={searchSettings.enabled}
                                onChange={(e) => setSearchSettings(prev => ({
                                  ...prev,
                                  enabled: e.target.checked
                                }))}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor="searchEnabled" className="text-sm">
                                Поиск активен
                              </Label>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end mt-6">
                        <SaveButton
                          isLoading={isSavingSearch}
                          onClick={async () => {
                            try {
                              setIsSavingSearch(true);
                              const response = await fetch('/api/settings/search', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(searchSettings),
                              });
                              const data = await response.json();
                              if (data.success) {
                                toast({
                                  title: 'Настройки сохранены',
                                  description: 'Настройки поиска успешно обновлены.',
                                });
                              } else {
                                throw new Error(data.error || 'Ошибка сохранения');
                              }
                            } catch (error) {
                              toast({
                                title: 'Ошибка',
                                description: error instanceof Error ? error.message : 'Ошибка сохранения настроек',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsSavingSearch(false);
                            }
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Warehouses Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Warehouse className="w-5 h-5" />
                        Управление складами
                      </CardTitle>
                      <CardDescription>
                        Управление складами для поиска слотов и доступ к полному справочнику складов WB. 
                        Склады из этого списка будут доступны при создании задач.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Add Warehouse Form */}
                        <form onSubmit={handleAddWarehouse} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="warehouseId">ID склада</Label>
                              <Input
                                id="warehouseId"
                                value={newWarehouse.warehouseId}
                                onChange={(e) => setNewWarehouse(prev => ({ ...prev, warehouseId: e.target.value }))}
                                placeholder="301983"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="warehouseName">Название склада</Label>
                              <Input
                                id="warehouseName"
                                value={newWarehouse.warehouseName}
                                onChange={(e) => setNewWarehouse(prev => ({ ...prev, warehouseName: e.target.value }))}
                                placeholder="Москва"
                                required
                              />
                            </div>
                          </div>
                          <Button type="submit">
                            <Plus className="w-4 h-4 mr-2" />
                            Добавить склад
                          </Button>
                        </form>

                        {/* Warehouse Reference Selection */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-medium text-foreground">
                                Справочник складов WB
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Всего: {warehouseStats.total} | Активных: {warehouseStats.active} | Неактивных: {warehouseStats.inactive}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => handleSyncWarehouses(false)}
                                disabled={isSyncingWarehouses}
                                variant="outline"
                                size="sm"
                              >
                                {isSyncingWarehouses ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Синхронизация...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Обновить из WB API
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => {
                                  if (confirm('⚠️ Принудительная очистка удалит ВСЕ склады и загрузит их заново. Продолжить?')) {
                                    handleSyncWarehouses(true);
                                  }
                                }}
                                disabled={isSyncingWarehouses}
                                variant="destructive"
                                size="sm"
                                title="Принудительная очистка и перезагрузка всех складов"
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Принудительно
                              </Button>
                              <Link href="/warehouses">
                                <Button variant="outline" size="sm">
                                  <Globe className="w-4 h-4 mr-2" />
                                  Полный справочник
                                </Button>
                              </Link>
                              <Input
                                placeholder="Поиск склада..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64"
                              />
                            </div>
                          </div>
                          
                          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            {filteredWarehouses.map((warehouse) => (
                              <div
                                key={warehouse.id}
                                className={`p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                                  selectedWarehouses.includes(warehouse.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                }`}
                                onClick={() => handleWarehouseToggle(warehouse.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {warehouse.name}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      ID: {warehouse.id}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {selectedWarehouses.includes(warehouse.id) ? (
                                      <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    ) : (
                                      <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {selectedWarehouses.length > 0 && (
                            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <span className="text-sm text-blue-800 dark:text-blue-200">
                                Выбрано складов: {selectedWarehouses.length}
                              </span>
                              <Button
                                onClick={handleAddSelectedWarehouses}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Добавить выбранные
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Warehouse List */}
                        <div className="space-y-4">
                          {warehouses.map((warehouse) => (
                            <div
                              key={warehouse.id}
                              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-medium text-foreground">
                                    {warehouse.warehouseName}
                                  </h3>
                                  <Badge variant="outline">
                                    ID: {warehouse.warehouseId}
                                  </Badge>
                                  <Badge
                                    variant={warehouse.enabled ? "default" : "secondary"}
                                    className={warehouse.enabled ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" : ""}
                                  >
                                    {warehouse.enabled ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Включен
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Отключен
                                      </>
                                    )}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                  <span className={`flex items-center gap-1 ${warehouse.boxAllowed ? 'text-green-600' : 'text-gray-400'}`}>
                                    <Package className="w-3 h-3" />
                                    Короба
                                  </span>
                                  <span className={`flex items-center gap-1 ${warehouse.monopalletAllowed ? 'text-green-600' : 'text-gray-400'}`}>
                                    <Database className="w-3 h-3" />
                                    Монопаллеты
                                  </span>
                                  <span className={`flex items-center gap-1 ${warehouse.supersafeAllowed ? 'text-green-600' : 'text-gray-400'}`}>
                                    <Shield className="w-3 h-3" />
                                    Суперсейф
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleWarehouse(warehouse.warehouseId, !warehouse.enabled)}
                                  className={warehouse.enabled 
                                    ? "text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/20"
                                    : "text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                                  }
                                >
                                  {warehouse.enabled ? (
                                    <>
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Отключить
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Включить
                                    </>
                                  )}
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteWarehouse(warehouse.warehouseId)}
                                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        Настройки уведомлений
                      </CardTitle>
                      <CardDescription>
                        Управление уведомлениями и интеграциями
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Telegram Settings Button */}
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/60">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <MessageCircle className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">Telegram уведомления</h3>
                              <p className="text-sm text-muted-foreground">
                                Настройка бота, управление пользователями и тестирование
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => setShowTelegramSettings(!showTelegramSettings)}
                            variant={showTelegramSettings ? "outline" : "default"}
                            className={showTelegramSettings ? "text-blue-600 border-blue-200 hover:bg-blue-50" : "bg-blue-600 hover:bg-blue-700"}
                          >
                            {showTelegramSettings ? (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                Скрыть настройки
                              </>
                            ) : (
                              <>
                                <Settings className="w-4 h-4 mr-2" />
                                Настроить Telegram
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Telegram Settings (Collapsible) */}
                        {showTelegramSettings && (
                          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
                            <TelegramSettings compact={true} />
                            
                            {/* Расширенные настройки Telegram - показываются прямо здесь */}
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <div>
                                <h4 className="font-medium text-foreground mb-2">Расширенные настройки</h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Управление токеном бота, шаблонами уведомлений и админскими функциями
                                </p>
                                <TelegramSettings showAdminSettings={true} compact={false} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        Другие интеграции
                      </CardTitle>
                      <CardDescription>
                        Дополнительные настройки интеграций
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                              <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">WB Авторизация</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Настройка авторизации в ЛК WB
                              </p>
                            </div>
                          </div>
                          <Link href="/wb-auth">
                            <Button variant="outline">
                              Настроить
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmText="Удалить"
        cancelText="Отмена"
      />
    </DashboardLayout>
    </ProtectedRoute>
  );
}