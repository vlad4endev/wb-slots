'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Save, 
  X, 
  Search, 
  Package,
  Warehouse,
  Calendar,
  Clock,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

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

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BOX_TYPES = [
  { id: 2, name: 'Короба', description: 'Стандартные короба' },
  { id: 5, name: 'Монопаллеты', description: 'Монопаллеты' },
  { id: 6, name: 'Суперсейф', description: 'Суперсейф' },
];

export default function CreateTaskModal({ isOpen, onClose, onSuccess }: CreateTaskModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRefs, setWarehouseRefs] = useState<WarehouseReference[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    if (isOpen) {
      fetchWarehouses();
      fetchWarehouseReferences();
    }
  }, [isOpen]);

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses');
      const data = await response.json();
      if (data.success) {
        setWarehouses(data.data?.warehouses || []);
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
        setWarehouseRefs(data.data?.warehouses || []);
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
      const response = await fetch('/api/tasks', {
        method: 'POST',
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
        setSuccess('Задача успешно создана!');
        setTimeout(() => {
          onSuccess();
          onClose();
          resetForm();
        }, 1500);
      } else {
        setError(data.error || 'Ошибка создания задачи');
      }
    } catch (error) {
      setError('Ошибка создания задачи');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      autoBook: false,
      autoBookSupplyId: '',
      filters: {
        coefficientMin: 0,
        coefficientMax: 20,
        warehouseIds: [],
        boxTypeIds: [2, 5],
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
    setSelectedWarehouses([]);
    setError('');
    setSuccess('');
  };

  const handleWarehouseToggle = (warehouseId: number) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                Создание новой задачи
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                Настройте параметры поиска слотов Wildberries
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <form onSubmit={handleSubmit} className="space-y-8 py-4">
            {/* Basic Information */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    Основная информация
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Название задачи *
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Введите название задачи"
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Приоритет
                      </Label>
                      <select
                        id="priority"
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                        className="w-full h-11 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        title="Выберите приоритет задачи"
                      >
                        <option value={1}>Низкий</option>
                        <option value={2}>Средний</option>
                        <option value={3}>Высокий</option>
                        <option value={4}>Критический</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Описание
                    </Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Описание задачи (необязательно)"
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warehouses */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <Warehouse className="w-4 h-4 text-white" />
                    </div>
                    Склады
                  </h3>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Выберите склады *
                    </Label>
                    <div className="relative">
                      <div
                        className="w-full h-11 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 cursor-pointer hover:border-green-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
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
                              className="mb-2 h-9"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filteredWarehouses.map((warehouse) => (
                              <div
                                key={warehouse.id}
                                className="flex items-center p-2 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer transition-colors"
                                onClick={() => handleWarehouseToggle(warehouse.id)}
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
                </div>
              </CardContent>
            </Card>

            {/* Box Types */}
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-white" />
                    </div>
                    Типы поставки
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {BOX_TYPES.map((boxType) => (
                      <div
                        key={boxType.id}
                        className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                          formData.filters.boxTypeIds.includes(boxType.id)
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                        }`}
                        onClick={() => toggleBoxType(boxType.id)}
                      >
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.filters.boxTypeIds.includes(boxType.id)}
                            onChange={() => {}}
                            className="mr-3 w-4 h-4"
                            title={`Выбрать тип поставки ${boxType.name}`}
                          />
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{boxType.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{boxType.description}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coefficient Range */}
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    Диапазон коэффициентов
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="coefficientMin" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Минимальный коэффициент
                      </Label>
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
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="coefficientMax" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Максимальный коэффициент
                      </Label>
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
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Date Range */}
            <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-cyan-200 dark:border-cyan-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    Период поиска
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dateFrom" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Дата начала поиска
                      </Label>
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
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateTo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Дата окончания поиска
                      </Label>
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
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto Booking */}
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    Автобронирование
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="autoBook"
                        checked={formData.autoBook}
                        onChange={(e) => setFormData(prev => ({ ...prev, autoBook: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                        title="Включить автобронирование"
                      />
                      <Label htmlFor="autoBook" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Включить автобронирование
                      </Label>
                    </div>
                    {formData.autoBook && (
                      <div className="space-y-2">
                        <Label htmlFor="autoBookSupplyId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Номер приемки для автобронирования
                        </Label>
                        <Input
                          id="autoBookSupplyId"
                          value={formData.autoBookSupplyId}
                          onChange={(e) => setFormData(prev => ({ ...prev, autoBookSupplyId: e.target.value }))}
                          placeholder="Введите номер приемки"
                          className="h-11"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Success/Error Display */}
            {success && (
              <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4 -mx-6 -mb-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button 
            type="submit" 
            disabled={isSaving || selectedWarehouses.length === 0}
            onClick={handleSubmit}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg"
          >
            {isSaving ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Создание...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Создать задачу
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
