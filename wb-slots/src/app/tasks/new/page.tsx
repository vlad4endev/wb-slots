'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  FiLoader as Loader2,
  FiSave as Save,
  FiArrowLeft as ArrowLeft,
  FiSearch as Search,
  FiX as X,
  FiCheck as Check,
  FiInfo as Info,
  FiAlertTriangle as AlertTriangle
} from 'react-icons/fi';
import Link from 'next/link';
import WarehouseSelector from '@/components/shared/warehouse-selector';
import DatePresets from '@/components/shared/date-presets';
import { useAutoBookingCheck } from '@/hooks/use-session-check';
import { 
  validateTaskForm, 
  saveFormSettings, 
  loadFormSettings,
  formatTaskDataForAPI,
  type TaskFormData 
} from '@/lib/utils/task-form-utils';

interface Warehouse {
  id: string;
  warehouseId: number;
  warehouseName: string;
  enabled: boolean;
}

interface WarehouseReference {
  id: number;
  name: string;
  isActive: boolean;
}

const BOX_TYPES = [
  { id: 2, name: 'Короба', description: 'Стандартные короба' },
  { id: 5, name: 'Монопаллеты', description: 'Монопаллеты' },
  { id: 6, name: 'Суперсейф', description: 'Суперсейф' },
];

