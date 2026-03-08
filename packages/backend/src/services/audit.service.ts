/**
 * Comprehensive Audit Service for TAU Community
 * Provides comprehensive logging, searching, and analysis of all system activities
 */

import { PrismaClient, UserRole } from '@prisma/client';
import { db, DatabaseUtils } from '../lib/database';

export interface AuditEntry {
  id: string;
  userId?: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface AuditFilters {
  userId?: string;
  userRole?: UserRole;
  action?: string;
  resource?: string;
  resourceId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSearchQuery {
  query: string;
  filters?: AuditFilters;
  limit?: number;
  offset?: number;
}

export interface AuditAction {
  userId?: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

export interface AuditStatistics {
  totalEntries: number;
  entriesByRole: Record<UserRole, number>;
  entriesByAction: Record<string, number>;
  entriesByResource: Record<string, number>;
  successRate: number;
  recentActivity: AuditEntry[];
}

export class AuditService {
  private static instance: AuditService;
  private client: PrismaClient;

  private constructor() {
    this.client = db.getClient();
  }

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Log a comprehensive audit action with before/after state tracking
   */
  async logAction(action: AuditAction): Promise<void> {
    try {
      // Prepare changes object with before/after states
      const changes: any = {};
      
      if (action.beforeState !== undefined) {
        changes.before = action.beforeState;
      }
      
      if (action.afterState !== undefined) {
        changes.after = action.afterState;
      }

      // If we have both before and after states, calculate the diff
      if (action.beforeState && action.afterState) {
        changes.diff = this.calculateStateDiff(action.beforeState, action.afterState);
      }

      await DatabaseUtils.logAudit({
        userId: action.userId,
        userRole: action.userRole,
        action: action.action,
        resource: action.resource,
        resourceId: action.resourceId,
        changes: Object.keys(changes).length > 0 ? changes : undefined,
        ipAddress: action.ipAddress,
        userAgent: action.userAgent,
        success: action.success ?? true,
        errorMessage: action.errorMessage,
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Get audit log entries with filtering and pagination
   */
  async getAuditLog(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    const whereClause: any = {};

    // Apply filters
    if (filters.userId) {
      whereClause.userId = filters.userId;
    }

    if (filters.userRole) {
      whereClause.userRole = filters.userRole;
    }

    if (filters.action) {
      whereClause.action = {
        contains: filters.action,
        mode: 'insensitive',
      };
    }

    if (filters.resource) {
      whereClause.resource = {
        contains: filters.resource,
        mode: 'insensitive',
      };
    }

    if (filters.resourceId) {
      whereClause.resourceId = filters.resourceId;
    }

    if (filters.success !== undefined) {
      whereClause.success = filters.success;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) {
        whereClause.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.timestamp.lte = filters.endDate;
      }
    }

    if (filters.ipAddress) {
      whereClause.ipAddress = filters.ipAddress;
    }

    const entries = await this.client.auditLog.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc',
      },
      take: filters.limit || 100,
      skip: filters.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return entries.map(entry => ({
      id: entry.id,
      userId: entry.userId || undefined,
      userRole: entry.userRole,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || undefined,
      changes: entry.changes,
      ipAddress: entry.ipAddress || undefined,
      userAgent: entry.userAgent || undefined,
      timestamp: entry.timestamp,
      success: entry.success,
      errorMessage: entry.errorMessage || undefined,
    }));
  }

  /**
   * Search audit logs with text-based queries
   */
  async searchAuditLog(searchQuery: AuditSearchQuery): Promise<AuditEntry[]> {
    const { query, filters = {}, limit = 100, offset = 0 } = searchQuery;

    // Build search conditions
    const searchConditions = [];

    // Search in action, resource, and error message
    if (query) {
      searchConditions.push(
        { action: { contains: query, mode: 'insensitive' } },
        { resource: { contains: query, mode: 'insensitive' } },
        { errorMessage: { contains: query, mode: 'insensitive' } }
      );
    }

    // Combine search with filters
    const whereClause: any = {};

    if (searchConditions.length > 0) {
      whereClause.OR = searchConditions;
    }

    // Apply additional filters
    if (filters.userId) {
      whereClause.userId = filters.userId;
    }

    if (filters.userRole) {
      whereClause.userRole = filters.userRole;
    }

    if (filters.success !== undefined) {
      whereClause.success = filters.success;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) {
        whereClause.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.timestamp.lte = filters.endDate;
      }
    }

    const entries = await this.client.auditLog.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return entries.map(entry => ({
      id: entry.id,
      userId: entry.userId || undefined,
      userRole: entry.userRole,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || undefined,
      changes: entry.changes,
      ipAddress: entry.ipAddress || undefined,
      userAgent: entry.userAgent || undefined,
      timestamp: entry.timestamp,
      success: entry.success,
      errorMessage: entry.errorMessage || undefined,
    }));
  }

  /**
   * Get audit statistics and analytics
   */
  async getAuditStatistics(filters: AuditFilters = {}): Promise<AuditStatistics> {
    const whereClause: any = {};

    // Apply date filters if provided
    if (filters.startDate || filters.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) {
        whereClause.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.timestamp.lte = filters.endDate;
      }
    }

    // Get total count
    const totalEntries = await this.client.auditLog.count({
      where: whereClause,
    });

    // Get entries by role
    const roleStats = await this.client.auditLog.groupBy({
      by: ['userRole'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    const entriesByRole: Record<UserRole, number> = {
      SUPER_ADMIN: 0,
      CLUB_PRESIDENT: 0,
      STUDENT: 0,
    };

    roleStats.forEach(stat => {
      entriesByRole[stat.userRole] = stat._count.id;
    });

    // Get entries by action
    const actionStats = await this.client.auditLog.groupBy({
      by: ['action'],
      where: whereClause,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10, // Top 10 actions
    });

    const entriesByAction: Record<string, number> = {};
    actionStats.forEach(stat => {
      entriesByAction[stat.action] = stat._count.id;
    });

    // Get entries by resource
    const resourceStats = await this.client.auditLog.groupBy({
      by: ['resource'],
      where: whereClause,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10, // Top 10 resources
    });

    const entriesByResource: Record<string, number> = {};
    resourceStats.forEach(stat => {
      entriesByResource[stat.resource] = stat._count.id;
    });

    // Calculate success rate
    const successCount = await this.client.auditLog.count({
      where: {
        ...whereClause,
        success: true,
      },
    });

    const successRate = totalEntries > 0 ? (successCount / totalEntries) * 100 : 100;

    // Get recent activity (last 10 entries)
    const recentActivity = await this.getAuditLog({
      ...filters,
      limit: 10,
      offset: 0,
    });

    return {
      totalEntries,
      entriesByRole,
      entriesByAction,
      entriesByResource,
      successRate,
      recentActivity,
    };
  }

  /**
   * Get audit trail for a specific resource
   */
  async getResourceAuditTrail(resource: string, resourceId: string): Promise<AuditEntry[]> {
    return this.getAuditLog({
      resource,
      resourceId,
      limit: 1000, // Get all entries for the resource
    });
  }

  /**
   * Get user activity history
   */
  async getUserActivityHistory(userId: string, filters: AuditFilters = {}): Promise<AuditEntry[]> {
    return this.getAuditLog({
      ...filters,
      userId,
      limit: filters.limit || 100,
    });
  }

  /**
   * Calculate the difference between before and after states
   */
  private calculateStateDiff(before: any, after: any): any {
    const diff: any = {};

    // Handle primitive values
    if (typeof before !== 'object' || typeof after !== 'object') {
      if (before !== after) {
        return { from: before, to: after };
      }
      return null;
    }

    // Handle null values
    if (before === null || after === null) {
      if (before !== after) {
        return { from: before, to: after };
      }
      return null;
    }

    // Handle arrays
    if (Array.isArray(before) || Array.isArray(after)) {
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        return { from: before, to: after };
      }
      return null;
    }

    // Handle objects
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    for (const key of allKeys) {
      const beforeValue = before[key];
      const afterValue = after[key];

      if (beforeValue !== afterValue) {
        if (typeof beforeValue === 'object' && typeof afterValue === 'object') {
          const nestedDiff = this.calculateStateDiff(beforeValue, afterValue);
          if (nestedDiff) {
            diff[key] = nestedDiff;
          }
        } else {
          diff[key] = { from: beforeValue, to: afterValue };
        }
      }
    }

    return Object.keys(diff).length > 0 ? diff : null;
  }

  /**
   * Clean up old audit entries (for maintenance)
   */
  async cleanupOldEntries(olderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.client.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Export audit logs to JSON format
   */
  async exportAuditLogs(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    // Remove pagination limits for export
    const exportFilters = { ...filters };
    delete exportFilters.limit;
    delete exportFilters.offset;

    return this.getAuditLog(exportFilters);
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance();