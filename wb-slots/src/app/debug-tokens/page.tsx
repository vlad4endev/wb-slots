'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, RefreshCw, Key } from 'lucide-react';

interface TokenStatus {
  id: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  tokenLength: number;
  tokenPreview: string;
  decryptionStatus: 'success' | 'failed' | 'invalid' | 'unknown';
  decryptionError: string | null;
  decryptedLength: number;
}

export default function DebugTokensPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [tokens, setTokens] = useState<TokenStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatingToken, setUpdatingToken] = useState<string | null>(null);
  const [newTokenValue, setNewTokenValue] = useState('');

  const loadTokens = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debug/check-tokens');
      const data = await response.json();

      if (data.success) {
        setTokens(data.data.tokens);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const updateToken = async (tokenId: string) => {
    if (!newTokenValue.trim()) {
      setError('Please enter a new token value');
      return;
    }

    setUpdatingToken(tokenId);
    setError(null);

    try {
      const response = await fetch('/api/debug/check-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId,
          newToken: newTokenValue.trim()
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNewTokenValue('');
        await loadTokens(); // Перезагружаем токены
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setUpdatingToken(null);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'invalid':
        return <Badge variant="destructive" className="bg-orange-500"><XCircle className="h-3 w-3 mr-1" />Invalid</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Debug Tokens
            </CardTitle>
            <CardDescription>
              Проверка и исправление токенов пользователя
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <Button onClick={loadTokens} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <RefreshCw className="h-4 w-4 mr-2" />
                Обновить
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Ошибка:</strong> {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {tokens.map((token) => (
                <Card key={token.id} className={token.decryptionStatus === 'failed' ? 'border-red-200 bg-red-50' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{token.category}</h3>
                        <p className="text-sm text-gray-500">
                          ID: {token.id} | Создан: {new Date(token.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(token.decryptionStatus)}
                        {token.isActive && <Badge variant="outline">Active</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Длина токена:</strong> {token.tokenLength} символов
                        </div>
                        <div>
                          <strong>Расшифрованная длина:</strong> {token.decryptedLength} символов
                        </div>
                        <div>
                          <strong>Превью:</strong> {token.tokenPreview}
                        </div>
                        <div>
                          <strong>Статус:</strong> {token.isActive ? 'Активен' : 'Неактивен'}
                        </div>
                      </div>

                      {(token.decryptionStatus === 'failed' || token.decryptionStatus === 'invalid') && (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Проблема с токеном:</strong> {token.decryptionError}
                          </AlertDescription>
                        </Alert>
                      )}

                      {(token.decryptionStatus === 'failed' || token.decryptionStatus === 'invalid') && (
                        <div className="space-y-2">
                          <Label htmlFor={`new-token-${token.id}`}>Новый токен:</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`new-token-${token.id}`}
                              type="password"
                              placeholder="Введите новый токен"
                              value={newTokenValue}
                              onChange={(e) => setNewTokenValue(e.target.value)}
                            />
                            <Button
                              onClick={() => updateToken(token.id)}
                              disabled={updatingToken === token.id || !newTokenValue.trim()}
                              size="sm"
                            >
                              {updatingToken === token.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Обновить
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {tokens.length === 0 && !isLoading && (
                <Alert>
                  <AlertDescription>
                    Токены не найдены
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
