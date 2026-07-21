'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Monitor, Wifi, WifiOff } from 'lucide-react';

export function SimpleBrowserConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkBrowserStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/browser/connect');
      const data = await response.json();
      
      if (data.success) {
        setIsConnected(data.browserStatus?.isConnected || false);
      }
    } catch (error) {
      console.error('Error checking browser status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Подключение к браузеру
        </CardTitle>
        <CardDescription>
          Простое подключение к открытому браузеру
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <div>
              <p className="font-medium">Статус браузера</p>
              <p className="text-sm text-muted-foreground">
                {isConnected ? 'Подключен' : 'Не подключен'}
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={checkBrowserStatus}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Проверка...' : 'Проверить статус'}
        </Button>
      </CardContent>
    </Card>
  );
}
