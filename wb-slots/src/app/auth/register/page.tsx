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
  UserPlus,
  Target,
  Star,
  Users,
  Lock,
  LogIn,
} from 'lucide-react';

const BENEFITS = [
  { icon: Star, title: 'Бесплатная регистрация', description: 'Создайте аккаунт за 2 минуты и начните работу' },
  { icon: Users, title: 'Мультипользовательская система', description: 'Каждый пользователь имеет изолированные данные' },
  { icon: Lock, title: 'Безопасность данных', description: 'Все данные зашифрованы и защищены' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          name: formData.name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Ошибка регистрации');
      }
    } catch (error) {
      setError('Произошла ошибка при регистрации');
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
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-violet-400/15 dark:bg-violet-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-32 w-[24rem] h-[24rem] bg-fuchsia-400/10 dark:bg-fuchsia-500/10 rounded-full blur-3xl" />

      <header className="relative bg-background/80 backdrop-blur-md border-b border-border/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-md shadow-violet-500/20">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-none">WB Slots</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Поиск слотов Wildberries</p>
              </div>
            </Link>

            <Link href="/auth/login">
              <Button variant="outline" className="gap-2">
                <LogIn className="w-4 h-4" />
                Войти
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-[calc(100vh-73px)]">
        {/* Left Side - Benefits */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16">
          <div className="max-w-md space-y-6">
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

        {/* Right Side - Register Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 lg:py-0">
          <div className="w-full max-w-md">
            <Card className="border border-border/60 shadow-xl shadow-violet-950/5 animate-fade-in">
              <CardHeader className="space-y-2 text-center pb-6">
                <div className="mx-auto w-11 h-11 bg-brand-gradient rounded-full flex items-center justify-center mb-3 shadow-md shadow-violet-500/20">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">Создать аккаунт</CardTitle>
                <CardDescription>Заполните форму для регистрации</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name">Полное имя</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Иван Иванов"
                      className="h-11"
                    />
                  </div>

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
                    <Label htmlFor="phone">Номер телефона</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+7 (999) 123-45-67"
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
                        placeholder="Создайте надежный пароль"
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

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Повторите пароль"
                      className="h-11"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 bg-brand-gradient hover:opacity-90 border-0 shadow-lg shadow-violet-500/20" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Создаем аккаунт...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Создать аккаунт
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-muted-foreground">Уже есть аккаунт?</span>
                  </div>
                </div>

                <div className="text-center">
                  <Link href="/auth/login" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                    Войти в существующий аккаунт
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>

                <div className="text-center text-xs text-muted-foreground">
                  Регистрируясь, вы соглашаетесь с{' '}
                  <Link href="/terms" className="text-primary hover:underline">
                    условиями использования
                  </Link>{' '}
                  и{' '}
                  <Link href="/privacy" className="text-primary hover:underline">
                    политикой конфиденциальности
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
