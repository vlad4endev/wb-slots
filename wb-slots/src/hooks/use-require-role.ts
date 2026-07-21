'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Гейт для debug/test-страниц: раньше они рендерились без какой-либо
 * проверки авторизации на клиенте — сейчас требуют роль DEVELOPER/ADMIN
 * и редиректят всех остальных на дашборд (или на главную, если не залогинен).
 */
export function useRequireRole(allowedRoles: string[] = ['DEVELOPER', 'ADMIN']) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) {
          if (!cancelled) router.replace('/');
          return;
        }
        const data = await response.json();
        const currentUser: CurrentUser | undefined = data?.data?.user;
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
          if (!cancelled) router.replace('/dashboard');
          return;
        }
        if (!cancelled) {
          setUser(currentUser);
          setIsAllowed(true);
        }
      } catch {
        if (!cancelled) router.replace('/');
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isChecking, isAllowed, user };
}
