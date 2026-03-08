/**
 * Property-Based Tests for Suspicious Activity Detection
 * **Feature: tau-kays, Property 17: Suspicious activity detection**
 * **Validates: Requirements 9.5**
 */

import fc from 'fast-check';
import { UserRole } from '@prisma/client';
import { SeverityLevel, AlertStatus } from '../../lib/moderation/types';

// Mock Prisma client for testing
const mockPrismaClient = {
  suspiciousActivityPatterns: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  suspiciousActivityAlerts: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  auditLog: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

// Mock the database module
jest.mock('../../lib/database', () => ({
  db: {
    getClient: () => mockPrismaClient,
  },
  DatabaseUtils: {
    logAudit: jest.fn(),
  },
}));

// Mock the moderation service
jest.mock('../../lib/moderation/service', () => ({
  ModerationService: {
    autoFlagContent: jest.fn(),
  },
}));

// Mock the alert notification service
jest.mock('../../services/alert-notification.service', () => ({
  AlertNotificationService: {
    sendImmediateAlert: jest.fn(),
  },
}));

// Import after mocking
import { SuspiciousActivityService } from '../../lib/moderation/suspicious-activity.service';

describe('Property 17: Suspicious activity detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: System must detect and alert on suspicious user activity patterns
   * **Validates: Requirements 9.5**
   */
  test('should detect suspicious activity patterns and create alerts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user activity patterns
        fc.record({
          userId: fc.uuid(),
          actionCount: fc.integer({ min: 1, max: 20 }),
          actionType: fc.constantFrom('ACTIVITY_CREATE', 'APPLICATION_SUBMIT', 'LOGIN_FAILED', 'CLUB_READ'),
        }),
        async ({ userId, actionCount, actionType }) => {
          // Clear all mocks for this test iteration
          jest.clearAllMocks();
          
          // Mock active patterns
          const mockPattern = {
            id: 'test-pattern',
            patternName: 'Test Pattern',
            detectionRules: {
              timeWindow: 300,
              maxActions: 5,
              actionTypes: [actionType],
            },
            severityLevel: SeverityLevel.MEDIUM,
            isActive: true,
          };

          mockPrismaClient.suspiciousActivityPatterns.findMany.mockResolvedValue([mockPattern]);

          // Mock audit log count for frequency checking
          mockPrismaClient.auditLog.count.mockResolvedValue(actionCount);

          // Mock no existing alerts
          mockPrismaClient.suspiciousActivityAlerts.findFirst.mockResolvedValue(null);

          // Mock alert creation
          mockPrismaClient.suspiciousActivityAlerts.create.mockResolvedValue({
            id: 'alert-1',
            patternId: 'test-pattern',
            userId,
            severityLevel: SeverityLevel.MEDIUM,
            status: AlertStatus.OPEN,
          });

          // Analyze activity
          await SuspiciousActivityService.analyzeUserActivity(
            userId,
            actionType,
            'TEST_RESOURCE',
            'resource-id',
            { test: 'data' }
          );

          // Verify patterns were checked
          expect(mockPrismaClient.suspiciousActivityPatterns.findMany).toHaveBeenCalledWith({
            where: { isActive: true },
          });

          // If action count exceeds threshold, an alert should be created
          if (actionCount >= 5) {
            expect(mockPrismaClient.suspiciousActivityAlerts.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                patternId: 'test-pattern',
                userId,
                severityLevel: SeverityLevel.MEDIUM,
                status: AlertStatus.OPEN,
              }),
            });
          } else {
            // If threshold not exceeded, no alert should be created
            expect(mockPrismaClient.suspiciousActivityAlerts.create).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Alerts should be created with appropriate severity levels
   */
  test('should create alerts with correct severity levels based on patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          patternSeverity: fc.constantFrom(SeverityLevel.LOW, SeverityLevel.MEDIUM, SeverityLevel.HIGH, SeverityLevel.CRITICAL),
          userId: fc.uuid(),
          actionCount: fc.integer({ min: 1, max: 20 }),
        }),
        async ({ patternSeverity, userId, actionCount }) => {
          // Mock pattern with specific severity
          const mockPattern = {
            id: 'test-pattern',
            patternName: 'Test Pattern',
            detectionRules: {
              timeWindow: 300,
              maxActions: 5,
              actionTypes: ['TEST_ACTION'],
            },
            severityLevel: patternSeverity,
            isActive: true,
          };

          mockPrismaClient.suspiciousActivityPatterns.findMany.mockResolvedValue([mockPattern]);
          mockPrismaClient.auditLog.count.mockResolvedValue(actionCount);
          mockPrismaClient.suspiciousActivityAlerts.findFirst.mockResolvedValue(null);

          const mockAlert = {
            id: 'alert-1',
            patternId: 'test-pattern',
            userId,
            severityLevel: patternSeverity,
            status: AlertStatus.OPEN,
          };

          mockPrismaClient.suspiciousActivityAlerts.create.mockResolvedValue(mockAlert);

          // Analyze activity
          await SuspiciousActivityService.analyzeUserActivity(
            userId,
            'TEST_ACTION',
            'TEST_RESOURCE',
            'resource-id',
            { test: 'data' }
          );

          // If action count exceeds threshold, alert should be created with correct severity
          if (actionCount >= 5) {
            expect(mockPrismaClient.suspiciousActivityAlerts.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                severityLevel: patternSeverity,
              }),
            });
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property: Existing alerts should be updated instead of creating duplicates
   */
  test('should update existing alerts instead of creating duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          patternId: fc.uuid(),
          existingOccurrences: fc.integer({ min: 0, max: 10 }),
        }),
        async ({ userId, patternId, existingOccurrences }) => {
          // Mock pattern
          const mockPattern = {
            id: patternId,
            patternName: 'Test Pattern',
            detectionRules: {
              timeWindow: 300,
              maxActions: 1,
              actionTypes: ['TEST_ACTION'],
            },
            severityLevel: SeverityLevel.MEDIUM,
            isActive: true,
          };

          mockPrismaClient.suspiciousActivityPatterns.findMany.mockResolvedValue([mockPattern]);
          mockPrismaClient.auditLog.count.mockResolvedValue(5); // Exceeds threshold

          // Mock existing alert
          const existingAlert = {
            id: 'existing-alert',
            patternId,
            userId,
            activityData: {
              additionalOccurrences: existingOccurrences,
            },
            status: AlertStatus.OPEN,
            detectedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          };

          mockPrismaClient.suspiciousActivityAlerts.findFirst.mockResolvedValue(existingAlert);
          mockPrismaClient.suspiciousActivityAlerts.update.mockResolvedValue({
            ...existingAlert,
            activityData: {
              additionalOccurrences: existingOccurrences + 1,
              lastOccurrence: new Date(),
            },
          });

          // Analyze activity
          await SuspiciousActivityService.analyzeUserActivity(
            userId,
            'TEST_ACTION',
            'TEST_RESOURCE',
            'resource-id',
            { test: 'data' }
          );

          // Should update existing alert, not create new one
          expect(mockPrismaClient.suspiciousActivityAlerts.update).toHaveBeenCalledWith({
            where: { id: 'existing-alert' },
            data: {
              activityData: expect.objectContaining({
                additionalOccurrences: existingOccurrences + 1,
                lastOccurrence: expect.any(Date),
              }),
            },
          });

          // Should not create new alert
          expect(mockPrismaClient.suspiciousActivityAlerts.create).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Alert retrieval should respect filtering parameters
   */
  test('should retrieve alerts with proper filtering', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          status: fc.option(fc.constantFrom(AlertStatus.OPEN, AlertStatus.INVESTIGATING, AlertStatus.RESOLVED), { nil: undefined }),
          severityLevel: fc.option(fc.constantFrom(SeverityLevel.LOW, SeverityLevel.MEDIUM, SeverityLevel.HIGH), { nil: undefined }),
          userId: fc.option(fc.uuid(), { nil: undefined }),
          limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          offset: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
        }),
        async (filters) => {
          // Mock alert data
          const mockAlerts = [
            {
              id: 'alert-1',
              patternId: 'pattern-1',
              userId: filters.userId || 'user-1',
              activityData: { action: 'TEST_ACTION' },
              severityLevel: filters.severityLevel || SeverityLevel.MEDIUM,
              detectedAt: new Date(),
              reviewedAt: null,
              reviewedBy: null,
              status: filters.status || AlertStatus.OPEN,
              resolutionNotes: null,
              pattern: {
                patternName: 'Test Pattern',
              },
              user: {
                id: 'user-1',
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                role: UserRole.STUDENT,
              },
              reviewedByUser: null,
            },
          ];

          mockPrismaClient.suspiciousActivityAlerts.findMany.mockResolvedValue(mockAlerts);

          // Get alerts with filters
          const result = await SuspiciousActivityService.getAlerts(filters);

          // Verify database query was called with correct filters
          const expectedWhere: any = {};
          if (filters.status) expectedWhere.status = filters.status;
          if (filters.severityLevel) expectedWhere.severityLevel = filters.severityLevel;
          if (filters.userId) expectedWhere.userId = filters.userId;

          expect(mockPrismaClient.suspiciousActivityAlerts.findMany).toHaveBeenCalledWith({
            where: expectedWhere,
            orderBy: [
              { severityLevel: 'desc' },
              { detectedAt: 'desc' },
            ],
            take: filters.limit || 50,
            skip: filters.offset || 0,
            include: expect.any(Object),
          });

          // Verify result structure
          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            id: 'alert-1',
            patternId: 'pattern-1',
            userId: expect.any(String),
            severityLevel: expect.any(String),
            status: expect.any(String),
            detectedAt: expect.any(Date),
          });
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Alert review should update status and log the action
   */
  test('should properly review alerts and log the action', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertId: fc.uuid(),
          reviewerId: fc.uuid(),
          status: fc.constantFrom(AlertStatus.INVESTIGATING, AlertStatus.RESOLVED, AlertStatus.FALSE_POSITIVE),
          resolutionNotes: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
        }),
        async ({ alertId, reviewerId, status, resolutionNotes }) => {
          // Mock successful update
          mockPrismaClient.suspiciousActivityAlerts.update.mockResolvedValue({
            id: alertId,
            status,
            reviewedAt: new Date(),
            reviewedBy: reviewerId,
            resolutionNotes,
          });

          // Review the alert
          const result = await SuspiciousActivityService.reviewAlert(
            alertId,
            reviewerId,
            status,
            resolutionNotes
          );

          // Verify the alert was updated
          expect(mockPrismaClient.suspiciousActivityAlerts.update).toHaveBeenCalledWith({
            where: { id: alertId },
            data: {
              status,
              reviewedAt: expect.any(Date),
              reviewedBy: reviewerId,
              resolutionNotes,
            },
          });

          // Verify the result
          expect(result).toEqual({
            success: true,
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Statistics should accurately reflect alert data
   */
  test('should calculate accurate suspicious activity statistics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          totalAlerts: fc.integer({ min: 0, max: 100 }),
          openAlerts: fc.integer({ min: 0, max: 50 }),
          criticalAlerts: fc.integer({ min: 0, max: 10 }),
        }),
        async ({ totalAlerts, openAlerts, criticalAlerts }) => {
          // Mock database responses
          mockPrismaClient.suspiciousActivityAlerts.count
            .mockResolvedValueOnce(totalAlerts)
            .mockResolvedValueOnce(openAlerts)
            .mockResolvedValueOnce(criticalAlerts);

          mockPrismaClient.suspiciousActivityAlerts.groupBy
            .mockResolvedValueOnce([
              { severityLevel: SeverityLevel.LOW, _count: { severityLevel: 5 } },
              { severityLevel: SeverityLevel.MEDIUM, _count: { severityLevel: 10 } },
              { severityLevel: SeverityLevel.HIGH, _count: { severityLevel: 8 } },
              { severityLevel: SeverityLevel.CRITICAL, _count: { severityLevel: criticalAlerts } },
            ])
            .mockResolvedValueOnce([
              { status: AlertStatus.OPEN, _count: { status: openAlerts } },
              { status: AlertStatus.INVESTIGATING, _count: { status: 5 } },
              { status: AlertStatus.RESOLVED, _count: { status: 15 } },
            ]);

          // Get statistics
          const stats = await SuspiciousActivityService.getStats();

          // Verify the statistics
          expect(stats).toMatchObject({
            totalAlerts,
            openAlerts,
            criticalAlerts,
            alertsBySeverity: expect.objectContaining({
              [SeverityLevel.LOW]: 5,
              [SeverityLevel.MEDIUM]: 10,
              [SeverityLevel.HIGH]: 8,
              [SeverityLevel.CRITICAL]: criticalAlerts,
            }),
            alertsByStatus: expect.objectContaining({
              [AlertStatus.OPEN]: openAlerts,
              [AlertStatus.INVESTIGATING]: 5,
              [AlertStatus.RESOLVED]: 15,
            }),
          });
        }
      ),
      { numRuns: 15 }
    );
  });
});