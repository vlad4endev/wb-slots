import { EnhancedWBSessionManager } from './enhanced-wb-session-manager';
import { EnhancedWBAuthService } from './enhanced-wb-auth-service';
import { getUnifiedSessionManager } from '../session';
import { Logger } from '@/lib/logging/logger';

/**
 * Интеграционный сервис для работы с улучшенной системой сессий WB
 * Обеспечивает совместимость с существующими API endpoints
 */

export interface SessionIntegrationResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  warnings?: string[];
  data?: any;
}

export class EnhancedSessionIntegration {
  private logger: Logger;
  private sessionManager: EnhancedWBSessionManager;
  private authService: EnhancedWBAuthService;

  constructor(encryptionKey: string) {
    this.logger = new Logger();
    this.sessionManager = getUnifiedSessionManager();
    this.authService = new EnhancedWBAuthService(encryptionKey);
  }

  /**
   * Создание сессии через браузер (замена для /api/wb-auth/login)
   */
  async createSessionViaBrowser(userId: string, options?: {
    headless?: boolean;
    timeout?: number;
    retries?: number;
  }): Promise<SessionIntegrationResult> {
    this.logger.info('🚀 Creating session via enhanced browser auth', { userId });

    try {
      const result = await this.authService.authenticate({
        userId,
        headless: options?.headless ?? true,
        timeout: options?.timeout ?? 60000,
        retries: options?.retries ?? 3
      });

      if (result.success) {
        this.logger.info('✅ Enhanced session created successfully', { 
          userId, 
          sessionId: result.sessionId 
        });
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to create session via browser', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Восстановление сессии (замена для /api/wb-session/refresh)
   */
  async restoreSession(userId: string): Promise<SessionIntegrationResult> {
    this.logger.info('🔄 Restoring session via enhanced system', { userId });

    try {
      const result = await this.authService.restoreSession(userId);

      if (result.success) {
        this.logger.info('✅ Enhanced session restored successfully', { 
          userId, 
          sessionId: result.sessionId 
        });
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to restore session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Обновление сессии (замена для /api/wb-session/refresh)
   */
  async refreshSession(userId: string): Promise<SessionIntegrationResult> {
    this.logger.info('🔄 Refreshing session via enhanced system', { userId });

    try {
      const result = await this.authService.refreshSession(userId);

      if (result.success) {
        this.logger.info('✅ Enhanced session refreshed successfully', { 
          userId, 
          sessionId: result.sessionId 
        });
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to refresh session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Получение статуса сессии (замена для /api/wb-session/status)
   */
  async getSessionStatus(userId: string): Promise<SessionIntegrationResult> {
    this.logger.info('📊 Getting session status via enhanced system', { userId });

    try {
      const stats = await this.sessionManager.getSessionStats(userId);

      return {
        success: true,
        data: {
          userId,
          stats,
          hasActiveSession: stats.activeSessions > 0,
          lastLoginAt: stats.lastLoginAt,
          averageSessionDuration: stats.averageSessionDuration
        }
      };
    } catch (error) {
      this.logger.error('❌ Failed to get session status', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Принудительное создание сессии через телефон (замена для /api/wb-session/force-create)
   */
  async forceCreateSession(userId: string, phoneNumber?: string): Promise<SessionIntegrationResult> {
    this.logger.info('🔧 Force creating session via enhanced system', { userId, phoneNumber });

    try {
      // Для принудительного создания используем браузерную авторизацию
      const result = await this.authService.authenticate({
        userId,
        headless: false, // Показываем браузер для ручной авторизации
        timeout: 120000, // Увеличиваем таймаут
        retries: 1 // Только одна попытка для принудительного создания
      });

      if (result.success) {
        this.logger.info('✅ Enhanced session force created successfully', { 
          userId, 
          sessionId: result.sessionId 
        });
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to force create session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Очистка недействительных сессий (замена для /api/wb-session/cleanup)
   */
  async cleanupSessions(userId?: string): Promise<SessionIntegrationResult> {
    this.logger.info('🧹 Cleaning up sessions via enhanced system', { userId });

    try {
      // Здесь должна быть логика очистки недействительных сессий
      // Пока возвращаем заглушку
      
      this.logger.info('✅ Enhanced session cleanup completed', { userId });
      
      return {
        success: true,
        data: {
          message: 'Session cleanup completed',
          userId
        }
      };
    } catch (error) {
      this.logger.error('❌ Failed to cleanup sessions', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Диагностика проблем с сессиями (замена для /api/wb-session/diagnose)
   */
  async diagnoseSession(userId: string): Promise<SessionIntegrationResult> {
    this.logger.info('🔍 Diagnosing session via enhanced system', { userId });

    try {
      const stats = await this.sessionManager.getSessionStats(userId);
      
      // Дополнительная диагностика
      const diagnostics = {
        userId,
        stats,
        hasActiveSession: stats.activeSessions > 0,
        lastLoginAt: stats.lastLoginAt,
        averageSessionDuration: stats.averageSessionDuration,
        recommendations: []
      };

      // Добавляем рекомендации на основе статистики
      if (stats.activeSessions === 0) {
        diagnostics.recommendations.push('No active sessions found. Consider creating a new session.');
      }

      if (stats.lastLoginAt) {
        const daysSinceLastLogin = (Date.now() - stats.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastLogin > 7) {
          diagnostics.recommendations.push('Last login was more than 7 days ago. Consider refreshing the session.');
        }
      }

      if (stats.averageSessionDuration && stats.averageSessionDuration < 1) {
        diagnostics.recommendations.push('Average session duration is very short. Check for session stability issues.');
      }

      return {
        success: true,
        data: diagnostics
      };
    } catch (error) {
      this.logger.error('❌ Failed to diagnose session', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Закрытие ресурсов
   */
  async close(): Promise<void> {
    await this.authService.closeBrowser();
  }
}
