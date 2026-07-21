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
    <header className="bg-card/80 backdrop-blur-md border-b border-border/60 px-6 py-4 sticky top-0 z-10">
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
              <a href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Войти
              </a>
              <a href="/auth/register" className="text-sm bg-brand-gradient text-white px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
                Регистрация
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
