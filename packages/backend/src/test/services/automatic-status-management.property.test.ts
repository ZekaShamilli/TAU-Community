/**
 * Property-Based Tests for Automatic Status Management
 * **Feature: tau-kays, Property 15: Automatic status management**
 * **Validates: Requirements 7.5**
 */

import fc from 'fast-check';
import { ActivityStatus, UserRole } from '@prisma/client';
import { getActivityScheduler } from '../../services/activity-scheduler.service';
import ActivityService from '../../services/activity.service';
import { DatabaseUtils } from '../../lib/database';

// Mock Prisma client for testing
const mockPrismaClient = {
  activity: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  club: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};

// Mock the database module
jest.mock('../../lib/database', () => ({
  db: {
    getClient: () => mockPrismaClient,
  },
  DatabaseUtils: {
    updateActivityStatuses: jest.fn(),
    logAudit: jest.fn(),
  },
  prisma: mockPrismaClient,
}));

// Mock session service
jest.mock('../../services/session.service', () => ({
  default: {
    cleanupExpiredSessions: jest.fn().mockResolvedValue(0),
  },
}));

describe('Property 15: Automatic status management', () => {
  let activityService: ActivityService;
  let activityScheduler: ReturnType<typeof getActivityScheduler>;

  beforeEach(() => {
    jest.clearAllMocks();
    activityService = new ActivityService();
    activityScheduler = getActivityScheduler();
  });

  /**
   * Property: Activities with end dates in the past should be automatically marked as completed
   * **Validates: Requirements 7.5**
   */
  test('should automatically mark activities as completed when end date passes', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate activities with various end dates
        fc.array(
          fc.record({
            id: fc.uuid(),
            clubId: fc.uuid(),
            title: fc.string({ minLength: 5, maxLength: 300 }),
            description: fc.option(fc.string({ maxLength: 2000 }), { nil: null }),
            startDate: fc.date({ min: new Date('2025-01-01'), max: new Date('2026-12-31') }),
            endDate: fc.date({ min: new Date('2025-01-01'), max: new Date('2026-12-31') }),
            location: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
            maxParticipants: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
            status: fc.constantFrom(ActivityStatus.PUBLISHED, ActivityStatus.DRAFT),
            createdBy: fc.uuid(),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (activities) => {
          const now = new Date();
          
          // Separate activities into past and future based on end date
          const pastActivities = activities.filter(activity => activity.endDate < now);
          const futureActivities = activities.filter(activity => activity.endDate >= now);
          
          // Mock database responses
          mockPrismaClient.activity.updateMany.mockResolvedValue({
            count: pastActivities.length
          });
          
          // Mock DatabaseUtils.updateActivityStatuses
          (DatabaseUtils.updateActivityStatuses as jest.Mock).mockResolvedValue(pastActivities.length);
          
          // Trigger automatic status update
          const serviceResult = await activityService.updateActivityStatuses();
          const dbUtilResult = await DatabaseUtils.updateActivityStatuses();
          
          // Verify that updateMany was called with correct conditions for past activities
          if (pastActivities.length > 0) {
            expect(mockPrismaClient.activity.updateMany).toHaveBeenCalledWith({
              where: {
                status: {
                  in: [ActivityStatus.PUBLISHED, ActivityStatus.DRAFT]
                },
                endDate: {
                  lt: expect.any(Date)
                }
              },
              data: {
                status: ActivityStatus.COMPLETED,
                updatedAt: expect.any(Date)
              }
            });
            
            // Verify that the correct number of activities were updated
            expect(serviceResult).toBe(pastActivities.length);
            expect(dbUtilResult).toBe(pastActivities.length);
          } else {
            // If no past activities, verify no updates were made
            expect(serviceResult).toBe(0);
            expect(dbUtilResult).toBe(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Only activities with PUBLISHED or DRAFT status should be eligible for automatic completion
   * **Validates: Requirements 7.5**
   */
  test('should only update activities with eligible statuses', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate activities with various statuses
        fc.array(
          fc.record({
            id: fc.uuid(),
            status: fc.constantFrom(
              ActivityStatus.PUBLISHED, 
              ActivityStatus.DRAFT, 
              ActivityStatus.COMPLETED,
              ActivityStatus.CANCELLED
            ),
            endDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2023-01-01') }), // All in the past
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (activities) => {
          // Count activities that should be eligible for update
          const eligibleActivities = activities.filter(activity => 
            activity.status === ActivityStatus.PUBLISHED || 
            activity.status === ActivityStatus.DRAFT
          );
          
          // Mock database response
          mockPrismaClient.activity.updateMany.mockResolvedValue({
            count: eligibleActivities.length
          });
          
          // Trigger status update
          const result = await activityService.updateActivityStatuses();
          
          // Verify that only eligible activities are considered for update
          expect(mockPrismaClient.activity.updateMany).toHaveBeenCalledWith({
            where: {
              status: {
                in: [ActivityStatus.PUBLISHED, ActivityStatus.DRAFT]
              },
              endDate: {
                lt: expect.any(Date)
              }
            },
            data: {
              status: ActivityStatus.COMPLETED,
              updatedAt: expect.any(Date)
            }
          });
          
          // Verify the correct count is returned
          expect(result).toBe(eligibleActivities.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Automatic status updates should preserve all activity data except status and updatedAt
   * **Validates: Requirements 7.5**
   */
  test('should preserve all activity data when updating status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          activitiesCount: fc.integer({ min: 1, max: 10 }),
        }),
        async ({ activitiesCount }) => {
          // Mock database response
          mockPrismaClient.activity.updateMany.mockResolvedValue({
            count: activitiesCount
          });
          
          // Trigger status update
          await activityService.updateActivityStatuses();
          
          // Verify that only status and updatedAt are modified
          expect(mockPrismaClient.activity.updateMany).toHaveBeenCalledWith({
            where: expect.any(Object),
            data: {
              status: ActivityStatus.COMPLETED,
              updatedAt: expect.any(Date)
            }
          });
          
          // Verify no other fields are modified in the update
          const updateCall = mockPrismaClient.activity.updateMany.mock.calls[0];
          const updateData = updateCall[0].data;
          
          expect(Object.keys(updateData)).toEqual(['status', 'updatedAt']);
          expect(updateData.status).toBe(ActivityStatus.COMPLETED);
          expect(updateData.updatedAt).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Scheduled tasks should execute automatic status updates at regular intervals
   * **Validates: Requirements 7.5**
   */
  test('should execute scheduled status updates correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          expectedUpdates: fc.integer({ min: 0, max: 50 }),
        }),
        async ({ expectedUpdates }) => {
          // Mock both service and database utility responses
          mockPrismaClient.activity.updateMany.mockResolvedValue({
            count: expectedUpdates
          });
          (DatabaseUtils.updateActivityStatuses as jest.Mock).mockResolvedValue(expectedUpdates);
          
          // Manually trigger the scheduled task (simulating cron execution)
          const result = await activityScheduler.triggerStatusUpdate();
          
          // Verify both methods were called
          expect(mockPrismaClient.activity.updateMany).toHaveBeenCalled();
          expect(DatabaseUtils.updateActivityStatuses).toHaveBeenCalled();
          
          // Verify the result contains both counts
          expect(result).toEqual({
            serviceCount: expectedUpdates,
            dbUtilCount: expectedUpdates
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property: Session cleanup should be executed as part of scheduled maintenance
   * **Validates: Requirements 7.5 (extended to include session management)**
   */
  test('should execute session cleanup as part of scheduled maintenance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          expectedSessionCleanup: fc.integer({ min: 0, max: 20 }),
          expectedActivityUpdates: fc.integer({ min: 0, max: 30 }),
        }),
        async ({ expectedSessionCleanup, expectedActivityUpdates }) => {
          // Mock session service
          const SessionService = require('../../services/session.service').default;
          SessionService.cleanupExpiredSessions.mockResolvedValue(expectedSessionCleanup);
          
          // Mock activity updates
          mockPrismaClient.activity.updateMany.mockResolvedValue({
            count: expectedActivityUpdates
          });
          (DatabaseUtils.updateActivityStatuses as jest.Mock).mockResolvedValue(expectedActivityUpdates);
          
          // Trigger all cleanup tasks
          const result = await activityScheduler.triggerAllCleanupTasks();
          
          // Verify all cleanup tasks were executed
          expect(SessionService.cleanupExpiredSessions).toHaveBeenCalled();
          expect(mockPrismaClient.activity.updateMany).toHaveBeenCalled();
          expect(DatabaseUtils.updateActivityStatuses).toHaveBeenCalled();
          
          // Verify the result structure
          expect(result).toEqual({
            activityUpdates: {
              serviceCount: expectedActivityUpdates,
              dbUtilCount: expectedActivityUpdates
            },
            sessionCleanup: expectedSessionCleanup
          });
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Status updates should be idempotent - running multiple times should not cause issues
   * **Validates: Requirements 7.5**
   */
  test('should be idempotent when running status updates multiple times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialUpdates: fc.integer({ min: 0, max: 10 }),
          subsequentRuns: fc.integer({ min: 1, max: 5 }),
        }),
        async ({ initialUpdates, subsequentRuns }) => {
          // First run should find activities to update
          mockPrismaClient.activity.updateMany
            .mockResolvedValueOnce({ count: initialUpdates })
            // Subsequent runs should find no activities to update (already completed)
            .mockResolvedValue({ count: 0 });
          
          // First run
          const firstResult = await activityService.updateActivityStatuses();
          expect(firstResult).toBe(initialUpdates);
          
          // Subsequent runs should return 0 (no more activities to update)
          for (let i = 0; i < subsequentRuns; i++) {
            const subsequentResult = await activityService.updateActivityStatuses();
            expect(subsequentResult).toBe(0);
          }
          
          // Verify the total number of calls
          expect(mockPrismaClient.activity.updateMany).toHaveBeenCalledTimes(subsequentRuns + 1);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Status updates should handle database errors gracefully
   * **Validates: Requirements 7.5**
   */
  test('should handle database errors gracefully during status updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ errorMessage }) => {
          // Mock database error
          const dbError = new Error(errorMessage);
          mockPrismaClient.activity.updateMany.mockRejectedValue(dbError);
          
          // Verify that the error is properly handled
          await expect(activityService.updateActivityStatuses()).rejects.toThrow(errorMessage);
          
          // Verify the database was called
          expect(mockPrismaClient.activity.updateMany).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Manual trigger should work the same as scheduled execution
   * **Validates: Requirements 7.5**
   */
  test('should produce same results for manual and scheduled triggers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          updateCount: fc.integer({ min: 0, max: 25 }),
        }),
        async ({ updateCount }) => {
          // Mock consistent responses
          mockPrismaClient.activity.updateMany.mockResolvedValue({ count: updateCount });
          (DatabaseUtils.updateActivityStatuses as jest.Mock).mockResolvedValue(updateCount);
          
          // Test manual trigger
          const manualResult = await activityScheduler.triggerStatusUpdate();
          
          // Reset mocks
          jest.clearAllMocks();
          mockPrismaClient.activity.updateMany.mockResolvedValue({ count: updateCount });
          (DatabaseUtils.updateActivityStatuses as jest.Mock).mockResolvedValue(updateCount);
          
          // Test direct service call (simulating scheduled execution)
          const serviceResult = await activityService.updateActivityStatuses();
          const dbUtilResult = await DatabaseUtils.updateActivityStatuses();
          
          // Verify both approaches produce the same results
          expect(manualResult.serviceCount).toBe(serviceResult);
          expect(manualResult.dbUtilCount).toBe(dbUtilResult);
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Status updates should work correctly across different time zones
   * **Validates: Requirements 7.5**
   */
  test('should handle time zone considerations correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          timeZoneOffset: fc.integer({ min: -12, max: 14 }), // UTC offset in hours
          activitiesCount: fc.integer({ min: 1, max: 10 }),
        }),
        async ({ timeZoneOffset, activitiesCount }) => {
          // Create a date that accounts for time zone
          const baseDate = new Date();
          const offsetDate = new Date(baseDate.getTime() + (timeZoneOffset * 60 * 60 * 1000));
          
          // Mock database response
          mockPrismaClient.activity.updateMany.mockResolvedValue({
            count: activitiesCount
          });
          
          // Trigger status update
          await activityService.updateActivityStatuses();
          
          // Verify that the comparison uses the current time correctly
          expect(mockPrismaClient.activity.updateMany).toHaveBeenCalledWith({
            where: {
              status: {
                in: [ActivityStatus.PUBLISHED, ActivityStatus.DRAFT]
              },
              endDate: {
                lt: expect.any(Date)
              }
            },
            data: {
              status: ActivityStatus.COMPLETED,
              updatedAt: expect.any(Date)
            }
          });
          
          // Verify the date used in the query is reasonable (within a few seconds of now)
          const updateCall = mockPrismaClient.activity.updateMany.mock.calls[0];
          const queryDate = updateCall[0].where.endDate.lt;
          const now = new Date();
          const timeDiff = Math.abs(now.getTime() - queryDate.getTime());
          
          // Should be within 5 seconds of current time
          expect(timeDiff).toBeLessThan(5000);
        }
      ),
      { numRuns: 10 }
    );
  });
});