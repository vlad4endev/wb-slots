'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ArrowLeft, Search, X, Check, Edit } from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '@/app/dashboard-layout';

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

interface Task {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  autoBook: boolean;
  autoBookSupplyId?: string;
  filters: any;
  retryPolicy: any;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

const BOX_TYPES = [
  { id: 2, name: 'Короба', description: 'Стандартные короба' },
  { id: 5, name: 'Монопаллеты', description: 'Монопаллеты' },
  { id: 6, name: 'Суперсейф', description: 'Суперсейф' },
];

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRefs, setWarehouseRefs] = useState<WarehouseReference[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    autoBook: false,
    autoBookSupplyId: '',
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
    priority: 1,
  });

  useEffect(() => {
    if (taskId) {
      fetchTask();
      fetchWarehouses();
      fetchWarehouseReferences();
      fetchCurrentUser();
    }
  }, [taskId]);

  const fetchTask = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/tasks/${taskId}`);
      const data = await response.json();

      if (data.success) {
        const taskData = data.data.task;
        setTask(taskData);
        
        // Заполняем форму данными задачи
        setFormData({
          name: taskData.name || '',
          description: taskData.description || '',
          autoBook: taskData.autoBook || false,
          autoBookSupplyId: taskData.autoBookSupplyId || '',
          filters: {
            coefficientMin: taskData.filters?.coefficientMin || 0,
            coefficientMax: taskData.filters?.coefficientMax || 20,
            warehouseIds: taskData.filters?.warehouseIds || [],
            boxTypeIds: taskData.filters?.boxTypeIds || [2, 5],
            dates: {
              from: taskData.filters?.dates?.from ? 
                new Date(taskData.filters.dates.from).toISOString().slice(0, 16) : 
                new Date().toISOString().slice(0, 16),
              to: taskData.filters?.dates?.to ? 
                new Date(taskData.filters.dates.to).toISOString().slice(0, 16) : 
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
            },
          },
          retryPolicy: {
            maxRetries: taskData.retryPolicy?.maxRetries || 3,
            backoffMs: taskData.retryPolicy?.backoffMs || 5000,
          },
          priority: taskData.priority || 1,
        });
        
        setSelectedWarehouses(taskData.filters?.warehouseIds || []);
      } else {
        setError(data.error || 'Ошибка загрузки задачи');
      }
    } catch (error) {
      setError('Ошибка загрузки задачи');
    } finally {
      setIsLoading(false);
    }
  };

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

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses');
      const data = await response.json();
      if (data.success) {
        setWarehouses(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchWarehouseReferences = async () => {
    try {
      const response = await fetch('/api/warehouses');
      const data = await response.json();
      if (data.success) {
        setWarehouseRefs(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching warehouse references:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          filters: {
            ...formData.filters,
            warehouseIds: selectedWarehouses,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/tasks');
      } else {
        setError(data.error || 'Ошибка сохранения задачи');
      }
    } catch (error) {
      setError('Ошибка сохранения задачи');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSearch = async () => {
    setIsTestLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/tasks/test-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: taskId,
          warehouseIds: selectedWarehouses,
          boxTypeIds: formData.filters.boxTypeIds,
          coefficientMin: formData.filters.coefficientMin,
          coefficientMax: formData.filters.coefficientMax,
          dateFrom: formData.filters.dates.from,
          dateTo: formData.filters.dates.to,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult(`Найдено слотов: ${data.data.foundSlots || 0}`);
      } else {
        setTestResult(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      setTestResult('Ошибка тестирования поиска');
    } finally {
      setIsTestLoading(false);
    }
  };

  const toggleWarehouse = (warehouseId: number) => {
    setSelectedWarehouses(prev => 
      prev.includes(warehouseId) 
        ? prev.filter(id => id !== warehouseId)
        : [...prev, warehouseId]
    );
  };

  const toggleBoxType = (boxTypeId: number) => {
    setFormData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        boxTypeIds: prev.filters.boxTypeIds.includes(boxTypeId)
          ? prev.filters.boxTypeIds.filter(id => id !== boxTypeId)
          : [...prev.filters.boxTypeIds, boxTypeId]
      }
    }));
  };

  const filteredWarehouses = warehouseRefs.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    warehouse.isActive
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">Загрузка задачи...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Задача не найдена
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Задача с указанным ID не существует или у вас нет доступа к ней
            </p>
            <Link href="/tasks">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Вернуться к задачам
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
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
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Редактирование задачи
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Изменение параметров задачи поиска слотов
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/tasks">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Назад к задачам
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
                <CardDescription>
                  Название и описание задачи
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название задачи *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Введите название задачи"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Описание задачи (необязательно)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Приоритет</Label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    title="Выберите приоритет задачи"
                  >
                    <option value={1}>Низкий</option>
                    <option value={2}>Средний</option>
                    <option value={3}>Высокий</option>
                    <option value={4}>Критический</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Search Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Параметры поиска</CardTitle>
                <CardDescription>
                  Настройка фильтров для поиска слотов
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Warehouses */}
                <div className="space-y-2">
                  <Label>Склады *</Label>
                  <div className="relative warehouse-dropdown">
                    <div
                      className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 cursor-pointer"
                      onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300">
                          {selectedWarehouses.length > 0 
                            ? `Выбрано складов: ${selectedWarehouses.length}`
                            : 'Выберите склады'
                          }
                        </span>
                        <Search className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    
                    {showWarehouseDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2">
                          <Input
                            placeholder="Поиск складов..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="mb-2"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredWarehouses.map((warehouse) => (
                            <div
                              key={warehouse.id}
                              className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => toggleWarehouse(warehouse.id)}
                            >
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={selectedWarehouses.includes(warehouse.id)}
                                  onChange={() => {}}
                                  className="mr-2"
                                  title={`Выбрать склад ${warehouse.name}`}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {warehouse.name}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Box Types */}
                <div className="space-y-2">
                  <Label>Типы поставки *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {BOX_TYPES.map((boxType) => (
                      <div
                        key={boxType.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.filters.boxTypeIds.includes(boxType.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                        onClick={() => toggleBoxType(boxType.id)}
                      >
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.filters.boxTypeIds.includes(boxType.id)}
                            onChange={() => {}}
                            className="mr-2"
                            title={`Выбрать тип поставки ${boxType.name}`}
                          />
                          <div>
                            <div className="font-medium text-sm">{boxType.name}</div>
                            <div className="text-xs text-gray-500">{boxType.description}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coefficient Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="coefficientMin">Минимальный коэффициент</Label>
                    <Input
                      id="coefficientMin"
                      type="number"
                      value={formData.filters.coefficientMin}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        filters: { ...prev.filters, coefficientMin: parseFloat(e.target.value) }
                      }))}
                      min="-10"
                      max="50"
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coefficientMax">Максимальный коэффициент</Label>
                    <Input
                      id="coefficientMax"
                      type="number"
                      value={formData.filters.coefficientMax}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        filters: { ...prev.filters, coefficientMax: parseFloat(e.target.value) }
                      }))}
                      min="-10"
                      max="50"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateFrom">Дата начала поиска</Label>
                    <Input
                      id="dateFrom"
                      type="datetime-local"
                      value={formData.filters.dates.from}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        filters: {
                          ...prev.filters,
                          dates: { ...prev.filters.dates, from: e.target.value }
                        }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateTo">Дата окончания поиска</Label>
                    <Input
                      id="dateTo"
                      type="datetime-local"
                      value={formData.filters.dates.to}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        filters: {
                          ...prev.filters,
                          dates: { ...prev.filters.dates, to: e.target.value }
                        }
                      }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto Booking */}
            <Card>
              <CardHeader>
                <CardTitle>Автобронирование</CardTitle>
                <CardDescription>
                  Настройка автоматического бронирования найденных слотов
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoBook"
                    checked={formData.autoBook}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoBook: e.target.checked }))}
                    className="rounded border-gray-300"
                    title="Включить автобронирование"
                  />
                  <Label htmlFor="autoBook">Включить автобронирование</Label>
                </div>
                {formData.autoBook && (
                  <div className="space-y-2">
                    <Label htmlFor="autoBookSupplyId">Номер приемки для автобронирования</Label>
                    <Input
                      id="autoBookSupplyId"
                      value={formData.autoBookSupplyId}
                      onChange={(e) => setFormData(prev => ({ ...prev, autoBookSupplyId: e.target.value }))}
                      placeholder="Введите номер приемки"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test Search */}
            <Card>
              <CardHeader>
                <CardTitle>Тестирование поиска</CardTitle>
                <CardDescription>
                  Проверьте параметры поиска перед сохранением
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  onClick={handleTestSearch}
                  disabled={isTestLoading || selectedWarehouses.length === 0}
                  variant="outline"
                >
                  {isTestLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Тестирование...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Тестировать поиск
                    </>
                  )}
                </Button>
                {testResult && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{testResult}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <Link href="/tasks">
                <Button type="button" variant="outline">
                  Отмена
                </Button>
              </Link>
              <Button type="submit" disabled={isSaving || selectedWarehouses.length === 0}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить изменения
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
