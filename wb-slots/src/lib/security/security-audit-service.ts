// ===== SECURITY AUDIT SERVICE =====

import { Logger } from '../logging/logger';

// ===== INTERFACES =====

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  events: string[]; // Event IDs
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata: Record<string, any>;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
  alertsByType: Record<SecurityAlertType, number>;
  topUsers: Array<{ userId: string; eventCount: number }>;
  topIPs: Array<{ ipAddress: string; eventCount: number }>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface SecurityConfig {
  enableRealTimeMonitoring: boolean;
  enableEventAggregation: boolean;
  enableAutomaticAlerts: boolean;
  enableIPBlocking: boolean;
  enableUserLockout: boolean;
  alertThresholds: {
    failedLogins: number;
    suspiciousActivity: number;
    rateLimitViolations: number;
    dataAccessViolations: number;
  };
  retentionPeriod: number; // days
  aggregationWindow: number; // minutes
}

export type SecurityEventType = 
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED'
  | 'PASSWORD_CHANGE'
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'TWO_FACTOR_FAILED'
  | 'SESSION_CREATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_TERMINATED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'DATA_ACCESS'
  | 'DATA_MODIFICATION'
  | 'API_ACCESS'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'ADMIN_ACTION'
  | 'SECURITY_VIOLATION'
  | 'SYSTEM_ERROR';

export type SecurityAlertType =
  | 'MULTIPLE_FAILED_LOGINS'
  | 'SUSPICIOUS_LOGIN_LOCATION'
  | 'RATE_LIMIT_ABUSE'
  | 'UNAUTHORIZED_ACCESS'
  | 'DATA_BREACH_ATTEMPT'
  | 'MALICIOUS_ACTIVITY'
  | 'SYSTEM_COMPROMISE'
  | 'PRIVILEGE_ESCALATION'
  | 'ANOMALOUS_BEHAVIOR'
  | 'SECURITY_CONFIG_CHANGE';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ===== SECURITY AUDIT SERVICE =====

export class SecurityAuditService {
  private static instance: SecurityAuditService;
  private logger: Logger;
  private config: SecurityConfig;
  private events: Map<string, SecurityEvent> = new Map();
  private alerts: Map<string, SecurityAlert> = new Map();
  private eventAggregator: Map<string, SecurityEvent[]> = new Map();
  private blockedIPs: Set<string> = new Set();
  private lockedUsers: Set<string> = new Set();
  private aggregationTimer?: NodeJS.Timeout;
  private alertTimer?: NodeJS.Timeout;

  private constructor() {
    this.logger = new Logger('INFO', { context: 'SecurityAuditService' });
    
    this.config = {
      enableRealTimeMonitoring: true,
      enableEventAggregation: true,
      enableAutomaticAlerts: true,
      enableIPBlocking: true,
      enableUserLockout: true,
      alertThresholds: {
        failedLogins: 5,
        suspiciousActivity: 3,
        rateLimitViolations: 10,
        dataAccessViolations: 5
      },
      retentionPeriod: 90, // 90 days
      aggregationWindow: 5 // 5 minutes
    };

    this.startMonitoring();
  }

  public static getInstance(): SecurityAuditService {
    if (!SecurityAuditService.instance) {
      SecurityAuditService.instance = new SecurityAuditService();
    }
    return SecurityAuditService.instance;
  }

  // ===== EVENT LOGGING =====

  async logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<string> {
    try {
      const eventId = this.generateEventId();
      const fullEvent: SecurityEvent = {
        ...event,
        id: eventId,
        timestamp: new Date(),
        resolved: false
      };

      this.events.set(eventId, fullEvent);

      // Log the event
      this.logger[this.getLogLevel(event.severity)](
        `🔐 Security Event: ${event.type}`,
        {
          eventId,
          type: event.type,
          severity: event.severity,
          userId: event.userId,
          ipAddress: event.ipAddress,
          details: event.details
        }
      );

      // Check for automatic alerts
      if (this.config.enableAutomaticAlerts) {
        await this.checkForAlerts(fullEvent);
      }

      // Check for IP blocking
      if (this.config.enableIPBlocking && event.ipAddress) {
        await this.checkIPBlocking(fullEvent);
      }

      // Check for user lockout
      if (this.config.enableUserLockout && event.userId) {
        await this.checkUserLockout(fullEvent);
      }

      return eventId;
    } catch (error) {
      this.logger.error('❌ Failed to log security event', { error });
      throw error;
    }
  }

  // ===== ALERT MANAGEMENT =====

