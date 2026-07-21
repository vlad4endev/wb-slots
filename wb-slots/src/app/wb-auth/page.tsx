'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FiArrowLeft as ArrowLeft,
  FiShield as Shield,
  FiCheckCircle as CheckCircle,
  FiAlertCircle as AlertCircle,
  FiTrash2 as Trash2,
  FiClock as Clock,
  FiEye as Eye
} from 'react-icons/fi';
import DashboardLayout from '@/app/dashboard-layout';
import Link from 'next/link';
import WBAuthPopup from '@/components/wb-auth-popup';
import SessionDetailsModal from '@/components/session-details-modal';

interface WBSession {
  id: string;
  sessionId?: string;
  isActive: boolean;
  expiresAt?: string | Date;
  lastUsedAt?: string;
  createdAt: string;
}

export default function WBAuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sessions, setSessions] = useState<WBSession[]>([]);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/wb-auth/sessions');
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const handleAuthSuccess = (sessionId: string) => {
    setSuccess('Авторизация успешна! Сессия сохранена.');
    fetchSessions();
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/wb-auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Сессия удалена');
        fetchSessions();
      } else {
        setError(data.error || 'Ошибка удаления сессии');
      }
    } catch (error) {
      setError('Ошибка удаления сессии');
    }
  };

  const handleViewSessionDetails = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowSessionDetails(true);
  };

  const handleCloseSessionDetails = () => {
    setShowSessionDetails(false);
    setSelectedSessionId(null);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/settings">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Назад к настройкам
                  </Button>
                </Link>
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Авторизация в WB
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Войдите в личный кабинет Wildberries для автобронирования
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Warning */}
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Внимание!</strong> Автобронирование слотов является экспериментальной функцией. 
              Используйте на свой страх и риск. Мы не несем ответственности за возможные блокировки аккаунта.
            </AlertDescription>
          </Alert>

          {/* Auth Button */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Авторизация в WB</CardTitle>
              <CardDescription>
                Нажмите кнопку ниже для входа в личный кабинет Wildberries. 
                Система автоматически извлечет и сохранит куки, localStorage и sessionStorage 
                для полноценного автобронирования слотов.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowAuthPopup(true)}
                className="w-full"
                size="lg"
              >
                <Shield className="w-5 h-5 mr-2" />
                Войти в личный кабинет WB
              </Button>
            </CardContent>
          </Card>

          {/* Sessions List */}
          <Card>
            <CardHeader>
              <CardTitle>Активные сессии</CardTitle>
              <CardDescription>
                Управление сохраненными сессиями для автобронирования
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Нет активных сессий</p>
                  <p className="text-sm text-gray-400">
                    Авторизуйтесь в WB для создания сессии
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {session.isActive ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            Сессия {(session.sessionId || session.id || 'N/A').substring(0, 8)}...
                          </p>
                          <p className="text-sm text-gray-500">
                            Создана: {new Date(session.createdAt).toLocaleString('ru-RU')}
                          </p>
                          {session.lastUsedAt && (
                            <p className="text-sm text-gray-500">
                              Использована: {new Date(session.lastUsedAt).toLocaleString('ru-RU')}
                            </p>
                          )}
                          {session.expiresAt && (
                            <p className="text-sm text-gray-500">
                              Истекает: {new Date(session.expiresAt).toLocaleString('ru-RU')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          session.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {session.isActive ? 'Активна' : 'Неактивна'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSessionDetails(session.id)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Просмотреть детали сессии"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSession(session.sessionId)}
                          className="text-red-600 hover:text-red-700"
                          title="Удалить сессию"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Как это работает?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Войдите в личный кабинет WB в открывшемся окне
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Система автоматически извлечет куки, localStorage и sessionStorage
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    При нахождении слотов система автоматически забронирует их
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Безопасность</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Все данные (куки, localStorage, sessionStorage) шифруются
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Данные хранятся только на вашем сервере
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Вы можете удалить сессию в любой момент
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Auth Popup */}
      <WBAuthPopup
        isOpen={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Session Details Modal */}
      {selectedSessionId && (
        <SessionDetailsModal
          isOpen={showSessionDetails}
          onClose={handleCloseSessionDetails}
          sessionId={selectedSessionId}
        />
      )}

      {/* Success/Error Messages */}
      {success && (
        <Alert className="fixed top-4 right-4 z-50 max-w-md">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="fixed top-4 right-4 z-50 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      </div>
    </DashboardLayout>
  );
}
