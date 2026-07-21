'use client';
import DebugPageGuard from '@/components/debug-page-guard';

import React from 'react';
import { SimpleBrowserConnection } from '@/components/SimpleBrowserConnection';

function BrowserTestPageContent() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Тест подключения к браузеру</h1>
        <p className="text-muted-foreground">
          Простое тестирование подключения к браузеру
        </p>
      </div>

      <SimpleBrowserConnection />
    </div>
  );
}

export default function BrowserTestPage() {
  return (
    <DebugPageGuard>
      <BrowserTestPageContent />
    </DebugPageGuard>
  );
}
