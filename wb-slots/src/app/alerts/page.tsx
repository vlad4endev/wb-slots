'use client';

import { AlertSystem } from '@/components/alerts/alert-system';
import DashboardLayout from '@/app/dashboard-layout';

// Отключаем prerendering для этой страницы
export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <AlertSystem />
      </div>
    </DashboardLayout>
  );
}
