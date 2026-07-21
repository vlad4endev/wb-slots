'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Home,
  Search,
  Settings,
  BarChart3,
  Plus,
  Menu,
  X,
  Zap,
  Activity,
  Shield,
  Target,
} from 'lucide-react';
import CreateTaskModal from '@/components/create-task-modal';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  timezone: string;
  role?: string;
  isProtected?: boolean;
}

interface ModernNavigationProps {
  user: UserProfile | null;
}

const navigationItems = [
  { name: 'Главная', href: '/dashboard', icon: Home, description: 'Обзор системы' },
  { name: 'Задачи поиска слотов', href: '/tasks', icon: Search, description: 'Управление задачами поиска слотов' },
  { name: 'Автобронирование', href: '/auto-booking', icon: Zap, description: 'Автоматическое бронирование' },
  { name: 'Аналитика', href: '/analytics', icon: BarChart3, description: 'Статистика и отчеты' },
  { name: 'Мониторинг', href: '/monitoring', icon: Activity, description: 'Производительность системы' },
  { name: 'Алерты', href: '/alerts', icon: Shield, description: 'Уведомления и алерты' },
  { name: 'Настройки', href: '/settings', icon: Settings, description: 'Конфигурация системы и Telegram' },
];

const quickActions = [
  { name: 'Настройки', href: '/settings', icon: Settings, variant: 'outline' as const },
];

export default function ModernNavigation({ user }: ModernNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname?.startsWith(href) || false;
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex lg:flex-col lg:w-64 lg:bg-card lg:border-r lg:border-border/60 lg:h-screen lg:sticky lg:top-0">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-border/60">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-sm shadow-violet-500/20">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-none">WB Slots</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Автоматизация поиска</p>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary" />
                )}
                <Icon className={`w-[18px] h-[18px] mr-3 flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-4 border-t border-border/60">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Быстрые действия
          </h3>
          <div className="space-y-2">
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
              className="w-full justify-start bg-brand-gradient hover:opacity-90 border-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать задачу
            </Button>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.name} href={action.href}>
                  <Button variant={action.variant} size="sm" className="w-full justify-start">
                    <Icon className="w-4 h-4 mr-2" />
                    {action.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/60">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-sm shadow-violet-500/20">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-foreground">WB Slots</h1>
          </Link>

          <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="bg-card border-b border-border/60">
            <div className="px-4 py-4 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] mr-3" />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Quick Actions */}
            <div className="px-4 py-4 border-t border-border/60">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    setIsCreateModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  size="sm"
                  className="w-full bg-brand-gradient hover:opacity-90 border-0"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать задачу
                </Button>
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.name} href={action.href} onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant={action.variant} size="sm" className="w-full">
                        <Icon className="w-4 h-4 mr-2" />
                        {action.name}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setIsCreateModalOpen(false)}
      />
    </>
  );
}
