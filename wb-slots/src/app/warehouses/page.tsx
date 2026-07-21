'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiMapPin as Warehouse,
  FiSearch as Search,
  FiRefreshCw as RefreshCw,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiMapPin as MapPin,
  FiHome as Building,
  FiGlobe as Globe,
  FiDownload as Download,
  FiCopy as Copy,
  FiPlus as Plus,
  FiToggleLeft as ToggleLeft,
  FiToggleRight as ToggleRight,
  FiPackage as Package,
  FiDatabase as Database,
  FiShield as Shield
} from 'react-icons/fi';

interface WarehouseReference {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WarehouseStats {
  total: number;
  active: number;
  inactive: number;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseReference[]>([]);
  const [stats, setStats] = useState<WarehouseStats>({ total: 0, active: 0, inactive: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<number[]>([]);
  const [isAddingToUser, setIsAddingToUser] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch('/api/warehouses/reference');
      const data = await response.json();

      if (data.success) {
        setWarehouses(data.data?.warehouses || []);
        setStats(data.data?.stats || { total: 0, active: 0, inactive: 0 });
      } else {
        setError(data.error || 'Ошибка загрузки складов');
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      setError('Ошибка загрузки складов');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncWarehouses = async () => {
    try {
      setIsSyncing(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/warehouses/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`Справочник обновлен! Добавлено ${data.data.total} складов`);
        await fetchWarehouses();
      } else {
        setError(data.error || 'Ошибка синхронизации складов');
      }
    } catch (error) {
      console.error('Error syncing warehouses:', error);
      setError('Ошибка синхронизации складов');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportWarehouses = () => {
    const csvContent = [
      'ID,Название,Активен,Дата создания',
      ...warehouses.map(w => `${w.id},"${w.name}",${w.isActive ? 'Да' : 'Нет'},"${new Date(w.createdAt).toLocaleDateString('ru-RU')}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `warehouses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyWarehouseId = (id: number) => {
    navigator.clipboard.writeText(id.toString());
    setSuccess(`ID склада ${id} скопирован в буфер обмена`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleToggleWarehouseStatus = async (warehouseId: number, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/warehouses/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          warehouseId, 
          isActive: !currentStatus 
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWarehouses(warehouses.map(w => 
          w.id === warehouseId 
            ? { ...w, isActive: !currentStatus }
            : w
        ));
        setStats(prev => ({
          ...prev,
          active: prev.active + (currentStatus ? -1 : 1),
          inactive: prev.inactive + (currentStatus ? 1 : -1)
        }));
        setSuccess(data.message);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Ошибка обновления статуса склада');
      }
    } catch (error) {
      console.error('Error toggling warehouse status:', error);
      setError('Ошибка обновления статуса склада');
    }
  };

  const handleToggleWarehouseSelection = (warehouseId: number) => {
    setSelectedWarehouses(prev => 
      prev.includes(warehouseId) 
        ? prev.filter(id => id !== warehouseId)
        : [...prev, warehouseId]
    );
  };

  const handleAddSelectedToUser = async () => {
    if (selectedWarehouses.length === 0) {
      setError('Выберите склады для добавления');
      return;
    }

    try {
      setIsAddingToUser(true);
      setError('');

      const response = await fetch('/api/warehouses/add-to-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseIds: selectedWarehouses }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        setSelectedWarehouses([]);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(data.error || 'Ошибка добавления складов');
      }
    } catch (error) {
      console.error('Error adding warehouses to user:', error);
      setError('Ошибка добавления складов');
    } finally {
      setIsAddingToUser(false);
    }
  };

  const filteredWarehouses = (warehouses || []).filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка справочника складов...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Справочник складов Wildberries
              </h1>
              <p className="text-muted-foreground">
                Официальный справочник всех складов WB
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Всего складов</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                  <Building className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Активных</p>
                    <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Неактивных</p>
                    <p className="text-2xl font-bold text-foreground">{stats.inactive}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Управление справочником
            </CardTitle>
            <CardDescription>
              Поиск, синхронизация и экспорт данных о складах
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Поиск склада по названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSyncWarehouses}
                  disabled={isSyncing}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSyncing ? (
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
                  onClick={handleAddSelectedToUser}
                  disabled={selectedWarehouses.length === 0 || isAddingToUser}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isAddingToUser ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Добавление...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить в список ({selectedWarehouses.length})
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleExportWarehouses}
                  variant="outline"
                  disabled={warehouses.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Warehouses Info */}
        {selectedWarehouses.length > 0 && (
          <Alert className="mb-6 border-primary/30 bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-foreground">
              Выбрано складов: {selectedWarehouses.length}. 
              Нажмите "Добавить в список" чтобы добавить их в ваш список включенных складов.
            </AlertDescription>
          </Alert>
        )}

        {/* Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-500/30 bg-green-500/10">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Warehouses List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Список складов ({filteredWarehouses.length})
            </CardTitle>
            <CardDescription>
              {searchQuery ? `Найдено ${filteredWarehouses.length} складов по запросу "${searchQuery}"` : 'Все доступные склады Wildberries'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredWarehouses.length === 0 ? (
              <div className="text-center py-8">
                <Warehouse className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'Склады не найдены' : 'Справочник складов пуст'}
                </p>
                {!searchQuery && (
                  <Button onClick={handleSyncWarehouses} className="mt-4">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Загрузить склады
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWarehouses.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    className={`p-4 border rounded-lg transition-all duration-200 ${
                      selectedWarehouses.includes(warehouse.id)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/60 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">
                          {warehouse.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          ID: {warehouse.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={warehouse.isActive ? "default" : "secondary"}
                          className={warehouse.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" : ""}
                        >
                          {warehouse.isActive ? (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyWarehouseId(warehouse.id)}
                          className="p-1 h-8 w-8"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Capabilities */}
                    <div className="flex items-center gap-3 mb-3 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Package className="w-3 h-3" />
                        Короба
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Database className="w-3 h-3" />
                        Монопаллеты
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        Суперсейф
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleWarehouseStatus(warehouse.id, warehouse.isActive)}
                          className={warehouse.isActive 
                            ? "text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/20"
                            : "text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                          }
                        >
                          {warehouse.isActive ? (
                            <>
                              <ToggleLeft className="w-4 h-4 mr-1" />
                              Отключить
                            </>
                          ) : (
                            <>
                              <ToggleRight className="w-4 h-4 mr-1" />
                              Включить
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleWarehouseSelection(warehouse.id)}
                          className={`p-1 h-8 w-8 ${
                            selectedWarehouses.includes(warehouse.id)
                              ? 'text-primary bg-primary/10'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {selectedWarehouses.includes(warehouse.id) ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 border-2 border-border rounded-full" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground/70 mt-2">
                      Обновлен: {new Date(warehouse.updatedAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
