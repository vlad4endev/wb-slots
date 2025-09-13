'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FiHome as Home, 
  FiSearch as Search, 
  FiSettings as Settings, 
  FiBarChart3 as BarChart3, 
  FiPlus as Plus,
  FiMenu as Menu,
  FiX as X,
  FiZap as Zap,
  FiClock as Clock,
  FiPackage as Warehouse,
  FiMessageSquare as MessageSquare,
  FiBot as Bot,
  FiActivity as Activity,
  FiShield as Shield,
  FiDatabase as Database
} from 'react-icons/fi';
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
  {
    name: 'Главная',
    href: '/dashboard',
    icon: Home,
    description: 'Обзор системы'
  },
  {
    name: 'Поиск слотов',
    href: '/tasks',
    icon: Search,
    description: 'Управление задачами'
  },
  {
    name: 'Автобронирование',
    href: '/auto-booking',
    icon: Zap,
    description: 'Автоматическое бронирование'
  },
  {
    name: 'Аналитика',
    href: '/analytics',
    icon: BarChart3,
    description: 'Статистика и отчеты'
  },
  {
    name: 'Настройки',
    href: '/settings',
    icon: Settings,
    description: 'Конфигурация системы'
  }
];

const quickActions = [
  {
    name: 'Telegram',
    href: '/settings/telegram',
    icon: MessageSquare,
    variant: 'outline' as const
  },
  {
    name: 'WB Куки',
    href: '/wb-session/extract-cookies',
    icon: Database,
    variant: 'outline' as const
  }
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
      <nav className="hidden lg:flex lg:flex-col lg:w-64 lg:bg-white lg:border-r lg:border-gray-200 lg:dark:bg-gray-900 lg:dark:border-gray-800 lg:h-screen lg:sticky lg:top-0">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">WB Slots</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Автоматизация поиска</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-4 py-6 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${active ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                </div>
                {active && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Быстрые действия
          </h3>
          <div className="space-y-2">
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
              className="w-full justify-start"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать задачу
            </Button>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.name} href={action.href}>
                  <Button
                    variant={action.variant}
                    size="sm"
                    className="w-full justify-start"
                  >
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
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">WB Slots</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="px-4 py-4 space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {/* Mobile Quick Actions */}
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    setIsCreateModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  size="sm"
                  className="w-full"
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

      {/* Create Task Modal */}
      <CreateTaskModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          // Можно добавить обновление данных или редирект
        }}
      />
    </>
  );
}
