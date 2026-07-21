'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Copy, 
  Eye, 
  EyeOff, 
  Shield, 
  Clock, 
  Globe, 
  Database,
  Cookie,
  Key,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SessionDetails {
  id: string;
  sessionId: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
  cookies: {
    total: number;
    list: Array<{
      name: string;
      value: string;
      domain?: string;
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: string;
    }>;
    important: {
      csrfToken?: string;
      authToken?: string;
      sessionToken?: string;
      refreshToken?: string;
    };
  };
  storage: {
    localStorage: number;
    sessionStorage: number;
    localStorageData: Record<string, string>;
    sessionStorageData: Record<string, string>;
  };
}

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export default function SessionDetailsModal({ isOpen, onClose, sessionId }: SessionDetailsModalProps) {
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());

  const fetchSessionDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/wb-auth/sessions/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setSessionDetails(data.data.session);
      } else {
        setError(data.error || 'Ошибка загрузки деталей сессии');
      }
    } catch (error) {
      setError('Ошибка загрузки деталей сессии');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchSessionDetails();
    }
  }, [isOpen, sessionId, fetchSessionDetails]);

  const toggleValueVisibility = (key: string) => {
    const newVisible = new Set(visibleValues);
    if (newVisible.has(key)) {
      newVisible.delete(key);
    } else {
      newVisible.add(key);
    }
    setVisibleValues(newVisible);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const maskValue = (value: string, isVisible: boolean) => {
    if (isVisible) return value;
    return value.length > 8 ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : '••••••••';
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Детали сессии
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sessionDetails && (
          <div className="space-y-6">
            {/* Основная информация */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Основная информация
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID сессии</label>
                    <p className="font-mono text-sm">{sessionDetails.sessionId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Статус</label>
                    <div className="mt-1">
                      <Badge variant={sessionDetails.isActive ? "default" : "secondary"}>
                        {sessionDetails.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Активна
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Неактивна
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Создана</label>
                    <p className="text-sm">{formatDate(sessionDetails.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Истекает</label>
                    <p className="text-sm">{formatDate(sessionDetails.expiresAt)}</p>
                  </div>
                  {sessionDetails.lastUsedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Последнее использование</label>
                      <p className="text-sm">{formatDate(sessionDetails.lastUsedAt)}</p>
                    </div>
                  )}
                  {sessionDetails.ipAddress && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">IP адрес</label>
                      <p className="text-sm font-mono">{sessionDetails.ipAddress}</p>
                    </div>
                  )}
                </div>
                {sessionDetails.userAgent && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">User Agent</label>
                    <p className="text-sm font-mono break-all">{sessionDetails.userAgent}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Детальная информация */}
            <Tabs defaultValue="cookies" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cookies" className="flex items-center gap-2">
                  <Cookie className="w-4 h-4" />
                  Cookies ({sessionDetails.cookies.total})
                </TabsTrigger>
                <TabsTrigger value="tokens" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Токены
                </TabsTrigger>
                <TabsTrigger value="storage" className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Storage
                </TabsTrigger>
              </TabsList>

              {/* Cookies Tab */}
              <TabsContent value="cookies" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cookies ({sessionDetails.cookies.total})</CardTitle>
                    <CardDescription>
                      Все куки, сохраненные для этой сессии
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {sessionDetails.cookies.list.map((cookie, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-medium">{cookie.name}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleValueVisibility(`cookie-${index}`)}
                              >
                                {visibleValues.has(`cookie-${index}`) ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(cookie.value)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="font-mono text-xs break-all">
                              {maskValue(cookie.value, visibleValues.has(`cookie-${index}`))}
                            </p>
                            <div className="flex gap-2 text-xs text-gray-500">
                              {cookie.domain && <span>Domain: {cookie.domain}</span>}
                              {cookie.path && <span>Path: {cookie.path}</span>}
                              {cookie.secure && <span>Secure</span>}
                              {cookie.httpOnly && <span>HttpOnly</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tokens Tab */}
              <TabsContent value="tokens" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Важные токены</CardTitle>
                    <CardDescription>
                      Ключевые токены для аутентификации
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(sessionDetails.cookies.important).map(([key, value]) => (
                      value && (
                        <div key={key} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleValueVisibility(`token-${key}`)}
                              >
                                {visibleValues.has(`token-${key}`) ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(value)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="font-mono text-sm break-all">
                            {maskValue(value, visibleValues.has(`token-${key}`))}
                          </p>
                        </div>
                      )
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Storage Tab */}
              <TabsContent value="storage" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Local Storage ({sessionDetails.storage.localStorage})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sessionDetails.storage.localStorage > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {Object.entries(sessionDetails.storage.localStorageData).map(([key, value]) => (
                            <div key={key} className="border rounded p-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-medium">{key}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleValueVisibility(`local-${key}`)}
                                >
                                  {visibleValues.has(`local-${key}`) ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                              <p className="font-mono text-xs break-all">
                                {maskValue(value, visibleValues.has(`local-${key}`))}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Session Storage ({sessionDetails.storage.sessionStorage})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sessionDetails.storage.sessionStorage > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {Object.entries(sessionDetails.storage.sessionStorageData).map(([key, value]) => (
                            <div key={key} className="border rounded p-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-medium">{key}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleValueVisibility(`session-${key}`)}
                                >
                                  {visibleValues.has(`session-${key}`) ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                              <p className="font-mono text-xs break-all">
                                {maskValue(value, visibleValues.has(`session-${key}`))}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
