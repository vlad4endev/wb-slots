'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AccountMenu from '@/components/account-menu';
import CreateTaskModal from '@/components/create-task-modal';
import {
  Zap,
  Target,
  Shield,
  Bell,
  Sparkles,
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
  Play,
  LogIn,
  UserPlus,
  Plus,
  Activity,
  Settings,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Автоматизация',
    description: 'Полностью автоматический поиск слотов 24/7 с уведомлениями в Telegram',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: Target,
    title: 'Умный поиск',
    description: 'ИИ анализирует коэффициенты и находит самые выгодные слоты',
    gradient: 'from-fuchsia-500 to-pink-500',
  },
  {
    icon: Shield,
    title: 'Безопасность',
    description: 'Шифрование данных и безопасная работа с API Wildberries',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    icon: Bell,
    title: 'Уведомления',
    description: 'Получайте мгновенные уведомления о найденных слотах в Telegram',
    gradient: 'from-pink-500 to-rose-500',
  },
];

const STEPS = [
  { n: 1, title: 'Подключение', description: 'Добавьте токены WB API и настройте склады для поиска' },
  { n: 2, title: 'Настройка', description: 'Создайте задачи с параметрами поиска и расписанием' },
  { n: 3, title: 'Автоматизация', description: 'Получайте уведомления о найденных слотах и бронируйте их' },
];

const STATS = [
  { icon: Users, value: '1000+', label: 'Активных пользователей' },
  { icon: Target, value: '50K+', label: 'Найденных слотов' },
  { icon: TrendingUp, value: '95%', label: 'Точность поиска' },
  { icon: Clock, value: '24/7', label: 'Работа системы' },
];

interface HomeUser {
  name?: string;
  email: string;
}

export default function HomePage() {
  const [user, setUser] = useState<HomeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.data?.user);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
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
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative brand-colored glow orbs, fixed in the background */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[32rem] h-[32rem] bg-violet-400/20 dark:bg-violet-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-40 w-[28rem] h-[28rem] bg-fuchsia-400/15 dark:bg-fuchsia-500/10 rounded-full blur-3xl" />

      {/* Header */}
      <header className="relative bg-background/80 backdrop-blur-md border-b border-border/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center shadow-md shadow-violet-500/20">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-none">WB Slots</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Поиск слотов Wildberries</p>
              </div>
            </Link>

            {user ? (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground">Добро пожаловать!</p>
                </div>
                <AccountMenu user={user} onLogout={handleLogout} />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth/login">
                  <Button variant="ghost" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Войти
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="gap-2 bg-brand-gradient hover:opacity-90 border-0 shadow-md shadow-violet-500/20">
                    <UserPlus className="w-4 h-4" />
                    Регистрация
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-700 dark:text-violet-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-violet-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Новый способ поиска слотов
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 text-balance">
            Автоматический поиск
            <span className="block text-brand-gradient">слотов Wildberries</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto text-balance">
            Экономьте время и находите лучшие слоты для поставок с помощью
            искусственного интеллекта и автоматизации
          </p>

          {user ? (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/dashboard">
                <Button size="lg" className="gap-2 bg-brand-gradient hover:opacity-90 border-0 shadow-lg shadow-violet-500/25">
                  <Activity className="w-5 h-5" />
                  Панель управления
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-5 h-5" />
                Создать задачу
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/auth/register">
                <Button size="lg" className="gap-2 bg-brand-gradient hover:opacity-90 border-0 shadow-lg shadow-violet-500/25">
                  <Play className="w-5 h-5" />
                  Начать бесплатно
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="gap-2">
                  <LogIn className="w-5 h-5" />
                  Войти в аккаунт
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="border border-border/60 bg-card shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div
                  className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-5 shadow-md`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it works */}
        <div className="text-center mb-24">
          <h2 className="text-3xl font-bold text-foreground mb-3">Как это работает</h2>
          <p className="text-muted-foreground mb-14">Всего 3 простых шага для начала работы</p>

          <div className="grid md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-gradient-to-r from-border to-transparent" />
                )}
                <div className="relative w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/20">
                  <span className="text-2xl font-bold text-white">{step.n}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
          {STATS.map((stat) => (
            <Card key={stat.label} className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-6 text-center">
                <stat.icon className="w-5 h-5 text-violet-500 mx-auto mb-3" />
                <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        {!user && (
          <div className="relative text-center rounded-3xl p-12 md:p-16 overflow-hidden bg-brand-gradient">
            <div className="relative">
              <h2 className="text-3xl font-bold text-white mb-4">Готовы начать?</h2>
              <p className="text-white/85 mb-8 max-w-2xl mx-auto">
                Присоединяйтесь к тысячам продавцов, которые уже экономят время и находят
                лучшие слоты с помощью нашей системы
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link href="/auth/register">
                  <Button size="lg" variant="secondary" className="gap-2 bg-white text-violet-700 hover:bg-white/90">
                    <UserPlus className="w-5 h-5" />
                    Создать аккаунт
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="gap-2 border-white/40 text-white hover:bg-white/10 hover:text-white">
                    <LogIn className="w-5 h-5" />
                    Войти
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/60 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">WB Slots</p>
                <p className="text-xs text-muted-foreground">© 2026 Все права защищены</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                <Settings className="w-4 h-4" />
                Настройки
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Политика конфиденциальности
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Условия использования
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
