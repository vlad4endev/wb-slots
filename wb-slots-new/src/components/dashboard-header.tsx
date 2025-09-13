'use client';

import AccountMenu from '@/components/account-menu';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  timezone: string;
}

interface DashboardHeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
}

export default function DashboardHeader({ user, onLogout }: DashboardHeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - can be empty or have breadcrumbs */}
        <div className="flex-1">
          {/* Breadcrumbs or page title can go here */}
        </div>
        
        {/* Right side - User menu */}
        <div className="flex items-center space-x-4">
          {user ? (
            <AccountMenu user={user} onLogout={onLogout} />
          ) : (
            <div className="flex items-center space-x-2">
              <a href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                Войти
              </a>
              <a href="/auth/register" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
                Регистрация
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
