'use client';

import { useRequireRole } from '@/hooks/use-require-role';

interface DebugPageGuardProps {
  children: React.ReactNode;
}

/**
 * Оборачивает debug/test-страницы, которые раньше рендерились всем
 * подряд без проверки авторизации. Пока идёт проверка или доступ не
 * разрешён, дочерний контент (и его side-effect-запросы) не монтируется.
 */
export default function DebugPageGuard({ children }: DebugPageGuardProps) {
  const { isChecking, isAllowed } = useRequireRole(['DEVELOPER', 'ADMIN']);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
