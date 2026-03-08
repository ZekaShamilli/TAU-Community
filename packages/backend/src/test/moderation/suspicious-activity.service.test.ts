/**
 * Suspicious Activity Service Tests
 */

import {
  SeverityLevel,
  AlertStatus
} from '../../lib/moderation/types';
import { UserRole } from '@prisma/client';

// Mock the database
const mockPrismaClient = {
  suspiciousActivityPatterns: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  suspiciousActivityAlerts: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  auditLog: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockDb = {
  getClient: jest.fn(() => mockPrismaClient),
};

const mockDatabaseUtils = {
  logAudit: jest.fn(),
};

const mockModerationService = {
  autoFlagContent: jest.fn(),
};

// Mock the imports
jest.mock('../../lib/database', () => ({
  db: mockDb,
  DatabaseUtils: mockDatabaseUtils,
}));

jest.mock('../../lib/moderation/service', () => ({
  ModerationService: mockModerationService,
}));

// Import after mocking
import { SuspiciousActivityService } from '../../lib/moderation/suspicious-activity.service';

describe('SuspiciousActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializePatterns', () => {
    it('should create default patterns if they do not exist', async () => {
      // Mock no existing patterns
      mockPrismaClient.suspiciousActivityPatterns.findFirst.mockResolvedValue(null);
      mockPrismaClient.suspiciousActivityPatterns.create.mockResolvedValue({ id: 'pattern-123' });

      await SuspiciousActivityService.initializePatterns();

      expect(mockPrismaClient.suspiciousActivityPatterns.create).toHaveBeenCalledTimes(5);
      expect(mockPrismaClient.suspiciousActivityPatterns.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patternName: 'Rapid Content Creation',
          patternDescription: 'User creates multiple pieces of content in a short time period',
          severityLevel: SeverityLevel.MEDIUM
        })
      });
    });

    it('should not create patterns if they already exist', async () => {
      // Mock existing pattern
      mockPrismaClient.suspiciousActivityPatterns.findFirst.mockResolvedValue({
        id: 'existing-pattern',
        patternName: 'Rapid Content Creation'
      });

      await SuspiciousActivityService.initializePatterns();

      expect(mockPrismaClient.suspiciousActivityPatterns.create).not.toHaveBeenCalled();
    });
  });

  describe('analyzeUserActivity', () => {
    it('should detect rapid content creation pattern', async () => {
      const userId = 'user-123';
      const action = 'ACTIVITY_CREATE';
      const resourceType = 'ACTIVITY';

      // Mock active patterns
      mockPrismaClient.suspiciousActivityPatterns.findMany.mockResolvedValue([
        {
          id: 'pattern-1',
          patternName: 'Rapid Content Creation',
          detectionRules: {
            timeWindow: 300, // 5 minutes
            maxActions: 3,
            actionTypes: ['ACTIVITY_CREATE']
          },
          severityLevel: SeverityLevel.MEDIUM
        }
      ]);

      // Mock audit log count (exceeds threshold)
      mockPrismaClient.auditLog.count.mockResolvedValue(5);

      // Mock no existing alert
      mockPrismaClient.suspiciousActivityAlerts.findFirst.mockResolvedValue(null);

      // Mock alert creation
      mockPrismaClient.suspiciousActivityAlerts.create.mockResolvedValue({
        id: 'alert-123',
        patternId: 'pattern-1',
        userId,
        severityLevel: SeverityLevel.MEDIUM
      });

      await SuspiciousActivityService.analyzeUserActivity(
        userId,
        action,
        resourceType,
        'resource-123',
        { title: 'Test Activity' }
      );

      expect(mockPrismaClient.auditLog.count).toHaveBeenCalledWith({
        where: {
          userId,
          action: { in: ['ACTIVITY_CREATE'] },
          timestamp: { gte: expect.any(Date) },
          success: true
        }
      });

      expect(mockPrismaClient.suspiciousActivityAlerts.create).toHaveBeenCalledWith({
        data: {
          patternId: 'pattern-1',
          userId,
          activityData: {
            action,
            resourceType,
            resourceId: 'resource-123',
            metadata: { title: 'Test Activity' },
            detectedAt: expect.any(Date)
          },
          severityLevel: SeverityLevel.MEDIUM,
          status: AlertStatus.OPEN
        }
      });

      expect(mockDatabaseUtils.logAudit).toHaveBeenCalled();
    });

    it('should not create duplicate alerts for same pattern and user', async () => {
      const userId = 'user-123';
      const action = 'ACTIVITY_CREATE';

      // Mock active patterns
      mockPrismaClient.suspiciousActivityPatterns.findMany.mockResolvedValue([
        {
          id: 'pattern-1',
          patternName: 'Rapid Content Creation',
          detectionRules: {
            timeWindow: 300,
            maxActions: 3,
            actionTypes: ['ACTIVITY_CREATE']
          },
          severityLevel: SeverityLevel.MEDIUM
        }
      ]);

      // Mock audit log count (exceeds threshold)
      mockPrismaClient.auditLog.count.mockResolvedValue(5);

      // Mock existing alert
      mockPrismaClient.suspiciousActivityAlerts.findFirst.mockResolvedValue({
        id: 'existing-alert',
        patternId: 'pattern-1',
        userId,
        status: AlertStatus.OPEN,
        activityData: { additionalOccurrences: 1 }
      });

      // Mock alert update
      mockPrismaClient.suspiciousActivityAlerts.update.mockResolvedValue({
        id: 'existing-alert'
      });

      await SuspiciousActivityService.analyzeUserActivity(
        userId,
        action,
        'ACTIVITY',
        'resource-123'
      );

      expect(mockPrismaClient.suspiciousActivityAlerts.create).not.toHaveBeenCalled();
      expect(mockPrismaClient.suspiciousActivityAlerts.update).toHaveBeenCalledWith({
        where: { id: 'existing-alert' },
        data: {
          activityData: {
            additionalOccurrences: 2,
            lastOccurrence: expect.any(Date)
          }
        }
      });
    });

    it('should auto-flag content for high severity alerts', async () => {
      const userId = 'user-123';
      const action = 'ACTIVITY_CREATE';
      const resourceType = 'ACTIVITY';
      const resourceId = 'activity-123';

      // Mock active patterns with high severity
      mockPrismaClient.suspiciousActivityPatterns.findMany.mockResolvedValue([
        {
          id: 'pattern-1',
          patternName: 'Spam Content Detection',
          detectionRules: {
            timeWindow: 300,
            maxActions: 2,
            actionTypes: ['ACTIVITY_CREATE']
          },
          severityLevel: SeverityLevel.HIGH
        }
      ]);

      // Mock audit log count (exceeds threshold)
      mockPrismaClient.auditLog.count.mockResolvedValue(3);

      // Mock no existing alert
      mockPrismaClient.suspiciousActivityAlerts.findFirst.mockResolvedValue(null);

      // Mock alert creation
      mockPrismaClient.suspiciousActivityAlerts.create.mockResolvedValue({
        id: 'alert-123',
        patternId: 'pattern-1',
        userId,
        severityLevel: SeverityLevel.HIGH
      });

      await SuspiciousActivityService.analyzeUserActivity(
        userId,
        action,
        resourceType,
        resourceId,
        { title: 'Suspicious Activity' }
      );

      expect(mockModerationService.autoFlagContent).toHaveBeenCalledWith(
        resourceType,
        resourceId,
        `Suspicious activity detected: ${action}`,
        SeverityLevel.HIGH
      );
    });
  });

  describe('getAlerts', () => {
    it('should return filtered alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          patternId: 'pattern-1',
          userId: 'user-1',
          activityData: { action: 'ACTIVITY_CREATE' },
          severityLevel: SeverityLevel.HIGH,
          detectedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          status: AlertStatus.OPEN,
          resolutionNotes: null,
          pattern: { patternName: 'Rapid Content Creation' },
          user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: UserRole.STUDENT },
          reviewedByUser: null
        }
      ];

      mockPrismaClient.suspiciousActivityAlerts.findMany.mockResolvedValue(mockAlerts);

      const filters = {
        status: AlertStatus.OPEN,
        severityLevel: SeverityLevel.HIGH,
        limit: 10,
        offset: 0
      };

      const result = await SuspiciousActivityService.getAlerts(filters);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'alert-1',
        patternId: 'pattern-1',
        userId: 'user-1',
        activityData: { action: 'ACTIVITY_CREATE' },
        severityLevel: SeverityLevel.HIGH,
        detectedAt: expect.any(Date),
        reviewedAt: undefined,
        reviewedBy: undefined,
        status: AlertStatus.OPEN,
        resolutionNotes: undefined
      });

      expect(mockPrismaClient.suspiciousActivityAlerts.findMany).toHaveBeenCalledWith({
        where: {
          status: AlertStatus.OPEN,
          severityLevel: SeverityLevel.HIGH
        },
        orderBy: [
          { severityLevel: 'desc' },
          { detectedAt: 'desc' }
        ],
        take: 10,
        skip: 0,
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
    });
  });

  describe('reviewAlert', () => {
    it('should successfully review an alert', async () => {
      const alertId = 'alert-123';
      const reviewerId = 'reviewer-123';
      const status = AlertStatus.RESOLVED;
      const resolutionNotes = 'False positive - user behavior is normal';

      mockPrismaClient.suspiciousActivityAlerts.update.mockResolvedValue({
        id: alertId,
        status
      });

      const result = await SuspiciousActivityService.reviewAlert(
        alertId,
        reviewerId,
        status,
        resolutionNotes
      );

      expect(result.success).toBe(true);
      expect(mockPrismaClient.suspiciousActivityAlerts.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: {
          status,
          reviewedAt: expect.any(Date),
          reviewedBy: reviewerId,
          resolutionNotes
        }
      });

      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
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
    });
  });

  describe('getStats', () => {
    it('should return suspicious activity statistics', async () => {
      // Mock counts
      mockPrismaClient.suspiciousActivityAlerts.count
        .mockResolvedValueOnce(15) // total
        .mockResolvedValueOnce(5)  // open
        .mockResolvedValueOnce(2); // critical

      // Mock group by results
      mockPrismaClient.suspiciousActivityAlerts.groupBy
        .mockResolvedValueOnce([
          { severityLevel: SeverityLevel.HIGH, _count: { severityLevel: 3 } },
          { severityLevel: SeverityLevel.MEDIUM, _count: { severityLevel: 7 } },
          { severityLevel: SeverityLevel.LOW, _count: { severityLevel: 5 } }
        ])
        .mockResolvedValueOnce([
          { status: AlertStatus.OPEN, _count: { status: 5 } },
          { status: AlertStatus.RESOLVED, _count: { status: 8 } },
          { status: AlertStatus.FALSE_POSITIVE, _count: { status: 2 } }
        ]);

      const stats = await SuspiciousActivityService.getStats();

      expect(stats.totalAlerts).toBe(15);
      expect(stats.openAlerts).toBe(5);
      expect(stats.criticalAlerts).toBe(2);
      expect(stats.alertsBySeverity[SeverityLevel.HIGH]).toBe(3);
      expect(stats.alertsByStatus[AlertStatus.RESOLVED]).toBe(8);
    });
  });

  describe('string similarity calculation', () => {
    it('should calculate similarity correctly', async () => {
      // This tests the private method indirectly through pattern checking
      const userId = 'user-123';
      const action = 'ACTIVITY_CREATE';

      // Mock similarity pattern
      mockPrismaClient.suspiciousActivityPatterns.findMany.mockResolvedValue([
        {
          id: 'pattern-1',
          patternName: 'Spam Content Detection',
          detectionRules: {
            type: 'similarity',
            timeWindow: 3600,
            minSimilarity: 0.8,
            checkFields: ['title', 'description'],
            actionTypes: ['ACTIVITY_CREATE']
          },
          severityLevel: SeverityLevel.HIGH
        }
      ]);

      // Mock recent audit logs with similar content
      mockPrismaClient.auditLog.findMany.mockResolvedValue([
        {
          changes: {
            title: 'Test Activity',
            description: 'This is a test activity'
          }
        }
      ]);

      // Mock no existing alert
      mockPrismaClient.suspiciousActivityAlerts.findFirst.mockResolvedValue(null);

      // Mock alert creation
      mockPrismaClient.suspiciousActivityAlerts.create.mockResolvedValue({
        id: 'alert-123'
      });

      const metadata = {
        title: 'Test Activity',
        description: 'This is a test activity' // Identical content
      };

      await SuspiciousActivityService.analyzeUserActivity(
        userId,
        action,
        'ACTIVITY',
        'activity-123',
        metadata
      );

      // Should detect high similarity and create alert
      expect(mockPrismaClient.suspiciousActivityAlerts.create).toHaveBeenCalled();
    });
  });
});