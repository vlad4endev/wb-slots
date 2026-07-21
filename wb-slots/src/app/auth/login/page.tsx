'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  Target,
  LogIn,
  Zap,
  Shield,
  MessageCircle,
} from 'lucide-react';

const BENEFITS = [
  { icon: Zap, title: 'Автоматизация', description: 'Полностью автоматический поиск слотов 24/7 с уведомлениями в Telegram' },
  { icon: Target, title: 'Умный поиск', description: 'ИИ анализирует коэффициенты и находит самые выгодные слоты' },
  { icon: Shield, title: 'Безопасность', description: 'Шифрование данных и безопасная работа с API Wildberries' },
];

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Ошибка входа');
      }
    } catch (error) {
      setError('Произошла ошибка при входе');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-violet-400/15 dark:bg-violet-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -left-32 w-[24rem] h-[24rem] bg-fuchsia-400/10 dark:bg-fuchsia-500/10 rounded-full blur-3xl" />

      <div className="relative flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16">
          <div className="max-w-md">
            <div className="mb-12 animate-fade-in">
              <Link href="/" className="inline-flex items-center space-x-4 group">
                <div className="w-14 h-14 bg-brand-gradient rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-lg shadow-violet-500/25">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold text-foreground">WB Slots</h1>
                  <p className="text-muted-foreground">Поиск слотов Wildberries</p>
                </div>
              </Link>
            </div>

            <div className="space-y-6">
              {BENEFITS.map((item, i) => (
                <div key={item.title} className={`flex items-start gap-3 animate-fade-in-delay-${i + 1}`}>
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 lg:py-0">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8 animate-fade-in">
              <Link href="/" className="inline-flex items-center space-x-3 group">
                <div className="w-11 h-11 bg-brand-gradient rounded-xl flex items-center justify-center shadow-md shadow-violet-500/20">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-xl font-bold text-foreground">WB Slots</h1>
                  <p className="text-xs text-muted-foreground">Поиск слотов Wildberries</p>
                </div>
              </Link>
            </div>

            <Card className="border border-border/60 shadow-xl shadow-violet-950/5 animate-fade-in">
              <CardHeader className="space-y-2 text-center pb-6">
                <div className="mx-auto w-11 h-11 bg-brand-gradient rounded-full flex items-center justify-center mb-3 shadow-md shadow-violet-500/20">
                  <LogIn className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">Добро пожаловать!</CardTitle>
                <CardDescription>Войдите в свой аккаунт для продолжения</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email адрес</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Введите пароль"
                        className="h-11 pr-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-11 w-11 hover:bg-transparent text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline font-medium">
                      Забыли пароль?
                    </Link>
                  </div>

                  <Button type="submit" className="w-full h-11 bg-brand-gradient hover:opacity-90 border-0 shadow-lg shadow-violet-500/20" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Входим...
                      </>
                    ) : (
                      <>
                        Войти
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-card text-muted-foreground">Или</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Link href="/auth/telegram-widget">
                      <Button type="button" variant="outline" className="w-full h-11 text-primary border-primary/30 hover:bg-primary/5">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Войти через Telegram
                      </Button>
                    </Link>

                    <Link href="/auth/telegram">
                      <Button type="button" variant="ghost" className="w-full h-9 text-sm text-muted-foreground">
                        Telegram Web App
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-muted-foreground">Нет аккаунта?</span>
                  </div>
                </div>

                <div className="text-center">
                  <Link href="/auth/register" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                    Создать новый аккаунт
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
