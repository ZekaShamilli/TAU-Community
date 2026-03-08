/**
 * Content Moderation Service
 * Handles content flagging, review mechanisms, and real-time monitoring
 */

import { db, DatabaseUtils } from '../database';
import {
  ContentType,
  ModerationStatus,
  ModerationPriority,
  ModerationAction,
  FlagCategory,
  SeverityLevel,
  AlertStatus,
  ContentModerationQueue,
  ContentFlag,
  ContentModerationHistory,
  SuspiciousActivityAlert,
  FlagContentRequest,
  ReviewContentRequest,
  ModerationFilters,
  ContentItem,
  ContentVersion,
  ModerationStats,
  SuspiciousActivityStats
} from './types';
import { UserRole } from '@prisma/client';

export class ModerationService {
  /**
   * Flag content for review
   */
  public static async flagContent(
    flaggedBy: string,
    request: FlagContentRequest
  ): Promise<{
    success: boolean;
    flagId?: string;
    error?: string;
  }> {
    try {
      const { contentType, contentId, flagCategory, flagReason, additionalInfo } = request;

      const client = db.getClient();

      // Check if content exists and get its data
      const contentData = await this.getContentData(contentType, contentId);
      if (!contentData) {
        return {
          success: false,
          error: 'Content not found'
        };
      }

      // Check if user has already flagged this content
      const existingFlag = await client.contentFlags.findFirst({
        where: {
          contentType,
          contentId,
          flaggedBy
        }
      });

      if (existingFlag) {
        return {
          success: false,
          error: 'You have already flagged this content'
        };
      }

      // Create content flag
      const flag = await client.contentFlags.create({
        data: {
          contentType,
          contentId,
          flaggedBy,
          flagCategory,
          flagReason,
          additionalInfo
        }
      });

      // Check if content is already in moderation queue
      let moderationItem = await client.contentModerationQueue.findFirst({
        where: {
          contentType,
          contentId,
          status: {
            in: [ModerationStatus.PENDING, ModerationStatus.FLAGGED, ModerationStatus.UNDER_REVIEW]
          }
        }
      });

      if (!moderationItem) {
        // Add to moderation queue
        const priority = this.calculatePriority(flagCategory, contentData);
        
        moderationItem = await client.contentModerationQueue.create({
          data: {
            contentType,
            contentId,
            contentData: contentData.content,
            authorId: contentData.authorId,
            clubId: contentData.clubId,
            status: ModerationStatus.FLAGGED,
            priority,
            flaggedBy,
            flagReason,
            autoFlagged: false
          }
        });
      } else {
        // Update existing moderation item
        await client.contentModerationQueue.update({
          where: { id: moderationItem.id },
          data: {
            status: ModerationStatus.FLAGGED,
            priority: this.calculatePriority(flagCategory, contentData),
            updatedAt: new Date()
          }
        });
      }

      // Log the flagging action
      await DatabaseUtils.logAudit({
        userId: flaggedBy,
        userRole: UserRole.STUDENT, // Will be updated with actual role
        action: 'CONTENT_FLAGGED',
        resource: 'MODERATION',
        resourceId: contentId,
        changes: {
          contentType,
          flagCategory,
          flagReason
        },
        success: true
      });

      // Record moderation history
      await this.recordModerationHistory({
        contentType,
        contentId,
        action: ModerationAction.REJECT, // Flagging is a form of rejection
        performedBy: flaggedBy,
        reason: `Flagged: ${flagReason}`,
        automated: false
      });

      return {
        success: true,
        flagId: flag.id
      };
    } catch (error) {
      console.error('Flag content error:', error);
      return {
        success: false,
        error: 'Failed to flag content'
      };
    }
  }

  /**
   * Review flagged content (Super Admin only)
   */
  public static async reviewContent(
    reviewerId: string,
    moderationId: string,
    request: ReviewContentRequest
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { action, comments, editedContent } = request;

      const client = db.getClient();

      // Get moderation item
      const moderationItem = await client.contentModerationQueue.findUnique({
        where: { id: moderationId }
      });

      if (!moderationItem) {
        return {
          success: false,
          error: 'Moderation item not found'
        };
      }

      // Update moderation queue item
      const newStatus = action === ModerationAction.APPROVE 
        ? ModerationStatus.APPROVED 
        : ModerationStatus.REJECTED;

      await client.contentModerationQueue.update({
        where: { id: moderationId },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          reviewAction: action,
          reviewComments: comments,
          updatedAt: new Date()
        }
      });

      // Apply the moderation action to the actual content
      await this.applyModerationAction(
        moderationItem.contentType as ContentType,
        moderationItem.contentId,
        action,
        editedContent,
        reviewerId
      );

