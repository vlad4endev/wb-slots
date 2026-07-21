'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModernNavigation from '@/components/modern-navigation';
import DashboardHeader from '@/components/dashboard-header';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  timezone: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) {
          // Раньше здесь просто оставляли user = null и всё равно рендерили
          // весь шелл с навигацией анонимному посетителю.
          if (!cancelled) router.replace('/');
          return;
        }
        const data = await response.json();
        if (!cancelled) setUser(data.data?.user);
      } catch (error) {
        console.error('Auth check error:', error);
        if (!cancelled) router.replace('/');
        return;
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        <ModernNavigation user={user} />
        <div className="flex-1 lg:ml-0 flex flex-col">
          <DashboardHeader user={user} onLogout={handleLogout} />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
