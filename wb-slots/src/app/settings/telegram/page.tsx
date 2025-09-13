'use client';

import { FiArrowLeft as ArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import TelegramSettings from '@/components/telegram-settings';
import DashboardLayout from '@/app/dashboard-layout';

export default function TelegramSettingsPage() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/settings">
                  <button 
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Вернуться к настройкам"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Настройки Telegram
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Управление уведомлениями и настройками бота
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <TelegramSettings showAdminSettings={true} />
        </div>
      </div>
    </DashboardLayout>
  );
}