  private async checkForAlerts(event: SecurityEvent): Promise<void> {
    try {
      // Check for multiple failed logins
      if (event.type === 'LOGIN_FAILED' && event.userId) {
        const recentFailures = this.getRecentEvents(
          'LOGIN_FAILED',
          event.userId,
          event.timestamp,
          15 * 60 * 1000 // 15 minutes
        );

        if (recentFailures.length >= this.config.alertThresholds.failedLogins) {
          await this.createAlert({
            type: 'MULTIPLE_FAILED_LOGINS',
            severity: 'HIGH',
            title: 'Multiple Failed Login Attempts',
            description: `User ${event.userId} has ${recentFailures.length} failed login attempts in the last 15 minutes`,
            userId: event.userId,
            ipAddress: event.ipAddress,
            events: recentFailures.map(e => e.id),
            metadata: {
              failureCount: recentFailures.length,
              timeWindow: '15 minutes'
            }
          });
        }
      }

      // Check for rate limit violations
      if (event.type === 'RATE_LIMIT_EXCEEDED') {
        const recentViolations = this.getRecentEvents(
          'RATE_LIMIT_EXCEEDED',
          event.userId || event.ipAddress,
          event.timestamp,
          60 * 60 * 1000 // 1 hour
        );

        if (recentViolations.length >= this.config.alertThresholds.rateLimitViolations) {
          await this.createAlert({
            type: 'RATE_LIMIT_ABUSE',
            severity: 'MEDIUM',
            title: 'Rate Limit Abuse Detected',
            description: `Excessive rate limit violations detected for ${event.userId || event.ipAddress}`,
            userId: event.userId,
            ipAddress: event.ipAddress,
            events: recentViolations.map(e => e.id),
            metadata: {
              violationCount: recentViolations.length,
              timeWindow: '1 hour'
            }
          });
        }
      }

      // Check for suspicious activity
      if (event.type === 'SUSPICIOUS_ACTIVITY') {
        const recentSuspicious = this.getRecentEvents(
          'SUSPICIOUS_ACTIVITY',
          event.userId || event.ipAddress,
          event.timestamp,
          30 * 60 * 1000 // 30 minutes
        );

        if (recentSuspicious.length >= this.config.alertThresholds.suspiciousActivity) {
          await this.createAlert({
            type: 'MALICIOUS_ACTIVITY',
            severity: 'CRITICAL',
            title: 'Malicious Activity Detected',
            description: `Multiple suspicious activities detected for ${event.userId || event.ipAddress}`,
            userId: event.userId,
            ipAddress: event.ipAddress,
            events: recentSuspicious.map(e => e.id),
            metadata: {
              activityCount: recentSuspicious.length,
              timeWindow: '30 minutes'
            }
          });
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to check for alerts', { error });
    }
  }

  private async createAlert(alert: Omit<SecurityAlert, 'id' | 'createdAt' | 'acknowledged' | 'resolved' | 'metadata'>): Promise<string> {
    try {
      const alertId = this.generateAlertId();
      const fullAlert: SecurityAlert = {
        ...alert,
        id: alertId,
        createdAt: new Date(),
        acknowledged: false,
        resolved: false,
        metadata: alert.metadata || {}
      };

      this.alerts.set(alertId, fullAlert);

      this.logger[this.getLogLevel(alert.severity)](
        `🚨 Security Alert: ${alert.title}`,
        {
          alertId,
          type: alert.type,
          severity: alert.severity,
          userId: alert.userId,
          ipAddress: alert.ipAddress,
          eventCount: alert.events.length
        }
      );

      return alertId;
    } catch (error) {
      this.logger.error('❌ Failed to create security alert', { error });
      throw error;
    }
  }

  // ===== IP BLOCKING =====

  private async checkIPBlocking(event: SecurityEvent): Promise<void> {
    if (!event.ipAddress) return;

    try {
      // Check for critical security events
      if (event.severity === 'CRITICAL' || event.type === 'SECURITY_VIOLATION') {
        this.blockedIPs.add(event.ipAddress);
        this.logger.warn(`🚫 IP blocked: ${event.ipAddress}`, {
          reason: event.type,
          severity: event.severity
        });
      }

      // Check for multiple failed logins from same IP
      if (event.type === 'LOGIN_FAILED') {
        const recentFailures = this.getRecentEvents(
          'LOGIN_FAILED',
          event.ipAddress,
          event.timestamp,
          60 * 60 * 1000 // 1 hour
        );

        if (recentFailures.length >= 20) { // 20 failed logins in 1 hour
          this.blockedIPs.add(event.ipAddress);
          this.logger.warn(`🚫 IP blocked due to excessive failed logins: ${event.ipAddress}`, {
            failureCount: recentFailures.length
          });
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to check IP blocking', { error });
    }
  }

  // ===== USER LOCKOUT =====

  private async checkUserLockout(event: SecurityEvent): Promise<void> {
    if (!event.userId) return;

    try {
      // Check for multiple failed logins
      if (event.type === 'LOGIN_FAILED') {
        const recentFailures = this.getRecentEvents(
          'LOGIN_FAILED',
          event.userId,
          event.timestamp,
          30 * 60 * 1000 // 30 minutes
        );

        if (recentFailures.length >= 10) { // 10 failed logins in 30 minutes
          this.lockedUsers.add(event.userId);
          this.logger.warn(`🔒 User locked: ${event.userId}`, {
            failureCount: recentFailures.length
          });
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to check user lockout', { error });
    }
  }

  // ===== QUERY METHODS =====

  getRecentEvents(
    type: SecurityEventType,
    identifier: string | undefined,
    since: Date,
    timeWindow: number
  ): SecurityEvent[] {
    const cutoffTime = new Date(since.getTime() - timeWindow);
    
    return Array.from(this.events.values()).filter(event => {
      if (event.type !== type) return false;
      if (event.timestamp < cutoffTime) return false;
      
      if (identifier) {
        return event.userId === identifier || event.ipAddress === identifier;
      }
      
      return true;
    });
  }

  getEventsByUser(userId: string, limit: number = 100): SecurityEvent[] {
    return Array.from(this.events.values())
      .filter(event => event.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getEventsByIP(ipAddress: string, limit: number = 100): SecurityEvent[] {
    return Array.from(this.events.values())
      .filter(event => event.ipAddress === ipAddress)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getUnresolvedAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAlertsBySeverity(severity: SecuritySeverity): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.severity === severity)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ===== SECURITY CHECKS =====

  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  isUserLocked(userId: string): boolean {
    return this.lockedUsers.has(userId);
  }

  async unblockIP(ipAddress: string, reason: string): Promise<void> {
    this.blockedIPs.delete(ipAddress);
    await this.logEvent({
      type: 'ADMIN_ACTION',
      severity: 'MEDIUM',
      action: 'IP_UNBLOCKED',
      details: { ipAddress, reason }
    });
    this.logger.info(`🔓 IP unblocked: ${ipAddress}`, { reason });
  }

  async unlockUser(userId: string, reason: string): Promise<void> {
    this.lockedUsers.delete(userId);
    await this.logEvent({
      type: 'ADMIN_ACTION',
      severity: 'MEDIUM',
      userId,
      action: 'USER_UNLOCKED',
      details: { reason }
    });
    this.logger.info(`🔓 User unlocked: ${userId}`, { reason });
  }

  // ===== METRICS =====

  getSecurityMetrics(timeRange: { start: Date; end: Date }): SecurityMetrics {
    const events = Array.from(this.events.values()).filter(event => 
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );

    const eventsByType: Record<SecurityEventType, number> = {} as any;
    const eventsBySeverity: Record<SecuritySeverity, number> = {} as any;
    const alertsByType: Record<SecurityAlertType, number> = {} as any;

    // Count events by type
    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    // Count alerts by type
    const alerts = Array.from(this.alerts.values()).filter(alert =>
      alert.createdAt >= timeRange.start && alert.createdAt <= timeRange.end
    );
    alerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });

    // Top users
    const userCounts: Record<string, number> = {};
    events.forEach(event => {
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }
    });
    const topUsers = Object.entries(userCounts)
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Top IPs
    const ipCounts: Record<string, number> = {};
    events.forEach(event => {
      if (event.ipAddress) {
        ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
      }
    });
    const topIPs = Object.entries(ipCounts)
      .map(([ipAddress, eventCount]) => ({ ipAddress, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      alertsByType,
      topUsers,
      topIPs,
      timeRange
    };
  }

  // ===== MONITORING =====

  private startMonitoring(): void {
    if (this.config.enableEventAggregation) {
      this.aggregationTimer = setInterval(() => {
        this.aggregateEvents();
      }, this.config.aggregationWindow * 60 * 1000);
    }

    if (this.config.enableAutomaticAlerts) {
      this.alertTimer = setInterval(() => {
        this.checkForAnomalies();
      }, 5 * 60 * 1000); // Every 5 minutes
    }
  }

  private aggregateEvents(): void {
    // Implementation for event aggregation
    this.logger.debug('📊 Aggregating security events');
  }

  private checkForAnomalies(): void {
    // Implementation for anomaly detection
    this.logger.debug('🔍 Checking for security anomalies');
  }

  // ===== UTILITY METHODS =====

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogLevel(severity: SecuritySeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'LOW': return 'info';
      case 'MEDIUM': return 'warn';
      case 'HIGH': return 'error';
      case 'CRITICAL': return 'error';
      default: return 'info';
    }
  }

  // ===== CLEANUP =====

  cleanup(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
    }

    this.events.clear();
    this.alerts.clear();
    this.eventAggregator.clear();
    this.blockedIPs.clear();
    this.lockedUsers.clear();

    this.logger.info('🧹 Security audit service cleaned up');
  }
}
