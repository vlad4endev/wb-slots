'use client';
import DebugPageGuard from '@/components/debug-page-guard';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, CheckCircle, XCircle } from 'lucide-react';

function DebugSlotSearchPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    warehouseIds: '117866',
    boxTypeIds: '2',
    dateFrom: new Date().toISOString().slice(0, 16),
    dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    coefficientMin: '0',
    coefficientMax: '20'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/debug/slot-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          warehouseIds: formData.warehouseIds.split(',').map(id => parseInt(id.trim())),
          boxTypeIds: formData.boxTypeIds.split(',').map(id => parseInt(id.trim())),
          dateFrom: new Date(formData.dateFrom).toISOString(),
          dateTo: new Date(formData.dateTo).toISOString(),
          coefficientMin: parseInt(formData.coefficientMin),
          coefficientMax: parseInt(formData.coefficientMax)
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Debug Slot Search
            </CardTitle>
            <CardDescription>
              Тестирование поиска слотов с детальным логированием
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouseIds">Warehouse IDs (через запятую)</Label>
                  <Input
                    id="warehouseIds"
                    name="warehouseIds"
                    value={formData.warehouseIds}
                    onChange={handleChange}
                    placeholder="117866, 117867"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="boxTypeIds">Box Type IDs (через запятую)</Label>
                  <Input
                    id="boxTypeIds"
                    name="boxTypeIds"
                    value={formData.boxTypeIds}
                    onChange={handleChange}
                    placeholder="2, 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">Дата начала</Label>
                  <Input
                    id="dateFrom"
                    name="dateFrom"
                    type="datetime-local"
                    value={formData.dateFrom}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">Дата окончания</Label>
                  <Input
                    id="dateTo"
                    name="dateTo"
                    type="datetime-local"
                    value={formData.dateTo}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coefficientMin">Минимальный коэффициент</Label>
                  <Input
                    id="coefficientMin"
                    name="coefficientMin"
                    type="number"
                    value={formData.coefficientMin}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coefficientMax">Максимальный коэффициент</Label>
                  <Input
                    id="coefficientMax"
                    name="coefficientMax"
                    type="number"
                    value={formData.coefficientMax}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Тестировать поиск слотов
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Ошибка:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Результат тестирования
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{result.foundSlots}</div>
                    <div className="text-sm text-blue-500">Найдено слотов</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{result.searchTime}ms</div>
                    <div className="text-sm text-green-500">Время поиска</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{result.tokenInfo?.hasToken ? '✅' : '❌'}</div>
                    <div className="text-sm text-purple-500">Токен найден</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{result.tokenInfo?.isActive ? '✅' : '❌'}</div>
                    <div className="text-sm text-orange-500">Токен активен</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Конфигурация:</h4>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                    {JSON.stringify(result.config, null, 2)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Информация о токене:</h4>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                    {JSON.stringify(result.tokenInfo, null, 2)}
                  </pre>
                </div>

                {result.result && result.result.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Найденные слоты:</h4>
                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto max-h-96">
                      {JSON.stringify(result.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function DebugSlotSearchPage() {
  return (
    <DebugPageGuard>
      <DebugSlotSearchPageContent />
    </DebugPageGuard>
  );
}
