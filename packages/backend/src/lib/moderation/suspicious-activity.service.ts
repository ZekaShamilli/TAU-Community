/**
 * Suspicious Activity Monitoring Service
 * Handles real-time monitoring and detection of suspicious user behavior
 */

import { db, DatabaseUtils } from '../database';
import {
  SeverityLevel,
  AlertStatus,
  SuspiciousActivityPattern,
  SuspiciousActivityAlert,
  SuspiciousActivityStats
} from './types';
import { UserRole } from '@prisma/client';
import { ModerationService } from './service';
import { AlertNotificationService } from '../../services/alert-notification.service';

export class SuspiciousActivityService {
  /**
   * Initialize default suspicious activity patterns
   */
  public static async initializePatterns(): Promise<void> {
    try {
      const client = db.getClient();

      const defaultPatterns = [
        {
          patternName: 'Rapid Content Creation',
          patternDescription: 'User creates multiple pieces of content in a short time period',
          detectionRules: {
            timeWindow: 300, // 5 minutes
            maxActions: 10,
            actionTypes: ['ACTIVITY_CREATE', 'APPLICATION_SUBMIT']
          },
          severityLevel: SeverityLevel.MEDIUM
        },
        {
          patternName: 'Spam Content Detection',
          patternDescription: 'Content contains repetitive or spam-like patterns',
          detectionRules: {
            minSimilarity: 0.8,
            checkFields: ['title', 'description', 'motivation'],
            timeWindow: 3600 // 1 hour
          },
          severityLevel: SeverityLevel.HIGH
        },
        {
          patternName: 'Multiple Failed Login Attempts',
          patternDescription: 'Multiple failed login attempts from same IP or user',
          detectionRules: {
            timeWindow: 900, // 15 minutes
            maxFailedAttempts: 5,
            actionTypes: ['LOGIN_FAILED']
          },
          severityLevel: SeverityLevel.HIGH
        },
        {
          patternName: 'Unusual Access Patterns',
          patternDescription: 'User accessing resources outside normal patterns',
          detectionRules: {
            timeWindow: 3600,
            maxClubAccess: 20,
            actionTypes: ['CLUB_READ', 'ACTIVITY_READ']
          },
          severityLevel: SeverityLevel.LOW
        },
        {
          patternName: 'Mass Application Submission',
          patternDescription: 'User submitting applications to many clubs rapidly',
          detectionRules: {
            timeWindow: 1800, // 30 minutes
            maxApplications: 5,
            actionTypes: ['APPLICATION_SUBMIT']
          },
          severityLevel: SeverityLevel.MEDIUM
        }
      ];

      for (const pattern of defaultPatterns) {
        const existing = await client.suspiciousActivityPatterns.findFirst({
          where: { patternName: pattern.patternName }
        });

        if (!existing) {
          await client.suspiciousActivityPatterns.create({
            data: pattern
          });
        }
      }
    } catch (error) {
      console.error('Initialize patterns error:', error);
    }
  }

