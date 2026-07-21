'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FiArrowLeft as ArrowLeft, FiInfo as InfoIcon } from 'react-icons/fi';
import Link from 'next/link';
import EnhancedSessionManager from '@/components/wb-session/enhanced-session-manager';

export default function EnhancedWBSessionPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Навигация */}
        <div className="mb-6">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к панели управления
          </Link>
        </div>

        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Управление сессиями WB (Enhanced)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Улучшенная система управления сессиями с полной поддержкой localStorage, sessionStorage и защитой от состояний гонки
          </p>
        </div>

        {/* Информационное сообщение */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <InfoIcon className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Новая архитектура сессий WB</strong><br />
            Эта система решает проблемы с нестабильным восстановлением сессий, проблемами с localStorage/sessionStorage и редиректами на страницу входа.
            Все данные сессии теперь шифруются и хранятся в улучшенной схеме базы данных.
          </AlertDescription>
        </Alert>

        {/* Основной компонент управления сессиями */}
        <EnhancedSessionManager />

        {/* Дополнительная информация */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Технические детали</CardTitle>
            <CardDescription>
              Информация о реализации новой архитектуры сессий
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Решенные проблемы:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>❌ Нестабильное восстановление сессий → ✅ Стабильное восстановление с валидацией</li>
                  <li>❌ Проблемы с localStorage/sessionStorage → ✅ Полная поддержка всех типов хранилища</li>
                  <li>❌ Редиректы на страницу входа → ✅ Автоматическая проверка авторизации</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Новые возможности:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>🔐 Улучшенное шифрование данных сессии (AES-256-GCM)</li>
                  <li>🔄 Защита от состояний гонки при работе с сессиями</li>
                  <li>📊 Детальная статистика и мониторинг сессий</li>
                  <li>🔍 Автоматическая валидация целостности сессий</li>
                  <li>⚡ Оптимизированное восстановление сессий</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  API Endpoints:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li><code>/api/wb-auth/enhanced</code> - Авторизация и управление сессиями</li>
                  <li><code>/api/wb-session/enhanced/create</code> - Создание сессии</li>
                  <li><code>/api/wb-session/enhanced/restore</code> - Восстановление сессии</li>
                  <li><code>/api/wb-session/enhanced/refresh</code> - Обновление сессии</li>
                  <li><code>/api/wb-session/enhanced/status</code> - Статус сессий</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
