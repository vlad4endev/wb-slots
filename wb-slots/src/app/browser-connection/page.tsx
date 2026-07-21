'use client';

import React, { useState } from 'react';
import { BrowserConnectionManager } from '@/components/BrowserConnectionManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Info, Monitor } from 'lucide-react';

export default function BrowserConnectionPage() {
  const [connectedSessionId, setConnectedSessionId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);

  const handleSessionConnected = (sessionId: string) => {
    setConnectedSessionId(sessionId);
  };

  const handleDataExtracted = (data: any) => {
    setExtractedData(data);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Подключение к браузеру</h1>
        <p className="text-muted-foreground">
          Автоматическое обнаружение открытого браузера и извлечение данных сессии
        </p>
      </div>

      {/* Статус подключения */}
      {connectedSessionId && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Сессия успешно подключена! ID сессии: <Badge variant="outline">{connectedSessionId}</Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Информация о извлеченных данных */}
      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Извлеченные данные
            </CardTitle>
            <CardDescription>
              Данные успешно извлечены из браузера
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="font-medium">Cookies</p>
                <p className="text-2xl font-bold text-blue-600">{extractedData.cookiesCount || 0}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-medium">LocalStorage</p>
                <p className="text-2xl font-bold text-green-600">{extractedData.localStorageKeys || 0}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-medium">SessionStorage</p>
                <p className="text-2xl font-bold text-purple-600">{extractedData.sessionStorageKeys || 0}</p>
              </div>
            </div>
            
            {extractedData.url && (
              <div className="mt-4 p-4 border rounded-lg">
                <p className="font-medium">URL:</p>
                <p className="text-sm text-muted-foreground break-all">{extractedData.url}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Основной компонент управления */}
      <BrowserConnectionManager
        onSessionConnected={handleSessionConnected}
        onDataExtracted={handleDataExtracted}
      />

      {/* Дополнительная информация */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Как это работает
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Автоматическое обнаружение</h4>
              <p className="text-sm text-muted-foreground">
                Система автоматически сканирует порты и пытается подключиться к открытому браузеру 
                через Chrome DevTools Protocol (CDP).
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Извлечение данных</h4>
              <p className="text-sm text-muted-foreground">
                Получает cookies, localStorage, sessionStorage и другую информацию 
                из активной сессии браузера.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Сохранение сессии</h4>
              <p className="text-sm text-muted-foreground">
                Извлеченные данные шифруются и сохраняются в базе данных 
                для последующего использования.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Безопасность</h4>
              <p className="text-sm text-muted-foreground">
                Все данные сессии шифруются с использованием AES-256-GCM 
                перед сохранением в базе данных.
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Важно:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Убедитесь, что браузер открыт и вы авторизованы на Wildberries</li>
              <li>• Браузер должен поддерживать Chrome DevTools Protocol</li>
              <li>• Для автоматического обнаружения браузер должен быть запущен с флагом --remote-debugging-port</li>
              <li>• Данные сессии будут зашифрованы и сохранены в базе данных</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