  /**
   * Analyze user activity for suspicious patterns
   */
  public static async analyzeUserActivity(
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const client = db.getClient();

      // Get active patterns
      const patterns = await client.suspiciousActivityPatterns.findMany({
        where: { isActive: true }
      });

      for (const pattern of patterns) {
        const rules = pattern.detectionRules as any;
        
        if (await this.checkPattern(userId, action, resourceType, resourceId, rules, metadata)) {
          await this.createAlert(pattern.id, userId, {
            action,
            resourceType,
            resourceId,
            metadata,
            detectedAt: new Date()
          }, pattern.severityLevel as SeverityLevel);
        }
      }
    } catch (error) {
      console.error('Analyze user activity error:', error);
    }
  }

  /**
   * Check if user activity matches a suspicious pattern
   */
  private static async checkPattern(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string | undefined,
    rules: any,
    metadata?: any
  ): Promise<boolean> {
    try {
      const client = db.getClient();

      // Check if action type matches pattern
      if (rules.actionTypes && !rules.actionTypes.includes(action)) {
        return false;
      }

      const timeWindow = rules.timeWindow || 3600; // Default 1 hour
      const windowStart = new Date(Date.now() - timeWindow * 1000);

      switch (rules.type || 'frequency') {
        case 'frequency':
          return await this.checkFrequencyPattern(userId, action, windowStart, rules);
        
        case 'similarity':
          return await this.checkSimilarityPattern(userId, resourceType, windowStart, rules, metadata);
        
        case 'access_pattern':
          return await this.checkAccessPattern(userId, action, windowStart, rules);
        
        default:
          return await this.checkFrequencyPattern(userId, action, windowStart, rules);
      }
    } catch (error) {
      console.error('Check pattern error:', error);
      return false;
    }
  }

  /**
   * Check frequency-based patterns (e.g., too many actions in time window)
   */
  private static async checkFrequencyPattern(
    userId: string,
    action: string,
    windowStart: Date,
    rules: any
  ): Promise<boolean> {
    try {
      const client = db.getClient();

      const actionCount = await client.auditLog.count({
        where: {
          userId,
          action: rules.actionTypes ? { in: rules.actionTypes } : action,
          timestamp: { gte: windowStart },
          success: true
        }
      });

      const maxActions = rules.maxActions || rules.maxFailedAttempts || 10;
      return actionCount >= maxActions;
    } catch (error) {
      console.error('Check frequency pattern error:', error);
      return false;
    }
  }

  /**
   * Check similarity-based patterns (e.g., spam content)
   */
  private static async checkSimilarityPattern(
    userId: string,
    resourceType: string,
    windowStart: Date,
    rules: any,
    metadata?: any
  ): Promise<boolean> {
    try {
      if (!metadata || !rules.checkFields) {
        return false;
      }

      const client = db.getClient();

      // Get recent content from the same user
      const recentAudits = await client.auditLog.findMany({
        where: {
          userId,
          resource: resourceType,
          timestamp: { gte: windowStart },
          success: true
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      // Check similarity with recent content
      for (const audit of recentAudits) {
        const changes = audit.changes as any;
        if (changes && this.calculateSimilarity(metadata, changes, rules.checkFields) >= rules.minSimilarity) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Check similarity pattern error:', error);
      return false;
    }
  }

  /**
   * Check access pattern anomalies
   */
  private static async checkAccessPattern(
    userId: string,
    action: string,
    windowStart: Date,
    rules: any
  ): Promise<boolean> {
    try {
      const client = db.getClient();

      if (rules.maxClubAccess) {
        const uniqueClubs = await client.auditLog.findMany({
          where: {
            userId,
            action: { in: rules.actionTypes },
            timestamp: { gte: windowStart },
            success: true
          },
          select: { resourceId: true },
          distinct: ['resourceId']
        });

        return uniqueClubs.length >= rules.maxClubAccess;
      }

      return false;
    } catch (error) {
      console.error('Check access pattern error:', error);
      return false;
    }
  }

  /**
   * Calculate similarity between two content objects
   */
  private static calculateSimilarity(content1: any, content2: any, fields: string[]): number {
    let totalSimilarity = 0;
    let fieldCount = 0;

    for (const field of fields) {
      if (content1[field] && content2[field]) {
        const similarity = this.stringSimilarity(
          content1[field].toString().toLowerCase(),
          content2[field].toString().toLowerCase()
        );
        totalSimilarity += similarity;
        fieldCount++;
      }
    }

    return fieldCount > 0 ? totalSimilarity / fieldCount : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Create suspicious activity alert
   */
  private static async createAlert(
    patternId: string,
    userId: string,
    activityData: any,
    severityLevel: SeverityLevel
  ): Promise<void> {
    try {
      const client = db.getClient();

      // Check if similar alert already exists for this user and pattern
      const existingAlert = await client.suspiciousActivityAlerts.findFirst({
        where: {
          patternId,
          userId,
          status: { in: [AlertStatus.OPEN, AlertStatus.INVESTIGATING] },
          detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }
      });

      if (existingAlert) {
        // Update existing alert with new activity data
        await client.suspiciousActivityAlerts.update({
          where: { id: existingAlert.id },
          data: {
            activityData: {
              ...(existingAlert.activityData as any),
              additionalOccurrences: ((existingAlert.activityData as any).additionalOccurrences || 0) + 1,
              lastOccurrence: new Date()
            }
          }
        });
        return;
      }

      // Create new alert
      const alert = await client.suspiciousActivityAlerts.create({
        data: {
          patternId,
          userId,
          activityData,
          severityLevel,
          status: AlertStatus.OPEN
        }
      });

      // Log the alert creation
      await DatabaseUtils.logAudit({
        userId,
        userRole: UserRole.STUDENT, // Will be updated with actual role
        action: 'SUSPICIOUS_ACTIVITY_DETECTED',
        resource: 'SECURITY',
        resourceId: alert.id,
        changes: {
          patternId,
          severityLevel,
          activityData
        },
        success: true
      });

      // Auto-flag content if severity is high or critical
      if (severityLevel === SeverityLevel.HIGH || severityLevel === SeverityLevel.CRITICAL) {
        if (activityData.resourceType && activityData.resourceId) {
          await ModerationService.autoFlagContent(
            activityData.resourceType,
            activityData.resourceId,
            `Suspicious activity detected: ${activityData.action}`,
            severityLevel
          );
        }
      }

      // Send immediate alert notification for high/critical severity
      if (severityLevel === SeverityLevel.HIGH || severityLevel === SeverityLevel.CRITICAL) {
        await AlertNotificationService.sendImmediateAlert(alert.id, severityLevel, activityData);
      }
    } catch (error) {
      console.error('Create alert error:', error);
    }
  }

  /**
   * Get suspicious activity alerts
   */
  public static async getAlerts(filters: {
    status?: AlertStatus;
    severityLevel?: SeverityLevel;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SuspiciousActivityAlert[]> {
    try {
      const client = db.getClient();

      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.severityLevel) {
        where.severityLevel = filters.severityLevel;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      const alerts = await client.suspiciousActivityAlerts.findMany({
        where,
        orderBy: [
          { severityLevel: 'desc' },
          { detectedAt: 'desc' }
        ],
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: {
          pattern: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          },
          reviewedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      return alerts.map(alert => ({
        id: alert.id,
        patternId: alert.patternId,
        userId: alert.userId || undefined,
        activityData: alert.activityData,
        severityLevel: alert.severityLevel as SeverityLevel,
        detectedAt: alert.detectedAt,
        reviewedAt: alert.reviewedAt || undefined,
        reviewedBy: alert.reviewedBy || undefined,
        status: alert.status as AlertStatus,
        resolutionNotes: alert.resolutionNotes || undefined
      }));
    } catch (error) {
      console.error('Get alerts error:', error);
      return [];
    }
  }

  /**
   * Review suspicious activity alert
   */
  public static async reviewAlert(
    alertId: string,
    reviewerId: string,
    status: AlertStatus,
    resolutionNotes?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = db.getClient();

      await client.suspiciousActivityAlerts.update({
        where: { id: alertId },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          resolutionNotes
        }
      });

      // Log the review
      await DatabaseUtils.logAudit({
        userId: reviewerId,
        userRole: UserRole.SUPER_ADMIN,
        action: 'SUSPICIOUS_ACTIVITY_REVIEWED',
        resource: 'SECURITY',
        resourceId: alertId,
        changes: {
          status,
          resolutionNotes
        },
        success: true
      });

      return {
        success: true
      };
    } catch (error) {
      console.error('Review alert error:', error);
      return {
        success: false,
        error: 'Failed to review alert'
      };
    }
  }

  /**
   * Get suspicious activity statistics
   */
  public static async getStats(): Promise<SuspiciousActivityStats> {
    try {
      const client = db.getClient();

      const [
        totalAlerts,
        openAlerts,
        criticalAlerts,
        alertsBySeverity,
        alertsByStatus
      ] = await Promise.all([
        client.suspiciousActivityAlerts.count(),
        client.suspiciousActivityAlerts.count({
          where: { status: AlertStatus.OPEN }
        }),
        client.suspiciousActivityAlerts.count({
          where: { severityLevel: SeverityLevel.CRITICAL }
        }),
        client.suspiciousActivityAlerts.groupBy({
          by: ['severityLevel'],
          _count: { severityLevel: true }
        }),
        client.suspiciousActivityAlerts.groupBy({
          by: ['status'],
          _count: { status: true }
        })
      ]);

      const alertsBySeverityMap: Record<SeverityLevel, number> = {} as any;
      Object.values(SeverityLevel).forEach(level => {
        alertsBySeverityMap[level] = 0;
      });
      alertsBySeverity.forEach(item => {
        alertsBySeverityMap[item.severityLevel as SeverityLevel] = item._count.severityLevel;
      });

      const alertsByStatusMap: Record<AlertStatus, number> = {} as any;
      Object.values(AlertStatus).forEach(status => {
        alertsByStatusMap[status] = 0;
      });
      alertsByStatus.forEach(item => {
        alertsByStatusMap[item.status as AlertStatus] = item._count.status;
      });

      return {
        totalAlerts,
        openAlerts,
        criticalAlerts,
        alertsBySeverity: alertsBySeverityMap,
        alertsByStatus: alertsByStatusMap
      };
    } catch (error) {
      console.error('Get suspicious activity stats error:', error);
      return {
        totalAlerts: 0,
        openAlerts: 0,
        criticalAlerts: 0,
        alertsBySeverity: {} as any,
        alertsByStatus: {} as any
      };
    }
  }

  /**
   * Monitor user action and trigger analysis
   */
  public static async monitorUserAction(
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    metadata?: any
  ): Promise<void> {
    // Run analysis in background to avoid blocking the main request
    setImmediate(async () => {
      await this.analyzeUserActivity(userId, action, resourceType, resourceId, metadata);
    });
  }
}