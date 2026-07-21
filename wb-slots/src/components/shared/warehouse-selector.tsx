'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FiSearch as Search, FiX as X } from 'react-icons/fi';

interface Warehouse {
  id: string;
  warehouseId: number;
  warehouseName: string;
  enabled: boolean;
  boxAllowed?: boolean;
  monopalletAllowed?: boolean;
  supersafeAllowed?: boolean;
}

interface WarehouseSelectorProps {
  selectedWarehouses: number[];
  onWarehousesChange: (warehouses: number[]) => void;
  onlyEnabled?: boolean;
  required?: boolean;
  className?: string;
}

export default function WarehouseSelector({
  selectedWarehouses,
  onWarehousesChange,
  onlyEnabled = true,
  required = false,
  className = '',
}: WarehouseSelectorProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWarehouses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/warehouses/user');
      const data = await response.json();
      if (data.success) {
        const warehouseList = data.data?.warehouses || [];
        setWarehouses(onlyEnabled ? warehouseList.filter((w: Warehouse) => w.enabled) : warehouseList);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWarehouseToggle = (warehouseId: number) => {
    const newSelection = selectedWarehouses.includes(warehouseId)
      ? selectedWarehouses.filter(id => id !== warehouseId)
      : [...selectedWarehouses, warehouseId];
    onWarehousesChange(newSelection);
  };

  const handleRemoveWarehouse = (warehouseId: number) => {
    onWarehousesChange(selectedWarehouses.filter(id => id !== warehouseId));
  };

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.warehouseName.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedWarehouses.includes(warehouse.warehouseId)
  );

  const selectedWarehousesList = warehouses.filter(w => selectedWarehouses.includes(w.warehouseId));

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Выберите склады {required && '*'}
          <span className="ml-2 text-xs text-gray-500">
            (доступно только включенных складов)
          </span>
        </Label>
        
        {/* Dropdown для выбора */}
        <div className="relative">
          <div
            className="w-full h-11 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 cursor-pointer hover:border-green-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
            onClick={() => setShowDropdown(!showDropdown)}
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
          
          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <Input
                  placeholder="Поиск складов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">Загрузка...</div>
                ) : filteredWarehouses.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {searchQuery ? 'Склады не найдены' : 'Все доступные склады выбраны'}
                  </div>
                ) : (
                  filteredWarehouses.map((warehouse) => (
                    <div
                      key={warehouse.warehouseId}
                      className="flex items-center p-2 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWarehouseToggle(warehouse.warehouseId);
                      }}
                    >
                      <div className="flex items-center flex-1">
                        <input
                          type="checkbox"
                          checked={selectedWarehouses.includes(warehouse.warehouseId)}
                          onChange={() => {}}
                          className="mr-2"
                          title={`Выбрать склад ${warehouse.warehouseName}`}
                        />
                        <div className="flex-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {warehouse.warehouseName}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            (ID: {warehouse.warehouseId})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Список выбранных складов */}
        {selectedWarehousesList.length > 0 && (
          <div className="mt-3 space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Выбранные склады:
            </Label>
            <div className="flex flex-wrap gap-2">
              {selectedWarehousesList.map(warehouse => (
                <Badge
                  key={warehouse.warehouseId}
                  className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/30"
                >
                  <span>{warehouse.warehouseName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveWarehouse(warehouse.warehouseId)}
                    className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                    title={`Удалить склад ${warehouse.warehouseName}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {required && selectedWarehouses.length === 0 && (
          <p className="text-sm text-red-500">Выберите хотя бы один склад</p>
        )}
      </div>
    </div>
  );
}