      // Resolve all flags for this content
      await client.contentFlags.updateMany({
        where: {
          contentType: moderationItem.contentType,
          contentId: moderationItem.contentId,
          resolvedAt: null
        },
        data: {
          resolvedAt: new Date(),
          resolvedBy: reviewerId,
          resolutionAction: action,
          resolutionComments: comments
        }
      });

      // Log the review action
      await DatabaseUtils.logAudit({
        userId: reviewerId,
        userRole: UserRole.SUPER_ADMIN,
        action: 'CONTENT_REVIEWED',
        resource: 'MODERATION',
        resourceId: moderationItem.contentId,
        changes: {
          contentType: moderationItem.contentType,
          action,
          comments
        },
        success: true
      });

      // Record moderation history
      await this.recordModerationHistory({
        contentType: moderationItem.contentType as ContentType,
        contentId: moderationItem.contentId,
        action,
        performedBy: reviewerId,
        reason: comments,
        previousData: moderationItem.contentData,
        newData: editedContent,
        automated: false
      });

      return {
        success: true
      };
    } catch (error) {
      console.error('Review content error:', error);
      return {
        success: false,
        error: 'Failed to review content'
      };
    }
  }

  /**
   * Get content moderation queue with filters
   */
  public static async getContentQueue(
    filters: ModerationFilters = {}
  ): Promise<ContentItem[]> {
    try {
      const client = db.getClient();

      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.priority) {
        where.priority = filters.priority;
      }

      if (filters.contentType) {
        where.contentType = filters.contentType;
      }

      if (filters.clubId) {
        where.clubId = filters.clubId;
      }

      if (filters.authorId) {
        where.authorId = filters.authorId;
      }

      if (filters.flaggedBy) {
        where.flaggedBy = filters.flaggedBy;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.flaggedAt = {};
        if (filters.dateFrom) {
          where.flaggedAt.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.flaggedAt.lte = filters.dateTo;
        }
      }

      const items = await client.contentModerationQueue.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { flaggedAt: 'desc' }
        ],
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          club: {
            select: {
              id: true,
              name: true
            }
          },
          flaggedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      return items.map(item => ({
        id: item.id,
        type: item.contentType as ContentType,
        content: item.contentData,
        authorId: item.authorId || undefined,
        clubId: item.clubId || undefined,
        status: item.status as ModerationStatus,
        createdAt: item.createdAt,
        flaggedAt: item.flaggedAt,
        flagReason: item.flagReason || undefined,
        priority: item.priority as ModerationPriority
      }));
    } catch (error) {
      console.error('Get content queue error:', error);
      return [];
    }
  }

  /**
   * Get content moderation history
   */
  public static async getContentHistory(contentId: string): Promise<ContentVersion[]> {
    try {
      const client = db.getClient();

      const history = await client.contentModerationHistory.findMany({
        where: { contentId },
        orderBy: { performedAt: 'desc' },
        include: {
          performedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      return history.map((item, index) => ({
        id: item.id,
        contentId: item.contentId,
        version: history.length - index,
        data: item.newData || item.previousData,
        createdAt: item.performedAt,
        createdBy: item.performedBy || undefined,
        action: item.action as ModerationAction,
        reason: item.reason || undefined
      }));
    } catch (error) {
      console.error('Get content history error:', error);
      return [];
    }
  }

  /**
   * Get moderation statistics
   */
  public static async getModerationStats(): Promise<ModerationStats> {
    try {
      const client = db.getClient();

      const [
        totalPending,
        totalFlagged,
        totalReviewed,
        flagsByCategory,
        actionsByType
      ] = await Promise.all([
        client.contentModerationQueue.count({
          where: { status: ModerationStatus.PENDING }
        }),
        client.contentModerationQueue.count({
          where: { status: ModerationStatus.FLAGGED }
        }),
        client.contentModerationQueue.count({
          where: { 
            status: { 
              in: [ModerationStatus.APPROVED, ModerationStatus.REJECTED] 
            } 
          }
        }),
        client.contentFlags.groupBy({
          by: ['flagCategory'],
          _count: { flagCategory: true }
        }),
        client.contentModerationHistory.groupBy({
          by: ['action'],
          _count: { action: true }
        })
      ]);

      // Calculate average review time
      const reviewedItems = await client.contentModerationQueue.findMany({
        where: {
          status: { 
            in: [ModerationStatus.APPROVED, ModerationStatus.REJECTED] 
          }
        },
        select: {
          flaggedAt: true,
          reviewedAt: true
        }
      });

      const averageReviewTime = reviewedItems.length > 0
        ? reviewedItems.reduce((sum, item) => {
            const reviewTime = item.reviewedAt!.getTime() - item.flaggedAt.getTime();
            return sum + reviewTime;
          }, 0) / reviewedItems.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      const flagsByCategoryMap: Record<FlagCategory, number> = {} as any;
      Object.values(FlagCategory).forEach(category => {
        flagsByCategoryMap[category] = 0;
      });
      flagsByCategory.forEach(item => {
        flagsByCategoryMap[item.flagCategory as FlagCategory] = item._count.flagCategory;
      });

      const actionsByTypeMap: Record<ModerationAction, number> = {} as any;
      Object.values(ModerationAction).forEach(action => {
        actionsByTypeMap[action] = 0;
      });
      actionsByType.forEach(item => {
        actionsByTypeMap[item.action as ModerationAction] = item._count.action;
      });

      return {
        totalPending,
        totalFlagged,
        totalReviewed,
        averageReviewTime,
        flagsByCategory: flagsByCategoryMap,
        actionsByType: actionsByTypeMap
      };
    } catch (error) {
      console.error('Get moderation stats error:', error);
      return {
        totalPending: 0,
        totalFlagged: 0,
        totalReviewed: 0,
        averageReviewTime: 0,
        flagsByCategory: {} as any,
        actionsByType: {} as any
      };
    }
  }

  /**
   * Auto-flag content based on suspicious patterns
   */
  public static async autoFlagContent(
    contentType: ContentType,
    contentId: string,
    reason: string,
    severity: SeverityLevel = SeverityLevel.MEDIUM
  ): Promise<void> {
    try {
      const client = db.getClient();

      // Get content data
      const contentData = await this.getContentData(contentType, contentId);
      if (!contentData) {
        return;
      }

      // Check if already in moderation queue
      const existingItem = await client.contentModerationQueue.findFirst({
        where: {
          contentType,
          contentId,
          status: {
            in: [ModerationStatus.PENDING, ModerationStatus.FLAGGED, ModerationStatus.UNDER_REVIEW]
          }
        }
      });

      if (existingItem) {
        return; // Already being moderated
      }

      // Calculate priority based on severity
      const priority = severity === SeverityLevel.CRITICAL 
        ? ModerationPriority.CRITICAL
        : severity === SeverityLevel.HIGH
        ? ModerationPriority.HIGH
        : ModerationPriority.MEDIUM;

      // Add to moderation queue
      await client.contentModerationQueue.create({
        data: {
          contentType,
          contentId,
          contentData: contentData.content,
          authorId: contentData.authorId,
          clubId: contentData.clubId,
          status: ModerationStatus.FLAGGED,
          priority,
          flagReason: reason,
          autoFlagged: true
        }
      });

      // Record moderation history
      await this.recordModerationHistory({
        contentType,
        contentId,
        action: ModerationAction.REJECT,
        reason: `Auto-flagged: ${reason}`,
        automated: true
      });

      // Log the auto-flagging
      await DatabaseUtils.logAudit({
        userRole: UserRole.SUPER_ADMIN, // System action
        action: 'CONTENT_AUTO_FLAGGED',
        resource: 'MODERATION',
        resourceId: contentId,
        changes: {
          contentType,
          reason,
          severity
        },
        success: true
      });
    } catch (error) {
      console.error('Auto-flag content error:', error);
    }
  }

  /**
   * Get content data based on type and ID
   */
  private static async getContentData(
    contentType: ContentType,
    contentId: string
  ): Promise<{
    content: any;
    authorId?: string;
    clubId?: string;
  } | null> {
    try {
      const client = db.getClient();

      switch (contentType) {
        case ContentType.ACTIVITY:
          const activity = await client.activity.findUnique({
            where: { id: contentId },
            include: { club: true }
          });
          if (!activity) return null;
          return {
            content: {
              title: activity.title,
              description: activity.description,
              location: activity.location,
              startDate: activity.startDate,
              endDate: activity.endDate
            },
            authorId: activity.createdBy,
            clubId: activity.clubId
          };

        case ContentType.CLUB_INFO:
          const club = await client.club.findUnique({
            where: { id: contentId }
          });
          if (!club) return null;
          return {
            content: {
              name: club.name,
              description: club.description
            },
            authorId: club.presidentId || undefined,
            clubId: club.id
          };

        case ContentType.APPLICATION:
          const application = await client.application.findUnique({
            where: { id: contentId }
          });
          if (!application) return null;
          return {
            content: {
              studentName: application.studentName,
              studentEmail: application.studentEmail,
              motivation: application.motivation
            },
            authorId: application.studentId || undefined,
            clubId: application.clubId
          };

        case ContentType.USER_PROFILE:
          const user = await client.user.findUnique({
            where: { id: contentId }
          });
          if (!user) return null;
          return {
            content: {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email
            },
            authorId: user.id
          };

        default:
          return null;
      }
    } catch (error) {
      console.error('Get content data error:', error);
      return null;
    }
  }

  /**
   * Calculate priority based on flag category and content
   */
  private static calculatePriority(
    flagCategory: FlagCategory,
    contentData: any
  ): ModerationPriority {
    // High priority categories
    if ([
      FlagCategory.HARASSMENT,
      FlagCategory.PRIVACY_VIOLATION,
      FlagCategory.COPYRIGHT_VIOLATION
    ].includes(flagCategory)) {
      return ModerationPriority.HIGH;
    }

    // Medium priority categories
    if ([
      FlagCategory.INAPPROPRIATE_CONTENT,
      FlagCategory.MISINFORMATION
    ].includes(flagCategory)) {
      return ModerationPriority.MEDIUM;
    }

    // Low priority categories
    return ModerationPriority.LOW;
  }

  /**
   * Apply moderation action to actual content
   */
  private static async applyModerationAction(
    contentType: ContentType,
    contentId: string,
    action: ModerationAction,
    editedContent?: any,
    performedBy?: string
  ): Promise<void> {
    try {
      const client = db.getClient();

      switch (action) {
        case ModerationAction.DELETE:
          await this.deleteContent(contentType, contentId);
          break;

        case ModerationAction.HIDE:
          await this.hideContent(contentType, contentId);
          break;

        case ModerationAction.EDIT:
          if (editedContent) {
            await this.editContent(contentType, contentId, editedContent);
          }
          break;

        case ModerationAction.WARN_USER:
          // TODO: Implement user warning system
          break;

        case ModerationAction.SUSPEND_USER:
          // TODO: Implement user suspension system
          break;

        // APPROVE and REJECT don't require content changes
        case ModerationAction.APPROVE:
        case ModerationAction.REJECT:
          break;
      }
    } catch (error) {
      console.error('Apply moderation action error:', error);
    }
  }

  /**
   * Delete content based on type
   */
  private static async deleteContent(contentType: ContentType, contentId: string): Promise<void> {
    const client = db.getClient();

    switch (contentType) {
      case ContentType.ACTIVITY:
        await client.activity.delete({ where: { id: contentId } });
        break;
      case ContentType.CLUB_INFO:
        // Don't delete club, just clear description
        await client.club.update({
          where: { id: contentId },
          data: { description: '[Content removed by moderation]' }
        });
        break;
      case ContentType.APPLICATION:
        await client.application.delete({ where: { id: contentId } });
        break;
      // USER_PROFILE deletion would be handled differently
    }
  }

  /**
   * Hide content based on type
   */
  private static async hideContent(contentType: ContentType, contentId: string): Promise<void> {
    const client = db.getClient();

    switch (contentType) {
      case ContentType.ACTIVITY:
        await client.activity.update({
          where: { id: contentId },
          data: { status: 'CANCELLED' }
        });
        break;
      case ContentType.CLUB_INFO:
        await client.club.update({
          where: { id: contentId },
          data: { isActive: false }
        });
        break;
      // Applications and user profiles don't have hide functionality
    }
  }

  /**
   * Edit content based on type
   */
  private static async editContent(
    contentType: ContentType,
    contentId: string,
    editedContent: any
  ): Promise<void> {
    const client = db.getClient();

    switch (contentType) {
      case ContentType.ACTIVITY:
        await client.activity.update({
          where: { id: contentId },
          data: {
            title: editedContent.title,
            description: editedContent.description,
            location: editedContent.location
          }
        });
        break;
      case ContentType.CLUB_INFO:
        await client.club.update({
          where: { id: contentId },
          data: {
            name: editedContent.name,
            description: editedContent.description
          }
        });
        break;
      // Applications typically shouldn't be edited
    }
  }

  /**
   * Record moderation history
   */
  private static async recordModerationHistory(data: {
    contentType: ContentType;
    contentId: string;
    action: ModerationAction;
    performedBy?: string;
    reason?: string;
    previousData?: any;
    newData?: any;
    automated: boolean;
  }): Promise<void> {
    try {
      const client = db.getClient();

      await client.contentModerationHistory.create({
        data: {
          contentType: data.contentType,
          contentId: data.contentId,
          action: data.action,
          performedBy: data.performedBy,
          reason: data.reason,
          previousData: data.previousData,
          newData: data.newData,
          automated: data.automated
        }
      });
    } catch (error) {
      console.error('Record moderation history error:', error);
    }
  }
}