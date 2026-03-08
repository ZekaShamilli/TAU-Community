/**
 * Session Service
 * Handles user session management with Redis caching
 */

import { SessionCacheService, CacheService } from '../lib/cache';
import { UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
  userId: string;
  userRole: UserRole;
  clubId?: string; // For club presidents
  email: string;
  firstName: string;
  lastName: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  permissions: string[];
}

export interface SessionInfo {
  sessionId: string;
  data: SessionData;
  expiresAt: Date;
  isActive: boolean;
}

export class SessionService {
  private static readonly SESSION_TTL = 900; // 15 minutes
  private static readonly EXTENDED_SESSION_TTL = 86400; // 24 hours for "remember me"
  private static readonly MAX_SESSIONS_PER_USER = 5;

  /**
   * Create a new session
   */
  public static async createSession(
    sessionData: Omit<SessionData, 'loginTime' | 'lastActivity'>,
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SessionInfo> {
    const sessionId = uuidv4();
    const now = new Date();
    const ttl = rememberMe ? this.EXTENDED_SESSION_TTL : this.SESSION_TTL;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const fullSessionData: SessionData = {
      ...sessionData,
      loginTime: now,
      lastActivity: now,
      ipAddress,
      userAgent
    };

    // Store session in cache
    await SessionCacheService.setSession(sessionId, fullSessionData);

    // Manage user session limits
    await this.enforceSessionLimits(sessionData.userId);

    // Log session creation
    console.log(`Session created for user ${sessionData.userId}: ${sessionId}`);

    return {
      sessionId,
      data: fullSessionData,
      expiresAt,
      isActive: true
    };
  }

  /**
   * Get session by ID
   */
  public static async getSession(sessionId: string): Promise<SessionInfo | null> {
    const sessionData = await SessionCacheService.getSession(sessionId);
    
    if (!sessionData) {
      return null;
    }

    // Check if session is expired (additional check beyond Redis TTL)
    const now = new Date();
    const lastActivity = new Date(sessionData.lastActivity);
    const timeSinceActivity = now.getTime() - lastActivity.getTime();
    
    if (timeSinceActivity > this.SESSION_TTL * 1000) {
      await this.invalidateSession(sessionId);
      return null;
    }

    return {
      sessionId,
      data: sessionData,
      expiresAt: new Date(lastActivity.getTime() + this.SESSION_TTL * 1000),
      isActive: true
    };
  }

  /**
   * Update session activity
   */
  public static async updateSessionActivity(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return false;
    }

    // Update last activity time
    const updatedData: SessionData = {
      ...session.data,
      lastActivity: new Date()
    };

    await SessionCacheService.setSession(sessionId, updatedData);
    return true;
  }

  /**
   * Invalidate a specific session
   */
  public static async invalidateSession(sessionId: string): Promise<void> {
    await SessionCacheService.invalidateSession(sessionId);
    console.log(`Session invalidated: ${sessionId}`);
  }

  /**
   * Invalidate all sessions for a user
   */
  public static async invalidateUserSessions(userId: string): Promise<void> {
    await SessionCacheService.invalidateUserSessions(userId);
    console.log(`All sessions invalidated for user: ${userId}`);
  }

