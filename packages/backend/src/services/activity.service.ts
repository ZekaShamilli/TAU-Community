/**
 * Activity Service
 * Handles all activity-related business logic including CRUD operations,
 * activity validation, status management, and club association.
 */

import { PrismaClient, Activity, ActivityStatus, UserRole, User, Club } from '@prisma/client';
import { prisma } from '../lib/database';

export interface CreateActivityRequest {
  clubId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  maxParticipants?: number;
  status?: ActivityStatus;
}

export interface UpdateActivityRequest {
  title?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  maxParticipants?: number;
  status?: ActivityStatus;
}

export interface ActivityFilters {
  clubId?: string;
  status?: ActivityStatus;
  startDateFrom?: Date;
  startDateTo?: Date;
  search?: string;
  createdBy?: string;
}

export interface ActivityWithDetails extends Activity {
  club?: Club;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
}

export interface ActivityVersionHistory {
  id: string;
  activityId: string;
  version: number;
  changes: any;
  changedBy: string;
  changedAt: Date;
  previousData: any;
}

export class ActivityService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Validate activity data
   */
  private validateActivityData(data: CreateActivityRequest | UpdateActivityRequest | any): void {
    // Title validation
    if ('title' in data && data.title) {
      if (data.title.length < 5 || data.title.length > 300) {
        throw new Error('Activity title must be between 5 and 300 characters');
      }
    }

    // Description validation
    if (data.description && data.description !== null && data.description.length > 5000) {
      throw new Error('Activity description cannot exceed 5000 characters');
    }

    // Location validation
    if (data.location && data.location !== null && data.location.length > 200) {
      throw new Error('Activity location cannot exceed 200 characters');
    }

    // Date validation
    if (data.startDate && data.endDate) {
      if (data.endDate <= data.startDate) {
        throw new Error('End date must be after start date');
      }
    }

    // Start date validation (must be in the future, with some flexibility for editing)
    if (data.startDate) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      if (data.startDate <= oneDayAgo) {
        throw new Error('Start date must be in the future');
      }
    }

    // Max participants validation
    if (data.maxParticipants !== undefined && data.maxParticipants !== null && data.maxParticipants <= 0) {
      throw new Error('Maximum participants must be a positive number');
    }
  }

  /**
   * Validate club access for activity operations
   */
  private async validateClubAccess(clubId: string, userId: string, userRole: UserRole): Promise<void> {
    if (userRole === UserRole.SUPER_ADMIN) {
      return; // Super admins have access to all clubs
    }

    if (userRole === UserRole.CLUB_PRESIDENT) {
      const club = await this.prisma.club.findUnique({
        where: { id: clubId },
        select: { presidentId: true, isActive: true }
      });

      if (!club) {
        throw new Error('Club not found');
      }

      if (!club.isActive) {
        throw new Error('Cannot manage activities for inactive club');
      }

      if (club.presidentId !== userId) {
        throw new Error('Access denied: You can only manage activities for your assigned club');
      }
    } else {
      throw new Error('Access denied: Insufficient permissions to manage activities');
    }
  }

  /**
   * Create a new activity
   */
  async createActivity(data: CreateActivityRequest, createdBy: string, userRole: UserRole): Promise<ActivityWithDetails> {
    // Validate input data
    this.validateActivityData(data);

    // Validate club access
    await this.validateClubAccess(data.clubId, createdBy, userRole);

    // Verify club exists and is active
    const club = await this.prisma.club.findUnique({
      where: { id: data.clubId },
      select: { id: true, name: true, isActive: true }
    });

    if (!club) {
      throw new Error('Club not found');
    }

    if (!club.isActive) {
      throw new Error('Cannot create activities for inactive club');
    }

    // Create the activity
    const activity = await this.prisma.activity.create({
      data: {
        clubId: data.clubId,
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        location: data.location,
        maxParticipants: data.maxParticipants,
        createdBy,
        status: data.status || ActivityStatus.DRAFT
      },
      include: {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Log the creation
    await this.logAuditAction(createdBy, 'CREATE', 'ACTIVITY', activity.id, {
      activityTitle: activity.title,
      clubId: activity.clubId,
      clubName: club.name,
      status: activity.status
    });

    return activity;
  }

  /**
   * Get an activity by ID
   */
  async getActivity(id: string, includeDetails: boolean = true): Promise<ActivityWithDetails | null> {
    return await this.prisma.activity.findUnique({
      where: { id },
      include: includeDetails ? {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      } : undefined
    });
  }

  /**
   * Update an activity
   */
  async updateActivity(
    id: string, 
    data: UpdateActivityRequest, 
    updatedBy: string, 
    userRole: UserRole
  ): Promise<ActivityWithDetails> {
    // Get existing activity
    const existingActivity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!existingActivity) {
      throw new Error('Activity not found');
    }

    // Validate club access
    await this.validateClubAccess(existingActivity.clubId, updatedBy, userRole);

    // Validate input data
    const mergedData = { ...existingActivity, ...data };
    this.validateActivityData(mergedData);

    // Store previous data for version history
    const previousData = {
      title: existingActivity.title,
      description: existingActivity.description,
      startDate: existingActivity.startDate,
      endDate: existingActivity.endDate,
      location: existingActivity.location,
      maxParticipants: existingActivity.maxParticipants,
      status: existingActivity.status
    };

    // Update the activity
    const updatedActivity = await this.prisma.activity.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Log the update with version history
    await this.logAuditAction(updatedBy, 'UPDATE', 'ACTIVITY', id, {
      before: previousData,
      after: {
        title: updatedActivity.title,
        description: updatedActivity.description,
        startDate: updatedActivity.startDate,
        endDate: updatedActivity.endDate,
        location: updatedActivity.location,
        maxParticipants: updatedActivity.maxParticipants,
        status: updatedActivity.status
      },
      changes: data
    });

    return updatedActivity;
  }

  /**
   * Delete an activity
   */
  async deleteActivity(id: string, deletedBy: string, userRole: UserRole): Promise<void> {
    // Get existing activity
    const existingActivity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        club: {
          select: { id: true, name: true }
        }
      }
    });

    if (!existingActivity) {
      throw new Error('Activity not found');
    }

    // Validate club access
    await this.validateClubAccess(existingActivity.clubId, deletedBy, userRole);

    // Delete the activity
    await this.prisma.activity.delete({
      where: { id }
    });

    // Log the deletion
    await this.logAuditAction(deletedBy, 'DELETE', 'ACTIVITY', id, {
      activityTitle: existingActivity.title,
      clubId: existingActivity.clubId,
      clubName: existingActivity.club.name,
      deletedData: {
        title: existingActivity.title,
        description: existingActivity.description,
        startDate: existingActivity.startDate,
        endDate: existingActivity.endDate,
        location: existingActivity.location,
        maxParticipants: existingActivity.maxParticipants,
        status: existingActivity.status
      }
    });
  }

  /**
   * List activities with filtering and pagination
   */
  async listActivities(
    filters: ActivityFilters = {},
    page: number = 1,
    limit: number = 20,
    orderBy: 'startDate' | 'createdAt' | 'title' = 'startDate',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<{ activities: ActivityWithDetails[]; total: number; page: number; totalPages: number }> {
    const where: any = {};

    if (filters.clubId) {
      where.clubId = filters.clubId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    if (filters.startDateFrom || filters.startDateTo) {
      where.startDate = {};
      if (filters.startDateFrom) {
        where.startDate.gte = filters.startDateFrom;
      }
      if (filters.startDateTo) {
        where.startDate.lte = filters.startDateTo;
      }
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const orderByClause: any = {};
    orderByClause[orderBy] = orderDirection;

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: {
          club: true,
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: orderByClause,
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.activity.count({ where })
    ]);

    return {
      activities,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get activities for a specific club (chronologically ordered)
   */
  async getClubActivities(
    clubId: string, 
    includeCompleted: boolean = true,
    limit?: number
  ): Promise<ActivityWithDetails[]> {
    const where: any = { clubId };

    if (!includeCompleted) {
      where.status = {
        not: ActivityStatus.COMPLETED
      };
    }

    return await this.prisma.activity.findMany({
      where,
      include: {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: [
        { startDate: 'asc' },
        { createdAt: 'asc' }
      ],
      ...(limit && { take: limit })
    });
  }

  /**
   * Get upcoming activities across all clubs (for public display)
   */
  async getUpcomingActivities(limit: number = 10): Promise<ActivityWithDetails[]> {
    const now = new Date();

    return await this.prisma.activity.findMany({
      where: {
        status: ActivityStatus.PUBLISHED,
        startDate: {
          gte: now
        },
        club: {
          isActive: true
        }
      },
      include: {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: [
        { startDate: 'asc' },
        { createdAt: 'asc' }
      ],
      take: limit
    });
  }

  /**
   * Update activity statuses based on dates (for scheduled tasks)
   */
  async updateActivityStatuses(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.activity.updateMany({
      where: {
        status: {
          in: [ActivityStatus.PUBLISHED, ActivityStatus.DRAFT]
        },
        endDate: {
          lt: now
        }
      },
      data: {
        status: ActivityStatus.COMPLETED,
        updatedAt: now
      }
    });

    if (result.count > 0) {
      console.log(`✅ Updated ${result.count} activities to COMPLETED status`);
    }

    return result.count;
  }

  /**
   * Get activity version history (from audit logs)
   */
  async getActivityVersionHistory(activityId: string): Promise<any[]> {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        resource: 'ACTIVITY',
        resourceId: activityId,
        action: {
          in: ['CREATE', 'UPDATE']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    return auditLogs.map((log, index) => ({
      id: log.id,
      version: auditLogs.length - index,
      action: log.action,
      changes: log.changes,
      changedBy: log.user,
      changedAt: log.timestamp,
      success: log.success
    }));
  }

  /**
   * Rollback activity to a previous version
   */
  async rollbackActivity(
    activityId: string,
    targetVersionId: string,
    rolledBackBy: string,
    userRole: UserRole
  ): Promise<ActivityWithDetails> {
    // Get the target version from audit logs
    const targetVersion = await this.prisma.auditLog.findUnique({
      where: { id: targetVersionId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!targetVersion || targetVersion.resource !== 'ACTIVITY' || targetVersion.resourceId !== activityId) {
      throw new Error('Target version not found or invalid');
    }

    // Get current activity to validate access
    const currentActivity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!currentActivity) {
      throw new Error('Activity not found');
    }

    // Validate club access
    await this.validateClubAccess(currentActivity.clubId, rolledBackBy, userRole);

    // Extract the data to rollback to
    let rollbackData: any;
    
    if (targetVersion.action === 'CREATE') {
      // If rolling back to creation, use the initial data
      const changes = targetVersion.changes as any;
      rollbackData = {
        title: changes?.activityTitle || currentActivity.title,
        description: changes?.description || null,
        startDate: changes?.startDate ? new Date(changes.startDate) : currentActivity.startDate,
        endDate: changes?.endDate ? new Date(changes.endDate) : currentActivity.endDate,
        location: changes?.location || null,
        maxParticipants: changes?.maxParticipants || null,
        status: changes?.status || ActivityStatus.DRAFT
      };
    } else if (targetVersion.action === 'UPDATE' && targetVersion.changes) {
      // If rolling back to an update, use the "before" state
      const changes = targetVersion.changes as any;
      const beforeData = changes?.before;
      if (beforeData) {
        rollbackData = {
          title: beforeData.title,
          description: beforeData.description,
          startDate: beforeData.startDate ? new Date(beforeData.startDate) : currentActivity.startDate,
          endDate: beforeData.endDate ? new Date(beforeData.endDate) : currentActivity.endDate,
          location: beforeData.location,
          maxParticipants: beforeData.maxParticipants,
          status: beforeData.status
        };
      } else {
        throw new Error('Cannot find before state in target version');
      }
    } else {
      throw new Error('Cannot determine rollback data from target version');
    }

    // Validate the rollback data
    this.validateActivityData(rollbackData);

    // Store current data for rollback history
    const currentData = {
      title: currentActivity.title,
      description: currentActivity.description,
      startDate: currentActivity.startDate,
      endDate: currentActivity.endDate,
      location: currentActivity.location,
      maxParticipants: currentActivity.maxParticipants,
      status: currentActivity.status
    };

    // Perform the rollback
    const rolledBackActivity = await this.prisma.activity.update({
      where: { id: activityId },
      data: {
        ...rollbackData,
        updatedAt: new Date()
      },
      include: {
        club: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Log the rollback action
    await this.logAuditAction(rolledBackBy, 'ROLLBACK', 'ACTIVITY', activityId, {
      rolledBackToVersion: targetVersionId,
      rolledBackToTimestamp: targetVersion.timestamp,
      rolledBackBy: targetVersion.user,
      before: currentData,
      after: rollbackData,
      rollbackReason: `Rolled back to version ${targetVersion.id} from ${targetVersion.timestamp}`
    });

    return rolledBackActivity;
  }

  /**
   * Compare two activity versions
   */
  async compareActivityVersions(
    activityId: string,
    version1Id: string,
    version2Id: string
  ): Promise<{
    version1: any;
    version2: any;
    differences: { field: string; version1Value: any; version2Value: any }[];
  }> {
    const [version1, version2] = await Promise.all([
      this.prisma.auditLog.findUnique({
        where: { id: version1Id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        }
      }),
      this.prisma.auditLog.findUnique({
        where: { id: version2Id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        }
      })
    ]);

    if (!version1 || !version2 || 
        version1.resource !== 'ACTIVITY' || version2.resource !== 'ACTIVITY' ||
        version1.resourceId !== activityId || version2.resourceId !== activityId) {
      throw new Error('Invalid version IDs or activity mismatch');
    }

    // Extract data from versions
    const extractVersionData = (version: any) => {
      if (version.action === 'CREATE') {
        return {
          title: version.changes?.activityTitle,
          description: version.changes?.description,
          startDate: version.changes?.startDate,
          endDate: version.changes?.endDate,
          location: version.changes?.location,
          maxParticipants: version.changes?.maxParticipants,
          status: version.changes?.status
        };
      } else if (version.action === 'UPDATE') {
        return version.changes?.after || {};
      } else if (version.action === 'ROLLBACK') {
        return version.changes?.after || {};
      }
      return {};
    };

    const data1 = extractVersionData(version1);
    const data2 = extractVersionData(version2);

    // Find differences
    const differences: { field: string; version1Value: any; version2Value: any }[] = [];
    const allFields = new Set([...Object.keys(data1), ...Object.keys(data2)]);

    for (const field of allFields) {
      const value1 = data1[field];
      const value2 = data2[field];
      
      if (JSON.stringify(value1) !== JSON.stringify(value2)) {
        differences.push({
          field,
          version1Value: value1,
          version2Value: value2
        });
      }
    }

    return {
      version1: {
        ...version1,
        data: data1
      },
      version2: {
        ...version2,
        data: data2
      },
      differences
    };
  }

  /**
   * Validate activity access for a user
   */
  async validateActivityAccess(
    activityId: string, 
    userId: string, 
    userRole: UserRole,
    action: 'READ' | 'WRITE' = 'READ'
  ): Promise<boolean> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        club: {
          select: {
            id: true,
            presidentId: true,
            isActive: true
          }
        }
      }
    });

    if (!activity) {
      return false;
    }

    // Super admins have full access
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Club presidents can manage activities for their club
    if (userRole === UserRole.CLUB_PRESIDENT) {
      if (action === 'WRITE') {
        return activity.club.presidentId === userId && activity.club.isActive;
      } else {
        return activity.club.presidentId === userId;
      }
    }

    // Students can only read published activities from active clubs
    if (userRole === UserRole.STUDENT) {
      if (action === 'READ') {
        return activity.status === ActivityStatus.PUBLISHED && activity.club.isActive;
      } else {
        return false; // Students cannot write/modify activities
      }
    }

    return false;
  }

  /**
   * Log audit action
   */
  private async logAuditAction(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    changes: any,
    tx?: any
  ): Promise<void> {
    const user = await (tx || this.prisma).user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new Error('User not found for audit logging');
    }

    await (tx || this.prisma).auditLog.create({
      data: {
        userId,
        userRole: user.role,
        action,
        resource,
        resourceId,
        changes,
        timestamp: new Date(),
        success: true
      }
    });
  }
}

export default ActivityService;