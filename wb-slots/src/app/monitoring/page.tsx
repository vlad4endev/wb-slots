'use client';

import { PerformanceMonitor } from '@/components/monitoring/performance-monitor';
import DashboardLayout from '@/app/dashboard-layout';

// Отключаем prerendering для этой страницы
export const dynamic = 'force-dynamic';

export default function MonitoringPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <PerformanceMonitor showDetails={true} />
      </div>
    </DashboardLayout>
  );
}
