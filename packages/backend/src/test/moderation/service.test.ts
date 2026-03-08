/**
 * Content Moderation Service Tests
 */

import {
  ContentType,
  ModerationStatus,
  ModerationPriority,
  ModerationAction,
  FlagCategory
} from '../../lib/moderation/types';
import { UserRole } from '@prisma/client';

// Mock the database
const mockPrismaClient = {
  contentFlags: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
  },
  contentModerationQueue: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  contentModerationHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
    groupBy: jest.fn(),
  },
  activity: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  club: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  application: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

const mockDb = {
  getClient: jest.fn(() => mockPrismaClient),
};

const mockDatabaseUtils = {
  logAudit: jest.fn(),
};

// Mock the imports
jest.mock('../../lib/database', () => ({
  db: mockDb,
  DatabaseUtils: mockDatabaseUtils,
}));

// Import after mocking
import { ModerationService } from '../../lib/moderation/service';

describe('ModerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('flagContent', () => {
    it('should successfully flag content', async () => {
      const flagRequest = {
        contentType: ContentType.ACTIVITY,
        contentId: 'activity-123',
        flagCategory: FlagCategory.INAPPROPRIATE_CONTENT,
        flagReason: 'This content is inappropriate',
        additionalInfo: 'Contains offensive language'
      };

      // Mock activity exists
      mockPrismaClient.activity.findUnique.mockResolvedValue({
        id: 'activity-123',
        title: 'Test Activity',
        description: 'Test description',
        createdBy: 'user-123',
        clubId: 'club-123'
      });

      // Mock no existing flag
      mockPrismaClient.contentFlags.findFirst.mockResolvedValue(null);

      // Mock no existing moderation item
      mockPrismaClient.contentModerationQueue.findFirst.mockResolvedValue(null);

      // Mock flag creation
      mockPrismaClient.contentFlags.create.mockResolvedValue({
        id: 'flag-123',
        ...flagRequest
      });

      // Mock moderation queue creation
      mockPrismaClient.contentModerationQueue.create.mockResolvedValue({
        id: 'moderation-123',
        contentType: flagRequest.contentType,
        contentId: flagRequest.contentId,
        status: ModerationStatus.FLAGGED
      });

      // Mock history creation
      mockPrismaClient.contentModerationHistory.create.mockResolvedValue({
        id: 'history-123'
      });

      const result = await ModerationService.flagContent('flagger-123', flagRequest);

      expect(result.success).toBe(true);
      expect(result.flagId).toBe('flag-123');
      expect(mockPrismaClient.contentFlags.create).toHaveBeenCalledWith({
        data: {
          contentType: flagRequest.contentType,
          contentId: flagRequest.contentId,
          flaggedBy: 'flagger-123',
          flagCategory: flagRequest.flagCategory,
          flagReason: flagRequest.flagReason,
          additionalInfo: flagRequest.additionalInfo
        }
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalled();
    });

    it('should fail if content does not exist', async () => {
      const flagRequest = {
        contentType: ContentType.ACTIVITY,
        contentId: 'nonexistent-activity',
        flagCategory: FlagCategory.SPAM,
        flagReason: 'This is spam'
      };

      // Mock activity does not exist
      mockPrismaClient.activity.findUnique.mockResolvedValue(null);

      const result = await ModerationService.flagContent('flagger-123', flagRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content not found');
    });

    it('should fail if user has already flagged the content', async () => {
      const flagRequest = {
        contentType: ContentType.ACTIVITY,
        contentId: 'activity-123',
        flagCategory: FlagCategory.HARASSMENT,
        flagReason: 'This is harassment'
      };

      // Mock activity exists
      mockPrismaClient.activity.findUnique.mockResolvedValue({
        id: 'activity-123',
        title: 'Test Activity'
      });

      // Mock existing flag
      mockPrismaClient.contentFlags.findFirst.mockResolvedValue({
        id: 'existing-flag',
        flaggedBy: 'flagger-123'
      });

      const result = await ModerationService.flagContent('flagger-123', flagRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already flagged this content');
    });
  });

  describe('reviewContent', () => {
    it('should successfully review and approve content', async () => {
      const moderationId = 'moderation-123';
      const reviewRequest = {
        action: ModerationAction.APPROVE,
        comments: 'Content is appropriate'
      };

      // Mock moderation item exists
      mockPrismaClient.contentModerationQueue.findUnique.mockResolvedValue({
        id: moderationId,
        contentType: ContentType.ACTIVITY,
        contentId: 'activity-123',
        contentData: { title: 'Test Activity' },
        status: ModerationStatus.FLAGGED
      });

      // Mock update
      mockPrismaClient.contentModerationQueue.update.mockResolvedValue({
        id: moderationId,
        status: ModerationStatus.APPROVED
      });

      // Mock flag resolution
      mockPrismaClient.contentFlags.updateMany.mockResolvedValue({ count: 1 });

      // Mock history creation
      mockPrismaClient.contentModerationHistory.create.mockResolvedValue({
        id: 'history-123'
      });

      const result = await ModerationService.reviewContent('reviewer-123', moderationId, reviewRequest);

      expect(result.success).toBe(true);
      expect(mockPrismaClient.contentModerationQueue.update).toHaveBeenCalledWith({
        where: { id: moderationId },
        data: {
          status: ModerationStatus.APPROVED,
          reviewedAt: expect.any(Date),
          reviewedBy: 'reviewer-123',
          reviewAction: ModerationAction.APPROVE,
          reviewComments: 'Content is appropriate',
          updatedAt: expect.any(Date)
        }
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalled();
    });

    it('should fail if moderation item does not exist', async () => {
      const moderationId = 'nonexistent-moderation';
      const reviewRequest = {
        action: ModerationAction.REJECT,
        comments: 'Content is inappropriate'
      };

      // Mock moderation item does not exist
      mockPrismaClient.contentModerationQueue.findUnique.mockResolvedValue(null);

      const result = await ModerationService.reviewContent('reviewer-123', moderationId, reviewRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Moderation item not found');
    });
  });

  describe('getContentQueue', () => {
    it('should return content queue with filters', async () => {
      const mockQueueItems = [
        {
          id: 'moderation-1',
          contentType: ContentType.ACTIVITY,
          contentId: 'activity-1',
          contentData: { title: 'Activity 1' },
          status: ModerationStatus.FLAGGED,
          priority: ModerationPriority.HIGH,
          flaggedAt: new Date(),
          createdAt: new Date(),
          author: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          club: { id: 'club-1', name: 'Test Club' },
          flaggedByUser: { id: 'flagger-1', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' }
        }
      ];

      mockPrismaClient.contentModerationQueue.findMany.mockResolvedValue(mockQueueItems);

      const filters = {
        status: ModerationStatus.FLAGGED,
        priority: ModerationPriority.HIGH,
        limit: 10,
        offset: 0
      };

      const result = await ModerationService.getContentQueue(filters);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'moderation-1',
        type: ContentType.ACTIVITY,
        content: { title: 'Activity 1' },
        authorId: undefined,
        clubId: undefined,
        status: ModerationStatus.FLAGGED,
        createdAt: expect.any(Date),
        flaggedAt: expect.any(Date),
        flagReason: undefined,
        priority: ModerationPriority.HIGH
      });

      expect(mockPrismaClient.contentModerationQueue.findMany).toHaveBeenCalledWith({
        where: {
          status: ModerationStatus.FLAGGED,
          priority: ModerationPriority.HIGH
        },
        orderBy: [
          { priority: 'desc' },
          { flaggedAt: 'desc' }
        ],
        take: 10,
        skip: 0,
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
    });
  });

  describe('getModerationStats', () => {
    it('should return moderation statistics', async () => {
      // Mock counts
      mockPrismaClient.contentModerationQueue.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(3) // flagged
        .mockResolvedValueOnce(10); // reviewed

      // Mock group by results
      mockPrismaClient.contentFlags.groupBy.mockResolvedValue([
        { flagCategory: FlagCategory.SPAM, _count: { flagCategory: 2 } },
        { flagCategory: FlagCategory.INAPPROPRIATE_CONTENT, _count: { flagCategory: 3 } }
      ]);

      mockPrismaClient.contentModerationHistory.groupBy.mockResolvedValue([
        { action: ModerationAction.APPROVE, _count: { action: 7 } },
        { action: ModerationAction.REJECT, _count: { action: 3 } }
      ]);

      // Mock reviewed items for average calculation
      mockPrismaClient.contentModerationQueue.findMany.mockResolvedValue([
        {
          flaggedAt: new Date('2026-01-01T10:00:00Z'),
          reviewedAt: new Date('2026-01-01T12:00:00Z') // 2 hours later
        },
        {
          flaggedAt: new Date('2024-01-01T14:00:00Z'),
          reviewedAt: new Date('2024-01-01T15:00:00Z') // 1 hour later
        }
      ]);

      const stats = await ModerationService.getModerationStats();

      expect(stats.totalPending).toBe(5);
      expect(stats.totalFlagged).toBe(3);
      expect(stats.totalReviewed).toBe(10);
      expect(stats.averageReviewTime).toBe(1.5); // Average of 2 and 1 hours
      expect(stats.flagsByCategory[FlagCategory.SPAM]).toBe(2);
      expect(stats.actionsByType[ModerationAction.APPROVE]).toBe(7);
    });
  });

  describe('autoFlagContent', () => {
    it('should auto-flag content based on suspicious patterns', async () => {
      // Mock activity exists
      mockPrismaClient.activity.findUnique.mockResolvedValue({
        id: 'activity-123',
        title: 'Suspicious Activity',
        description: 'This looks suspicious',
        createdBy: 'user-123',
        clubId: 'club-123'
      });

      // Mock no existing moderation item
      mockPrismaClient.contentModerationQueue.findFirst.mockResolvedValue(null);

      // Mock moderation queue creation
      mockPrismaClient.contentModerationQueue.create.mockResolvedValue({
        id: 'moderation-123',
        contentType: ContentType.ACTIVITY,
        contentId: 'activity-123',
        status: ModerationStatus.FLAGGED,
        autoFlagged: true
      });

      // Mock history creation
      mockPrismaClient.contentModerationHistory.create.mockResolvedValue({
        id: 'history-123'
      });

      await ModerationService.autoFlagContent(
        ContentType.ACTIVITY,
        'activity-123',
        'Detected spam pattern'
      );

      expect(mockPrismaClient.contentModerationQueue.create).toHaveBeenCalledWith({
        data: {
          contentType: ContentType.ACTIVITY,
          contentId: 'activity-123',
          contentData: {
            title: 'Suspicious Activity',
            description: 'This looks suspicious',
            location: undefined,
            startDate: undefined,
            endDate: undefined
          },
          authorId: 'user-123',
          clubId: 'club-123',
          status: ModerationStatus.FLAGGED,
          priority: ModerationPriority.MEDIUM,
          flagReason: 'Detected spam pattern',
          autoFlagged: true
        }
      });

      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
        userRole: UserRole.SUPER_ADMIN,
        action: 'CONTENT_AUTO_FLAGGED',
        resource: 'MODERATION',
        resourceId: 'activity-123',
        changes: {
          contentType: ContentType.ACTIVITY,
          reason: 'Detected spam pattern',
          severity: 'MEDIUM'
        },
        success: true
      });
    });

    it('should not auto-flag content that is already being moderated', async () => {
      // Mock activity exists
      mockPrismaClient.activity.findUnique.mockResolvedValue({
        id: 'activity-123',
        title: 'Activity',
        description: 'Description'
      });

      // Mock existing moderation item
      mockPrismaClient.contentModerationQueue.findFirst.mockResolvedValue({
        id: 'existing-moderation',
        status: ModerationStatus.PENDING
      });

      await ModerationService.autoFlagContent(
        ContentType.ACTIVITY,
        'activity-123',
        'Detected spam pattern'
      );

      // Should not create new moderation item
      expect(mockPrismaClient.contentModerationQueue.create).not.toHaveBeenCalled();
    });
  });
});