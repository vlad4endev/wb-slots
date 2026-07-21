// ===== SESSION MANAGER - SRP: Управление сессиями =====

import { Page } from 'playwright';
import { prisma } from '../../../prisma';
import { decrypt } from '../../../encryption';
import { ILogger } from '../../core/interfaces';

export interface SessionInfo {
  isValid: boolean;
  cookies: number;
  localStorage: number;
  sessionStorage: number;
  userAgent: string;
  lastActivity: Date;
}

export interface ISessionManager {
  validateSession(userId: string): Promise<SessionInfo>;
  restoreSession(page: Page, userId: string): Promise<boolean>;
  saveSession(page: Page, userId: string): Promise<void>;
  clearSession(userId: string): Promise<void>;
}

export class SessionManager implements ISessionManager {
  constructor(private logger: ILogger) {}

  async validateSession(userId: string): Promise<SessionInfo> {
    this.logger.info(`Validating session for user: ${userId}`);
    
    try {
      const session = await prisma.wBSession.findFirst({
        where: { userId, isActive: true },
        orderBy: { updatedAt: 'desc' }
      });

      if (!session) {
        return {
          isValid: false,
          cookies: 0,
          localStorage: 0,
          sessionStorage: 0,
          userAgent: '',
          lastActivity: new Date()
        };
      }

      // Check if session is expired (24 hours)
      const isExpired = Date.now() - session.updatedAt.getTime() > 24 * 60 * 60 * 1000;
      
      if (isExpired) {
        await prisma.wBSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });
      }

      return {
        isValid: !isExpired,
        cookies: session.cookies ? JSON.parse(session.cookies).length : 0,
        localStorage: session.localStorage ? Object.keys(JSON.parse(session.localStorage)).length : 0,
        sessionStorage: session.sessionStorage ? Object.keys(JSON.parse(session.sessionStorage)).length : 0,
        userAgent: session.userAgent || '',
        lastActivity: session.updatedAt
      };
    } catch (error) {
      this.logger.error('Error validating session:', error);
      return {
        isValid: false,
        cookies: 0,
        localStorage: 0,
        sessionStorage: 0,
        userAgent: '',
        lastActivity: new Date()
      };
    }
  }

  async restoreSession(page: Page, userId: string): Promise<boolean> {
    this.logger.info(`Restoring session for user: ${userId}`);
    
    try {
      const session = await prisma.wBSession.findFirst({
        where: { userId, isActive: true },
        orderBy: { updatedAt: 'desc' }
      });

      if (!session) {
        this.logger.warn('No active session found');
        return false;
      }

      // Restore cookies
      if (session.cookies) {
        const cookies = JSON.parse(session.cookies);
        await page.context().addCookies(cookies);
      }

      // Restore localStorage
      if (session.localStorage) {
        const localStorage = JSON.parse(session.localStorage);
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            window.localStorage.setItem(key, value as string);
          }
        }, localStorage);
      }

      // Restore sessionStorage
      if (session.sessionStorage) {
        const sessionStorage = JSON.parse(session.sessionStorage);
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            window.sessionStorage.setItem(key, value as string);
          }
        }, sessionStorage);
      }

      this.logger.info('Session restored successfully');
      return true;
    } catch (error) {
      this.logger.error('Error restoring session:', error);
      return false;
    }
  }

  async saveSession(page: Page, userId: string): Promise<void> {
    this.logger.info(`Saving session for user: ${userId}`);
    
    try {
      // Get cookies
      const cookies = await page.context().cookies();
      
      // Get localStorage
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      // Get sessionStorage
      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return data;
      });

      // Get user agent
      const userAgent = await page.evaluate(() => navigator.userAgent);

      // Save to database
      await prisma.wBSession.upsert({
        where: { userId },
        update: {
          cookies: JSON.stringify(cookies),
          localStorage: JSON.stringify(localStorage),
          sessionStorage: JSON.stringify(sessionStorage),
          userAgent,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          userId,
          cookies: JSON.stringify(cookies),
          localStorage: JSON.stringify(localStorage),
          sessionStorage: JSON.stringify(sessionStorage),
          userAgent,
          isActive: true
        }
      });

      this.logger.info('Session saved successfully');
    } catch (error) {
      this.logger.error('Error saving session:', error);
      throw error;
    }
  }

  async clearSession(userId: string): Promise<void> {
    this.logger.info(`Clearing session for user: ${userId}`);
    
    try {
      await prisma.wBSession.updateMany({
        where: { userId },
        data: { isActive: false }
      });
      
      this.logger.info('Session cleared successfully');
    } catch (error) {
      this.logger.error('Error clearing session:', error);
      throw error;
    }
  }
}
