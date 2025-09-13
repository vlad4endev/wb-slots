'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Copy,
  Cookie,
  Database,
  Shield
} from 'lucide-react';
import DashboardLayout from '@/app/dashboard-layout';

export default function ExtractCookiesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);

  const extractCookies = () => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Извлекаем куки
      const cookies = document.cookie.split(';').map(cookie => {
        const [name, value] = cookie.trim().split('=');
        return {
          name: name,
          value: value,
          domain: '.wildberries.ru',
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'Lax'
        };
      });

      // Извлекаем localStorage
      const localStorage = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.includes('wb') || key?.includes('wildberries')) {
          localStorage[key] = window.localStorage.getItem(key);
        }
      }

      // Извлекаем sessionStorage
      const sessionStorage = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.includes('wb') || key?.includes('wildberries')) {
          sessionStorage[key] = window.sessionStorage.getItem(key);
        }
      }

      const data = {
        cookies,
        localStorage,
        sessionStorage
      };

      setExtractedData(data);
      setMessage({
        type: 'success',
        text: `Извлечено: ${cookies.length} куки, ${Object.keys(localStorage).length} localStorage, ${Object.keys(sessionStorage).length} sessionStorage`
      });

    } catch (error) {
      setMessage({
        type: 'error',
        text: `Ошибка извлечения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveToServer = async () => {
    if (!extractedData) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/wb-session/extract-cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractedData),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Куки успешно сохранены на сервере!'
        });
      } else {
        setMessage({
          type: 'error',
          text: `Ошибка сохранения: ${result.error}`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Ошибка отправки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!extractedData) return;

    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
    setMessage({
      type: 'success',
      text: 'Данные скопированы в буфер обмена!'
    });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <Cookie className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Извлечение куки WB
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Извлечение и сохранение куки для автобронирования
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Инструкция по извлечению куки
              </CardTitle>
              <CardDescription>
                Следуйте этим шагам для безопасного извлечения куки из вашего браузера
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Откройте Wildberries Seller</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Перейдите на <a href="https://seller.wildberries.ru" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">seller.wildberries.ru</a> и войдите в свой аккаунт
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Откройте инструменты разработчика</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Нажмите F12 или правой кнопкой мыши → "Исследовать элемент"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Перейдите на эту страницу</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      В новой вкладке откройте эту страницу и нажмите "Извлечь куки"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <p className="font-medium">Сохраните данные</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Нажмите "Сохранить на сервере" для автоматического сохранения
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Извлечение данных
              </CardTitle>
              <CardDescription>
                Извлеките куки, localStorage и sessionStorage из текущего браузера
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button 
                  onClick={extractCookies}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isLoading ? 'Извлечение...' : 'Извлечь куки'}
                </Button>
                
                {extractedData && (
                  <>
                    <Button 
                      onClick={saveToServer}
                      disabled={isLoading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {isLoading ? 'Сохранение...' : 'Сохранить на сервере'}
                    </Button>
                    
                    <Button 
                      onClick={copyToClipboard}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Копировать
                    </Button>
                  </>
                )}
              </div>

              {message && (
                <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'}>
                  <div className="flex items-center gap-2">
                    {message.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <AlertDescription className={message.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                      {message.text}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {extractedData && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Извлеченные данные:</h4>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <pre className="text-xs text-gray-700 dark:text-gray-300">
                      {JSON.stringify(extractedData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Важно:</strong> Куки содержат ваши данные авторизации. Не передавайте их третьим лицам. 
              Данные шифруются перед сохранением на сервере.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </DashboardLayout>
  );
}
