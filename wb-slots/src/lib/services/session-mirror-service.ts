import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logging';
import { getUnifiedSessionManager } from '@/lib/session';

const REQUIRED_COOKIE_NAMES = [
  'WBToken',
  'WBTokenSig',
  'x-supplier-token',
  'x-supplier-id',
  '__wblid',
  'wbx_session_id'
];

export type SessionMirrorStatus = 'AUTHORIZED' | 'REAUTH_REQUIRED' | 'STALE';

export interface SessionMirrorSnapshot {
  userId: string;
  sessionId?: string;
  isAuthorized: boolean;
  sellerId?: string;
  allowedWarehouses?: number[];
  expiresAt?: string;
  lastHeartbeat?: string;
  status: SessionMirrorStatus;
  fingerprint?: Record<string, any>;
  updatedAt: string;
}

export interface SessionSyncPayload {
  tokens: Record<string, string>;
  timestamp: string;
  fingerprint?: Record<string, any>;
  expiresAt?: string;
}

export interface SessionMirrorEventPayload {
  type: 'USER_REAUTH_REQUIRED' | 'SESSION_EXTENDED' | 'HEARTBEAT';
  reason?: string;
  timestamp?: string;
}

class SessionMirrorCache {
  private cache = new Map<string, { snapshot: SessionMirrorSnapshot; expiresAt: number }>();
  private ttlMs: number;

  constructor(ttlMs = 60_000) {
    this.ttlMs = ttlMs;
  }

  get(userId: string): SessionMirrorSnapshot | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }
    return entry.snapshot;
  }

  set(userId: string, snapshot: SessionMirrorSnapshot) {
    this.cache.set(userId, {
      snapshot,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  delete(userId: string) {
    this.cache.delete(userId);
  }
}

export class SessionMirrorService {
  private cache = new SessionMirrorCache();
  private sessionManager = getUnifiedSessionManager();
  private log = logger.child({ module: 'SessionMirrorService' });

  async ingestCookies(userId: string, payload: SessionSyncPayload) {
    this.validatePayload(payload);
    const sessionId = crypto.randomUUID();
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : this.addDays(new Date(), 7);
    const cookies = this.buildCookiesFromTokens(payload.tokens);

    const serializedSession = JSON.stringify({
      sessionId,
      cookies,
      localStorage: {},
      sessionStorage: {},
      userAgent: 'WB-Session-Mirror/1.0',
      expiresAt: expiresAt.toISOString(),
      metadata: {
        createdAt: new Date(),
        lastValidated: new Date(),
        version: '3.1-extension',
        fingerprint: payload.fingerprint || null
      }
    });

    const encryptedSessionData = (this.sessionManager as any).encrypt(serializedSession);

    await prisma.wBSession.upsert({
      where: { userId },
      update: {
        sessionData: encryptedSessionData,
        isActive: true,
        lastValidated: new Date(),
        lastUsedAt: new Date(),
        expiresAt,
        deactivatedAt: null,
        deactivationReason: null
      },
      create: {
        userId,
        sessionData: encryptedSessionData,
        isActive: true,
        lastValidated: new Date(),
        lastUsedAt: new Date(),
        expiresAt
      }
    });

    const snapshot: SessionMirrorSnapshot = {
      userId,
      sessionId,
      isAuthorized: true,
      sellerId: payload.tokens['x-supplier-id'],
      allowedWarehouses: undefined,
      expiresAt: expiresAt.toISOString(),
      lastHeartbeat: payload.timestamp,
      status: 'AUTHORIZED',
      fingerprint: payload.fingerprint,
      updatedAt: new Date().toISOString()
    };

    await this.persistSnapshot(snapshot);
    this.cache.set(userId, snapshot);

    this.log.info({ userId, sessionId }, 'Session mirror snapshot updated via cookie sync');
  }

  async recordHeartbeat(userId: string, timestamp?: string) {
    const snapshot = (await this.getSessionSnapshot(userId)) ?? this.createEmptySnapshot(userId);
    snapshot.lastHeartbeat = timestamp ?? new Date().toISOString();
    snapshot.status = snapshot.isAuthorized ? 'AUTHORIZED' : snapshot.status;
    snapshot.updatedAt = new Date().toISOString();

    await this.persistSnapshot(snapshot);
    this.cache.set(userId, snapshot);
  }

  async markExtended(userId: string, expiresAt?: string) {
    const snapshot = (await this.getSessionSnapshot(userId)) ?? this.createEmptySnapshot(userId);
    snapshot.expiresAt = expiresAt ?? this.addDays(new Date(), 7).toISOString();
    snapshot.status = 'AUTHORIZED';
    snapshot.isAuthorized = true;
    snapshot.updatedAt = new Date().toISOString();

    await this.persistSnapshot(snapshot);
    this.cache.set(userId, snapshot);
  }

  async requireReauth(userId: string, reason?: string) {
    const snapshot = (await this.getSessionSnapshot(userId)) ?? this.createEmptySnapshot(userId);
    snapshot.isAuthorized = false;
    snapshot.status = 'REAUTH_REQUIRED';
    snapshot.updatedAt = new Date().toISOString();

    await this.persistSnapshot(snapshot);
    this.cache.set(userId, snapshot);

    this.log.warn({ userId, reason }, 'Session mirror flagged for reauthentication');
  }

  async getSessionSnapshot(userId: string): Promise<SessionMirrorSnapshot | null> {
    const cached = this.cache.get(userId);
    if (cached) return cached;

    const settings = await prisma.userSettings.findUnique({
      where: {
        userId_category: {
          userId,
          category: 'session-mirror'
        }
      }
    });

    if (!settings) {
      return null;
    }

    const snapshot = settings.settings as SessionMirrorSnapshot;
    this.cache.set(userId, snapshot);
    return snapshot;
  }

  private async persistSnapshot(snapshot: SessionMirrorSnapshot) {
    await prisma.userSettings.upsert({
      where: {
        userId_category: {
          userId: snapshot.userId,
          category: 'session-mirror'
        }
      },
      update: {
        settings: snapshot
      },
      create: {
        userId: snapshot.userId,
        category: 'session-mirror',
        settings: snapshot
      }
    });
  }

  private validatePayload(payload: SessionSyncPayload) {
    if (!payload.tokens || typeof payload.tokens !== 'object') {
      throw new Error('SessionMirrorService: tokens payload is required');
    }

    const missing = REQUIRED_COOKIE_NAMES.filter((name) => !(name in payload.tokens));
    if (missing.length > 0) {
      this.log.warn({ missing }, 'SessionMirrorService: missing important cookies');
    }
  }

  private buildCookiesFromTokens(tokens: Record<string, string>) {
    return Object.entries(tokens).map(([name, value]) => ({
      name,
      value,
      domain: '.wildberries.ru',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'Lax' as const
    }));
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private createEmptySnapshot(userId: string): SessionMirrorSnapshot {
    return {
      userId,
      isAuthorized: false,
      status: 'STALE',
      updatedAt: new Date().toISOString()
    };
  }
}

let sessionMirrorService: SessionMirrorService | null = null;

export function getSessionMirrorService(): SessionMirrorService {
  if (!sessionMirrorService) {
    sessionMirrorService = new SessionMirrorService();
  }
  return sessionMirrorService;
}