  /**
   * Get all active sessions for a user
   */
  public static async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessionIds = await SessionCacheService.getUserSessions(userId);
    const sessions: SessionInfo[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.data.lastActivity).getTime() - new Date(a.data.lastActivity).getTime()
    );
  }

  /**
   * Validate session and return user data
   */
  public static async validateSession(sessionId: string): Promise<SessionData | null> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return null;
    }

    // Update activity timestamp
    await this.updateSessionActivity(sessionId);
    
    return session.data;
  }

  /**
   * Extend session expiration (for "remember me" functionality)
   */
  public static async extendSession(sessionId: string, extendedTtl?: number): Promise<boolean> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return false;
    }

    const ttl = extendedTtl || this.EXTENDED_SESSION_TTL;
    
    // Re-store with extended TTL
    await CacheService.set(sessionId, session.data, {
      prefix: 'session',
      ttl
    });

    return true;
  }

  /**
   * Get session statistics
   */
  public static async getSessionStatistics(): Promise<{
    totalActiveSessions: number;
    sessionsByRole: Record<UserRole, number>;
    averageSessionDuration: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    const cacheKey = 'session_statistics';
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        // This is a simplified implementation
        // In a real scenario, you'd scan through all sessions
        const stats = {
          totalActiveSessions: 0,
          sessionsByRole: {
            [UserRole.SUPER_ADMIN]: 0,
            [UserRole.CLUB_PRESIDENT]: 0,
            [UserRole.STUDENT]: 0
          },
          averageSessionDuration: 0,
          oldestSession: null as Date | null,
          newestSession: null as Date | null
        };

        // This would require scanning Redis keys, which is expensive
        // In production, you'd maintain these stats separately
        
        return stats;
      },
      { prefix: 'session_stats', ttl: 300 } // 5 minutes
    );
  }

  /**
   * Clean up expired sessions
   */
  public static async cleanupExpiredSessions(): Promise<number> {
    // Redis automatically handles TTL expiration
    // This method is for additional cleanup logic if needed
    console.log('Session cleanup completed (handled by Redis TTL)');
    return 0;
  }

  /**
   * Enforce session limits per user
   */
  private static async enforceSessionLimits(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    if (sessions.length >= this.MAX_SESSIONS_PER_USER) {
      // Remove oldest sessions
      const sessionsToRemove = sessions
        .sort((a, b) => 
          new Date(a.data.lastActivity).getTime() - new Date(b.data.lastActivity).getTime()
        )
        .slice(0, sessions.length - this.MAX_SESSIONS_PER_USER + 1);

      for (const session of sessionsToRemove) {
        await this.invalidateSession(session.sessionId);
      }

      console.log(`Removed ${sessionsToRemove.length} old sessions for user ${userId}`);
    }
  }

  /**
   * Get session by user and device info (for duplicate session detection)
   */
  public static async findSessionByDevice(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SessionInfo | null> {
    const sessions = await this.getUserSessions(userId);
    
    for (const session of sessions) {
      if (session.data.ipAddress === ipAddress && 
          session.data.userAgent === userAgent) {
        return session;
      }
    }
    
    return null;
  }

  /**
   * Update session permissions (when user role changes)
   */
  public static async updateSessionPermissions(
    userId: string,
    newPermissions: string[]
  ): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    for (const session of sessions) {
      const updatedData: SessionData = {
        ...session.data,
        permissions: newPermissions
      };
      
      await SessionCacheService.setSession(session.sessionId, updatedData);
    }
    
    console.log(`Updated permissions for ${sessions.length} sessions of user ${userId}`);
  }

  /**
   * Get active sessions count by role
   */
  public static async getActiveSessionsByRole(): Promise<Record<UserRole, number>> {
    const cacheKey = 'active_sessions_by_role';
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        // This would require scanning all sessions
        // In production, maintain counters separately
        return {
          [UserRole.SUPER_ADMIN]: 0,
          [UserRole.CLUB_PRESIDENT]: 0,
          [UserRole.STUDENT]: 0
        };
      },
      { prefix: 'session_stats', ttl: 60 } // 1 minute
    );
  }

  /**
   * Health check for session service
   */
  public static async healthCheck(): Promise<boolean> {
    try {
      const testSessionId = 'health_check_session';
      const testData: SessionData = {
        userId: 'test-user',
        userRole: UserRole.STUDENT,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        loginTime: new Date(),
        lastActivity: new Date(),
        permissions: []
      };

      // Test session operations
      await SessionCacheService.setSession(testSessionId, testData);
      const retrieved = await SessionCacheService.getSession(testSessionId);
      await SessionCacheService.invalidateSession(testSessionId);

      return retrieved !== null && retrieved.userId === testData.userId;
    } catch (error) {
      console.error('Session service health check failed:', error);
      return false;
    }
  }
}

export default SessionService;