export default function NewTaskPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRefs, setWarehouseRefs] = useState<WarehouseReference[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    description: '',
    autoBook: false,
    autoBookSupplyId: '',
    preorderID: '',
    filters: {
      coefficientMin: 0,
      coefficientMax: 20,
      warehouseIds: [] as number[],
      boxTypeIds: [2, 5] as number[],
      dates: {
        from: new Date().toISOString().slice(0, 16),
        to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      },
    },
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 5000,
    },
    priority: 4, // Максимальный приоритет по умолчанию
  });
  
  const [manualSupplyInput, setManualSupplyInput] = useState('');
  const [useManualSupply, setUseManualSupply] = useState(true); // По умолчанию ручной ввод
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Проверка сессии для автобронирования
  const { canAutoBook, isCheckingSession, sessionError, refreshSession } = useAutoBookingCheck();

  useEffect(() => {
    fetchWarehouses();
    fetchWarehouseReferences();
    fetchCurrentUser();
    
    // Загружаем сохраненные настройки
    const savedSettings = loadFormSettings();
    if (savedSettings) {
      setFormData(prev => ({
        ...prev,
        ...(savedSettings.filters && { filters: { ...prev.filters, ...savedSettings.filters } }),
        ...(savedSettings.retryPolicy && { retryPolicy: savedSettings.retryPolicy }),
        ...(savedSettings.priority !== undefined && { priority: savedSettings.priority }),
      }));
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setCurrentUser(data.data?.user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  // Закрытие выпадающего списка при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.warehouse-dropdown')) {
        setShowWarehouseDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses/user');
      const data = await response.json();
      if (data.success) {
        setWarehouses(data.data.warehouses);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchWarehouseReferences = async () => {
    try {
      const response = await fetch('/api/warehouses?limit=1000');
      const data = await response.json();
      if (data.success) {
        setWarehouseRefs(data.data.warehouses);
      }
    } catch (error) {
      console.error('Error fetching warehouse references:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setValidationErrors([]);

    try {
      // Валидация формы
      const validation = validateTaskForm(formData);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        setIsLoading(false);
        return;
      }

      // Проверка WB сессии если включено автобронирование
      if (formData.autoBook && !canAutoBook) {
        setError('Нет активной сессии Wildberries. Авторизуйтесь через WB для автобронирования (перейдите в WB Auth)');
        setIsLoading(false);
        return;
      }

      // Сохраняем настройки формы
      saveFormSettings(formData);

      // Форматируем данные для API
      const taskData = formatTaskDataForAPI(formData);

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      const data = await response.json();

      if (data.success) {
        // Показываем уведомление об успешном создании
        alert('Задача создана успешно! Поиск слотов запущен автоматически.');
        router.push('/dashboard');
      } else {
        setError(data.error || 'Ошибка создания задачи');
      }
    } catch (error) {
      setError('Произошла ошибка при создании задачи');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith('filters.')) {
      const parts = name.split('.');
      if (parts.length === 3 && parts[1] === 'dates') {
        // Обработка дат
        const dateKey = parts[2];
        setFormData(prev => ({
          ...prev,
          filters: {
            ...prev.filters,
            dates: {
              ...prev.filters.dates,
              [dateKey]: value,
            },
          },
        }));
      } else {
        const filterKey = parts[1];
        setFormData(prev => ({
          ...prev,
          filters: {
            ...prev.filters,
            [filterKey]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
          },
        }));
      }
    } else if (name.startsWith('retryPolicy.')) {
      const policyKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        retryPolicy: {
          ...prev.retryPolicy,
          [policyKey]: parseInt(value) || 0,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
      }));
    }
  };

  const handleWarehouseChange = (warehouseId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        warehouseIds: checked
          ? [...prev.filters.warehouseIds, warehouseId]
          : prev.filters.warehouseIds.filter(id => id !== warehouseId),
      },
    }));
  };

  const handleWarehouseReferenceToggle = (warehouseId: number) => {
    setSelectedWarehouses(prev => 
      prev.includes(warehouseId) 
        ? prev.filter(id => id !== warehouseId) // Убираем из выбранных
        : [...prev, warehouseId] // Добавляем к выбранным
    );
  };

  const toggleWarehouse = async (warehouseId: string) => {
    try {
      const warehouse = warehouses.find(w => w.id === warehouseId);
      if (!warehouse) return;

      const response = await fetch('/api/warehouses/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          warehouseId: warehouse.warehouseId,
          warehouseName: warehouse.warehouseName,
          enabled: !warehouse.enabled,
        }),
      });

      if (response.ok) {
        // Обновляем локальное состояние
        setWarehouses(prev => 
          prev.map(w => 
            w.id === warehouseId 
              ? { ...w, enabled: !w.enabled }
              : w
          )
        );
      }
    } catch (error) {
      console.error('Error toggling warehouse:', error);
    }
  };

  const addSelectedWarehouses = () => {
    if (selectedWarehouses.length > 0) {
      setFormData(prev => ({
        ...prev,
        filters: {
          ...prev.filters,
          warehouseIds: Array.from(new Set([...prev.filters.warehouseIds, ...selectedWarehouses])), // Добавляем к существующим
        },
      }));
      
      setSelectedWarehouses([]);
      setSearchQuery('');
      setShowWarehouseDropdown(false);
    }
  };

  const removeWarehouse = (warehouseId: number) => {
    setFormData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        warehouseIds: prev.filters.warehouseIds.filter(id => id !== warehouseId),
      },
    }));
  };

  const handleBoxTypeChange = (boxTypeId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        boxTypeIds: checked
          ? [boxTypeId] // Выбираем только один тип поставки
          : [], // Если снимаем выбор, очищаем
      },
    }));
  };

  const filteredWarehouseRefs = warehouseRefs.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !formData.filters.warehouseIds.includes(warehouse.id)
  );

  const handleTestRequest = async () => {
    if (formData.filters.warehouseIds.length === 0 || formData.filters.boxTypeIds.length === 0) {
      setTestResult('❌ Выберите хотя бы один склад и один тип поставки для теста');
      return;
    }

    setIsTestLoading(true);
    setTestResult(null);

    try {
      console.log('🧪 Отправляем тестовый запрос с параметрами:', {
        warehouseIds: formData.filters.warehouseIds, // Используем выбранные склады
        boxTypeIds: formData.filters.boxTypeIds, // Используем выбранные типы поставки
        coefficientMin: -1, // Тестовый коэффициент от -1
        coefficientMax: 0,  // до 0
        dateFrom: formData.filters.dates?.from ? new Date(formData.filters.dates.from).toISOString() : new Date().toISOString(),
        dateTo: formData.filters.dates?.to ? new Date(formData.filters.dates.to).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isSortingCenter: false,
      });
      
      const response = await fetch('/api/tasks/test-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          warehouseIds: formData.filters.warehouseIds, // Используем выбранные склады
          boxTypeIds: formData.filters.boxTypeIds, // Используем выбранные типы поставки
          coefficientMin: -1, // Тестовый коэффициент от -1
          coefficientMax: 0,  // до 0
          dateFrom: formData.filters.dates?.from ? new Date(formData.filters.dates.from).toISOString() : new Date().toISOString(),
          dateTo: formData.filters.dates?.to ? new Date(formData.filters.dates.to).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          isSortingCenter: false, // Добавляем параметр isSortingCenter
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const result = data.data;
        setTestResult(`✅ Тестовый запрос выполнен успешно!\n\n📊 РЕЗУЛЬТАТЫ:\n• Найдено слотов: ${result.foundSlots}\n• Проверено записей: ${result.totalChecked}\n• Время выполнения: ${result.searchTime}ms\n• Ошибок: ${result.errors?.length || 0}\n\n⚙️ КОНФИГУРАЦИЯ:\n• Склады: ${result.config.warehouseIds.join(', ')}\n• Типы поставки: ${result.config.boxTypeIds.join(', ')}\n• Коэффициент: ${result.config.coefficientMin} - ${result.config.coefficientMax}\n• Период: ${new Date(result.config.dateFrom).toLocaleDateString('ru-RU')} - ${new Date(result.config.dateTo).toLocaleDateString('ru-RU')}\n• Сортировочный центр: ${result.config.isSortingCenter ? '✅ Да' : '❌ Нет'}\n\n🔑 ТОКЕН:\n• Статус: ${result.tokenInfo?.hasToken ? '✅ Найден' : '❌ Не найден'}\n• Категория: ${result.tokenInfo?.tokenCategory || 'N/A'}\n• Активен: ${result.tokenInfo?.isActive ? '✅ Да' : '❌ Нет'}\n\n${result.errors?.length > 0 ? `⚠️ ОШИБКИ:\n${result.errors.join('\n')}` : ''}`);
      } else {
        const details = data.details;
        setTestResult(`❌ Ошибка тестового запроса: ${data.error}\n\n${details?.message || ''}\n\n💡 РЕШЕНИЕ:\n${details?.solution || 'Обратитесь к администратору'}\n\n⚙️ КОНФИГУРАЦИЯ:\n• Склады: ${formData.filters.warehouseIds.join(', ')}\n• Типы поставки: ${formData.filters.boxTypeIds.join(', ')}\n• Пользователь: ${details?.userId || 'N/A'}`);
      }
    } catch (error) {
      setTestResult(`❌ Ошибка выполнения тестового запроса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsTestLoading(false);
    }
  };

  const cronPresets = [
    { label: 'Каждые 15 минут', value: '*/15 * * * *' },
    { label: 'Каждые 30 минут', value: '*/30 * * * *' },
    { label: 'Каждый час', value: '0 * * * *' },
    { label: 'Каждые 2 часа', value: '0 */2 * * *' },
    { label: 'Каждые 6 часов', value: '0 */6 * * *' },
    { label: 'Ежедневно в 9:00', value: '0 9 * * *' },
    { label: 'Ежедневно в 18:00', value: '0 18 * * *' },
    { label: 'По будням в 9:00', value: '0 9 * * 1-5' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Создать задачу
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Настройте автоматический поиск слотов
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>
                Название и описание задачи
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Поиск слотов Москва"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Комментарий</Label>
                  <Input
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Краткое описание"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {/* Проверка WB сессии для автобронирования */}
                {!canAutoBook && (
                  <Alert className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Нет активной сессии Wildberries. Перейдите в <button 
                        type="button"
                        onClick={() => window.location.href = '/wb-auth'} 
                        className="underline font-semibold"
                      >
                        WB Auth
                      </button> для авторизации и автобронирования
                    </AlertDescription>
                  </Alert>
                )}
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="autoBook"
                    checked={formData.autoBook}
                    onChange={(e) => {
                      if (e.target.checked && !canAutoBook) {
                        setError('Нет активной сессии Wildberries. Авторизуйтесь через WB для автобронирования');
                        return;
                      }
                      handleChange(e);
                    }}
                    disabled={!canAutoBook}
                    className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm">
                    Автобронирование слотов
                    {!canAutoBook && <span className="text-xs text-orange-600 ml-2">(требуется WB сессия)</span>}
                  </span>
                </label>

                {formData.autoBook && (
                  <div className="space-y-2">
                    <Label htmlFor="autoBookSupplyId">Номер поставки для автобронирования *</Label>
                    <Input
                      id="autoBookSupplyId"
                      name="autoBookSupplyId"
                      value={formData.autoBookSupplyId}
                      onChange={handleChange}
                      placeholder="Введите номер поставки"
                      required={formData.autoBook}
                    />
                    <p className="text-xs text-gray-500">
                      Введите номер поставки, который будет использоваться для автоматического бронирования слотов
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Period */}
          <Card>
            <CardHeader>
              <CardTitle>Период поиска</CardTitle>
              <CardDescription>
                Выберите временной диапазон для поиска слотов
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DatePresets
                dateRange={formData.filters.dates}
                onDateRangeChange={(dates) => setFormData(prev => ({
                  ...prev,
                  filters: { ...prev.filters, dates }
                }))}
                showTimeInput={true}
              />
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Фильтры поиска</CardTitle>
              <CardDescription>
                Настройте параметры поиска слотов
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Warehouses */}
              <div className="space-y-4">
                <WarehouseSelector
                  selectedWarehouses={formData.filters.warehouseIds}
                  onWarehousesChange={(warehouses) => setFormData(prev => ({
                    ...prev,
                    filters: { ...prev.filters, warehouseIds: warehouses }
                  }))}
                  required={true}
                />
              </div>

              {/* Box Types */}
              <div className="space-y-2">
                <Label>Тип поставки *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {BOX_TYPES.map((boxType) => (
                    <label
                      key={boxType.id}
                      className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                        formData.filters.boxTypeIds.includes(boxType.id) 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' 
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="boxType"
                        checked={formData.filters.boxTypeIds.includes(boxType.id)}
                        onChange={(e) => handleBoxTypeChange(boxType.id, e.target.checked)}
                        className="border-gray-300"
                        title={`Выбрать ${boxType.name}`}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {boxType.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {boxType.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {formData.filters.boxTypeIds.length === 0 && (
                  <p className="text-sm text-red-500">Выберите тип поставки</p>
                )}
              </div>

              {/* Coefficient */}
              <div className="space-y-2">
                <Label>Коэффициент приёмки</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="coefficientMin">Минимум</Label>
                    <Input
                      id="coefficientMin"
                      name="filters.coefficientMin"
                      type="number"
                      min="0"
                      max="20"
                      value={formData.filters.coefficientMin}
                      onChange={handleChange}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coefficientMax">Максимум</Label>
                    <Input
                      id="coefficientMax"
                      name="filters.coefficientMax"
                      type="number"
                      min="0"
                      max="20"
                      value={formData.filters.coefficientMax}
                      onChange={handleChange}
                      placeholder="20"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Диапазон коэффициента приёмки (0-20)
                </p>
              </div>
            </CardContent>
          </Card>


          {/* Test Request Section - Only for specific user */}
          {currentUser?.id === 'cmf8sg2w8000085vkomhit4hv' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">🧪 Тестовый запрос</CardTitle>
                <CardDescription>
                  Проверка работы поиска слотов с выбранными параметрами (коэффициент от -1 до 0)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Button
                    type="button"
                    onClick={handleTestRequest}
                    disabled={isTestLoading || formData.filters.warehouseIds.length === 0 || formData.filters.boxTypeIds.length === 0}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isTestLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    🧪 Тестовый запрос
                  </Button>
                  <Link href="/settings">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      ⚙️ Настройки токенов
                    </Button>
                  </Link>
                  <p className="text-sm text-gray-500">
                    Будет использован коэффициент от -1 до 0 с выбранными складами и типами поставки
                  </p>
                </div>
                
                {testResult && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {testResult}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-semibold">Ошибки валидации:</div>
                  <ul className="list-disc list-inside">
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" type="button">
                Отмена
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={isLoading || formData.filters.warehouseIds.length === 0 || formData.filters.boxTypeIds.length === 0 || (formData.autoBook && !formData.autoBookSupplyId)}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Создать задачу
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
