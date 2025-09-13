'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FiTrendingUp as TrendingUp,
  FiClock as Clock,
  FiCheckCircle as CheckCircle,
  FiXCircle as XCircle,
  FiSearch as Search,
  FiActivity as Activity,
  FiBarChart as BarChart3,
} from 'react-icons/fi';
import { SlotSearchStats } from '@/types/slot-search';

interface SlotSearchStatsProps {
  stats: SlotSearchStats;
  isLoading?: boolean;
}

export default function SlotSearchStats({ stats, isLoading = false }: SlotSearchStatsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Статистика поиска
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const successRate = stats.totalSearches > 0 
    ? (stats.successfulSearches / stats.totalSearches) * 100 
    : 0;

  const averageSlotsPerSearch = stats.totalSearches > 0 
    ? stats.totalFoundSlots / stats.totalSearches 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Общее количество поисков */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Всего поисков</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {stats.totalSearches}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Успешные поиски */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Успешные</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {stats.successfulSearches}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Найденные слоты */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Найдено слотов</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {stats.totalFoundSlots}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Среднее время поиска */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Среднее время</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {Math.round(stats.averageSearchTime)}мс
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Дополнительная статистика */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Детальная статистика
          </CardTitle>
          <CardDescription>
            Анализ эффективности поиска слотов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Успешность поиска */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Успешность поиска
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {successRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={successRate} className="h-2" />
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>{stats.successfulSearches} успешных</span>
                <XCircle className="w-3 h-3 text-red-500 ml-2" />
                <span>{stats.failedSearches} неудачных</span>
              </div>
            </div>

            {/* Среднее количество слотов на поиск */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Слотов на поиск
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {averageSlotsPerSearch.toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Всего найдено: {stats.totalFoundSlots} слотов
              </div>
            </div>

            {/* Последний поиск */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Последний поиск
                </span>
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(stats.lastSearchTime).toLocaleTimeString('ru-RU')}
                </Badge>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(stats.lastSearchTime).toLocaleDateString('ru-RU')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
