'use client';

import { AdvancedAnalyticsDashboard } from '@/components/analytics/advanced-analytics-dashboard';
import DashboardLayout from '@/app/dashboard-layout';

// Отключаем prerendering для этой страницы
export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <AdvancedAnalyticsDashboard />
      </div>
    </DashboardLayout>
  );
}
