'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  FiUser as User, 
  FiSettings as Settings, 
  FiLogOut as LogOut, 
  FiChevronDown as ChevronDown,
  FiUser as UserCircle,
  FiCog as Cog,
  FiPower as Power,
  FiWrench as Wrench,
  FiTestTube as TestTube,
  FiBug as Bug,
  FiMessageSquare as MessageSquare,
  FiBot as Bot,
  FiDatabase as Database,
  FiMonitor as Monitor,
  FiPlus as Plus,
  FiShield as Shield,
  FiAward as BadgeIcon
} from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface AccountMenuProps {
  user: UserProfile;
  onLogout: () => void;
}

export default function AccountMenu({ user, onLogout }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Закрываем меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    onLogout();
    setIsOpen(false);
  };

  const handleProfileClick = () => {
    router.push('/settings?tab=profile');
    setIsOpen(false);
  };

  const handleSettingsClick = () => {
    router.push('/settings');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
          user.role === 'DEVELOPER' 
            ? 'bg-purple-100 dark:bg-purple-900/20'
            : user.role === 'ADMIN'
            ? 'bg-red-100 dark:bg-red-900/20'
            : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          <UserCircle className={`w-4 h-4 ${
            user.role === 'DEVELOPER' 
              ? 'text-purple-600 dark:text-purple-400'
              : user.role === 'ADMIN'
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-400'
          }`} />
        </div>
        <div className="hidden sm:block text-left">
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium">{user.name || user.email}</span>
            {user.role && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                user.role === 'DEVELOPER' 
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                  : user.role === 'ADMIN'
                  ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {user.role === 'DEVELOPER' ? 'DEV' : 
                 user.role === 'ADMIN' ? 'ADMIN' : 
                 'USER'}
              </span>
            )}
            {user.isProtected && (
              <Shield className="w-3 h-3 text-green-500" />
            )}
          </div>
        </div>
        <ChevronDown className="w-4 h-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                user.role === 'DEVELOPER' 
                  ? 'bg-purple-100 dark:bg-purple-900/20'
                  : user.role === 'ADMIN'
                  ? 'bg-red-100 dark:bg-red-900/20'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <UserCircle className={`w-6 h-6 ${
                  user.role === 'DEVELOPER' 
                    ? 'text-purple-600 dark:text-purple-400'
                    : user.role === 'ADMIN'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.name || 'Пользователь'}
                  </p>
                  {user.role && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'DEVELOPER' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                        : user.role === 'ADMIN'
                        ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {user.role === 'DEVELOPER' ? 'DEV' : 
                       user.role === 'ADMIN' ? 'ADMIN' : 
                       'USER'}
                    </span>
                  )}
                  {user.isProtected && (
                    <Shield className="w-3 h-3 text-green-500" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
                {user.role === 'DEVELOPER' && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                    Максимальные права
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2">
            <Button 
              className="w-full justify-start" 
              size="sm"
              onClick={() => {
                setIsCreateModalOpen(true);
                setIsOpen(false);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать задачу
            </Button>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleProfileClick}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <User className="w-4 h-4 mr-3" />
              Мой профиль
            </button>
            
            <button
              onClick={handleSettingsClick}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4 mr-3" />
              Настройки
            </button>
          </div>

          {/* Services Section */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                СЛУЖБЫ
              </h3>
            </div>
            <div className="py-1">
              <Link
                href="/test-services"
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <TestTube className="w-4 h-4 mr-3 text-blue-500" />
                Тест сервисов
              </Link>
              
              <Link
                href="/test-telegram-webapp"
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <MessageSquare className="w-4 h-4 mr-3 text-green-500" />
                Telegram WebApp
              </Link>
              
              <Link
                href="/debug-auth"
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Bug className="w-4 h-4 mr-3 text-orange-500" />
                Debug Auth
              </Link>
              
              <Link
                href="/test-logging"
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Database className="w-4 h-4 mr-3 text-purple-500" />
                Тест логирования
              </Link>
              
              <Link
                href="/test-monitoring"
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Monitor className="w-4 h-4 mr-3 text-cyan-500" />
                Мониторинг
              </Link>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* Logout */}
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Выйти
            </button>
          </div>

          {/* Developer Info */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              <p>Чендев В. 2025-2026</p>
              <p>Сборка: 1.0.0</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          // Можно добавить редирект на страницу задач
        }}
      />
    </div>
  );
}
