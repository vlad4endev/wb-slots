'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  FiSearch as Search,
  FiFilter as Filter,
  FiRefreshCw as RefreshCw,
  FiLoader as Loader2,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiClock as Clock,
  FiMapPin as Warehouse,
  FiBox as Box,
  FiTrendingUp as TrendingUp,
  FiCalendar as Calendar,
  FiSettings as Settings,
  FiAlertTriangle as AlertTriangle,
  FiInfo as Info,
} from 'react-icons/fi';
import { FoundSlot, SlotSearchResult, SlotSearchStats } from '@/types/slot-search';
import SlotSearchStatsComponent from './slot-search-stats';

interface SlotSearchFormFilters {
  warehouseIds: string;
  boxTypeIds: string;
  coefficientMin: string;
  coefficientMax: string;
  dateFrom: string;
  dateTo: string;
  isSortingCenter: string;
  updateInterval: string;
}

const BOX_TYPES = [
  { id: 1, name: 'Короб' },
  { id: 2, name: 'Короб' },
  { id: 5, name: 'Монопаллета' },
  { id: 6, name: 'Суперсейф' },
];

const WAREHOUSES = [
  { id: 117501, name: 'Подольск' },
  { id: 130744, name: 'Казань' },
  { id: 130745, name: 'Екатеринбург' },
  { id: 130746, name: 'Новосибирск' },
  { id: 130747, name: 'Хабаровск' },
  { id: 130748, name: 'Краснодар' },
  { id: 130749, name: 'Санкт-Петербург' },
  { id: 130750, name: 'Москва' },
];

