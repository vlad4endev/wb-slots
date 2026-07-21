'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FiCalendar as Calendar,
  FiClock as Clock,
  FiSunrise as Sunrise,
  FiSun as Sun
} from 'react-icons/fi';

export interface DateRange {
  from: string;
  to: string;
}

interface DatePresetsProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  showTimeInput?: boolean;
  className?: string;
}

export const getDatePreset = (preset: string): DateRange => {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  
  // Устанавливаем время начала на начало дня
  from.setHours(0, 0, 0, 0);
  
  switch (preset) {
    case 'today':
      to.setHours(23, 59, 59, 999);
      break;
    case 'tomorrow':
      from.setDate(from.getDate() + 1);
      to.setDate(to.getDate() + 1);
      to.setHours(23, 59, 59, 999);
      break;
    case '3days':
      to.setDate(to.getDate() + 2);
      to.setHours(23, 59, 59, 999);
      break;
    case 'week':
      to.setDate(to.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      break;
    case '2weeks':
      to.setDate(to.getDate() + 13);
      to.setHours(23, 59, 59, 999);
      break;
    case 'month':
      to.setDate(to.getDate() + 29);
      to.setHours(23, 59, 59, 999);
      break;
    default:
      to.setDate(to.getDate() + 29);
      to.setHours(23, 59, 59, 999);
  }
  
  return {
    from: from.toISOString().slice(0, 16),
    to: to.toISOString().slice(0, 16),
  };
};

const DATE_PRESETS = [
  { id: 'today', label: 'На сегодня', icon: Sun, color: 'blue' },
  { id: 'tomorrow', label: 'На завтра', icon: Sunrise, color: 'indigo' },
  { id: '3days', label: 'На 3 дня', icon: Calendar, color: 'purple' },
  { id: 'week', label: 'На неделю', icon: Calendar, color: 'pink' },
  { id: '2weeks', label: 'На 2 недели', icon: Calendar, color: 'rose' },
  { id: 'month', label: 'На месяц', icon: Calendar, color: 'red' },
];

export default function DatePresets({
  dateRange,
  onDateRangeChange,
  showTimeInput = true,
  className = '',
}: DatePresetsProps) {
  const handlePresetClick = (preset: string) => {
    const newRange = getDatePreset(preset);
    onDateRangeChange(newRange);
  };

  const handleManualChange = (field: 'from' | 'to', value: string) => {
    onDateRangeChange({
      ...dateRange,
      [field]: value,
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Быстрый выбор периода
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {DATE_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(preset.id)}
                className={`flex items-center justify-center gap-1 text-xs hover:bg-${preset.color}-50 hover:border-${preset.color}-300 dark:hover:bg-${preset.color}-900/20`}
              >
                <Icon className="w-3 h-3" />
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateFrom" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Дата начала поиска
          </Label>
          <Input
            id="dateFrom"
            type={showTimeInput ? 'datetime-local' : 'date'}
            value={dateRange.from}
            onChange={(e) => handleManualChange('from', e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateTo" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Дата окончания поиска
          </Label>
          <Input
            id="dateTo"
            type={showTimeInput ? 'datetime-local' : 'date'}
            value={dateRange.to}
            onChange={(e) => handleManualChange('to', e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {/* Валидация дат */}
      {dateRange.from && dateRange.to && new Date(dateRange.from) >= new Date(dateRange.to) && (
        <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <span>⚠️</span>
          <span>Дата начала должна быть раньше даты окончания</span>
        </div>
      )}

      {/* Информация о выбранном периоде */}
      {dateRange.from && dateRange.to && new Date(dateRange.from) < new Date(dateRange.to) && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
          <span className="font-medium">Выбранный период:</span>{' '}
          {new Date(dateRange.from).toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}
          {' - '}
          {new Date(dateRange.to).toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}
          {' '}
          ({Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24))} дней)
        </div>
      )}
    </div>
  );
}

