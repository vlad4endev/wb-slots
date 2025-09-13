'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Bot, 
  Key, 
  Copy, 
  Check, 
  AlertCircle,
  ExternalLink,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function TelegramSetupPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      id: 'step1',
      title: 'Создайте бота в Telegram',
      description: 'Напишите @BotFather в Telegram и создайте нового бота',
      details: [
        'Откройте Telegram и найдите @BotFather',
        'Отправьте команду /newbot',
        'Введите имя для вашего бота (например: "WB Slots Bot")',
        'Введите username для бота (например: "wb_slots_bot")',
        'Скопируйте полученный токен'
      ],
      code: '/newbot\nWB Slots Bot\nwb_slots_bot'
    },
    {
      id: 'step2',
      title: 'Получите Chat ID',
      description: 'Узнайте ваш Chat ID для отправки уведомлений',
      details: [
        'Напишите боту @userinfobot',
        'Отправьте любое сообщение',
        'Скопируйте ваш Chat ID (число)',
        'Или используйте бота @getidsbot'
      ],
      code: 'Напишите @userinfobot\nОтправьте любое сообщение\nСкопируйте Chat ID'
    },
    {
      id: 'step3',
      title: 'Настройте переменные окружения',
      description: 'Добавьте токен бота в файл .env.local',
      details: [
        'Создайте файл .env.local в корне проекта',
        'Добавьте строку с токеном бота',
        'Перезапустите приложение'
      ],
      code: 'TELEGRAM_BOT_TOKEN="ваш_токен_от_BotFather"'
    },
    {
      id: 'step4',
      title: 'Настройте уведомления в приложении',
      description: 'Введите Chat ID в настройках приложения',
      details: [
        'Перейдите в раздел "Настройки"',
        'Выберите вкладку "Telegram"',
        'Введите ваш Chat ID',
        'Включите уведомления',
        'Сохраните настройки'
      ],
      code: 'Chat ID: ваш_chat_id\nВключить уведомления: ✓'
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Настройка Telegram уведомлений
        </h1>
        <p className="text-muted-foreground">
          Пошаговая инструкция по настройке Telegram бота для уведомлений
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Важно:</strong> Для работы Telegram уведомлений необходимо создать бота и настроить переменные окружения.
          <br />
          <strong>Текущий статус:</strong> {process.env.TELEGRAM_BOT_TOKEN ? '✅ Токен настроен' : '❌ Токен не настроен'}
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {steps.map((step, index) => (
          <Card key={step.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                  {index + 1}
                </Badge>
                {step.title}
              </CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Детальные шаги:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {step.details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Пример команды/кода:</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(step.code, step.id)}
                  >
                    {copied === step.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <pre className="bg-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                  {step.code}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Полезные ссылки */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Полезные ссылки
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Telegram боты:</h4>
              <div className="space-y-1">
                <a 
                  href="https://t.me/BotFather" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Bot className="h-4 w-4" />
                  @BotFather - создание ботов
                </a>
                <a 
                  href="https://t.me/userinfobot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Key className="h-4 w-4" />
                  @userinfobot - получение Chat ID
                </a>
                <a 
                  href="https://t.me/getidsbot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Key className="h-4 w-4" />
                  @getidsbot - альтернативный способ
                </a>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Действия:</h4>
              <div className="space-y-2">
                <Link href="/settings/telegram">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Настроить Telegram в приложении
                  </Button>
                </Link>
                <Link href="/test-telegram-settings">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Протестировать настройки
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Пример файла .env.local */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Пример файла .env.local</CardTitle>
          <CardDescription>
            Создайте файл .env.local в корне проекта с настройками
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Инструкция:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Создайте файл <code>.env.local</code> в корне проекта (рядом с <code>package.json</code>)</li>
                  <li>Скопируйте содержимое ниже в этот файл</li>
                  <li>Замените <code>YOUR_BOT_TOKEN_HERE</code> на ваш токен от @BotFather</li>
                  <li>Перезапустите приложение командой <code>npm run dev</code></li>
                </ol>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Содержимое файла .env.local:</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(`# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="your-32-byte-base64-encryption-key-here"

# App
APP_BASE_URL="http://localhost:3000"
NODE_ENV="development"

# Telegram
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
TELEGRAM_WEBHOOK_URL=""

# Rate limiting
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"`, 'env')}
                >
                  {copied === 'env' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="your-32-byte-base64-encryption-key-here"

# App
APP_BASE_URL="http://localhost:3000"
NODE_ENV="development"

# Telegram
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
TELEGRAM_WEBHOOK_URL=""

# Rate limiting
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
