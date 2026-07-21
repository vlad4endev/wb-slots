'use client';

import { useState, useEffect, useCallback } from 'react';

/* eslint-disable react-hooks/exhaustive-deps */

export interface SessionStatus {
  isActive: boolean;
  isLoading: boolean;
  user: any | null;
  lastChecked: Date | null;
  error: string | null;
}

/**
 * Хук для проверки активности сессии пользователя
 */
export function useSessionCheck(autoCheckInterval?: number) {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    isActive: false,
    isLoading: true,
    user: null,
    lastChecked: null,
    error: null,
  });

  const checkSession = useCallback(async () => {
    try {
      setSessionStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.data?.user) {
        setSessionStatus({
          isActive: true,
          isLoading: false,
          user: data.data.user,
          lastChecked: new Date(),
          error: null,
        });
      } else {
        setSessionStatus({
          isActive: false,
          isLoading: false,
          user: null,
          lastChecked: new Date(),
          error: data.error || 'Сессия неактивна',
        });
      }
    } catch (error) {
      console.error('Session check error:', error);
      setSessionStatus({
        isActive: false,
        isLoading: false,
        user: null,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Ошибка проверки сессии',
      });
    }
  }, []);

  // Проверка при монтировании компонента
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Автоматическая периодическая проверка
  useEffect(() => {
    if (autoCheckInterval && autoCheckInterval > 0) {
      const interval = setInterval(() => {
        checkSession();
      }, autoCheckInterval);

      return () => clearInterval(interval);
    }
  }, [autoCheckInterval, checkSession]);

  // Проверка при возвращении на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkSession]);

  return {
    ...sessionStatus,
    checkSession,
    refreshSession: checkSession,
  };
}

/**
 * Хук для проверки возможности автобронирования
 * Проверяет наличие активной WB сессии (для Playwright), а НЕ токена API
 */
export function useAutoBookingCheck() {
  const [wbSessionStatus, setWbSessionStatus] = useState<{
    hasSession: boolean;
    isLoading: boolean;
    error: string | null;
    lastChecked: Date | null;
  }>({
    hasSession: false,
    isLoading: true,
    error: null,
    lastChecked: null,
  });

  const checkWBSession = useCallback(async () => {
    try {
      setWbSessionStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log('🔍 useAutoBookingCheck: проверка WB сессии...');
      
      const response = await fetch('/api/wb-session/check', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 useAutoBookingCheck: ответ получен', {
        status: response.status,
        ok: response.ok
      });

      const data = await response.json();
      
      console.log('📊 useAutoBookingCheck: данные ответа', {
        success: data.success,
        hasSession: data.data?.hasSession,
        message: data.data?.message,
        error: data.error
      });

      if (data.success && data.data?.hasSession === true) {
        console.log('✅ useAutoBookingCheck: WB сессия активна');
        setWbSessionStatus({
          hasSession: true,
          isLoading: false,
          error: null,
          lastChecked: new Date(),
        });
      } else {
        console.log('⚠️ useAutoBookingCheck: WB сессия неактивна', data.data?.message);
        setWbSessionStatus({
          hasSession: false,
          isLoading: false,
          error: data.data?.message || data.error || 'Нет активной WB сессии',
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      console.error('❌ useAutoBookingCheck: ошибка проверки WB сессии:', error);
      setWbSessionStatus({
        hasSession: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Ошибка проверки WB сессии',
        lastChecked: new Date(),
      });
    }
  }, []);

  // Проверка при монтировании
  useEffect(() => {
    checkWBSession();
  }, [checkWBSession]);

  // Автоматическая проверка каждые 2 минуты
  useEffect(() => {
    const interval = setInterval(() => {
      checkWBSession();
    }, 120000); // 2 минуты

    return () => clearInterval(interval);
  }, [checkWBSession]);

  // Проверка при возвращении на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkWBSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkWBSession]);

  return {
    canAutoBook: wbSessionStatus.hasSession,
    isCheckingSession: wbSessionStatus.isLoading,
    sessionError: wbSessionStatus.error,
    refreshSession: checkWBSession,
  };
}