export default function SlotSearch() {
  const [filters, setFilters] = useState<SlotSearchFormFilters>({
    warehouseIds: '',
    boxTypeIds: '2,5', // По умолчанию короб и монопаллета
    coefficientMin: '0',
    coefficientMax: '20',
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isSortingCenter: 'false',
    updateInterval: '30',
  });

  const [searchResult, setSearchResult] = useState<SlotSearchResult | null>(null);
  const [searchStats, setSearchStats] = useState<SlotSearchStats>({
    totalSearches: 0,
    successfulSearches: 0,
    failedSearches: 0,
    averageSearchTime: 0,
    totalFoundSlots: 0,
    lastSearchTime: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSearch, setAutoSearch] = useState(false);
  const [searchInterval, setSearchInterval] = useState<NodeJS.Timeout | null>(null);

  // Автоматический поиск
  useEffect(() => {
    if (autoSearch && !isLoading) {
      const interval = setInterval(() => {
        handleSearch();
      }, parseInt(filters.updateInterval) * 1000);
      
      setSearchInterval(interval);
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else if (searchInterval) {
      clearInterval(searchInterval);
      setSearchInterval(null);
    }
  }, [autoSearch, filters.updateInterval, isLoading]);

  const handleSearch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();
      
      // Добавляем параметры фильтрации
      if (filters.warehouseIds) searchParams.set('warehouseIds', filters.warehouseIds);
      if (filters.boxTypeIds) searchParams.set('boxTypeIds', filters.boxTypeIds);
      if (filters.coefficientMin) searchParams.set('coefficientMin', filters.coefficientMin);
      if (filters.coefficientMax) searchParams.set('coefficientMax', filters.coefficientMax);
      if (filters.dateFrom) searchParams.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) searchParams.set('dateTo', filters.dateTo);
      if (filters.isSortingCenter) searchParams.set('isSortingCenter', filters.isSortingCenter);
      if (filters.updateInterval) searchParams.set('updateInterval', filters.updateInterval);

      console.log(`🔍 Searching slots with filters:`, filters);

      const response = await fetch(`/api/tasks/search-slots?${searchParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSearchResult(data);
        
        // Обновляем статистику
        setSearchStats(prev => ({
          totalSearches: prev.totalSearches + 1,
          successfulSearches: prev.successfulSearches + 1,
          failedSearches: prev.failedSearches,
          averageSearchTime: prev.totalSearches > 0 
            ? (prev.averageSearchTime * prev.totalSearches + data.data.searchTime) / (prev.totalSearches + 1)
            : data.data.searchTime,
          totalFoundSlots: prev.totalFoundSlots + data.data.foundSlots.length,
          lastSearchTime: data.data.timestamp,
        }));
        
        console.log(`✅ Search completed:`, {
          foundSlots: data.data.foundSlots.length,
          searchTime: data.data.searchTime,
          timestamp: data.data.timestamp,
        });
      } else {
        setError(data.error || 'Search failed');
        
        // Обновляем статистику для неудачного поиска
        setSearchStats(prev => ({
          totalSearches: prev.totalSearches + 1,
          successfulSearches: prev.successfulSearches,
          failedSearches: prev.failedSearches + 1,
          averageSearchTime: prev.totalSearches > 0 
            ? (prev.averageSearchTime * prev.totalSearches + (data.data?.searchTime || 0)) / (prev.totalSearches + 1)
            : (data.data?.searchTime || 0),
          totalFoundSlots: prev.totalFoundSlots,
          lastSearchTime: data.data?.timestamp || new Date().toISOString(),
        }));
        
        console.error(`❌ Search failed:`, data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const handleFilterChange = (key: keyof SlotSearchFormFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleAutoSearch = () => {
    setAutoSearch(prev => !prev);
  };

  const getCoefficientColor = (coefficient: number) => {
    if (coefficient <= 5) return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-300';
    if (coefficient <= 10) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300';
    if (coefficient <= 15) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300';
    return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-300';
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = WAREHOUSES.find(w => w.id === warehouseId);
    return warehouse ? warehouse.name : `Склад ${warehouseId}`;
  };

  const getBoxTypeName = (boxTypeId: number) => {
    const boxType = BOX_TYPES.find(b => b.id === boxTypeId);
    return boxType ? boxType.name : `Тип ${boxTypeId}`;
  };

  return (
    <div className="space-y-6">
      {/* Статистика поиска */}
      <SlotSearchStatsComponent stats={searchStats} isLoading={isLoading} />

      {/* Фильтры поиска */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Фильтры поиска слотов
          </CardTitle>
          <CardDescription>
            Настройте параметры для поиска доступных слотов на складах Wildberries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Склады */}
            <div className="space-y-2">
              <Label htmlFor="warehouseIds">Склады (ID через запятую)</Label>
              <Input
                id="warehouseIds"
                placeholder="117501,130744,130745"
                value={filters.warehouseIds}
                onChange={(e) => handleFilterChange('warehouseIds', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Доступные: {WAREHOUSES.map(w => `${w.id} (${w.name})`).join(', ')}
              </p>
            </div>

            {/* Типы коробов */}
            <div className="space-y-2">
              <Label htmlFor="boxTypeIds">Типы коробов (ID через запятую)</Label>
              <Input
                id="boxTypeIds"
                placeholder="2,5"
                value={filters.boxTypeIds}
                onChange={(e) => handleFilterChange('boxTypeIds', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Доступные: {BOX_TYPES.map(b => `${b.id} (${b.name})`).join(', ')}
              </p>
            </div>

            {/* Коэффициент */}
            <div className="space-y-2">
              <Label htmlFor="coefficientMin">Минимальный коэффициент</Label>
              <Input
                id="coefficientMin"
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={filters.coefficientMin}
                onChange={(e) => handleFilterChange('coefficientMin', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coefficientMax">Максимальный коэффициент</Label>
              <Input
                id="coefficientMax"
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={filters.coefficientMax}
                onChange={(e) => handleFilterChange('coefficientMax', e.target.value)}
              />
            </div>

            {/* Даты */}
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Дата начала</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Дата окончания</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            {/* Сортировочный центр */}
            <div className="space-y-2">
              <Label htmlFor="isSortingCenter">Сортировочный центр</Label>
              <Select
                value={filters.isSortingCenter}
                onValueChange={(value) => handleFilterChange('isSortingCenter', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Обычный склад</SelectItem>
                  <SelectItem value="true">Сортировочный центр</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Интервал обновления */}
            <div className="space-y-2">
              <Label htmlFor="updateInterval">Интервал обновления (сек)</Label>
              <Input
                id="updateInterval"
                type="number"
                min="10"
                max="300"
                value={filters.updateInterval}
                onChange={(e) => handleFilterChange('updateInterval', e.target.value)}
              />
            </div>
          </div>

          {/* Кнопки управления */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              {isLoading ? 'Поиск...' : 'Найти слоты'}
            </Button>

            <Button
              onClick={toggleAutoSearch}
              variant={autoSearch ? "destructive" : "outline"}
              disabled={isLoading}
            >
              {autoSearch ? (
                <XCircle className="w-4 h-4 mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {autoSearch ? 'Остановить' : 'Автопоиск'}
            </Button>
          </div>

          {autoSearch && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                Автоматический поиск активен. Обновление каждые {filters.updateInterval} секунд.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Результаты поиска */}
      {searchResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Результаты поиска
            </CardTitle>
            <CardDescription>
              Найдено слотов: {searchResult.data.foundSlots.length} | 
              Время поиска: {searchResult.data.searchTime}мс | 
              Обновлено: {new Date(searchResult.data.timestamp).toLocaleString('ru-RU')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchResult.data.foundSlots.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Слоты не найдены
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Попробуйте изменить параметры поиска или расширить диапазон дат
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResult.data.foundSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {getWarehouseName(slot.warehouseId)}
                        </h3>
                        <Badge
                          variant="outline"
                          className={getCoefficientColor(slot.coefficient)}
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {slot.coefficient}
                        </Badge>
                        <Badge variant="outline">
                          <Box className="w-3 h-3 mr-1" />
                          {getBoxTypeName(slot.boxTypes[0])}
                        </Badge>
                        {slot.isSortingCenter && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            <Settings className="w-3 h-3 mr-1" />
                            СЦ
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(slot.date).toLocaleDateString('ru-RU')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {slot.timeSlot}
                        </span>
                        <span className="flex items-center gap-1">
                          <Warehouse className="w-3 h-3" />
                          ID: {slot.warehouseId}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Хранение: {slot.storageCoef} | </span>
                        <span>Доставка: {slot.deliveryCoef}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {slot.available ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Доступен
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          <XCircle className="w-3 h-3 mr-1" />
                          Недоступен
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ошибки */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
